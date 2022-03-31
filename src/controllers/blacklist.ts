import { checkFilePath, env } from "../utils";
import { DBMap } from "../core/DBMap";


type BlacklistCommand = Set<string>;
type BlacklistUser = Map<string, BlacklistCommand>;

class Blacklist {
   private static list: DBMap<string, BlacklistUser> = new DBMap<string, BlacklistUser>(checkFilePath("data", `${env("BOT_NAME")}-blacklist.sql`), "contexts", false);

/* DEPRECATED
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
*/

   public static add(context: string = "*:*", userID: string = "", command: string = ""): void {
      if (!context || !userID || !command) return;   
      const userList = Blacklist.list.get(context) ?? new Map<string, Set<string>>();      
      const commandList = userList.get(userID) ?? new Set<string>();
      commandList.add(command);
      userList.set(userID, commandList);
      Blacklist.list.set(context, userList);
   }
   public static remove(context: string = "*:*", userID: string = "", command: string = ""): void {
      if (!context || !userID || !command) return;
      const userList = Blacklist.list.get(context) ?? new Map<string, Set<string>>();
      if (!userList.has(userID)) return;
      const commandList = userList.get(userID) ?? new Set<string>();
      commandList.delete(command);
      userList.set(userID, commandList);
      Blacklist.list.set(context, userList);
   }
   public static denied(context: string = "*:*", userID: string = "", command: string = ""): boolean {
      if (!context || !userID || !command) return false;
      if (!Blacklist.list.has(context)) return false;
      const userList = Blacklist.list.get(context) ?? new Map<string, Set<string>>();
      if (!userList.has(userID)) return false;
      const triggerList = userList.get(userID) ?? new Set<string>();
      return triggerList.has(command);
   }

   public static allowed(context: string = "*:*", userID: string = "", command: string = ""): boolean {
      return !Blacklist.denied(context, userID, command);
   }
}

export { Blacklist }