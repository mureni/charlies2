import { MessageAttachment, MessageEmbed, ClientUser, Message, TextChannel } from "discord.js";
import { getEndearment, getDisplayName, interpolateUsers, KnownUsers } from "./user";
import { Brain } from "./brain";
import { Swap } from "../controllers/swap";
import { TriggerResult, Triggers } from "./triggerProcessor";

const memoizedRX: Map<string, RegExp> = new Map<string, RegExp>();

const newRX = (expr: string, flags?: string) => {
   if (!memoizedRX.has(expr)) {
      const rx = flags ? new RegExp(expr, flags) : new RegExp(expr);
      memoizedRX.set(expr, rx);
      return rx;
   } else {
      return memoizedRX.get(expr) as RegExp;
   }   
}

// Maximum length of discord message
const MAX_LENGTH = 1950;

interface ProcessResults {
   learned: boolean;
   triggeredBy?: string;
   processedText: string;
   response?: string;
}

type ModificationType = {
   Case?: "upper" | "lower" | "unchanged",
   KeepOriginal?: boolean,
   ProcessSwaps?: boolean,
   UseEndearments?: boolean,
   TTS?: boolean,
   Balance?: boolean,
   StripFormatting?: boolean
}

const escapeRegExp = (rxString: string) => rxString.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string

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
].map(emoticon => escapeRegExp(emoticon)).join('|');

//erx = [`:-)`, `:)`, `:-]`, `:]`, `:-3`, `:3`, `:->`, `:>`, `8-)`, `8)`, `:-}`, `:}`, `:o)`, `:c)`, `:^)`, `=]`, `=)`, `:-D`, `:D`, `8-D`, `8D`, `x-D`, `xD`, `X-D`, `XD`, `=D`, `=3`, `B^D`, `:-))`, `:-(`, `:(`, `:-c`, `:c`,`:-<`, `:<`, `:-[`, `:[`, `:-||`, `>:[`, `:{`, `:@`, `>:(`, `:'-(`, `:'(`, `:'-)`, `:')`, `D-':`, `D:<`, `D:`, `D8`, `D;`, `D=`, `DX`, `:-O`, `:O`, `:-o`, `:o`, `:-0`, `8-0`, `>:O`, `:-*`, `:*`, `:×`, `;-)`, `;)`, `*-)`, `*)`, `;-]`, `;]`, `;^)`, `:-,`, `;D`, `:-P`, `:P`, `X-P`, `XP`, `x-p`, `xp`, `:-p`, `:p`, `:-Þ`, `:Þ`, `:-þ`, `:þ`, `:-b`, `:b`, `d:`, `=p`, `>:P`, `:-/`, `:/`, `:-.`, `>:\\`, `>:/`, `:\\`, `=/`, `=\\`, `:L`, `=L`, `:S`,`:-|`, `:|`, `:$`, `://)`, `://3`, `:-X`, `:X`, `:-#`, `:#`, `:-&`, `:&`, `O:-)`, `O:)`, `0:-3`, `0:3`, `0:-)`, `0:)`, `;^)`, `>:-)`, `>:)`, `}:-)`, `}:)`, `3:-)`, `3:)`, `>;)`, `>:3`, `>;3`, `|;-)`, `|-O`, `:-J`, `#-)`, `%-)`, `%)`, `:-###..`, `:###..`, `<:-|`, `',:-|`, `',:-l`, `</3`, `<\\3`, `<3` ].map(emoticon => emoticon.replace(/[.*+?^${}()|[\]\\\-]/ug, '\\$&')).join('|');

