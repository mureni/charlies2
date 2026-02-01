import type { TriggerResult } from "@/core/triggerTypes";
import type { CoreMessage, PlatformCommandInteraction } from "@/platform";
import type { PluginCommand, TriggerPlugin } from "@/plugins/types";
import { registerSwapFilters, unregisterSwapFilters } from "@/filters/swaps";
import { Swaps } from "@/filters/swaps/manager";
import type { SwapScope } from "@/filters/swaps/types";

const swapMatcher = /^swap\s+(?<pattern>.+?)\s+with\s+(?<replacement>.+)$/ui;
const unswapMatcher = /^unswap\s+(?<pattern>.+)$/ui;
const swapListMatcher = /^swap-list$/ui;
const baseModifications = { Case: "unchanged" } as const;

const formatRule = (rule: { pattern: string; replacement: string; applyLearn: boolean; applyRespond: boolean; mode: string; caseSensitive: boolean }): string => {
   const flags = [
      rule.applyLearn ? "learn" : null,
      rule.applyRespond ? "respond" : null
   ].filter(Boolean).join("/");
   const mode = rule.mode === "regex" ? "regex" : "word";
   const caseFlag = rule.caseSensitive ? "case" : "nocase";
   return `\`${rule.pattern} → ${rule.replacement || "<blank>"}\` (${mode}, ${caseFlag}, ${flags || "disabled"})`;
};

interface SwapScopeInput {
   scope?: string;
   scopeId?: string;
   authorId?: string;
   channelId?: string;
   guildId?: string;
   isGroupDm?: boolean;
}

const resolveScopeInput = (input: SwapScopeInput): { scope: SwapScope; scopeId: string } | Error => {
   const scopeRaw = input.scope?.trim();
   const scope = scopeRaw ? Swaps.normalizeScope(scopeRaw) : null;
   const defaultScope: SwapScope = input.isGroupDm ? "group" : (input.guildId ? "guild" : "user");
   const resolvedScope = scope ?? defaultScope;
   let scopeId = (input.scopeId ?? "").trim();
   if (!scopeId) {
      if (resolvedScope === "guild") scopeId = input.guildId ?? "";
      if (resolvedScope === "channel") scopeId = input.channelId ?? "";
      if (resolvedScope === "user") scopeId = input.authorId ?? "";
      if (resolvedScope === "group") {
         if (input.isGroupDm && input.channelId) scopeId = Swaps.groupIdForDm(input.channelId);
      }
   }
   if (!resolvedScope) return new Error("invalid scope");
   if (!scopeId) return new Error("scope id required");
   return { scope: resolvedScope, scopeId };
};

const resolveScopeFromMessage = (context: CoreMessage): { scope: SwapScope; scopeId: string } | Error =>
   resolveScopeInput({
      authorId: context.authorId,
      channelId: context.channelId,
      guildId: context.guildId,
      isGroupDm: Boolean(context.channel?.isGroupDm)
   });

const resolveScopeFromCommand = (interaction: PlatformCommandInteraction, scope?: string, scopeId?: string): { scope: SwapScope; scopeId: string } | Error =>
   resolveScopeInput({
      scope,
      scopeId,
      authorId: interaction.userId,
      channelId: interaction.channelId,
      guildId: interaction.guildId
   });

const executeSwap = async (context: CoreMessage, matches?: RegExpMatchArray): Promise<TriggerResult> => {
   const pattern = matches?.groups?.pattern?.trim() ?? "";
   const replacement = matches?.groups?.replacement?.trim() ?? "";
   if (!pattern) {
      return { results: [{ contents: "usage: swap <word> with <replacement>" }], modifications: baseModifications };
   }
   const resolved = resolveScopeFromMessage(context);
   if (resolved instanceof Error) {
      return { results: [{ contents: resolved.message }], modifications: baseModifications };
   }
   const { scope, scopeId } = resolved;
   const rule = Swaps.saveRule({
      scope,
      scopeId,
      pattern,
      replacement,
      mode: "word",
      caseSensitive: false,
      applyLearn: true,
      applyRespond: true
   });
   if (rule instanceof Error) {
      return { results: [{ contents: rule.message }], modifications: baseModifications };
   }
   return {
      results: [{ contents: `swap saved for ${scope} ${scopeId}: ${formatRule(rule)}` }],
      modifications: baseModifications
   };
};

