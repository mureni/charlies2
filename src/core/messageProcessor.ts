import { getEndearment, interpolateUsers } from "./user";
import { Brain } from "./brain";
import { log } from "./log";
import { Filters } from "@/filters";
import { InteractionRouter } from "./interactionRouter";
import type { ModificationType, TriggerResult } from "./triggerTypes";
import { env, escapeRegExp, newRX, randFrom } from "@/utils";
import type { CoreMessage, OutgoingMessage, OutgoingMessage as PlatformOutgoingMessage } from "@/platform";
import { touchKnownUser, saveKnownUser } from "@/platform/knownUsers";


// Maximum length of discord message
const MAX_LENGTH = 1950;

interface ProcessResults {
   learned: boolean;
   triggeredBy?: string;
   processedText: string;
   response?: string;
   directedTo?: string;
}

type MemberContext = Parameters<typeof interpolateUsers>[1];


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
].map(emoticon => newRX(`\\b${escapeRegExp(emoticon)}\\b`)).join("|");

const LINE_BREAK_RX = newRX(`\\r?\\n`, "musig");
const GREENTEXT_START_RX = newRX(`^\\s*>`, "u");
const GREENTEXT_SPLIT_RX = newRX(`(?=>)`, "u");
const CHANNEL_MENTION_RX = newRX(`<#\\d+>`, "musig");
const CODE_BLOCK_FENCE_RX = newRX(`\\\`{3}`, "g");

const DEFAULT_SECRET_PLACES = [
   "my secret place",
   "the quiet side room",
   "a tucked-away nook",
   "the hidden corner",
   "the back hallway",
   "a little hideaway"
];
const traceFlow = env("TRACE_FLOW") === "true";
const trace = (message: string, data?: unknown): void => {
   if (traceFlow) log(data ? { message: `Flow: ${message}`, data } : `Flow: ${message}`, "trace");
};

const getSecretPlace = (): string => {
   const configured = Brain.settings?.secretPlaces;
   const places = Array.isArray(configured) && configured.length > 0
      ? configured
      : DEFAULT_SECRET_PLACES;
   return randFrom(places) ?? "my secret place";
};

//erx = [`:-)`, `:)`, `:-]`, `:]`, `:-3`, `:3`, `:->`, `:>`, `8-)`, `8)`, `:-}`, `:}`, `:o)`, `:c)`, `:^)`, `=]`, `=)`, `:-D`, `:D`, `8-D`, `8D`, `x-D`, `xD`, `X-D`, `XD`, `=D`, `=3`, `B^D`, `:-))`, `:-(`, `:(`, `:-c`, `:c`,`:-<`, `:<`, `:-[`, `:[`, `:-||`, `>:[`, `:{`, `:@`, `>:(`, `:'-(`, `:'(`, `:'-)`, `:')`, `D-':`, `D:<`, `D:`, `D8`, `D;`, `D=`, `DX`, `:-O`, `:O`, `:-o`, `:o`, `:-0`, `8-0`, `>:O`, `:-*`, `:*`, `:×`, `;-)`, `;)`, `*-)`, `*)`, `;-]`, `;]`, `;^)`, `:-,`, `;D`, `:-P`, `:P`, `X-P`, `XP`, `x-p`, `xp`, `:-p`, `:p`, `:-Þ`, `:Þ`, `:-þ`, `:þ`, `:-b`, `:b`, `d:`, `=p`, `>:P`, `:-/`, `:/`, `:-.`, `>:\\`, `>:/`, `:\\`, `=/`, `=\\`, `:L`, `=L`, `:S`,`:-|`, `:|`, `:$`, `://)`, `://3`, `:-X`, `:X`, `:-#`, `:#`, `:-&`, `:&`, `O:-)`, `O:)`, `0:-3`, `0:3`, `0:-)`, `0:)`, `;^)`, `>:-)`, `>:)`, `}:-)`, `}:)`, `3:-)`, `3:)`, `>;)`, `>:3`, `>;3`, `|;-)`, `|-O`, `:-J`, `#-)`, `%-)`, `%)`, `:-###..`, `:###..`, `<:-|`, `',:-|`, `',:-l`, `</3`, `<\\3`, `<3` ].map(emoticon => emoticon.replace(/[.*+?^${}()|[\]\\\-]/ug, '\\$&')).join('|');

