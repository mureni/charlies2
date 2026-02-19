import type { FSWatcher } from "fs";
import { watch } from "fs";
import { resolve } from "path";
import { cleanMessage } from "@/core";
import { log } from "@/core/log";
import type { InteractionResult } from "@/core/interactionTypes";
import type { StandardMessage } from "@/contracts";
import { escapeRegExp } from "@/utils";
import { resolvePluginPaths } from "@/plugins/paths";
import type { PluginCommand, InteractionPlugin } from "@/plugins/types";
import { Madlibs } from "./madlibs/manager";

const madlibMatcher = /^madlib(?<category>\s+.+)?$/ui;
const madlibEditMatcher = /^madlib edit(?:\s+(?<category>.+))?$/ui;
const madlibAddWordMatcher = /^madlib-add-word (?<category>.+?) (?<type>.+?) (?<word>.+)$/ui;
const madlibRemoveWordMatcher = /^madlib-remove-word (?<category>.+?) (?<type>.+?) (?<word>.+)$/ui;
const madlibAddPatternMatcher = /^madlib-add-pattern (?<category>.+?) (?<pattern>.+)$/ui;
const madlibRemovePatternMatcher = /^madlib-remove-pattern (?<category>.+?) (?<pattern>.+)$/ui;
const madlibSessionMatcher = /^[\s\S]+$/u;

type SessionStage =
   | "menu"
   | "add-word-type"
   | "add-word-word"
   | "remove-word-type"
   | "remove-word-word"
   | "add-pattern"
   | "remove-pattern";

interface MadlibSession {
   channelId: string;
   userId: string;
   category: string;
   stage: SessionStage;
   pendingType?: string;
}

const sessions = new Map<string, MadlibSession>();
const sessionKey = (context: StandardMessage): string => `${context.channelId}:${context.authorId}`;
const isDirectMessage = (context: StandardMessage): boolean => context.channel?.scope === "dm" || !context.guildId;
const { resourcesDir, dataDir } = resolvePluginPaths("madlibs");
const builtinsDir = resolve(resourcesDir, "builtins");
const baseDir = resolve(resourcesDir, "base");
const metaOverridesPath = resolve(dataDir, "meta.json");
const watchDirs = [builtinsDir, baseDir, metaOverridesPath];
let watchers: FSWatcher[] = [];
let watching = false;
let watchTimer: NodeJS.Timeout | undefined;

const scheduleRefresh = (): void => {
   if (watchTimer) clearTimeout(watchTimer);
   watchTimer = setTimeout(() => {
      Madlibs.refreshBuiltins();
      Madlibs.refreshBaseCategories();
      Madlibs.refreshMetaOverrides();
      refreshCommands();
   }, 200);
};

const startWatching = (): void => {
   if (watching) return;
   watching = true;
   for (const dir of watchDirs) {
      try {
         const watcher = watch(dir, () => {
            scheduleRefresh();
         });
         watchers.push(watcher);
      } catch (error: unknown) {
         const message = error instanceof Error ? error.message : String(error);
         log(`Madlibs watch failed for ${dir}: ${message}`, "warn");
      }
   }
};

const stopWatching = (): void => {
   watching = false;
   if (watchTimer) {
      clearTimeout(watchTimer);
      watchTimer = undefined;
   }
   for (const watcher of watchers) {
      watcher.close();
   }
   watchers = [];
};