const processMessage = async (client: ClientUser, message: Message): Promise<ProcessResults> => {
   const results: ProcessResults = { learned: false, processedText: "" }
   if (!(message.channel instanceof TextChannel) || message.type !== "DEFAULT") return results;
   
   /* TODO: Process server-specific blacklists to prevent users from responding */

   /* Do not process own messages */
   if (message.author.id === client.id) return results;
   
   let cleanText = cleanMessage(message, { Case: "lower", UseEndearments: true });

   /* Remove initial references to self (e.g. "charlies learn this text" -> "learn this text", "charlies: hi" -> "hi") */
   cleanText = cleanText.replace(newRX(`^\s*\b${escapeRegExp(client.username)}\b[:,]?\s*`, "uig"), "");
   cleanText = cleanText.replace(newRX(`^\s*\b${escapeRegExp(Brain.botName)}\b[:,]?\s*`, "uig"), "");

   const processed: TriggerResult = await Triggers.process(message);

   if (!processed.triggered) {      
      
      /* Detect whether a conversation with the person is ongoing or if a response is appropriate */
      let shouldRespond: boolean = message.mentions.has(client) || Brain.shouldRespond(Brain.botName, message.content);
      let seed: string = "";

      // TODO: Populate and maintain KnownUsers
      const user = KnownUsers.get(message.author.id)!;         
      if (user) {         
         const conversation = user.conversations.get(message.channel.id);
         if (conversation) {
            // Optimal time is roughly 7 seconds delay for a conversation
            if (Date.now() - conversation.lastSpokeAt < Brain.settings.conversationTimeLimit) {
               shouldRespond = true;
               seed = [cleanText, conversation.lastTopic].join(" ");
            }
         };
      }           

      if (shouldRespond) {
         if (message.channel instanceof TextChannel) message.channel.startTyping();
         if (user) {
            user.conversations.set(message.channel.id, {
               lastSpokeAt: Date.now(),
               lastTopic: cleanText
            });
         }

         let response = "";
         if (!seed) seed = await Brain.getSeed(cleanText);
         /* Try up to 5 times to get a unique response */
         for (let attempt = 0; attempt < 5; attempt++) {    
            response = await Brain.getResponse(seed);
            if (response.toLowerCase() !== cleanText.toLowerCase()) break;
            seed = await Brain.getSeed();
         }         
         // If it still repeats, get a random response with a random seed
         if (response.toLowerCase() === cleanText.toLowerCase()) response = await Brain.getResponse(await Brain.getRandomSeed());
         // If it STILL repeats, return a "confounded" emoji 
         if (response.toLowerCase() === cleanText.toLowerCase()) response = '😖';

         const mods: ModificationType = { ...processed.modifications };
         
         if (message.tts) mods.TTS = true;
         if (Brain.shouldYell(message.content)) mods.Case = "upper";

         const directedTo = getDisplayName(message.member?.user ?? message.author, message.guild?.members);
         await sendMessage(client, message.channel, `${directedTo}: ${response}`, mods);

         /* Learn what it just created, to create a feedback */
         const cleanResponse = cleanMessage(response, { Case: "lower", UseEndearments: true });
         await Brain.learn(cleanResponse);
         
         results.response = response;
      }

      results.learned = await Brain.learn(cleanText);
      

   } else {
      
      if (message.channel instanceof TextChannel) message.channel.startTyping();
      results.triggeredBy = processed.triggeredBy;
      const mods: ModificationType = { ... processed.modifications };
      mods.Balance = true;
      
      if (Brain.shouldYell(message.content)) mods.Case = "upper";

      if (processed.directedTo) {
         if (processed.results.length > 1) {
            // Only say the "directed to" name once if there is more than one line of response
            processed.results.unshift(`${processed.directedTo}:`);
         } else {
            processed.results[0] = `${processed.directedTo}: ${processed.results[0]}`
         }
      }
      let linesToSend: string[] = [];
      let outputLength: number = 0;
      for (const line of processed.results) {
         if (line instanceof MessageEmbed || line instanceof MessageAttachment) {
            // Do not process anything on RichEmbeds -- this allows triggers to be somewhat insecure, be careful!            
            await message.channel.send(line);
         } else {
            // If the line will make the overall message too long, send what is in the queue and then clear it 
            if (outputLength + line.length > MAX_LENGTH) {
               await sendMessage(client, message.channel, linesToSend.join('\n'), mods);
               linesToSend = [];
            }
            linesToSend.push(line);
            outputLength += line.length;
         }
      }
      if (linesToSend.length > 0) {         
         await sendMessage(client, message.channel, linesToSend.join('\n'), mods);
      }      
      results.response = processed.results.join('\n');
   }
   results.processedText = cleanText.trim();
   message.channel.stopTyping(true);
   return results;
}

