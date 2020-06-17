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
   TTS = 16,
   Balance = 32
}

const emoticonRXs = [
   `:-)`, `:)`, `:-]`, `:]`, `:-3`, `:3`,	`:->`, `:>`, `8-)`, `8)`, `:-}`, `:}`, `:o)`, `:c)`, `:^)`, `=]`, `=)`,
   `:-D`, `:D`, `8-D`, `8D`, `x-D`, `xD`, `X-D`, `XD`, `=D`, `=3`, `B^D`, `:-))`, `:-(`, `:(`, `:-c`, `:c`,`:-<`,
   `:<`, `:-[`, `:[`, `:-||`, `>:[`, `:{`, `:@`, `>:(`, `:'-(`, `:'(`, `:'-)`, `:')`, `D-':`, `D:<`, `D:`, `D8`,
   `D;`, `D=`, `DX`, `:-O`, `:O`, `:-o`, `:o`, `:-0`, `8-0`, `>:O`, `:-*`, `:*`, `:×`, `;-)`, `;)`, `*-)`, `*)`,
   `;-]`, `;]`, `;^)`, `:-,`, `;D`, `:-P`, `:P`, `X-P`, `XP`, `x-p`, `xp`, `:-p`, `:p`, `:-Þ`, `:Þ`, `:-þ`, `:þ`,
   `:-b`, `:b`, `d:`, `=p`, `>:P`, `:-/`, `:/`, `:-.`, `>:\\`, `>:/`, `:\\`, `=/`, `=\\`, `:L`, `=L`, `:S`,`:-|`,
   `:|`, `:$`, `://)`, `://3`, `:-X`, `:X`, `:-#`, `:#`, `:-&`, `:&`, `O:-)`, `O:)`, `0:-3`, `0:3`, `0:-)`, `0:)`,
   `;^)`, `>:-)`, `>:)`, `}:-)`, `}:)`, `3:-)`, `3:)`, `>;)`, `>:3`, `>;3`, `|;-)`, `|-O`, `:-J`, `#-)`, `%-)`, `%)`,
   `:-###..`, `:###..`, `<:-|`, `',:-|`, `',:-l`, `</3`, `<\\3`, `<3` 
].map(emoticon => emoticon.replace(/[.*+?^${}()|[\]\\]/ug, '\\$&')).join('|');

//erx = [`:-)`, `:)`, `:-]`, `:]`, `:-3`, `:3`, `:->`, `:>`, `8-)`, `8)`, `:-}`, `:}`, `:o)`, `:c)`, `:^)`, `=]`, `=)`, `:-D`, `:D`, `8-D`, `8D`, `x-D`, `xD`, `X-D`, `XD`, `=D`, `=3`, `B^D`, `:-))`, `:-(`, `:(`, `:-c`, `:c`,`:-<`, `:<`, `:-[`, `:[`, `:-||`, `>:[`, `:{`, `:@`, `>:(`, `:'-(`, `:'(`, `:'-)`, `:')`, `D-':`, `D:<`, `D:`, `D8`, `D;`, `D=`, `DX`, `:-O`, `:O`, `:-o`, `:o`, `:-0`, `8-0`, `>:O`, `:-*`, `:*`, `:×`, `;-)`, `;)`, `*-)`, `*)`, `;-]`, `;]`, `;^)`, `:-,`, `;D`, `:-P`, `:P`, `X-P`, `XP`, `x-p`, `xp`, `:-p`, `:p`, `:-Þ`, `:Þ`, `:-þ`, `:þ`, `:-b`, `:b`, `d:`, `=p`, `>:P`, `:-/`, `:/`, `:-.`, `>:\\`, `>:/`, `:\\`, `=/`, `=\\`, `:L`, `=L`, `:S`,`:-|`, `:|`, `:$`, `://)`, `://3`, `:-X`, `:X`, `:-#`, `:#`, `:-&`, `:&`, `O:-)`, `O:)`, `0:-3`, `0:3`, `0:-)`, `0:)`, `;^)`, `>:-)`, `>:)`, `}:-)`, `}:)`, `3:-)`, `3:)`, `>;)`, `>:3`, `>;3`, `|;-)`, `|-O`, `:-J`, `#-)`, `%-)`, `%)`, `:-###..`, `:###..`, `<:-|`, `',:-|`, `',:-l`, `</3`, `<\\3`, `<3` ].map(emoticon => emoticon.replace(/[.*+?^${}()|[\]\\\-]/ug, '\\$&')).join('|');