const processMessage = async (message: CoreMessage): Promise<ProcessResults> => {
   const results: ProcessResults = { learned: false, processedText: "" }
   const memberContext = message as MemberContext;
   const platform = message.platform;
   const canSend = platform?.canSend ? await platform.canSend(message.channelId, message.guildId) : true;
   trace(
      "processMessage start",
      {
         author: message.authorId,
         channel: message.channelId,
         type: message.channel?.type ?? "unknown",
         isBot: Boolean(message.isBot),
         isSelf: Boolean(message.isSelf),
         mentionsBot: Boolean(message.mentionsBot),
         canSend,
         platform: platform
      }
   );
   
   /* Do not process own messages */
   if (message.isSelf) {
      trace(`skip: isSelf=true`);
      return results;
   }
   
   let cleanText = await cleanMessage(message.content, { Case: "lower", UseEndearments: true }, memberContext);

   /* Remove initial references to self (e.g. "charlies learn this text" -> "learn this text", "charlies: hi" -> "hi") */
   cleanText = cleanText.replace(newRX(`^\\s*\\b${escapeRegExp(Brain.botName)}\\b[:,]?\\s*`, "uig"), "");
   const preBrainText = Filters.apply("preBrain", cleanText, message, "learn");

   const processed: TriggerResult = await InteractionRouter.process(message);
   await InteractionRouter.registerCommands(platform);
   log(`Trigger results: ${JSON.stringify(processed)}`, "debug");

   if (processed.error) {
      log(processed.error.message, "error");
   }

   const isDirectMessage = message.channel?.scope === "dm";
   const isGroupDm = Boolean(message.channel?.isGroupDm)
      || (isDirectMessage && typeof message.channel?.memberCount === "number" && message.channel.memberCount > 1);
   const shouldPrefixResponse = !(isDirectMessage && !isGroupDm);

   if (!processed.triggered) {
      const personalityResults = await processPersonalityResponse(
         message,
         processed,
         preBrainText,
         memberContext,
         canSend,
         shouldPrefixResponse
      );
      results.response = personalityResults.response;
      results.directedTo = personalityResults.directedTo;
      results.learned = personalityResults.learned;
   } else {
      
      trace("triggered", { canSend, platform: platform, resultsCount: processed.results.length });
      if (canSend && platform) await platform.sendTyping(message.channelId);
      results.triggeredBy = processed.triggeredBy;
      const mods: ModificationType = processed.modifications;
      if (!mods.KeepOriginal) mods.Balance = true;
      
      if (!(mods.KeepOriginal || mods.Case === "unchanged") && Brain.shouldYell(message.content)) mods.Case = "upper";

      if (processed.directedTo && shouldPrefixResponse) {
         processed.results[0].contents = `${processed.directedTo}: ${processed.results[0].contents}`;
         results.directedTo = processed.directedTo;
      }
      
      const outgoingPayload: OutgoingMessage = { contents: "", embeds: [], attachments: [] };
      results.response = "";
      for (const resultsPayload of processed.results as PlatformOutgoingMessage[]) {
         outgoingPayload.contents = resultsPayload.contents;
         if (resultsPayload.attachments) {
            results.response += resultsPayload.attachments.map(attachment => `[attachment ${attachment.name}]`).join("\n");
            //log(`Trigger results contain attachments; including attachments in message`);
            outgoingPayload.attachments = resultsPayload.attachments;
         }
         if (resultsPayload.embeds) {
            results.response += resultsPayload.embeds.map(embed => `[embed ${embed.title}]`).join("\n");
            //log(`Trigger results contain embeds; including embeds in message`);
            outgoingPayload.embeds = resultsPayload.embeds;
         }

         // The results.response is really for debugging purposes, and is only used in the 'on message received' event in the main index.ts file
         results.response += `${outgoingPayload.contents}\n`;

         // Send any message payload that is not yet sent
         if (outgoingPayload.contents !== "" || (outgoingPayload.attachments?.length ?? 0) > 0  || (outgoingPayload.embeds?.length ?? 0) > 0) {
            await sendMessage(message, outgoingPayload, mods);
         }
      }

      results.response = results.response.trimEnd();
   }
   results.processedText = preBrainText.trim();
   return results;
}

