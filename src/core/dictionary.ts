import { existsSync, readFileSync, writeFileSync } from "fs";
import { checkFilePath } from "@/utils";

let cached: Set<string> | null = null;

const normalizeWord = (word: string): string => word.trim().toLowerCase();

const parseWordList = (content: string): Set<string> => {
   const words = content
      .split(/\r?\n/u)
      .map(normalizeWord)
      .filter(Boolean);
   return new Set(words);
};

const parseTrainer = (content: string): Set<string> => {
   const matches = content.match(/[a-z0-9][a-z0-9'_-]*/giu) ?? [];
   return new Set(matches.map(token => token.toLowerCase()));
};

const loadDictionary = (): Set<string> => {
   if (cached) return cached;
   const dataPath = checkFilePath("data", "dictionary.txt");
   const resourcePath = checkFilePath("resources", "dictionary.txt");
   if (existsSync(dataPath)) {
      cached = parseWordList(readFileSync(dataPath, "utf8"));
      return cached;
   }
   if (existsSync(resourcePath)) {
      cached = parseWordList(readFileSync(resourcePath, "utf8"));
      return cached;
   }
   const trainerPath = checkFilePath("resources", "default-trainer.txt");
   if (existsSync(trainerPath)) {
      cached = parseTrainer(readFileSync(trainerPath, "utf8"));
      try {
         const sorted = Array.from(cached.values()).sort();
         writeFileSync(dataPath, `${sorted.join("\n")}\n`, "utf8");
      } catch {
         // ignore write failures
      }
      return cached;
   }
   cached = new Set<string>();
   return cached;
};

const isCommonWord = (word: string): boolean => {
   if (!word) return false;
   return loadDictionary().has(normalizeWord(word));
};

export { loadDictionary, isCommonWord };
