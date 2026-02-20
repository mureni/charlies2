import { readFileSync } from "fs";
import { resolve } from "path";
import type { StandardMessage } from "@/contracts";
import type { InteractionResult } from "@/core/interactionTypes";
import type { InteractionPlugin } from "@/plugins/types";
import { resolvePluginPaths } from "@/plugins/paths";

interface BibleVerse {
   ref: string;
   text: string;
}

interface BibleBook {
   book: string;
   verses: BibleVerse[];
}

const bibleFileName = "kjv.json";
let cachedWords: string[] | undefined;

const loadBibleWords = (): string[] => {
   if (cachedWords) return cachedWords;
   const { resourcesDir } = resolvePluginPaths("quotes");
   const filePath = resolve(resourcesDir, bibleFileName);
   const raw = readFileSync(filePath, "utf8");
   const bible = JSON.parse(raw.trim()) as BibleBook[];
   const words: string[] = [];
   for (const book of bible) {
      for (const verse of book.verses) {
         const pieces = verse.text.split(/\s+/).filter(Boolean);
         words.push(...pieces);
      }
   }
   cachedWords = words;
   return words;
};

const prayMatcher = /^!?pray/ui;

const execute = async (): Promise<InteractionResult> => {
   const output: InteractionResult = { results: [], modifications: { ProcessSwaps: true }, directedTo: undefined };
   try {
      const allWords = loadBibleWords();
      if (allWords.length === 0) {
         output.results = [{ contents: "no words found to pray with" }];
         return output;
      }
      const numWords = 20 + Math.floor(Math.random() * 30);
      const response: string[] = ["God says..."];
      for (let wordCount = 0; wordCount <= numWords; wordCount++) {
         const wordNumber = Math.floor(Math.random() * allWords.length);
         response.push(allWords[wordNumber]);
      }
      output.results = [{ contents: response.join(" ") }];
      return output;
   } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.results = [{ contents: `Unable to pray right now: ${message}` }];
      return output;
   }
};

const prayPlugin: InteractionPlugin = {
   id: "pray",
   name: "Pray - Talk to God",
   description: "Sends your thoughts to God and retrieves a message in return (orig. by Terry Davis)",
   usage: "pray or !pray",
   icon: "icons/pray.gif",
   matcher: prayMatcher,
   execute: async (_context: StandardMessage) => execute()
};

const plugins = [prayPlugin];
export { plugins };