const executeUnswap = async (context: CoreMessage, matches?: RegExpMatchArray): Promise<TriggerResult> => {
   const pattern = matches?.groups?.pattern?.trim() ?? "";
   if (!pattern) {
      return { results: [{ contents: "usage: unswap <word> or unswap all" }], modifications: baseModifications };
   }
   const resolved = resolveScopeFromMessage(context);
   if (resolved instanceof Error) {
      return { results: [{ contents: resolved.message }], modifications: baseModifications };
   }
   const { scope, scopeId } = resolved;
   if (pattern.toLowerCase() === "all" || pattern.toLowerCase() === "<all>") {
      Swaps.clearScope(scope, scopeId);
      return { results: [{ contents: `cleared swap rules for ${scope} ${scopeId}` }], modifications: baseModifications };
   }
   const removed = Swaps.removeRulesByPattern(scope, scopeId, pattern);
   if (removed === 0) {
      return { results: [{ contents: `no swap rules found for ${pattern} in ${scope} ${scopeId}` }], modifications: baseModifications };
   }
   return { results: [{ contents: `removed ${removed} swap rule(s) for ${scope} ${scopeId}` }], modifications: baseModifications };
};

const executeSwapList = async (context: CoreMessage): Promise<TriggerResult> => {
   const resolved = resolveScopeFromMessage(context);
   if (resolved instanceof Error) {
      return { results: [{ contents: resolved.message }], modifications: baseModifications };
   }
   const { scope, scopeId } = resolved;
   const rules = Swaps.listRules({ scope, scopeId });
   if (rules.length === 0) {
      return { results: [{ contents: `no swap rules for ${scope} ${scopeId}` }], modifications: baseModifications };
   }
   return { results: [{ contents: rules.map(formatRule).join("\n") }], modifications: baseModifications };
};

const swapCommand: PluginCommand = {
   name: "swap",
   description: "Create or update a swap rule.",
   options: [
      { name: "pattern", description: "Pattern to replace", type: "string", required: true },
      { name: "replacement", description: "Replacement text", type: "string", required: true },
      { name: "scope", description: "user | group | guild | channel", type: "string", required: false },
      { name: "scopeId", description: "Scope id (optional)", type: "string", required: false },
      { name: "mode", description: "word | regex", type: "string", required: false },
      { name: "caseSensitive", description: "Case sensitive", type: "boolean", required: false },
      { name: "applyLearn", description: "Apply on learn", type: "boolean", required: false },
      { name: "applyRespond", description: "Apply on respond", type: "boolean", required: false },
      { name: "enabled", description: "Rule enabled", type: "boolean", required: false }
   ],
   usage: "swap <pattern> <replacement> [scope] [scopeId]",
   form: {
      title: "Create Swap Rule",
      submitLabel: "Save",
      fields: [
         { name: "pattern", label: "Pattern", type: "string", required: true, placeholder: "fudge" },
         { name: "replacement", label: "Replacement", type: "string", required: true, placeholder: "frick" },
         { name: "scope", label: "Scope (user/group/guild/channel)", type: "string", required: false },
         { name: "scopeId", label: "Scope Id", type: "string", required: false },
         { name: "mode", label: "Mode (word/regex)", type: "string", required: false },
         { name: "caseSensitive", label: "Case sensitive", type: "boolean", required: false },
         { name: "applyLearn", label: "Apply on learn", type: "boolean", required: false },
         { name: "applyRespond", label: "Apply on respond", type: "boolean", required: false },
         { name: "enabled", label: "Enabled", type: "boolean", required: false }
      ]
   }
};

const swapRemoveCommand: PluginCommand = {
   name: "swap-remove",
   description: "Remove swap rules by pattern or clear scope.",
   options: [
      { name: "pattern", description: "Pattern to remove", type: "string", required: false },
      { name: "all", description: "Clear all rules for scope", type: "boolean", required: false },
      { name: "scope", description: "user | group | guild | channel", type: "string", required: false },
      { name: "scopeId", description: "Scope id (optional)", type: "string", required: false }
   ],
   usage: "swap-remove [pattern] [scope] [scopeId]",
   form: {
      title: "Remove Swap Rule",
      submitLabel: "Remove",
      fields: [
         { name: "pattern", label: "Pattern", type: "string", required: false, placeholder: "fudge" },
         { name: "all", label: "Clear all rules in scope", type: "boolean", required: false },
         { name: "scope", label: "Scope (user/group/guild/channel)", type: "string", required: false },
         { name: "scopeId", label: "Scope Id", type: "string", required: false }
      ]
   }
};

const swapListCommand: PluginCommand = {
   name: "swap-list",
   description: "List swap rules for a scope.",
   options: [
      { name: "scope", description: "user | group | guild | channel", type: "string", required: false },
      { name: "scopeId", description: "Scope id (optional)", type: "string", required: false }
   ],
   usage: "swap-list [scope] [scopeId]"
};

