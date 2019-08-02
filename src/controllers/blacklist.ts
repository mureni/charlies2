import { checkFilePath } from "../config";
import { writeFileSync, readFileSync, existsSync } from "fs";

const BLACKLIST_FILE = checkFilePath("data", "blacklist.json");

interface BlacklistJSON {
   [serverID: string]: {
      [userID: string]: string[];      
   }
}

class Blacklist {
   private static list: Map<string, Map<string, Set<string>>> = new Map();  

   public static load(filename = BLACKLIST_FILE): boolean | Error {
      if (!existsSync(filename)) return new Error(`Blacklist file ${filename} does not exist.`);
      const data = JSON.parse(readFileSync(filename, "utf8"));
      
      Blacklist.list.clear();
      for (const guildID of Object.keys(data)) {
         const users = data[guildID];
         const userList = new Map<string, Set<string>>();
         for (const userID of Object.keys(users)) {            
            const triggerList = new Set<string>(users[userID]);
            userList.set(userID, triggerList);
         }
         Blacklist.list.set(guildID, userList);
      }      
      return true;
   }

   public static save(filename: string = BLACKLIST_FILE): boolean | Error {      
      const data: BlacklistJSON = {};
      if (Blacklist.list.size === 0) return new Error(`Unable to save blacklist data: no blacklist data found.`);
      for (let guildID of Blacklist.list.keys()) {
         data[guildID] = {}
         const guild = Blacklist.list.get(guildID) as Map<string, Set<string>>;
         for (let userID of guild.keys()) {
            data[guildID][userID] = Array.from(guild.get(userID) as Set<string>);
         }
      }
      writeFileSync(filename, JSON.stringify(data, null, 2), "utf8");
      return true;
   }
   
   public static add(guildID: string, userID: string, trigger: string): void {
      if (!Blacklist.list.has(guildID)) Blacklist.list.set(guildID, new Map<string, Set<string>>());
      const userList = Blacklist.list.get(guildID) as Map<string, Set<string>>;
      if (!userList.has(userID)) userList.set(userID, new Set<string>());
      const triggerList = userList.get(userID) as Set<string>;
      triggerList.add(trigger);
   }
   public static remove(guildID: string, userID: string, trigger: string): void {
      if (!Blacklist.list.has(guildID)) return;
      const userList = Blacklist.list.get(guildID) as Map<string, Set<string>>;
      if (!userList.has(userID)) return;
      const triggerList = userList.get(userID) as Set<string>;
      triggerList.delete(trigger);
   }
   public static allowed(guildID: string, userID: string, trigger: string): boolean {
      if (!Blacklist.list.has(guildID)) return true;
      const userList = Blacklist.list.get(guildID) as Map<string, Set<string>>;
      if (!userList.has(userID)) return true;
      const triggerList = userList.get(userID) as Set<string>;
      return !triggerList.has(trigger);
   }
}

export { Blacklist }