const processPersonalityResponse = async (
   message: CoreMessage,
   processed: TriggerResult,
   preBrainText: string,
   memberContext: MemberContext | undefined,
   canSend: boolean,
   shouldPrefixResponse: boolean
): Promise<Pick<ProcessResults, "response" | "directedTo" | "learned">> => {
   const platform = message.platform;
   const isDirectMessage = message.channel?.scope === "dm";
   const isGroupDm = Boolean(message.channel?.isGroupDm)
      || (isDirectMessage && typeof message.channel?.memberCount === "number" && message.channel.memberCount > 1);
   const mentionsBot = Boolean(message.mentionsBot);
   const matchesBotName = (text: string): boolean => {
      if (!Brain.botName) return false;
      return Boolean(text.match(newRX(escapeRegExp(Brain.botName), "giu")));
   };

   let shouldRespond = false;
   if (isDirectMessage && !isGroupDm) {
      shouldRespond = true;
   } else if (isDirectMessage && isGroupDm) {
      const groupSize = Math.max(2, message.channel?.memberCount ?? 2);
      const baseOutburst = Brain.settings.outburstThreshold;
      const groupOutburst = Math.min(1, baseOutburst * groupSize);
      shouldRespond = Math.random() < groupOutburst || mentionsBot || matchesBotName(preBrainText);
   } else {
      shouldRespond = mentionsBot || Brain.shouldRespond(Brain.botName, preBrainText);
   }

   /* If the message is a reference (reply) then check if the referenced message should be responded to */
   if (message.referencedContent) {
      if (message.referencedMentionsBot || matchesBotName(message.referencedContent)) shouldRespond = true;
   }

   trace("shouldRespond", { mentionsBot, shouldRespond, isDirectMessage, isGroupDm });

   let seed: string = "";
   let conversationActive = false;
   const user = touchKnownUser(message.authorId, message.authorName);
   const conversation = user.conversations.get(message.channelId);
   if (conversation) {
      if (Date.now() - conversation.lastSpokeAt < Brain.settings.conversationTimeLimit) {
         shouldRespond = true;
         conversationActive = true;
         seed = [preBrainText, conversation.lastTopic].join(" ");
      }
   }

   if (shouldRespond && canSend && platform) {
      trace("respond", {
         shouldRespond,
         canSend,
         platform: platform,
         conversationActive,
         seedProvided: seed !== ""
      });
      await platform.sendTyping(message.channelId);
      user.conversations.set(message.channelId, {
         lastSpokeAt: Date.now(),
         lastTopic: preBrainText
      });
      saveKnownUser(message.authorId, user, { bump: false });

      let response = "";
      if (!seed) seed = await Brain.getSeed(preBrainText);
      for (let attempt = 0; attempt < 5; attempt++) {
         response = await Brain.getResponse(seed);
         if (response.toLowerCase() !== preBrainText.toLowerCase()) break;
         seed = await Brain.getSeed();
      }
      if (response.toLowerCase() === preBrainText.toLowerCase()) response = await Brain.getResponse(await Brain.getRandomSeed());
      if (response.toLowerCase() === preBrainText.toLowerCase()) response = "😖";

      const mods: ModificationType = { ...processed.modifications };

      if (message.tts) mods.TTS = true;
      if (Brain.shouldYell(message.content)) mods.Case = "upper";

      const directedTo = shouldPrefixResponse ? message.authorName : undefined;
      if (directedTo) {
         await sendMessage(message, { contents: `${directedTo}: ${response}` }, mods);
      } else {
         await sendMessage(message, { contents: response }, mods);
      }

      /* Learn what it just created, to create a feedback */
      const cleanResponse = await cleanMessage(response, { Case: "lower", UseEndearments: true }, memberContext);
      await Brain.learn(cleanResponse);

      return {
         learned: await Brain.learn(preBrainText),
         response,
         directedTo
      };
   }

   trace("not responding", {
      shouldRespond,
      canSend,
      platform: platform,
      conversationActive
   });

   return { learned: await Brain.learn(preBrainText) };
};