/* Utility functions for bot interface */
const sendMessage = async (client: ClientUser, channel: TextChannel, text: string, mods?: ModificationType): Promise<boolean> => {
   const permissions = channel.permissionsFor(client);
   if (!permissions || !permissions.has('SEND_MESSAGES')) return false;
   if (!channel.guild) return false;

   text = interpolateUsers(text, channel.guild.members, !!(mods?.UseEndearments));
   text = cleanMessage(text, mods);

   /* Processing swaps should always be done AFTER cleaning the message.
      This prevents swap rules causing usernames or channels to accidentally leak 
   */
   if (mods?.ProcessSwaps) text = Swap.process(channel.guild.id, text);
   
   // TODO: Balance code blocks and such accounting for max length, if necessary
   while (text !== "") {      
      await channel.send(text.substring(0, MAX_LENGTH), { tts: !!(mods?.TTS), split: true });
      text = text.substring(MAX_LENGTH);
   }
   return true;
}

const cleanMessage = (message: Message | string, mods?: ModificationType): string => {

   // TODO: Memoize all regexps

   let fullText: string;

   if (message instanceof Message) {
      fullText = message.content.trim();
      fullText = interpolateUsers(fullText, message.guild?.members, !!(mods?.UseEndearments));      
   } else {
      fullText = message.trim();
      fullText = interpolateUsers(fullText, undefined, !!(mods?.UseEndearments));
   }

   /* Quick bug fix for broken brains that stored "greentext" (>words) in a single line by accident
      words words>more words>even more words ->
         words words
         >more words
         >even more words
   */
   // fullText = fullText.replace(/(\D+?)>(.+?)/muig, "$1\n>$2");
   /* Fix any broken custom emojis */
   fullText = fullText.replace(/<:(\w+?):(\d+?)\s+>/muig, "<:$1:$2>");
  

   /* Remove ANSI control characters and RTL marks (skipping CR and LF) */      
   fullText = fullText.replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u200f\u061c\u00ad]/muig, '');
      
   const formatCodes = {
      underline: "_",
      bold: "*",
      italic: "**",
      spoiler: "||",
      strikethrough: "~~"
   }

   const blockCodes = {
      URLs: '🔗',
      emoticons: '☻',
      codeBlocks: '⎁',                  
      injections: '⚿'
   }

   /* Prevent injection of block escaping (someone maliciously putting '<[CODE]-[NUMBER]>' in the origin text */
   const blocksRX = newRX(`<[${Object.values(blockCodes).join('')}]\-\d+>`, 'mug');
   const injectionBlocks = extractBlocks(fullText, blockCodes.injections, blocksRX);
   const injected: string[] = injectionBlocks.blocks;
   fullText = injectionBlocks.text;

   /* Capture code blocks (between pairs of ```) as case insensitive and as-is regarding line breaks */
   const codeRX = /```.+?```/muigs;
   const extractedCode = extractBlocks(fullText, blockCodes.codeBlocks, codeRX);
   const codeBlocks: string[] = extractedCode.blocks;
   fullText = extractedCode.text;

   /* Capture URLs, case-sensitive */
   const urlRX = /((((?:http|https|ftp|sftp):(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9\.-]+|(?:www\.|[-;:&=\+\$,\w]+@)[A-Za-z0-9\.-]+)((?:\/[-\+~%\/\.\w_]*)?\??(?:[-\+=&;%@\.\w_]*)#?(?:[\.!\/\\\w]*))?)/mug;
   const extractedURLs = extractBlocks(fullText, blockCodes.URLs, urlRX);
   const urls: string[] = extractedURLs.blocks;
   fullText = extractedURLs.text;

   /* Capture emoticons, case-sensitive, NO UNICODE (will cause 'invalid escape') */
   const emoticonRX = newRX(emoticonRXs, 'mg');
   const extractedEmoticons = extractBlocks(fullText, blockCodes.emoticons, emoticonRX);
   const emoticons: string[] = extractedEmoticons.blocks;
   fullText = extractedEmoticons.text;

   /* Prepare regexp for stripping formatting if required */
   const codes = `(?:${escapeRegExp(Object.values(formatCodes).join('|'))})`;
   const formatRX = newRX(`${codes}(?<Text>)${codes}`, 'ug');

   /* Split lines for further line-level processing */
   const lines = fullText.split(/\r?\n/ug);

   let results: string[] = [];
   for (const line of lines) {

      let text = line;

      /* Replace bot name with 'my friend' (and strip initial) */
      text = text.replace(newRX(`^${Brain.botName}:?\s*`, "ui"), "");
      text = text.replace(newRX(Brain.botName, "uig"), getEndearment());

      /* Replace all channel mentions with 'my secret place' */
      // TODO: Change this to a rotating list of secret places
      text = text.replace(/<#\d+>/uig, "my secret place");

      /* Mild bug fix for broken brains: replace periods/other characters in the middle of full words (more than 1 characters) with a period then a space.
         This should avoid causing problems with regular abbreviations (Dr., N.A.S.A, Mrs., etc.), and doing it after URLs should avoid breaking those */
      text = text.replace(/([^\s\.)]{2,}?)([\.")\]?!,])([^\s\.")\]?!,])/uig, "$1$2 $3");
      /* TODO: fix edge cases where comma should not have a space (for numbers, i.e. 2,000,000) */
      /* TODO: fix edge cases where period is between things that aren't detected as URL but should be (i.e. sub.example.com) - period should not have space after */
      /* TODO: fix edge cases where it is appropriate to have a character followed immediately by a quotation mark  */      

      // Fix broken discord mentions caused by the above
      text = text.replace(/<@!\s+(\d+)>/muig, "<@!$1>");

      // TODO: test if this is broken or necessary
      //text = text.replace(/"?(.+?)([\.)\]?!,])\s+"/uig, '"$1$2"');
      
      switch (mods?.Case) {
         case "unchanged":
            break;
         case "upper":
            text = text.toUpperCase();
            break;
         case "lower":
         default: 
            text = text.toLowerCase();
            break;
      }
      
      if (mods?.StripFormatting) text = text.replace(formatRX, '$<Text>');

      results.push(text);
   }
   let result = results.join("\n");

   /* Restore emoticons */
   if (emoticons.length > 0) result = restoreBlocks(result, blockCodes.emoticons, emoticons);

   /* Restore URLs */
   if (urls.length > 0) result = restoreBlocks(result, blockCodes.URLs, urls);

   /* Restore code blocks */
   if (codeBlocks.length > 0) result = restoreBlocks(result, blockCodes.codeBlocks, codeBlocks);
      
   /* Restore injected block escape attempts */
   if (injected.length > 0) result = restoreBlocks(result, blockCodes.injections, injected);

   // Last step: balance brackets and quotation marks and such
   if (mods?.Balance) result = balanceText(result);
   
   return result;
}

