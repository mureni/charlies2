import { Message, cleanMessage, TriggerResult, Trigger } from "../core";
import { Madlibs } from "../controllers";

const madlib: Trigger = {
   id: "madlib",
   name: "Madlib generator",
   description: "Generates a random paragraph based on known madlib patterns",
   usage: "madlib",
   command: /^madlib$/ui,
   action: () => {
      const output: TriggerResult = { results: [], modifications: { ProcessSwaps: true }, directedTo: undefined };            
      const size = 2 + Math.floor(Math.random() * 3);
      output.results = [Madlibs.generate(size)];
      return output;
   }
}

const madlibAddWord: Trigger = {
   id: "madlib-add-word",
   name: "Add madlib word",
   description: "Adds a word of <type> to the madlib generator; if <type> does not exist, it will create the new vocabulary type and add the word",
   usage: "madlib-add-word <type> <word>",
   command: /^madlib-add-word (?<type>.+?) (?<word>.+)$/ui,
   action: (_context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: { Case: 'unchanged' }, directedTo: undefined };
      if (matches.length === 0 || !matches.groups) return output;
      
      const vocabType = `[${cleanMessage((matches.groups.type || "").trim(), { Case: "lower", UseEndearments: true })}]`;
      const word = cleanMessage((matches.groups.word || "").trim(), { Case: "lower", UseEndearments: true });
      
      const success = Madlibs.addVocab(vocabType, word);
      output.results = [success ? `added \`${word}\` to vocabulary list for \`${vocabType}\`` : `can't do that, try again`];
      
      return output;
   }
}
const madlibRemoveWord: Trigger = {
   id: "madlib-remove-word",
   name: "Remove madlib word",
   description: "Removes a word of <type> from the madlib generator",
   usage: "madlib-remove-word <type> <word>",
   command: /^madlib-remove-word (?<type>.+?) (?<word>.+)$/ui,
   action: (_context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" }, directedTo: undefined };
      if (matches.length === 0 || !matches.groups) return output;
      
      const vocabType = `[${cleanMessage((matches.groups.type || "").trim(), { Case: "lower", UseEndearments: true })}]`;
      const word = cleanMessage((matches.groups.word || "").trim(), { Case: "lower", UseEndearments: true });
      
      const success = Madlibs.removeVocab(vocabType, word);
      output.results = [success ? `removed \`${word}\` from vocabulary list for \`${vocabType}\`` : `can't do that, try again`];
      
      return output;
   }
}

const madlibAddPattern: Trigger = {
   id: "madlib-add-pattern",
   name: "Add madlib pattern",
   description: "Adds a pattern to the madlib generator -- Pattern consists of static words mixed with vocabulary types enclosed in square brackets (i.e. \`[noun]\` or other defined types); unknown vocabulary types will be ignored",
   usage: "madlib-add-pattern <pattern>",
   example: "madlib-add-pattern the [adverb] [noun] [verb]ed [preposition] the [noun].",
   command: /^madlib-add-pattern (?<pattern>.+)$/ui,
   action: (_context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" }, directedTo: undefined };
      if (matches.length === 0 || !matches.groups) return output;
      
      const pattern = cleanMessage((matches.groups.pattern || "").trim(), { Case: "lower", UseEndearments: true });

      const success = Madlibs.addPattern(pattern);
      output.results = [success ? `added \`${pattern}\` to pattern list` : `can't do that, try again`];
      
      return output;
   }
}

const madlibRemovePattern: Trigger = {
   id: "madlib-remove-pattern",
   name: "Remove madlib pattern",
   description: "Removes a pattern from the madlib generator, if it exists",
   usage: "madlib-remove-pattern <pattern>",
   command: /^madlib-remove-pattern (?<pattern>.+)$/ui,
   action: (_context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" }, directedTo: undefined };
      if (matches.length === 0 || !matches.groups) return output;
      
      const pattern = cleanMessage((matches.groups.pattern || "").trim(), { Case: "lower", UseEndearments: true });
      
      const success = Madlibs.removePattern(pattern);
      output.results = [success ? `removed \`${pattern}\` from pattern list` : `can't do that, try again`];
      
      return output;
   }
}

const triggers = [ madlib, madlibAddWord, madlibRemoveWord, madlibAddPattern, madlibRemovePattern ];
export { triggers };