const baseCommands: PluginCommand[] = [
   {
      name: "madlib-edit",
      description: "Start a DM-only edit session for a madlib category (supports tokenized vocab).",
      usage: "madlib edit <category>",
      example: "madlib edit general",
      fallbackMatcher: madlibEditMatcher
   },
   {
      name: "madlib-add-word",
      description: "Adds a word of <type> to madlibs for <category>. Supports #, [####], [A-Z], [a-z], {2,4}.",
      usage: "madlib-add-word <category> <type> <word>",
      example: "madlib-add-word general noun INC-####",
      fallbackMatcher: madlibAddWordMatcher,
      form: {
         title: "Add Madlib Word",
         fields: [
            { name: "category", label: "Category", type: "string", required: true, placeholder: "general" },
            { name: "type", label: "Type (without brackets)", type: "string", required: true, placeholder: "noun" },
            { name: "word", label: "Word", type: "string", required: true, placeholder: "INC-[####]" }
         ]
      }
   },
   {
      name: "madlib-remove-word",
      description: "Removes a word of <type> from the madlib generator for <category>.",
      usage: "madlib-remove-word <category> <type> <word>",
      fallbackMatcher: madlibRemoveWordMatcher,
      form: {
         title: "Remove Madlib Word",
         fields: [
            { name: "category", label: "Category", type: "string", required: true, placeholder: "general" },
            { name: "type", label: "Type (without brackets)", type: "string", required: true, placeholder: "noun" },
            { name: "word", label: "Word", type: "string", required: true, placeholder: "lantern" }
         ]
      }
   },
   {
      name: "madlib-add-pattern",
      description: "Adds a pattern to the madlib generator for <category>.",
      usage: "madlib-add-pattern <category> <pattern>",
      example: "madlib-add-pattern general the [adverb] [noun] [verb]ed [preposition] the [noun].",
      fallbackMatcher: madlibAddPatternMatcher,
      form: {
         title: "Add Madlib Pattern",
         fields: [
            { name: "category", label: "Category", type: "string", required: true, placeholder: "general" },
            { name: "pattern", label: "Pattern", type: "string", required: true, placeholder: "The [adj] [noun] likes to [verb]." }
         ]
      }
   },
   {
      name: "madlib-remove-pattern",
      description: "Removes a pattern from the madlib generator for <category>.",
      usage: "madlib-remove-pattern <category> <pattern>",
      fallbackMatcher: madlibRemovePatternMatcher,
      form: {
         title: "Remove Madlib Pattern",
         fields: [
            { name: "category", label: "Category", type: "string", required: true, placeholder: "general" },
            { name: "pattern", label: "Pattern", type: "string", required: true, placeholder: "The [adj] [noun] likes to [verb]." }
         ]
      }
   },
   {
      name: "madlib",
      description: "Generates a random paragraph based on known madlib patterns, with optional category.",
      options: [
         {
            name: "category",
            description: "Madlib category",
            type: "string",
            required: false
         }
      ],
      usage: "madlib [category]",
      example: "madlib general",
      fallbackMatcher: madlibMatcher
   }
];

const commands: PluginCommand[] = [];
let commandsReady = false;
const sessionCommand: PluginCommand = {
   name: "madlib-session",
   description: "internal",
   usage: "madlib-session",
   fallbackMatcher: madlibSessionMatcher,
   hidden: true
};

const buildBuiltinMatcher = (name: string, matcher?: string, matcherFlags?: string): RegExp => {
   if (!matcher) return new RegExp(`^${escapeRegExp(name)}$`, "ui");
   try {
      return new RegExp(matcher, matcherFlags ?? "ui");
   } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Madlibs builtin matcher invalid for ${name}: ${message}`, "warn");
      return new RegExp(`^${escapeRegExp(name)}$`, "ui");
   }
};

const buildBuiltinCommands = (): PluginCommand[] => {
   const commands = Madlibs.listCommandCategories();
   return commands.map((entry) => ({
      name: entry.id,
      description: entry.description ?? `Generates a ${entry.name} paragraph.`,
      usage: entry.usage ?? entry.id,
      example: entry.example,
      fallbackMatcher: buildBuiltinMatcher(entry.id, entry.matcher, entry.matcherFlags)
   }));
};

const refreshCommands = (): void => {
   const builtinCommands = buildBuiltinCommands();
   commands.splice(0, commands.length, ...baseCommands, ...builtinCommands, sessionCommand);
   const builtinNames = builtinCommands.map(command => command.name);
   madlibsPlugin.usage = builtinNames.length > 0
      ? `${builtinNames.join(" | ")} | madlib [category]`
      : "madlib [category]";
   commandsReady = true;
};

const ensureCommandsReady = (): void => {
   if (commandsReady) return;
   refreshCommands();
};

const resolveCommand = (content: string): { name: string; match: RegExpMatchArray } | undefined => {
   ensureCommandsReady();
   for (const command of commands) {
      if (!command.fallbackMatcher) continue;
      const match = content.match(command.fallbackMatcher);
      if (match) return { name: command.name, match };
   }
   return undefined;
};

const readonlyNotice = (category: string): InteractionResult => ({
   results: [{ contents: `\`${category}\` is read-only` }],
   modifications: { Case: "unchanged" }
});

