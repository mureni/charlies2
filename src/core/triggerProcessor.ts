import { readdirSync, readFileSync } from "fs";
import { Trigger, TriggerResult } from "./triggerTypes";
import { log } from "./log";
import { Blacklist } from "../controllers";
import { PluginManager } from "../plugins";
import { checkFilePath, env } from "../utils";
import {
   CoreMessage,
   OutgoingAttachment,
   OutgoingEmbed,
   OutgoingEmbedField
} from "../platform";
import type { PlatformAdapter } from "../platform";

// TODO: Add "resources" field to allow a trigger to have static resources it can pull from (i.e. dictionaries, image folders, etc.)
// TODO: Add "data" field to allow a trigger to load and save data -- should also have option to specify whether data applies to server, channel, user, or self

class Triggers {
   public static list: Trigger[] = [];
   private static pluginManager = new PluginManager();
   private static commandsRegistered = false;
   private static commandsRegistering = false;
   private static watching = false;
   
   public static async initialize(): Promise<Trigger[]> {
      const triggers: Trigger[] = [];
      Triggers.pluginManager.clear();
      const triggerFiles = readdirSync(checkFilePath("code", "triggers/"));
      for (const file of triggerFiles) {
         const fullPath = checkFilePath("code", `triggers/${file}`);
         log(`Loading trigger file ${fullPath}...`);
         await import(fullPath).then((importedTriggers: { triggers: Trigger[] }) => {            
            for (const trigger of importedTriggers.triggers) {
               log(`Loaded trigger ${trigger.id}`);
               triggers.push(trigger);
            }
         }).catch(error => {
            log(`Error loading trigger file ${file}: ${error}`, 'error');
         });
      }
      Triggers.pluginManager.registerLegacyTriggers(triggers);
      await Triggers.pluginManager.loadFromDist();
      Triggers.list = Triggers.pluginManager.getLegacyTriggers();
      Triggers.startWatching();
      return Triggers.list;
   }

   public static async registerCommands(platform?: PlatformAdapter): Promise<void> {
      if (Triggers.commandsRegistered || Triggers.commandsRegistering) return;
      if (!platform || !platform.supportsCommands || !platform.registerCommands) return;
      if (Triggers.list.length === 0) await Triggers.initialize();
      const commands = Triggers.pluginManager.getCommands();
      if (commands.length === 0) {
         Triggers.commandsRegistered = true;
         return;
      }
      Triggers.commandsRegistering = true;
      try {
         await platform.registerCommands(commands);
         Triggers.commandsRegistered = true;
      } catch (error: unknown) {
         const message = error instanceof Error ? error.message : String(error);
         log(`Error registering commands: ${message}`, "error");
      } finally {
         Triggers.commandsRegistering = false;
      }
   }

   public static async reload(): Promise<Trigger[]> {
      await Triggers.pluginManager.unloadAll();
      Triggers.commandsRegistered = false;
      Triggers.commandsRegistering = false;
      Triggers.list = [];
      return Triggers.initialize();
   }

   public static startWatching(): void {
      if (Triggers.watching) return;
      if (env("PLUGINS_WATCH", "false") !== "true") return;
      Triggers.watching = true;
      Triggers.pluginManager.startWatching(() => {
         void Triggers.reload();
      });
   }

   public static async process(message: CoreMessage): Promise<TriggerResult> {

      if (Triggers.list.length === 0) {
         Triggers.list = await Triggers.initialize();
      }

      const output: TriggerResult = await Triggers.help(message);
      if (output.results.length > 0) return { ...output, triggered: true, triggeredBy: "help" };
      if (message.isBot) return output;
      
      const senderName = message.authorName || message.authorId;
      
      // TODO: Expand permissions and owner checking beyond Discord
      const isAdmin = Boolean(message.isAdmin);
      const isBotOwner = Boolean(message.isBotOwner || message.authorId === env("BOT_OWNER_DISCORD_ID"));

      for (const trigger of Triggers.list) {
         if (trigger.ownerOnly && !isBotOwner) continue;
         if (trigger.adminOnly && !(isAdmin || isBotOwner)) continue;
         const matches = message.content.match(trigger.command);
         if (!matches) continue;

         if (Blacklist.denied(message.guildId ?? "DM", message.authorId, trigger.id)) {
            output.directedTo = senderName;
            output.results = [{ contents: `you are not allowed to execute \`${trigger.id}\` in ${message.guildName ?? 'direct messages'}` }];
            return { ...output, triggered: true, triggeredBy: trigger.id }
         }

         const triggerOutput = await trigger.action(message, matches);
         if (triggerOutput.results.length > 0 || triggerOutput.triggered) {
            log(`Successful trigger output: ${JSON.stringify(triggerOutput)}`, "debug");
            return { ...triggerOutput, triggered: true, triggeredBy: trigger.id };
         }
      }
      log(`Trigger output: ${JSON.stringify(output)}`, "debug");
      return { ...output, triggered: false };
   }
   
   private static async help(message: CoreMessage): Promise<TriggerResult> {
      // TODO: Make into cleaner thing 

      if (Triggers.list.length === 0) {
         Triggers.list = await Triggers.initialize();
      }

      const help = message.content.match(/^!help\s*(?<command>.+)?/);
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" } };
      if (!help) return output;
            
      // Check if a trigger was provided to get help for specific trigger
      const command = help.groups?.command ? help.groups.command.toLowerCase() : "commands";

      if (command === "commands") {
         const list: string[] = [];
         Triggers.list.forEach(trigger => {
            if (trigger.hidden) return;
            list.push(trigger.id);
         });
         output.results = [
            { contents: `Available commands: \`${list.join(", ")}\`` },
            { contents: `Type !help <command> for more information` }
         ];
      } else {
         const found = Triggers.list.find(trigger => {
            if (trigger.hidden) return false;
            return command.match(trigger.command) !== null || command.match(trigger.id) !== null;
         });
      
         if (!found) {
            output.results = [{ contents: "no such command exists" }];
            return output;
         }
         const fields: OutgoingEmbedField[] = [{ name: "Usage", value: found.usage }];
         if (found.example) fields.push({ name: "Example", value: found.example });
         const entry: OutgoingEmbed = {
            color: found.ownerOnly ? "RED" : found.adminOnly ? "ORANGE" : "#0099ff",
            title: `${found.ownerOnly ? "Bot Owner Only - " : found.adminOnly ? "Server Admin Only - " : ""}Help for ${found.name}`,
            description: found.description,
            footer: "Items within [square] or <angled> brackets are optional. [Square brackets] means the contents can be changed by you, <angled brackets> means you have to type exactly the contents of the angled brackets.",
            fields,
            thumbnailAttachmentName: "help.png",
            imageAttachmentName: "help.png"
         };
         const attachmentPath = found.icon
            ? checkFilePath("resources", found.icon)
            : checkFilePath("resources", "icons/help.png");
         const attachment: OutgoingAttachment = {
            name: "help.png",
            data: readFileSync(attachmentPath)
         };
         output.results = [ { contents: "", embeds: [ entry ], attachments: [ attachment ] } ];
      }
           
      return output;
   }
   
}

export { TriggerResult, Trigger, Triggers }