const splitTextForSending = (text: string, maxLength: number): string[] => {
   if (text.length <= maxLength) return [text];
   const chunks: string[] = [];
   let remaining = text;
   while (remaining.length > maxLength) {
      let chunk = remaining.slice(0, maxLength);
      remaining = remaining.slice(maxLength);
      const fenceCount = (chunk.match(CODE_BLOCK_FENCE_RX) ?? []).length;
      if (fenceCount % 2 !== 0) {
         if (chunk.length + 4 > maxLength) {
            const trimSize = chunk.length + 4 - maxLength;
            remaining = chunk.slice(chunk.length - trimSize) + remaining;
            chunk = chunk.slice(0, chunk.length - trimSize);
         }
         chunk = `${chunk}\n\`\`\``;
         remaining = `\`\`\`\n${remaining}`;
      }
      chunks.push(chunk);
   }
   if (remaining.length > 0) chunks.push(remaining);
   return chunks;
};

/* Utility functions for bot interface */
const sendMessage = async (context: CoreMessage, message: OutgoingMessage, mods?: ModificationType): Promise<boolean> => {
   const platform = context.platform;
   if (!platform) {
      trace(`sendMessage skipped: platform=false channel=${context.channelId}`);
      return false;
   }
   const memberContext = context.memberContext as MemberContext | undefined;
   const workingMods = mods ? { ...mods } : undefined;
   if (workingMods?.KeepOriginal) {
      // Reset all other mods
      workingMods.Balance = false;
      workingMods.Case = "unchanged";
      workingMods.ProcessSwaps = false;
      workingMods.StripFormatting = false;
      workingMods.UseEndearments = false;
   }
   let text = message.contents;
   text = await interpolateUsers(text, memberContext, Boolean(workingMods?.UseEndearments));
   text = await cleanMessage(text, workingMods, memberContext);
   const skipFilters = workingMods?.ProcessSwaps === false ? ["swaps"] : undefined;
   text = Filters.apply("postBrain", text, context, "respond", { skipIds: skipFilters });
   const embeds = message.embeds ?? [];
   const files = message.attachments ?? [];
   if (text === "" && embeds.length === 0 && files.length === 0) return true;
   // Can't send empty message with embeds to discord, hack around it
   if ((embeds.length > 0 || files.length > 0) && text === "") text = " ";
   const chunks = splitTextForSending(text, MAX_LENGTH);
   for (let index = 0; index < chunks.length; index++) {
      await platform.sendMessage(context.channelId, {
         contents: chunks[index],
         embeds: index === 0 ? embeds : [],
         attachments: index === 0 ? files : [],
         tts: Boolean(workingMods?.TTS)
      });
   }
   return true;
}