const blockedNotice = (category: string): InteractionResult => ({
   results: [{ contents: `\`${category}\` is disabled in this context` }],
   modifications: { Case: "unchanged" }
});

const sessionMenu = (category: string): InteractionResult => ({
   results: [
      {
         contents:
            `Editing \`${category}\`.\n` +
            `Choose an action:\n` +
            `1) Add word\n` +
            `2) Remove word\n` +
            `3) Add pattern\n` +
            `4) Remove pattern\n` +
            `5) List vocab\n` +
            `6) List patterns\n` +
            `7) Export\n` +
            `8) Save\n` +
            `9) Cancel\n` +
            `Tip: words can use # or [####], [A-Z], [a-z], {2,4} (escape with \\).`
      }
   ],
   modifications: { Case: "unchanged" }
});

const sessionListSummary = (category: string): InteractionResult => {
   const snapshot = Madlibs.getCategorySnapshot(category);
   if (!snapshot?.merged) {
      return { results: [{ contents: "no data found for that category" }], modifications: { Case: "unchanged" } };
   }
   const vocabTypes = Object.keys(snapshot.merged.vocab);
   const vocabSummary = vocabTypes.length === 0
      ? "none"
      : vocabTypes.map(type => `${type} (${snapshot.merged?.vocab[type].length ?? 0})`).join(", ");
   const patternCount = snapshot.merged.patterns.length;
   return {
      results: [
         {
            contents:
               `Category: \`${category}\`\n` +
               `Patterns: ${patternCount}\n` +
               `Vocab: ${vocabSummary}`
         }
      ],
      modifications: { Case: "unchanged" }
   };
};

