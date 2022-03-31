import { DBMap } from "../core/DBMap";
import { checkFilePath, env, escapeRegExp } from "../utils";

class Swap {
   
   private static list: DBMap<string, Map<string, string>> = new DBMap<string, Map<string, string>>(checkFilePath("data", `${env("BOT_NAME")}-swaps.sql`), "swaps", false);
   
   public static process (guildID: string, text: string): string {
      text = text.trim();
      if (!Swap.list.has(guildID)) return text;
      const guildList = Swap.list.get(guildID) ?? new Map<string, string>();
      if (guildList.size === 0) return text;
      for (const word of guildList.keys()) {
         let newWord = guildList.get(word) as string ?? "";
         if (newWord === `<blank>`) newWord = "";
         text = text.replace(new RegExp(escapeRegExp(word), "uig"), newWord);
      }
      text = text.replace(/\s{2,}/g, ' ').trim();
      return text;
   }

   public static getList (guildID: string): string[] {
      const results: string[] = [];
      if (!Swap.list.has(guildID)) return results;
      const guildList = Swap.list.get(guildID) ?? new Map<string, string>();
      if (guildList.size === 0) return results;
      for (const word of guildList.keys()) {
         let newWord = guildList.get(word) ?? ""; 
         if (newWord === "") newWord = "<blank>";
         results.push(`\`${word} → ${newWord}\``);
      };
      return results;
   }

   public static add(guildID: string, swapThis: string, withThis: string = ""): void {         
      const guildList = Swap.list.get(guildID) ?? new Map<string, string>();
      if (withThis === "") withThis = `<blank>`;      
      guildList.set(swapThis.trim(), withThis.trim());
      Swap.list.set(guildID, guildList);
   }
   
   public static remove(guildID: string, word: string): void {      
      const guildList = Swap.list.get(guildID) ?? new Map<string, string>();
      if (guildList.has(word)) guildList.delete(word);
      Swap.list.set(guildID, guildList);
   }
   public static clear(guildID: string): void {      
      const guildList = Swap.list.get(guildID) ?? new Map<string, string>();
      if (guildList.size > 0) guildList.clear();
      Swap.list.set(guildID, guildList);
   }
}

export { Swap }