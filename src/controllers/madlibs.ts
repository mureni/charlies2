import { existsSync, readFileSync, writeFileSync } from "fs";
import { checkFilePath } from "../utils";

const DATA_FILE = checkFilePath("data", "madlibs.json");

class Madlibs {
   public static patterns: Set<string> = new Set<string>();
   public static vocab: Map<string, Set<string>> = new Map<string, Set<string>>();

   public static load(filename: string = DATA_FILE): boolean | Error {      
      if (!existsSync(filename)) return new Error(`Unable to load madlibs data file '${filename}': file does not exist.`);
      const data = JSON.parse(readFileSync(filename, "utf8"));
      
      if (!Reflect.has(data, "vocab") || !Reflect.has(data, "patterns")) return false;

      for (const vocabType of Object.keys(data.vocab)) {                  
         const words = new Set<string>();         
         const wordArray: string[] = Array.from(data.vocab[vocabType]) || [];
         for (const word of wordArray) {
            words.add(word);
         }
         Madlibs.vocab.set(vocabType, words);
      }
      
      Madlibs.patterns = new Set<string>(data.patterns);      

      return true;
   }

   public static save(filename: string = DATA_FILE): boolean | Error {      
      const data: { vocab: { [vocabType: string]: string[] }, patterns: string[] } = { vocab: {}, patterns: [] };
      if (Madlibs.vocab.size === 0) return new Error(`Unable to save madlibs data: no data found.`);
      for (let vocabType of Madlibs.vocab.keys()) {            
         data.vocab[vocabType] = Array.from(Madlibs.vocab.get(vocabType) as Set<string>);                         
      }
      data.patterns = Array.from(Madlibs.patterns);
      writeFileSync(filename, JSON.stringify(data, null, 2), "utf8");
      return true;
   }

   public static generate(numLines: number = 4): string {
      if (Madlibs.patterns.size === 0 || Madlibs.vocab.size === 0) {
         const loadResults = Madlibs.load();
         if (loadResults instanceof Error) throw loadResults; 
      }
      const patterns = Array.from(Madlibs.patterns);
      const response: string[] = [];
      for (let l = 0; l < numLines; l++) {
         // Get a pattern and remove it from the list
         let [ pulledPattern ]: string[] = patterns.splice(Math.floor(Math.random() * patterns.length), 1);   
         if (!pulledPattern) break;

         // Replace vocab words in the pattern with random options from that vocab type
         for (const vocabType of Madlibs.vocab.keys()) {
            
            if (pulledPattern.indexOf(vocabType) === -1) continue;

            let word: string = "";
            let words: string[] = [];

            while (pulledPattern.indexOf(vocabType) >= 0) {
               if (!word) {
                  // First run or ran out of words, refill the list and try again
                  words = Array.from(Madlibs.vocab.get(vocabType) as Set<string>);
                  if (words.length === 0) break;                  
               } 
               [ word ] = words.splice(Math.floor(Math.random() * words.length), 1);
               if (!word) break;               
               pulledPattern = pulledPattern.replace(vocabType, word);               
            }
         }         
         response.push(pulledPattern.concat("."));
      }
      return response.join(" ").trim();
   }

   public static addVocab(vocabType: string, word: string): boolean {
      if (!vocabType || !word) return false;
      if (!Madlibs.vocab.has(vocabType)) Madlibs.vocab.set(vocabType, new Set<string>());
      const words = Madlibs.vocab.get(vocabType) as Set<string>;
      words.add(word);
      return true;
   }

   public static removeVocab(vocabType: string, word: string): boolean {
      if (!vocabType || !word) return false;
      if (!Madlibs.vocab.has(vocabType)) return false;
      const words = Madlibs.vocab.get(vocabType) as Set<string>;
      words.delete(word);
      return true;
   }

   public static addPattern(pattern: string): boolean {
      if (!pattern) return false;
      Madlibs.patterns.add(pattern);
      return true;
   }

   public static removePattern(pattern: string): boolean {
      if (!pattern || !Madlibs.patterns.has(pattern)) return false;
      Madlibs.patterns.delete(pattern);
      return true;
   }

   
}

export { Madlibs }