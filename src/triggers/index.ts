import { tarot } from "./tarot";
import { hippy } from "./hippy";
import { choose } from "./choose";
import { a0l } from "./a0l";
import { swapList, addSwap, removeSwap, swapSave } from "./swapWords";
import { saveBrain } from "./saveBrain";
import { story } from "./story";
import { Message } from "discord.js";
import { CONFIG } from "../config";
const importedTriggers = [ tarot, choose, a0l, swapList, addSwap, removeSwap, swapSave, saveBrain, story, hippy ];

interface TriggerResult {
   results: string[];   
   caseSensitive: boolean;
   processSwaps: boolean;
   directedTo?: string;
   triggered?: boolean;
   triggeredBy?: string;
}
interface Trigger {
   name: string;
   description: string;
   usage: string;
   command: RegExp;
   action(context?: Message, matches?: RegExpMatchArray): TriggerResult;
   ownerOnly?: boolean;
}

class Triggers {
   static list: Trigger[] = importedTriggers;
   static process(context: Message): TriggerResult {      
      const output: TriggerResult = Triggers.help(context);
      if (output.results.length > 0) return { ...output, triggered: true, triggeredBy: "help" };
            
      for (const trigger of Triggers.list) {
         if (trigger.ownerOnly && context.author.id !== CONFIG.ownerID) continue;
         const matches = context.content.match(trigger.command);
         if (!matches) continue;
         const triggerOutput = trigger.action(context, matches);
         if (triggerOutput.results.length > 0) return { ...triggerOutput, triggered: true, triggeredBy: trigger.name };
      }

      return { ...output, triggered: false };
   }
   static help(context: Message): TriggerResult {
      const help = context.content.match(/^!help\s*(?<command>.+)?/);
      const output: TriggerResult = { results: [], caseSensitive: true, processSwaps: false };
      if (!help) return output;
      if (!help.groups || !help.groups.command) {
         // Get help for all triggers
         for (const trigger of Triggers.list) {
            if (!trigger.ownerOnly) output.results.push(`**${trigger.name}** - *${trigger.description}*.`, `➥ **Usage:** \`${trigger.usage}\``);
         }         
      } else {
         // Get help for specific trigger
         const command = help.groups.command;
         const found = Triggers.list.find(trigger => command.match(trigger.command) !== null);
         if (!found) {
            output.results = ["no such command exists"];
            return output;
         }
         output.results.push(`${found.ownerOnly ? `***(Bot owner only)*** - ` : ``}**${found.name}** - *${found.description}*.`, `➥ **Usage:** \`${found.usage}\``);
      }
      return output;
   }
   
}



export { TriggerResult, Trigger, Triggers }