const handleCommand = async (interaction: PlatformCommandInteraction): Promise<void> => {
   if (interaction.command === "swap") {
      const pattern = String(interaction.options.pattern ?? "").trim();
      const replacement = String(interaction.options.replacement ?? "").trim();
      if (!pattern) {
         await interaction.reply({ contents: "pattern is required" });
         return;
      }
      const resolved = resolveScopeFromCommand(interaction, String(interaction.options.scope ?? ""), String(interaction.options.scopeId ?? ""));
      if (resolved instanceof Error) {
         await interaction.reply({ contents: resolved.message });
         return;
      }
      const modeRaw = String(interaction.options.mode ?? "").trim().toLowerCase();
      const rule = Swaps.saveRule({
         scope: resolved.scope,
         scopeId: resolved.scopeId,
         pattern,
         replacement,
         mode: modeRaw === "regex" ? "regex" : "word",
         caseSensitive: Boolean(interaction.options.caseSensitive),
         applyLearn: interaction.options.applyLearn === undefined ? true : Boolean(interaction.options.applyLearn),
         applyRespond: interaction.options.applyRespond === undefined ? true : Boolean(interaction.options.applyRespond),
         enabled: interaction.options.enabled === undefined ? true : Boolean(interaction.options.enabled)
      });
      if (rule instanceof Error) {
         await interaction.reply({ contents: rule.message });
         return;
      }
      await interaction.reply({ contents: `swap saved for ${resolved.scope} ${resolved.scopeId}: ${formatRule(rule)}` });
      return;
   }
   if (interaction.command === "swap-remove") {
      const pattern = String(interaction.options.pattern ?? "").trim();
      const clearAll = Boolean(interaction.options.all);
      const resolved = resolveScopeFromCommand(interaction, String(interaction.options.scope ?? ""), String(interaction.options.scopeId ?? ""));
      if (resolved instanceof Error) {
         await interaction.reply({ contents: resolved.message });
         return;
      }
      if (!pattern && !clearAll) {
         await interaction.reply({ contents: "pattern or all=true is required" });
         return;
      }
      if (clearAll) {
         Swaps.clearScope(resolved.scope, resolved.scopeId);
         await interaction.reply({ contents: `cleared swap rules for ${resolved.scope} ${resolved.scopeId}` });
         return;
      }
      const removed = Swaps.removeRulesByPattern(resolved.scope, resolved.scopeId, pattern);
      if (removed === 0) {
         await interaction.reply({ contents: `no swap rules found for ${pattern} in ${resolved.scope} ${resolved.scopeId}` });
         return;
      }
      await interaction.reply({ contents: `removed ${removed} swap rule(s) for ${resolved.scope} ${resolved.scopeId}` });
      return;
   }
   if (interaction.command === "swap-list") {
      const resolved = resolveScopeFromCommand(interaction, String(interaction.options.scope ?? ""), String(interaction.options.scopeId ?? ""));
      if (resolved instanceof Error) {
         await interaction.reply({ contents: resolved.message });
         return;
      }
      const rules = Swaps.listRules({ scope: resolved.scope, scopeId: resolved.scopeId });
      if (rules.length === 0) {
         await interaction.reply({ contents: `no swap rules for ${resolved.scope} ${resolved.scopeId}` });
         return;
      }
      await interaction.reply({ contents: rules.map(formatRule).join("\n") });
   }
};

const swapPlugin: TriggerPlugin = {
   id: "swap",
   name: "Swap words",
   description: "Adds words to a swap list that can be applied when learning or responding.",
   usage: "swap [this] with [that]",
   matcher: swapMatcher,
   execute: executeSwap,
   commands: [swapCommand, swapRemoveCommand, swapListCommand],
   onCommand: handleCommand,
   onLoad: () => registerSwapFilters(),
   onUnload: () => unregisterSwapFilters()
};

const unswapPlugin: TriggerPlugin = {
   id: "unswap",
   name: "Unswap word",
   description: "Remove a word from the current swap list.",
   usage: "unswap [this]/all",
   matcher: unswapMatcher,
   execute: executeUnswap
};

const swapListPlugin: TriggerPlugin = {
   id: "swap-list",
   name: "Swap list",
   description: "Displays the swap list for this context.",
   usage: "swap-list",
   matcher: swapListMatcher,
   execute: executeSwapList
};

const plugins = [swapPlugin, unswapPlugin, swapListPlugin];

export { plugins };