const sessionExport = (category: string): InteractionResult => {
   const snapshot = Madlibs.getCategorySnapshot(category);
   if (!snapshot) {
      return { results: [{ contents: "no data found for that category" }], modifications: { Case: "unchanged" } };
   }
   const payload = {
      id: category,
      overlay: snapshot.overlay ?? { patterns: [], vocab: {}, tombstones: { patterns: [], vocab: {} } }
   };
   return {
      results: [
         {
            contents: `\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``
         }
      ],
      modifications: { Case: "unchanged" }
   };
};

const handleSessionInput = async (context: StandardMessage, session: MadlibSession): Promise<InteractionResult> => {
   const content = context.content.trim();
   const lower = content.toLowerCase();

   if (lower === "9" || lower === "cancel") {
      sessions.delete(sessionKey(context));
      return { results: [{ contents: "Session cancelled." }], modifications: { Case: "unchanged" } };
   }

   if (session.stage === "menu") {
      if (lower === "1" || lower === "add word") {
         session.stage = "add-word-type";
         return { results: [{ contents: "Enter vocab type (without brackets):" }], modifications: { Case: "unchanged" } };
      }
      if (lower === "2" || lower === "remove word") {
         session.stage = "remove-word-type";
         return { results: [{ contents: "Enter vocab type (without brackets):" }], modifications: { Case: "unchanged" } };
      }
      if (lower === "3" || lower === "add pattern") {
         session.stage = "add-pattern";
         return { results: [{ contents: "Enter pattern (use [type] tokens):" }], modifications: { Case: "unchanged" } };
      }
      if (lower === "4" || lower === "remove pattern") {
         session.stage = "remove-pattern";
         return { results: [{ contents: "Enter pattern to remove:" }], modifications: { Case: "unchanged" } };
      }
      if (lower === "5" || lower === "list vocab") {
         return sessionListSummary(session.category);
      }
      if (lower === "6" || lower === "list patterns") {
         const snapshot = Madlibs.getCategorySnapshot(session.category);
         const patterns = snapshot?.merged?.patterns ?? [];
         const contents = patterns.length === 0 ? "No patterns found." : patterns.map(item => `- ${item}`).join("\n");
         return { results: [{ contents }], modifications: { Case: "unchanged" } };
      }
      if (lower === "7" || lower === "export") return sessionExport(session.category);
      if (lower === "8" || lower === "save") {
         sessions.delete(sessionKey(context));
         return { results: [{ contents: "Session saved and closed." }], modifications: { Case: "unchanged" } };
      }
      return sessionMenu(session.category);
   }

   if (session.stage === "add-word-type") {
      session.pendingType = content;
      session.stage = "add-word-word";
      return { results: [{ contents: "Enter word (supports # or [####], [A-Z], [a-z], {2,4}):" }], modifications: { Case: "unchanged" } };
   }

   if (session.stage === "remove-word-type") {
      session.pendingType = content;
      session.stage = "remove-word-word";
      return { results: [{ contents: "Enter word:" }], modifications: { Case: "unchanged" } };
   }

   if (session.stage === "add-word-word") {
      const vocabType = `[${(session.pendingType ?? "").trim()}]`;
      const success = Madlibs.addVocab(session.category, vocabType, content);
      session.stage = "menu";
      session.pendingType = undefined;
      return {
         results: [{ contents: success ? `Added \`${content}\` to \`${vocabType}\`.` : "Can't do that, try again." }],
         modifications: { Case: "unchanged" }
      };
   }

   if (session.stage === "remove-word-word") {
      const vocabType = `[${(session.pendingType ?? "").trim()}]`;
      const success = Madlibs.removeVocab(session.category, vocabType, content);
      session.stage = "menu";
      session.pendingType = undefined;
      return {
         results: [{ contents: success ? `Removed \`${content}\` from \`${vocabType}\`.` : "Can't do that, try again." }],
         modifications: { Case: "unchanged" }
      };
   }

   if (session.stage === "add-pattern") {
      const success = Madlibs.addPattern(session.category, content);
      session.stage = "menu";
      return {
         results: [{ contents: success ? "Pattern added." : "Can't do that, try again." }],
         modifications: { Case: "unchanged" }
      };
   }

   if (session.stage === "remove-pattern") {
      const success = Madlibs.removePattern(session.category, content);
      session.stage = "menu";
      return {
         results: [{ contents: success ? "Pattern removed." : "Can't do that, try again." }],
         modifications: { Case: "unchanged" }
      };
   }

   session.stage = "menu";
   return sessionMenu(session.category);
};