const processMessage = (client: ClientUser, message: Message): ProcessResults => {
   const results: ProcessResults = { learned: false, processedText: "" }
   if (!(message.channel instanceof TextChannel) || message.type !== "DEFAULT") return results;
   
   /* TODO: Process server-specific blacklists to prevent users from responding */

   /* Do not process own messages */
   if (message.author.id === client.id) return results;
   
   const cleanText = cleanMessage(message, Modifications.ForceLowercase & Modifications.FriendlyNames);
   const processed: TriggerResult = Triggers.process(message);

   if (!processed.triggered) {      
      results.learned = Brain.learn(cleanText);
      if (message.isMentioned(client) || Brain.shouldRespond(message.content)) {
         let response = "";
         let seed = Brain.getSeed(cleanText);
         /* Try up to 5 times to get a unique response */
         for (let attempt = 0; attempt < 5; attempt++) {    
            response = Brain.getResponse(seed);
            if (response.toLowerCase() === message.content.toLowerCase() || response.toLowerCase() === cleanText.toLowerCase()) seed = Brain.getSeed();
         }
         const modifications = processed.modifications
                             | (message.tts ? Modifications.TTS : 0)
                             | (Brain.shouldYell(message.content) ? Modifications.Yell : 0);
         sendMessage(client, message.channel, response, getDisplayName(message.member), modifications);
         /* Learn what it just created, to create a feedback */
         Brain.learn(cleanMessage(response, Modifications.ForceLowercase & Modifications.FriendlyNames));
         results.response = response;
      }
   } else {
      results.triggeredBy = processed.triggeredBy;
      let modifications = processed.modifications | Modifications.Balance;
      if (!(modifications & Modifications.AsIs)) modifications |= (Brain.shouldYell(message.content) ? Modifications.Yell : 0);
      for (const line of processed.results) {
         sendMessage(client, message.channel, line, processed.directedTo, processed.modifications);         
      }
      results.response = processed.results.join('\n');
   }
   results.processedText = cleanText.trim();
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
   let fullText: string = (message instanceof Message) ? interpolateUsers(message.content.trim(), message.guild?.members, !!(modifications & Modifications.FriendlyNames)): message.trim();

   /* Quick bug fix for broken brains that stored "greentext" (>words) in a single line by accident
      words words>more words>even more words ->
         words words
         >more words
         >even more words
   */
   fullText = fullText.replace(/(\D+?)>(.+?)/muig, "$1\n>$2");
   /* Fix any broken custom emojis */
   fullText = fullText.replace(/<:(\w+?):(\d+?)\s+>/muig, "<:$1:$2>");

   const lines = fullText.split(/\n/ug);   

   let results: string[] = [];
   for (const line of lines) {

      let text = line;

      /* Remove ANSI control characters and RTL marks */      
      text = text.replace(/[\u0000-\u001f\u200f\u061c\u00ad]/uig, '');

      const blockCodes = {
         URLs: '🔗',
         emoticons: '☻',
         injections: '⚿'
      }

      /* Prevent injection of block escaping (someone maliciously putting '<CODE-NUMBER>' in the origin text */
      const blocksRX = new RegExp(`<[${Object.values(blockCodes).join('')}]\-\d+>`, 'ug');
      const injectionBlocks = extractBlocks(text, blockCodes.injections, blocksRX);
      const injected: string[] = injectionBlocks.blocks;
      text = injectionBlocks.text;

      /* Capture URLs as case-sensitive */
      const urlRX = /((((?:http|https|ftp|sftp):(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9\.-]+|(?:www\.|[-;:&=\+\$,\w]+@)[A-Za-z0-9\.-]+)((?:\/[-\+~%\/\.\w_]*)?\??(?:[-\+=&;%@\.\w_]*)#?(?:[\.!\/\\\w]*))?)/ug;    
      const extracted = extractBlocks(text, blockCodes.URLs, urlRX);
      const urls: string[] = extracted.blocks;
      text = extracted.text;

      /* Capture emoticons */
      const emoticonRX = new RegExp(emoticonRXs, 'ug');
      const extractedEmoticons = extractBlocks(text, blockCodes.emoticons, emoticonRX);
      const emoticons: string[] = extractedEmoticons.blocks;
      text = extractedEmoticons.text;

      /* Replace bot name with 'my friend' (and strip initial) */
      text = text.replace(new RegExp(`^${Brain.settings.name}:?\s*`, "ui"), "");
      text = text.replace(new RegExp(Brain.settings.name, "uig"), getEndearment());

      /* Replace all channel mentions with 'my secret place' */
      text = text.replace(/<#\d+>/uig, "my secret place");

      /* Mild bug fix for broken brains: replace periods/other characters in the middle of full words (more than 1 characters) with a period then a space.
         This should avoid causing problems with regular abbreviations (Dr., N.A.S.A, Mrs., etc.), and doing it after URLs should avoid breaking those */
      text = text.replace(/([^\s\.)]{2,}?)([\.")\]?!,])([^\s\.")\]?!,])/uig, "$1$2 $3");
      /* Fix edge cases where it is appropriate to have a character followed immediately by a quotation mark  */
      //text = text.replace(/"?(.+?)([\.)\]?!,])\s+"/uig, '"$1$2"');

      /* If "As Is" flag is not set, modify output for upper/lowercase */   
      if (!(modifications & Modifications.AsIs)) {
         /* If "Yell" flag is set, use uppercase -- otherwise, lowercase */
         text = !!(modifications & Modifications.Yell) ? text.toUpperCase() : text.toLowerCase();
         /* If "ForceLowercase" flag is set, force lowercase regardless of yelling (for learning,  comparison, etc.) */ 
         if (!!(modifications & Modifications.ForceLowercase)) text = text.toLowerCase();
      }

      /* Restore emoticons */
      if (emoticons.length > 0) text = restoreBlocks(text, blockCodes.emoticons, emoticons);

      /* Restore URLs */
      if (urls.length > 0) text = restoreBlocks(text, blockCodes.URLs, urls);
         
      /* Restore injected block escape attempts */
      if (injected.length > 0) text = restoreBlocks(text, blockCodes.injections, injected);
      
      results.push(text);
   }
   let result = results.join("\n");

   // Last step: balance brackets and quotation marks and such
   if (!!(modifications & Modifications.Balance)) result = balanceText(result, modifications);
   return result;
}

const extractBlocks = (text: string = "", symbol: string = "", regEx: RegExp | null = null): { text: string, blocks: string[] } => {
   if (!text || !symbol || !regEx) return { text: text, blocks: [] };   
   const blocks: string[] = [];
   const matches = text.match(regEx);
   if (matches) {
      for (let i = 0; i < matches.length; i++) {
         blocks.push(matches[i]);
         text = text.replace(matches[i], `<${symbol}-${i}>`);
      }
   }
   return { text: text, blocks: blocks }
}
const restoreBlocks = (text: string = "", symbol: string = "", blocks: string[] = []): string => {
   if (!text || !symbol || blocks.length === 0) return text;   
   for (let i = 0; i < blocks.length; i++) {
      text = text.replace(`<${symbol}-${i}>`, blocks[i]);
   }
   return text;
}

const balanceText = (text: string, modifications: number = (Modifications.AsIs | Modifications.Balance)): string => {
      
   const codeBlock: boolean = (text.match(/```/iug) || []).length > 0;
   text = text.replace(/[`"]{2,10}/iug, '');   

   /* If "As Is" flag is not set, strip formatting */   
   if (!(modifications & Modifications.AsIs)) text = text.replace(/[*_|]{2,10}/iug, '');   
      
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



