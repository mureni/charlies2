import { existsSync, readFileSync } from "fs";
import { checkFilePath } from "../config";

const DATA_FILE = checkFilePath("data", "hippy.json");

class Bullshit {
   public static patterns: Set<string> = new Set<string>();
   public static vocab: Map<string, Set<string>> = new Map<string, Set<string>>();

   public static load(filename: string = DATA_FILE): boolean | Error {      
      if (!existsSync(filename)) return new Error(`Unable to load bullshit data file '${filename}': file does not exist.`);
      const data = JSON.parse(readFileSync(filename, "utf8"));
      
      if (!Reflect.has(data, "vocab") || !Reflect.has(data, "patterns")) return false;

      for (const vocabType of Object.keys(data.vocab)) {                  
         const words = new Set<string>();         
         const wordArray: string[] = Array.from(data.vocab[vocabType]) || [];
         for (const word of wordArray) {
            words.add(word);
         }
         Bullshit.vocab.set(vocabType, words);
      }
      
      Bullshit.patterns = new Set<string>(data.patterns);      

      return true;
   }

   public static generate(numLines: number = 4): string {
      if (Bullshit.patterns.size === 0 || Bullshit.vocab.size === 0) {
         const loadResults = Bullshit.load();
         if (loadResults instanceof Error) throw loadResults; 
      }
      const patterns = Array.from(Bullshit.patterns);
      const response: string[] = [];
      for (let l = 0; l < numLines; l++) {
         // Get a pattern and remove it from the list
         let [ pulledPattern ]: string[] = patterns.splice(Math.floor(Math.random() * patterns.length), 1);   
         
         // Replace vocab words in the pattern with random options from that vocab type
         for (const vocabType of Bullshit.vocab.keys()) {
            
            if (pulledPattern.indexOf(vocabType) === -1) continue;

            const words: string[] = Array.from(Bullshit.vocab.get(vocabType) as Set<string>);
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

export { Bullshit }