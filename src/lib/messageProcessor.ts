import { ClientUser, Message, TextChannel } from "discord.js";
import { getUser } from "./user";
import { Brain } from "./brain";
import { Swap } from "./swap";
import { TriggerResult, Triggers } from "../triggers";
interface ProcessResults {
   learned: boolean;
   triggeredBy?: string;
   processedText: string;
   response?: string;
}

const processMessage = (client: ClientUser, message: Message): ProcessResults => {
   const results: ProcessResults = { learned: false, processedText: "" }
   if (!(message.channel instanceof TextChannel) || message.type !== "DEFAULT") return results;
   if (message.member.user.id === client.id) return results;

   const cleanText = cleanMessage(message);
   const processed: TriggerResult = Triggers.process(message);

   if (!processed.triggered) {      
      results.learned = Brain.learn(cleanText);
      if (message.isMentioned(client) || Brain.shouldRespond(message.content)) {         
         const seed = Brain.getSeed(cleanText);         
         const response = Brain.getResponse(seed);         
         sendMessage(client, message.channel, response, getUser(message.member), message.tts, false, true);
         results.response = response;         
      }
   } else {
      results.triggeredBy = processed.triggeredBy;      
      for (const line of processed.results) {
         sendMessage(client, message.channel, line, processed.directedTo, message.tts, processed.caseSensitive, processed.processSwaps);         
      }
      results.response = processed.results.join('\n');
   }
   results.processedText = cleanText;
   return results;
}

/* Utility functions for bot interface */
const sendMessage = (client: ClientUser, channel: TextChannel, text: string, directedTo: string | undefined = undefined, tts: boolean = false, caseSensitive: boolean = false, processSwaps: boolean = true): boolean => {
   const permissions = channel.permissionsFor(client);
   if (!permissions || !permissions.has('SEND_MESSAGES')) return false;
   
   if (processSwaps) text = Swap.process(channel.guild.id, text);   
   text = cleanMessage(text, caseSensitive);
   if (!caseSensitive) text = Brain.shouldYell(text) ? text.toUpperCase() : text.toLowerCase();
   if (directedTo) {
      let name = directedTo || "";
      channel.members.forEach(member => {
         name = name.replace(new RegExp(`<@!?${member.id}>`, 'uig'), getUser(member));
      });
      name = name.replace(/<@&\d+>/uig, "my friends");
      name = name.replace(/@(?:everyone|here)/uig, "my friends");      
      text = `${name}: ${text}`;
   }

   channel.send(text, { tts: tts, split: true });
   return true;
}

const cleanMessage = (message: Message | string, caseSensitive: boolean = false): string => {
   let text: string = (message instanceof Message) ? message.content.trim() : message.trim();
   
   /* Remove control characters and RTL marks */
   text = text.replace(/[\u0000-\u001f\u200f\u061c]/uig, '');

   /* Capture URLs as case-sensitive */
   const urlRX = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9\.-]+|(?:www\.|[-;:&=\+\$,\w]+@)[A-Za-z0-9\.-]+)((?:\/[-\+~%\/\.\w_]*)?\??(?:[-\+=&;%@\.\w_]*)#?(?:[\.!\/\\\w]*))?)/ug; 
   const urlMatches = text.match(urlRX);   
   const urls: string[] = [];
   if (urlMatches) {
      for (let i = 0; i < urlMatches.length; i++) {
         urls.push(urlMatches[i]);
         text = text.replace(urlMatches[i], `<🔗-${i}>`);
      }
   }
   /* Replace bot name with 'my friend' (and strip initial) */
   text = text.replace(new RegExp(`^${Brain.settings.name}:?\s*`, "ui"), "");
   text = text.replace(new RegExp(Brain.settings.name, "uig"), "my friend");
   /* Replace all channel mentions with 'my secret place' */
   text = text.replace(/<#\d+>/uig, "my secret place");
   /* Replace all role/everyone/here mentions with 'my friends' */
   text = text.replace(/<@&\d+>/uig, "my friends");
   text = text.replace(/@(?:everyone|here)/uig, "my friends");
   /* Replace all user mentions with 'my friend' */
   text = text.replace(/<@!?\d+>/uig, "my friend");
   
   /* Replace all nicknames/usernames with 'my friend' (and strip initial) */
   if (message instanceof Message && message.guild && message.guild.members) {
      message.guild.members.forEach(member => {
         const user = getUser(member);
         text = text.replace(new RegExp(`^(?:${user}):?\s*`, 'uig'), "");
         text = text.replace(new RegExp(`(${user})`, 'uig'), "my friend");
      });
   }

   /* Normalize text to lowercase */
   if (!caseSensitive) text = text.toLowerCase();

   /* Restore URLs */
   if (urlMatches) {
      for (let i = 0; i < urls.length; i++) {      
         text = text.replace(`<🔗-${i}>`, urls[i]);
      }
   }

   text = balanceText(text).normalize();
   return text;
}


const balanceText = (text: string): string => {         
   const codeBlock: boolean = (text.match(/```/iug) || []).length > 0;
   text = text.replace(/`{2,10}/iug, '');   
   
   const codeSegment: boolean = (text.match(/`/ug) || []).length % 2 !== 0;
   const parenthesisStart: number = (text.match(/\(/ug) || []).length;
   const parenthesisEnd: number = (text.match(/\)/ug) || []).length - (text.match(/\s+\w\)/ug) || []).length;
   const doubleQuote: boolean = (text.match(/"/ug) || []).length % 2 !== 0;
   
   if (doubleQuote) text = text.endsWith('"') ? '"'.concat(text) : text.concat('"');   
   if (parenthesisStart < parenthesisEnd) text = "(".repeat(parenthesisEnd - parenthesisStart).concat(text);
   if (parenthesisStart > parenthesisEnd) text = text.concat(")".repeat(parenthesisStart - parenthesisEnd));   
   if (codeSegment) text = text.endsWith('`') ? '`'.concat(text) : text.concat('`');   
   if (codeBlock) text = '```'.concat(text, '```');
   return text;
}


export { ProcessResults, processMessage }