const extractBlocks = (text: string = "", symbol: string = "", regEx: RegExp | null = null): { text: string, blocks: string[] } => {
   /* "Extracts" text matching the provided regular expression, saving it "as-is" and replacing
       it with a <[symbol]-[index]> where index is each instance of the text matching the regular expression */
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

const balanceText = (text: string): string => {
               
   const isCodeSegmentsUnbalanced: boolean = (text.match(/`/mug) ?? []).length % 2 !== 0;
   const numParenthesisStarted: number = (text.match(/\(/mug) ?? []).length;
   const numParenthesisEnded: number = (text.match(/\)/mug) ?? []).length;
   const isDoubleQuoteUnbalanced: boolean = (text.match(/"/mug) ?? []).length % 2 !== 0;
   
   if (isDoubleQuoteUnbalanced) {
      if (text.endsWith('"')) {
         text = '"' + text;
      } else {
         text = text + '"';
      }
   }
   if (numParenthesisStarted < numParenthesisEnded) {
      text = "(".repeat(numParenthesisEnded - numParenthesisStarted) + text;
   } else if (numParenthesisStarted > numParenthesisEnded) {
      text = text + ")".repeat(numParenthesisStarted - numParenthesisEnded);
   }
   if (isCodeSegmentsUnbalanced) {
      if (text.endsWith('`')) {
         text = '`' + text;
      } else { 
         text = text + '`';
      }
   }
   return text; 

}


export { ProcessResults, processMessage, cleanMessage, ModificationType }



