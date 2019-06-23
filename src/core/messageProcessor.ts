import { ClientUser, Message, TextChannel } from "discord.js";
import { getEndearment, getDisplayName, interpolateUsers } from "./user";
import { Brain } from "./brain";
import { Swap } from "../controllers/swap";
import { TriggerResult, Triggers } from "./triggerProcessor";
interface ProcessResults {
   learned: boolean;
   triggeredBy?: string;
   processedText: string;
   response?: string;
}

export enum Modifications {
   ForceLowercase = 0,
   AsIs = 1,
   Yell = 2,
   ProcessSwaps = 4,
   FriendlyNames = 8,
   TTS = 16
}

const processMessage = (client: ClientUser, message: Message): ProcessResults => {
   const results: ProcessResults = { learned: false, processedText: "" }
   if (!(message.channel instanceof TextChannel) || message.type !== "DEFAULT") return results;
   
   /* Process server-specific blacklists to prevent users from responding */
   if (message.author.id === client.id) return results;
   
   const cleanText = interpolateUsers(cleanMessage(message, Modifications.ForceLowercase), message.guild.members, true);
   const processed: TriggerResult = Triggers.process(message);

   if (!processed.triggered) {      
      results.learned = Brain.learn(cleanText);
      if (message.isMentioned(client) || Brain.shouldRespond(message.content)) {
         let response = "";
         let seed = Brain.getSeed(cleanText);
         /* Try up to 5 times to get a unique response */
         for (let attempt = 0; attempt < 5; attempt++) {    
            response = Brain.getResponse(seed);
            if (response.toLowerCase() === message.content.toLowerCase()) seed = Brain.getSeed();
         }
         const modifications = processed.modifications
                             | (message.tts ? Modifications.TTS : 0)
                             | (Brain.shouldYell(message.content) ? Modifications.Yell : 0);
         sendMessage(client, message.channel, response, getDisplayName(message.member), modifications);
         /* Learn what it just created, to create a feedback */
         Brain.learn(interpolateUsers(cleanMessage(response, Modifications.ForceLowercase), message.guild.members, true));
         results.response = response;
      }
   } else {
      results.triggeredBy = processed.triggeredBy;
      let modifications = processed.modifications;
      if (!(modifications & Modifications.AsIs)) modifications |= (Brain.shouldYell(message.content) ? Modifications.Yell : 0);
      for (const line of processed.results) {
         sendMessage(client, message.channel, line, processed.directedTo, processed.modifications);         
      }
      results.response = processed.results.join('\n');
   }
   results.processedText = cleanText;
   return results;
}

/* Utility functions for bot interface */
const sendMessage = (client: ClientUser, channel: TextChannel, text: string, directedTo: string | undefined = undefined, modifications: number = Modifications.AsIs): boolean => {
   const permissions = channel.permissionsFor(client);
   if (!permissions || !permissions.has('SEND_MESSAGES')) return false;
      
   if (modifications & Modifications.ProcessSwaps) text = Swap.process(channel.guild.id, text);
   text = interpolateUsers(text, channel.guild.members, !!(modifications & Modifications.FriendlyNames));
   text = cleanMessage(text, modifications);
   
   if (directedTo) {
      const name = interpolateUsers(directedTo || "", channel.members, false);
      text = `${name}: ${text}`;
   }

   channel.send(text, { tts: !!(modifications & Modifications.TTS), split: true });
   return true;
}

const cleanMessage = (message: Message | string, modifications: number = Modifications.AsIs): string => {
   let text: string = (message instanceof Message) ? message.content.trim() : message.trim();

   /* Remove control characters and RTL marks */
   text = text.replace(/[\u0000-\u001f\u200f\u061c\u00ad]/uig, '');

   /* Capture URLs as case-sensitive */
   const urlRX = /((((?:http|https|ftp|sftp):(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9\.-]+|(?:www\.|[-;:&=\+\$,\w]+@)[A-Za-z0-9\.-]+)((?:\/[-\+~%\/\.\w_]*)?\??(?:[-\+=&;%@\.\w_]*)#?(?:[\.!\/\\\w]*))?)/ug; 
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
   text = text.replace(new RegExp(Brain.settings.name, "uig"), getEndearment());

   /* Replace all channel mentions with 'my secret place' */
   text = text.replace(/<#\d+>/uig, "my secret place");

   /* If "As Is" flag is not set, modify output for upper/lowercase */   
   if (!(modifications & Modifications.AsIs)) {
      /* If "Yell" flag is set, use uppercase -- otherwise, lowercase */
      text = !!(modifications & Modifications.Yell) ? text.toUpperCase() : text.toLowerCase();
      /* If "ForceLowercase" flag is set, force lowercase regardless of yelling (for learning,  comparison, etc.) */ 
      if (!!(modifications & Modifications.ForceLowercase)) text = text.toLowerCase();
   }

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
   text = text.replace(/[`"*_]{2,10}/iug, '');   
   
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


export { ProcessResults, processMessage, cleanMessage }



