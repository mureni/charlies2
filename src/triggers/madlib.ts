import { CoreMessage, cleanMessage, TriggerResult, Trigger } from "../core";
import { Madlibs } from "../controllers";

const madlib: Trigger = {
   id: "madlib",
   name: "Madlib generator",
   description: "Generates a random paragraph based on known madlib patterns, with optional category",
   usage: "madlib [category]",
   command: /^madlib(?<category>\s+.+)?$/ui,
   action: async (_context: CoreMessage, matches?: RegExpMatchArray) => {
      const output: TriggerResult = { results: [], modifications: { ProcessSwaps: true }, directedTo: undefined };            
      
      const category = await cleanMessage((matches?.groups?.category ?? "general").trim(), { Case: "lower", UseEndearments: true });      
      const size = 2 + Math.floor(Math.random() * 3);
      output.results = [{contents: Madlibs.generate(size, category)}];
      return output;
   }
}

const madlibAddWord: Trigger = {
   id: "madlib-add-word",
   name: "Add madlib word",
   description: "Adds a word of <type> to the madlib generator for <category>; if <category> or <type> does not exist, it will create the new vocabulary category and type and add the word",
   usage: "madlib-add-word <category> <type> <word>",
   command: /^madlib-add-word (?<category>.+?) (?<type>.+?) (?<word>.+)$/ui,
   action: async (_context: CoreMessage, matches?: RegExpMatchArray) => {
      const output: TriggerResult = { results: [], modifications: { Case: 'unchanged' }, directedTo: undefined };
      if (!matches || matches.length === 0 || !matches.groups) return output;

      const category = await cleanMessage((matches.groups.category ?? "general").trim(), { Case: "lower", UseEndearments: true });      
      const vocabType = `[${await cleanMessage((matches.groups.type ?? "").trim(), { Case: "lower", UseEndearments: true })}]`;
      const word = await cleanMessage((matches.groups.word ?? "").trim(), { Case: "lower", UseEndearments: true });
      
      const success = Madlibs.addVocab(category, vocabType, word);
      output.results = [{ contents: success ? `added \`${word}\` to \`${category}\` vocabulary list for \`${vocabType}\`` : `can't do that, try again` }];
      
      return output;
   }
}
const madlibRemoveWord: Trigger = {
   id: "madlib-remove-word",
   name: "Remove madlib word",
   description: "Removes a word of <type> from the madlib generator for <category>",
   usage: "madlib-remove-word <category> <type> <word>",
   command: /^madlib-remove-word (?<category>.+?) (?<type>.+?) (?<word>.+)$/ui,
   action: async (_context: CoreMessage, matches?: RegExpMatchArray) => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" }, directedTo: undefined };
      if (!matches || matches.length === 0 || !matches.groups) return output;
      
      const category = await cleanMessage((matches.groups.category ?? "general").trim(), { Case: "lower", UseEndearments: true });      
      const vocabType = `[${await cleanMessage((matches.groups.type ?? "").trim(), { Case: "lower", UseEndearments: true })}]`;
      const word = await cleanMessage((matches.groups.word ?? "").trim(), { Case: "lower", UseEndearments: true });
      
      const success = Madlibs.removeVocab(category, vocabType, word);
      output.results = [{ contents: success ? `removed \`${word}\` from \`${category}\` vocabulary list for \`${vocabType}\`` : `can't do that, try again` }];
      
      return output;
   }
}

const madlibAddPattern: Trigger = {
   id: "madlib-add-pattern",
   name: "Add madlib pattern",
   description: "Adds a pattern to the madlib generator for <category> -- Pattern consists of static words mixed with vocabulary types enclosed in square brackets (i.e. \`[noun]\` or other defined types); unknown vocabulary types will be ignored",
   usage: "madlib-add-pattern <category> <pattern>",
   example: "madlib-add-pattern general the [adverb] [noun] [verb]ed [preposition] the [noun].",
   command: /^madlib-add-pattern (?<category>.+?) (?<pattern>.+)$/ui,
   action: async (_context: CoreMessage, matches?: RegExpMatchArray) => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" }, directedTo: undefined };
      if (!matches || matches.length === 0 || !matches.groups) return output;
      
      const category = await cleanMessage((matches.groups.category ?? "general").trim(), { Case: "lower", UseEndearments: true });      
      const pattern = await cleanMessage((matches.groups.pattern || "").trim(), { Case: "lower", UseEndearments: true });

      const success = Madlibs.addPattern(category, pattern);
      output.results = [{ contents: success ? `added \`${pattern}\` to pattern list for \`${category}\`` : `can't do that, try again` }];
      
      return output;
   }
}

const madlibRemovePattern: Trigger = {
   id: "madlib-remove-pattern",
   name: "Remove madlib pattern",
   description: "Removes a pattern from the madlib generator for <category>, if it exists",
   usage: "madlib-remove-pattern <category> <pattern>",
   command: /^madlib-remove-pattern (?<category>.+?) (?<pattern>.+)$/ui,
   action: async (_context: CoreMessage, matches?: RegExpMatchArray) => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" }, directedTo: undefined };
      if (!matches || matches.length === 0 || !matches.groups) return output;
      
      const category = await cleanMessage((matches.groups.category ?? "general").trim(), { Case: "lower", UseEndearments: true });      
      const pattern = await cleanMessage((matches.groups.pattern || "").trim(), { Case: "lower", UseEndearments: true });
      
      const success = Madlibs.removePattern(category, pattern);
      output.results = [ { contents: success ? `removed \`${pattern}\` from pattern list for \`${category}\`` : `can't do that, try again` }];
      
      return output;
   }
}

const triggers = [ madlib, madlibAddWord, madlibRemoveWord, madlibAddPattern, madlibRemovePattern ];
export { triggers };
