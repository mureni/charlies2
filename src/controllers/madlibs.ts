// DEPRECATED import { existsSync, readFileSync, writeFileSync } from "fs";
import { checkFilePath, env } from "../utils";
import { DBMap } from "../core/DBMap";

// DEPRECATED const DATA_FILE = checkFilePath("data", "madlibs.json");

/* Structure:
{ 
   "name-of-madlib-category": {
      "patterns": string[];
      "vocab": {
         [vocabType: string]: string[]
      }
   }
}
*/
type MadlibPatterns = Set<string>;
type MadlibVocab = Map<string, Set<string>>;
type MadlibCategory = {
   "patterns": MadlibPatterns;
   "vocab": MadlibVocab;  
};

class Madlibs {
   
   private static categories: DBMap<string, MadlibCategory> = new DBMap<string, MadlibCategory>(checkFilePath("data", `${env("BOT_NAME")}-madlibs.sql`), "categories", false);

   /* DEPRECATED 
   private static patterns: Set<string> = new Set<string>(); 
   private static vocab: Map<string, Set<string>> = new Map<string, Set<string>>();
   
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
   */

   private static getCategory(category: string = "general"): MadlibCategory {
      const cat = Madlibs.categories.get(category);
      if (!cat) { 
         const newCat = { patterns: new Set<string>(), vocab: new Map<string, Set<string>>() };
         Madlibs.categories.set(category, newCat);
         return newCat;
      }
      return cat;
   }

   public static generate(numLines: number = 4, category: string = "general"): string {
      
      const categoryData = Madlibs.getCategory(category);
      if (categoryData.patterns.size === 0 || categoryData.vocab.size === 0) return "No usable madlib data found";

      /* DEPRECATED 
      if (Madlibs.patterns.size === 0 || Madlibs.vocab.size === 0) {
         const loadResults = Madlibs.load();
         if (loadResults instanceof Error) throw loadResults; 
      }
      */
      const patterns = Array.from(categoryData.patterns.values());
      const response: string[] = [];
      for (let l = 0; l < numLines; l++) {
         // Get a pattern and remove it from the list
         let [ pulledPattern ]: string[] = patterns.splice(Math.floor(Math.random() * patterns.length), 1);   
         if (!pulledPattern) break;

         // Replace vocab words in the pattern with random options from that vocab type
         for (const vocabType of categoryData.vocab.keys()) {
            
            if (pulledPattern.indexOf(vocabType) === -1) continue;

            let word: string = "";
            let words: string[] = [];

            while (pulledPattern.indexOf(vocabType) >= 0) {
               if (!word) {
                  // First run or ran out of words, refill the list and try again
                  words = Array.from(categoryData.vocab.get(vocabType) as Set<string>);
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

   public static addVocab(category: string = "general", vocabType: string = "", word: string = ""): boolean {
      if (!category || !vocabType || !word) return false;
      const categoryData = Madlibs.getCategory(category);
      const words = categoryData.vocab.get(vocabType) ?? new Set<string>();
      words.add(word);
      categoryData.vocab.set(vocabType, words);
      Madlibs.categories.set(category, categoryData);
      return true;
   }

   public static removeVocab(category: string = "general", vocabType: string = "", word: string = ""): boolean {
      if (!vocabType || !word) return false;      
      const categoryData = Madlibs.getCategory(category);
      const words = categoryData.vocab.get(vocabType) ?? new Set<string>();
      if (words.size === 0) return false;
      words.delete(word);
      categoryData.vocab.set(vocabType, words);
      Madlibs.categories.set(category, categoryData);
      return true;
   }

   public static addPattern(category: string = "general", pattern: string = ""): boolean {
      if (!pattern) return false;
      const categoryData = Madlibs.getCategory(category);      
      categoryData.patterns.add(pattern);
      Madlibs.categories.set(category, categoryData);
      return true;
   }

   public static removePattern(category: string = "general", pattern: string): boolean {
      if (!pattern) return false;
      const categoryData = Madlibs.getCategory(category);
      if (!categoryData.patterns.has(pattern)) return false;
      categoryData.patterns.delete(pattern);
      Madlibs.categories.set(category, categoryData);
      return true;
   }

   
}

export { Madlibs }