const cleanMessage = async (text: string, mods?: ModificationType, members?: MemberContext): Promise<string> => {

   let fullText: string;

   const workingMods = mods ? { ...mods } : undefined;
   if (workingMods?.KeepOriginal) {
      // Reset all other mods
      workingMods.Balance = false;
      workingMods.Case = "unchanged";
      workingMods.ProcessSwaps = false;
      workingMods.StripFormatting = false;
      workingMods.UseEndearments = false;
   }
   const botNameCleaner = (text: string) => {
      /* Ensure no rogue RegExp-breaking characters in the bot name */
      const cleanBotName = escapeRegExp(Brain.botName);
      /* Strip initial use of the bot's name (most common usage being "botname: text text text" with or without the ":") */
      text = text.replace(newRX(`^\\s*${cleanBotName}:?\\s*`, "musig"), "");
      /* Replace any remaining references to the bot's name with 'my friend' or similar generic endearment */
      return text.replace(newRX(cleanBotName, "musig"), getEndearment());
   }

   fullText = botNameCleaner(text.trim());
   fullText = await interpolateUsers(fullText, members, Boolean(workingMods?.UseEndearments));

   /* Fix any broken custom emojis (<:name:00000000>) where a space before the > was accidentally saved */
   fullText = fullText.replace(newRX(`<:(\\w+?):(\\d+?)\\s+>`, "musig"), "<:$1:$2>");

   /* Remove ANSI control characters and RTL marks (skipping CR and LF) */
   fullText = fullText.replace(newRX(`[\\u0000-\\u0009\\u000b\\u000c\\u000e-\\u001f\\u200f\\u061c\\u00ad]`, "musig"), "");
      
   const formatCodes = {
      underline: "_",
      bold: "*",
      bold2: "__",
      italic: "**",
      spoiler: "||",
      strikethrough: "~~",
      code: "`"
   }

   const blockCodes = {
      URLs: "🔗",
      emoticons: "☻",
      codeBlocks: "⎁",
      injections: "⚿"
   }

   /* Prevent injection of block escaping (someone maliciously putting '<[CODE]-[NUMBER]>' in the origin text */
   const blocksRX = newRX(`<[${Object.values(blockCodes).join("")}]-\\d+>`, "muigs");
   const injectionBlocks = extractBlocks(fullText, blockCodes.injections, blocksRX);
   const injected: string[] = injectionBlocks.blocks;
   fullText = injectionBlocks.text;

   /* Capture code blocks (between pairs of ```) as case insensitive and as-is regarding line breaks */
   const codeRX = newRX("```[\\s\\S]+?```", "muigs");
   const extractedCode = extractBlocks(fullText, blockCodes.codeBlocks, codeRX);
   const codeBlocks: string[] = extractedCode.blocks;
   fullText = extractedCode.text;

   /* Capture URLs, case-sensitive */
   const urlRX = newRX(`((((?:http|https|ftp|sftp):(?:\\/\\/)?)(?:[-;:&=\\+\\$,\\w]+@)?[A-Za-z0-9\\.-]+|(?:www\\.|[-;:&=\\+\\$,\\w]+@)[A-Za-z0-9\\.-]+)((?:\\/[-\\+~%\\/\\.\\w_]*)?\\??(?:[-\\+=&;%@\\.\\w_]*)#?(?:[\\.!\\/\\\\\\w]*))?)`, "mug");
   const extractedURLs = extractBlocks(fullText, blockCodes.URLs, urlRX);
   const urls: string[] = extractedURLs.blocks;
   fullText = extractedURLs.text;

   /* Capture emoticons, case-sensitive, NO UNICODE (will cause 'invalid escape') */
   const emoticonRX = newRX(emoticonRXs, "mg");
   const extractedEmoticons = extractBlocks(fullText, blockCodes.emoticons, emoticonRX);
   const emoticons: string[] = extractedEmoticons.blocks;
   fullText = extractedEmoticons.text;

   /* Prepare regexp for stripping formatting if required */
   const formatCodeRX = `(?:${Object.values(formatCodes).map(code => escapeRegExp(code)).join("|")})`;
   const stripFormattingRX = newRX(`${formatCodeRX}+(?<Text>.+?)${formatCodeRX}+`, "misug");

   /* Split lines for further line-level processing */
   const lines = fullText.split(LINE_BREAK_RX);
   

   const results: string[] = [];
   for (const line of lines) {

      let text = line;



      /* Replace all channel mentions with a rotating list of secret places */
      text = text.replace(CHANNEL_MENTION_RX, () => getSecretPlace());
   
    
      switch (workingMods?.Case) {
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
      
      if (workingMods?.StripFormatting) text = text.replace(stripFormattingRX, "$<Text>");

      const greentextParts = text.match(GREENTEXT_START_RX) ? text.split(GREENTEXT_SPLIT_RX) : null;
      if (greentextParts && greentextParts.length > 1) {
         greentextParts.forEach((part) => results.push(part));
         continue;
      }

      results.push(text);
   }
   let result = results.join("\n");

   /* Restore emoticons */
   if (emoticons.length > 0) result = restoreBlocks(result, blockCodes.emoticons, emoticons);

   /* Restore URLs */
   if (urls.length > 0) result = restoreBlocks(result, blockCodes.URLs, urls);
   
   /* Balance brackets and quotation marks and such. Do this before restoring code blocks to avoid counting ``` as 3x ` */
   if (workingMods?.Balance) result = balanceText(result);

   /* Restore code blocks */
   if (codeBlocks.length > 0) result = restoreBlocks(result, blockCodes.codeBlocks, codeBlocks);
      
   /* Restore injected block escape attempts */
   if (injected.length > 0) result = restoreBlocks(result, blockCodes.injections, injected);


   
   return result;
}

const extractBlocks = (text: string = "", symbol: string = "", regEx: RegExp | null = null): { text: string, blocks: string[] } => {
   /* "Extracts" text matching the provided regular expression, saving it "as-is" and replacing
       it with a <[symbol]-[index]> where index is each instance of the text matching the regular expression */
       
   /* NOTE: There should be only one match per <[symbol]-[index]>. Do not use matchAll/replaceAll for this.
            Let the regexp decide if the match is global, since this will work itself out in the number of matches found. */
   if (!text || !symbol || !regEx) return { text: text, blocks: [] };
   const blocks: string[] = [];
   if (regEx.global) {
      const workingRX = new RegExp(regEx.source, regEx.flags);
      const matches = Array.from(text.matchAll(workingRX));
      if (matches.length > 0) {
         let rebuilt = "";
         let lastIndex = 0;
         matches.forEach((match, index) => {
            const matchText = match[0];
            const matchIndex = match.index ?? 0;
            rebuilt += text.slice(lastIndex, matchIndex);
            rebuilt += `<${symbol}-${index}>`;
            blocks.push(matchText);
            lastIndex = matchIndex + matchText.length;
         });
         rebuilt += text.slice(lastIndex);
         text = rebuilt;
      }
   } else {
      const match = text.match(regEx);
      if (match && match.index !== undefined) {
         blocks.push(match[0]);
         text = text.slice(0, match.index) + `<${symbol}-0>` + text.slice(match.index + match[0].length);
      }
   }
   return { text: text, blocks: blocks };
}
const restoreBlocks = (text: string = "", symbol: string = "", blocks: string[] = []): string => {
   /* NOTE: There should be only one match per <[symbol]-[index]>. Do not use RegExp or replaceAll for this.
            The data that is being restored is plain text, not to be evaluated any further. */
   if (!text || !symbol || blocks.length === 0) return text;
   for (let i = 0; i < blocks.length; i++) {
      text = text.replace(`<${symbol}-${i}>`, blocks[i]);
   }
   return text;
}

const balanceText = (text: string): string => {
   
   const lines = text.split(LINE_BREAK_RX);
   const results: string[] = [];
   const CODE_SEGMENT_RX = newRX(`\``, "musig");
   const OPEN_PAREN_RX = newRX(`\\(`, "musig");
   const CLOSE_PAREN_RX = newRX(`\\)`, "musig");
   const DOUBLE_QUOTE_RX = newRX(`"`, "musig");

   for (let line of lines) {
   
      const isCodeSegmentsUnbalanced: boolean = (line.match(CODE_SEGMENT_RX) ?? []).length % 2 !== 0;
      const numParenthesisStarted: number = (line.match(OPEN_PAREN_RX) ?? []).length;
      const numParenthesisEnded: number = (line.match(CLOSE_PAREN_RX) ?? []).length;
      const isDoubleQuoteUnbalanced: boolean = (line.match(DOUBLE_QUOTE_RX) ?? []).length % 2 !== 0;
      
      if (isDoubleQuoteUnbalanced) {
         if (line.endsWith('"')) {
            line = '"' + line;
         } else {
            line = line + '"';
         }
      }
      if (numParenthesisStarted < numParenthesisEnded) {
         line = "(".repeat(numParenthesisEnded - numParenthesisStarted) + line;
      } else if (numParenthesisStarted > numParenthesisEnded) {
         line = line + ")".repeat(numParenthesisStarted - numParenthesisEnded);
      }
      if (isCodeSegmentsUnbalanced) {
         if (line.endsWith("`")) {
            line = "`" + line;
         } else {
            line = line + "`";
         }
      }
      results.push(line);
   }
   let fixedText = results.join("\n");

   /* Split any instances of ``` being next to each other by inserting a space after the first ``` */
   const ADJACENT_CODE_BLOCK_RX = newRX(`\`{3}(\\S)`, "musig");
   fixedText = fixedText.replace(ADJACENT_CODE_BLOCK_RX, "``` $1");
   
   /* Check for unbalanced code blocks (```) */
   const CODE_BLOCK_RX = newRX(`\`{3}`, "musig");
   const isCodeBlockUnbalanced: boolean = (fixedText.match(CODE_BLOCK_RX) ?? []).length % 2 !== 0;

   if (isCodeBlockUnbalanced) {
      if (fixedText.endsWith("```")) {
         fixedText = "```" + fixedText;
      } else {
         fixedText = fixedText + "```";
      }
   }

   return fixedText;
}


export { ProcessResults, processMessage, cleanMessage }
export type { ModificationType }
