import { existsSync, readFileSync, writeFileSync } from "fs";
import { checkFilePath } from "../utils";
const SWAP_FILE = checkFilePath("data", "swaps.json");
class Swap {
   private static list: Map<string, Map<string, string>> = new Map();
   
   public static save(filename: string = SWAP_FILE): boolean | Error {
      try { 
         const data: { [guildID: string]: { [word: string]: string }} = {};
         if (Swap.list.size === 0) return new Error(`Unable to save swap data: no swap data found.`);
         for (let guildID of Swap.list.keys()) {
            data[guildID] = {}
            const guild = Swap.list.get(guildID) as Map<string, string>;
            for (let word of guild.keys()) {
               data[guildID][word] = guild.get(word) as string;
            }
         }
         writeFileSync(filename, JSON.stringify(data, null, 2), "utf8");
         return true;
      } catch (error) {
         if (error instanceof Error) {
            return error;
         } else {
            return new Error("Unknown error occurred while saving swap data");
         }
      }
   }
   
   public static load(filename: string = SWAP_FILE): boolean | Error {
      try {
         if (!existsSync(filename)) return new Error(`Unable to load swap data file '${filename}': file does not exist.`);
         const data = JSON.parse(readFileSync(filename, "utf8"));
         Swap.list.clear();
         for (const guildID of Object.keys(data)) {
            const words = data[guildID];
            const wordList = new Map<string, string>();
            for (const word of Object.keys(words)) {
               wordList.set(word, words[word]);
            }
            Swap.list.set(guildID, wordList);
         }
         return true;
      } catch (error) {
         if (error instanceof Error) {
            return error;
         } else {
            return new Error("Unknown error occurred while loading swap data");
         }
      }
   }
   
   public static process (guildID: string, text: string): string {
      text = text.trim();
      if (!Swap.list.has(guildID)) return text;
      const guildList = Swap.list.get(guildID) as Map<string, string>;
      if (guildList.size === 0) return text;
      for (const word of guildList.keys()) {
         let newWord = guildList.get(word) as string || "";
         if (newWord === `<blank>`) newWord = "";
         text = text.replace(new RegExp(word, "uig"), newWord);
      }
      text = text.replace(/\s{2,}/g, ' ').trim();
      return text;
   }
   public static getList (guildID: string): string[] {
      const results: string[] = [];
      if (!Swap.list.has(guildID)) return results;
      const guildList = Swap.list.get(guildID) as Map<string, string>;
      if (guildList.size === 0) return results;
      for (const word of guildList.keys()) {
         let newWord = guildList.get(word) as string || ""; 
         if (newWord === "") newWord = "<blank>";
         results.push(`\`${word} → ${newWord}\``);
      };
      return results;
   }
   public static add(guildID: string, swapThis: string, withThis: string = ""): void {   
      if (!Swap.list.has(guildID)) Swap.list.set(guildID, new Map<string, string>());
      const guildList = Swap.list.get(guildID) as Map<string, string>;
      if (withThis === "") withThis = `<blank>`;      
      guildList.set(swapThis.trim(), withThis.trim());
   }
   
   public static remove(guildID: string, word: string): void {
      if (!Swap.list.has(guildID)) Swap.list.set(guildID, new Map<string, string>());
      const guildList = Swap.list.get(guildID) as Map<string, string>;
      if (guildList.has(word)) guildList.delete(word);
   }
   public static clear(guildID: string): void {
      if (!Swap.list.has(guildID)) Swap.list.set(guildID, new Map<string, string>());
      const guildList = Swap.list.get(guildID) as Map<string, string>;
      if (guildList.size > 0) guildList.clear();
   }
}

export { Swap }