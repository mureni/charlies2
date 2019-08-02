import { Message } from "discord.js";
import { readdirSync } from "fs";
import { Modifications } from "./messageProcessor";
import { log } from "./log";
import { Blacklist } from "../controllers";
import { checkFilePath, CONFIG } from "../config";

interface TriggerResult {
   results: string[];   
   modifications: number;
   directedTo?: string;
   triggered?: boolean;
   triggeredBy?: string;
}
interface Trigger {
   id: string;
   name: string;
   description: string;
   usage: string;
   command: RegExp;
   action(context?: Message, matches?: RegExpMatchArray): TriggerResult;
   ownerOnly?: boolean;
   adminOnly?: boolean;
}

class Triggers {
   public static list: Trigger[] = Triggers.import();

   private static import(): Trigger[] {
      const triggers: Trigger[] = [];
      const triggerFiles = readdirSync(checkFilePath("code", "triggers/"));
      for (const file of triggerFiles) {
         const fullPath = checkFilePath("code", `triggers/${file}`);
         log(`Loading trigger file ${fullPath}...`);
         import(fullPath).then((importedTriggers: { triggers: Trigger[] }) => {            
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
   public static process(context: Message): TriggerResult {      
      const output: TriggerResult = Triggers.help(context);
      if (output.results.length > 0) return { ...output, triggered: true, triggeredBy: "help" };
      if (context.author.bot) return output;
      const isAdmin = context.member.hasPermission("ADMINISTRATOR") || context.member.hasPermission("MANAGE_GUILD");
      const isBotOwner = context.author.id === CONFIG.ownerID;      

      for (const trigger of Triggers.list) {
         if (trigger.ownerOnly && !isBotOwner) continue;
         if (trigger.adminOnly && !isAdmin) continue;
         const matches = context.content.match(trigger.command);
         if (!matches) continue;

         if (!Blacklist.allowed(context.guild.id, context.author.id, trigger.id)) {
            output.directedTo = context.member.displayName;
            output.results = [`you are not allowed to execute \`${trigger.id}\` on ${context.guild.name}`];
            return { ...output, triggered: true, triggeredBy: trigger.id }
         }

         const triggerOutput = trigger.action(context, matches);
         if (triggerOutput.results.length > 0) return { ...triggerOutput, triggered: true, triggeredBy: trigger.id };
      }

      return { ...output, triggered: false };
   }
   private static help(context: Message): TriggerResult {
      const help = context.content.match(/^!help\s*(?<command>.+)?/);
      const output: TriggerResult = { results: [], modifications: Modifications.AsIs };
      if (!help) return output;
      if (!help.groups || !help.groups.command) {
         // Get help for all triggers
         for (const trigger of Triggers.list) {
            if (!trigger.ownerOnly) output.results.push(`**${trigger.name}** - *${trigger.description}*.`, `➥ **Usage:** \`${trigger.usage}\``);
         }         
      } else {
         // Get help for specific trigger
         const command = help.groups.command.toLowerCase();
         if (command === "commands") {
            const list: string[] = [];
            Triggers.list.forEach(trigger => list.push(trigger.id));
            output.results = [`Available commands: \`${list.join(", ")}\``];
         } else {
            const found = Triggers.list.find(trigger => (command.match(trigger.command) !== null || command.match(trigger.id) !== null));
         
            if (!found) {
               output.results = ["no such command exists"];
               return output;
            }
            output.results.push(`${found.ownerOnly ? `***(Bot owner only)*** - ` : ``}**${found.name}** - *${found.description}*.`, `➥ **Usage:** \`${found.usage}\``);
         }

      }
      return output;
   }
   
}

export { TriggerResult, Trigger, Triggers }