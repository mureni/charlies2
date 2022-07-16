import { existsSync, readFileSync } from "fs";
import { log } from "../core/log";
import { checkFilePath } from "../utils";

const DATA_FILE = checkFilePath("resources", "corpo.json");

class Corpo {
   public static patterns: Set<string> = new Set<string>();
   public static vocab: Map<string, Set<string>> = new Map<string, Set<string>>();

   public static load(filename: string = DATA_FILE): boolean | Error {      
      if (!existsSync(filename)) return new Error(`Unable to load corpo data file '${filename}': file does not exist.`);
      const data = JSON.parse(readFileSync(filename, "utf8"));
      
      if (!Reflect.has(data, "vocab") || !Reflect.has(data, "patterns")) return new Error(`Unable to load corpo data file '${filename}': file is not properly formatted.`);;

      for (const vocabType of Object.keys(data.vocab)) {                  
         const words = new Set<string>();         
         const wordArray: string[] = Array.from(data.vocab[vocabType]) || [];
         for (const word of wordArray) {
            words.add(word);
         }
         Corpo.vocab.set(vocabType, words);
      }
      
      Corpo.patterns = new Set<string>(data.patterns);            

      return true;
   }

   public static generate(numLines: number = 4): string {
      if (Corpo.patterns.size === 0 || Corpo.vocab.size === 0) {
         const loadResults = Corpo.load();
         if (loadResults instanceof Error) throw loadResults; 
      }
      const patterns = Array.from(Corpo.patterns);
      
      log(JSON.stringify(patterns, null, 2), "debug");

      const response: string[] = [];
      const maxLines = Math.min(numLines, patterns.length);

      for (let l = 0; l < maxLines; l++) {
         // Get a pattern and remove it from the list
         let [ pulledPattern ]: string[] = patterns.splice(Math.floor(Math.random() * patterns.length), 1);   
         log(`Pulled pattern: ${pulledPattern}`, "debug");
         
         // Replace vocab words in the pattern with random options from that vocab type
         for (const vocabType of Corpo.vocab.keys()) {
            
            if (pulledPattern.indexOf(vocabType) === -1) continue;

            const words: string[] = Array.from(Corpo.vocab.get(vocabType) as Set<string>);
            if (words.length === 0) continue;
            
            while (pulledPattern.indexOf(vocabType) >= 0) {
               const [ word ]: string[] = words.splice(Math.floor(Math.random() * words.length), 1);                        
               pulledPattern = pulledPattern.replace(vocabType, word);               
            }
         }
         response.push(pulledPattern);
      }
      return response.join(" ").trim();
   }
}

export { Corpo }