const execute = async (context: StandardMessage): Promise<InteractionResult> => {
   const resolved = resolveCommand(context.content);
   if (!resolved) return { results: [], modifications: { Case: "unchanged" } };

   if (resolved.name === "madlib-session") {
      const key = sessionKey(context);
      const session = sessions.get(key);
      if (!session || !isDirectMessage(context)) {
         return { results: [], modifications: { Case: "unchanged" } };
      }
      return handleSessionInput(context, session);
   }

   if (resolved.name === "madlib-edit") {
      if (!isDirectMessage(context)) {
         return {
            results: [{ contents: "Madlib edit sessions are only available in direct messages." }],
            modifications: { Case: "unchanged" }
         };
      }
      const category = await cleanMessage((resolved.match.groups?.category ?? "general").trim(), {
         Case: "lower"
      });
      if (Madlibs.isBuiltinCategory(category)) return readonlyNotice(category);
      const key = sessionKey(context);
      const session: MadlibSession = {
         channelId: context.channelId,
         userId: context.authorId,
         category,
         stage: "menu"
      };
      sessions.set(key, session);
      return sessionMenu(category);
   }

   if (Madlibs.isBuiltinCategory(resolved.name)) {
      if (!Madlibs.isCategoryAllowed(context, resolved.name)) return blockedNotice(resolved.name);
      const size = 6 + Math.floor(Math.random() * 3);
      return { results: [{ contents: Madlibs.generate(size, resolved.name) }], modifications: { ProcessSwaps: true } };
   }

   if (resolved.name === "madlib") {
      const category = await cleanMessage((resolved.match.groups?.category ?? "general").trim(), {
         Case: "lower"
      });
      if (!Madlibs.isCategoryAllowed(context, category)) return blockedNotice(category);
      const size = 2 + Math.floor(Math.random() * 3);
      return { results: [{ contents: Madlibs.generate(size, category) }], modifications: { ProcessSwaps: true } };
   }

   if (!resolved.match.groups) {
      return { results: [], modifications: { Case: "unchanged" } };
   }

   if (resolved.name === "madlib-add-word" || resolved.name === "madlib-remove-word") {
      const category = await cleanMessage((resolved.match.groups.category ?? "general").trim(), {
         Case: "lower"
      });
      if (Madlibs.isBuiltinCategory(category)) return readonlyNotice(category);
      const vocabType = `[${await cleanMessage((resolved.match.groups.type ?? "").trim(), {
         Case: "lower"
      })}]`;
      const word = await cleanMessage((resolved.match.groups.word ?? "").trim(), {
         Case: "lower"
      });
      const success =
         resolved.name === "madlib-add-word"
            ? Madlibs.addVocab(category, vocabType, word)
            : Madlibs.removeVocab(category, vocabType, word);
      return {
         results: [
            {
               contents: success
                  ? `${resolved.name === "madlib-add-word" ? "added" : "removed"} \`${word}\` ${resolved.name === "madlib-add-word" ? "to" : "from"} \`${category}\` vocabulary list for \`${vocabType}\``
                  : "can't do that, try again"
            }
         ],
         modifications: { Case: "unchanged" }
      };
   }

   if (resolved.name === "madlib-add-pattern" || resolved.name === "madlib-remove-pattern") {
      const category = await cleanMessage((resolved.match.groups.category ?? "general").trim(), {
         Case: "lower"
      });
      if (Madlibs.isBuiltinCategory(category)) return readonlyNotice(category);
      const pattern = await cleanMessage((resolved.match.groups.pattern ?? "").trim(), {
         Case: "lower"
      });
      const success =
         resolved.name === "madlib-add-pattern"
            ? Madlibs.addPattern(category, pattern)
            : Madlibs.removePattern(category, pattern);
      return {
         results: [
            {
               contents: success
                  ? `${resolved.name === "madlib-add-pattern" ? "added" : "removed"} \`${pattern}\` ${resolved.name === "madlib-add-pattern" ? "to" : "from"} pattern list for \`${category}\``
                  : "can't do that, try again"
            }
         ],
         modifications: { Case: "unchanged" }
      };
   }

   return { results: [], modifications: { Case: "unchanged" } };
};

const madlibsPlugin: InteractionPlugin = {
   id: "madlibs",
   name: "Madlib generator",
   description: "Pattern-driven nonsense generator with built-in and user-supplied vocabularies (supports tokenized vocab).",
   usage: "madlib [category]",
   commands,
   execute,
   onLoad: () => {
      Madlibs.refreshBuiltins();
      Madlibs.refreshBaseCategories();
      Madlibs.refreshAccessConfig();
      Madlibs.refreshMetaOverrides();
      refreshCommands();
      startWatching();
   },
   onUnload: () => {
      stopWatching();
   }
};

const plugins = [madlibsPlugin];
export { plugins };
