import { Message, MessageEmbed, MessageAttachment, User } from "discord.js";
import { getDisplayName } from "./user";
import { readdirSync } from "fs";
import { ModificationType } from "./messageProcessor";
import { log } from "./log";
import { Blacklist } from "../controllers";
import { checkFilePath, env } from "../config";

interface TriggerResult {
   results: (string | MessageEmbed | MessageAttachment)[];
   modifications: ModificationType;
   directedTo?: string;
   triggered?: boolean;
   triggeredBy?: string;
}

// TODO: Add "resources" field to allow a trigger to have static resources it can pull from (i.e. dictionaries, image folders, etc.)
// TODO: Add "data" field to allow a trigger to load and save data -- should also have option to specify whether data applies to server, channel, user, or self

interface Trigger {
   id: string;
   name: string;
   description: string;
   usage: string;
   command: RegExp;
   action(context?: Message, matches?: RegExpMatchArray): TriggerResult | Promise<TriggerResult>;
   ownerOnly?: boolean;
   adminOnly?: boolean;
   example?: string;
   icon?: string;  // For now, 'icon' refers to a file relative to the "resources" folder
}

class Triggers {
   public static list: Trigger[] = [];
   
   private static async initialize(): Promise<Trigger[]> {
      const triggers: Trigger[] = [];
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
      return triggers;
   }

   public static async process(message: Message): Promise<TriggerResult> {

      if (Triggers.list.length === 0) {
         Triggers.list = await Triggers.initialize();
      }

      const output: TriggerResult = await Triggers.help(message);
      if (output.results.length > 0) return { ...output, triggered: true, triggeredBy: "help" };
      if (!message.author || message.author.bot) return output;
      
      let sender: User;
      if (message.member) {
         // text channel
         sender = message.member.user;
      } else {
         // DM
         sender = message.author;
      }
      
      // TODO: Expand permissions and owner checking beyond Discord
      const isAdmin = !!(message.member) && (message.member.hasPermission("ADMINISTRATOR") || message.member.hasPermission("MANAGE_GUILD"));
      const isBotOwner = message.author.id === env("BOT_OWNER_DISCORD_ID");

      for (const trigger of Triggers.list) {
         if (trigger.ownerOnly && !isBotOwner) continue;
         if (trigger.adminOnly && !(isAdmin || isBotOwner)) continue;
         const matches = message.content.match(trigger.command);
         if (!matches) continue;

         if (!Blacklist.allowed(message.guild?.id ?? "DM", message.author.id, trigger.id)) {
            output.directedTo = getDisplayName(sender, message.guild?.members);
            output.results = [`you are not allowed to execute \`${trigger.id}\` in ${message.guild?.name ?? 'direct messages'}`];
            return { ...output, triggered: true, triggeredBy: trigger.id }
         }

         const triggerOutput = await trigger.action(message, matches);
         if (triggerOutput.results.length > 0 || triggerOutput.triggered) return { ...triggerOutput, triggered: true, triggeredBy: trigger.id };
      }

      return { ...output, triggered: false };
   }
   
   private static async help(message: Message): Promise<TriggerResult> {
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
         Triggers.list.forEach(trigger => list.push(trigger.id));
         output.results = [`Available commands: \`${list.join(", ")}\``, `Type !help <command> for more information`];
      } else {
         const found = Triggers.list.find(trigger => (command.match(trigger.command) !== null || command.match(trigger.id) !== null));
      
         if (!found) {
            output.results = ["no such command exists"];
            return output;
         }
         const entry = new MessageEmbed()
            .setColor("#0099ff")
            .setTitle(`Help for ${found.name}`)
            .setDescription(found.description)
            .setFooter('Items within [square] or <angled> brackets are optional. [Square brackets] means the contents can be changed by you, <angled brackets> means you have to type exactly the contents of the angled brackets.')
            .attachFiles(found.icon ? [checkFilePath("resources", `icons/${found.icon}`)] : [checkFilePath("resources", "icons/help.png")])
            .setThumbnail(found.icon ? `attachment://${found.icon}` : "attachment://help.png")
            .addField('Usage', found.usage);
         if (found.adminOnly) entry.setColor('orange').setTitle(`Server Admin Only - Help for ${found.name}`);
         if (found.ownerOnly) entry.setColor('red').setTitle(`Bot Owner Only - Help for ${found.name}`);
         if (found.example) entry.addField('Example', found.example);
         
         output.results.push(entry);
      }
           
      return output;
   }
   
}

export { TriggerResult, Trigger, Triggers }