import {
   log,
   Brain,
   CoreMessage,
   cleanMessage,
   TriggerResult,
   Trigger,
} from "../core";
import { env } from "../utils";

const learnHistory: Trigger = {
   id: "learn-history",
   name: "Learn History",
   description: "Learns the history of a channel",
   usage: "learn-history <channelID>",
   adminOnly: true,
   ownerOnly: true,
   command: /^learn-history ?(?<channelID>.+)?/iu,
   action: async (context: CoreMessage, matches?: RegExpMatchArray) => {      
      const output: TriggerResult = {
         results: [],
         modifications: { ProcessSwaps: true },
         directedTo: undefined,
      };
      const platform = context.platform;
      const traceFlow = env("TRACE_FLOW") === "true";
      const trace = (message: string, data?: unknown) => {
         if (traceFlow) log(data ? { message: `LearnHistory: ${message}`, data } : `LearnHistory: ${message}`, "trace");
      };
      
      const MAX_MESSAGES = 2 ** 20; // 1 million messages max - safety first!
            
      try {

         if (!platform) {
            output.results.push({ contents: "platform adapter not available" });
            return output;
         }

         let channelID = matches?.groups?.channelID ? matches.groups.channelID.trim() : "";
         if (!channelID) channelID = context.channelId;
         
         const channel = await platform.fetchChannel(context.guildId, channelID);
         if (!channel || channel.type !== "text" || !channel.supportsHistory) {
            await platform.reply(context.id, `that is not a valid text channel in this guild`);
            return output;
         }
         if (platform.hasPermission) {
            const canRead = await platform.hasPermission(channel.id, "READ_MESSAGE_HISTORY", context.guildId);
            if (!canRead) {
               await platform.reply(context.id, `I am not allowed to read message history for that channel`);
               return output;
            }
         }

         const startTime = Date.now();

         await platform.reply(
            context.id,
            `trying to learn channel history from ${channel.name}, this might take some time`
         );
         
         let totalMessagesLearned = 0;
         let lastMessageLearned = channelID === context.channelId ? context.id : "";
         let isStillLearning = true;

         do {
            trace(`fetchHistory`, {
               channelId: channel.id,
               beforeId: lastMessageLearned || "none",
               totalMessagesLearned
            });
            const messages = await platform.fetchHistory(channel.id, {
               limit: 100,
               beforeId: lastMessageLearned || undefined,
            });
            if (!messages || messages.length < 1) isStillLearning = false;
            
            log(`Fetched ${messages.length} messages from channel: ${channel.id}`);
            if (!isStillLearning) break;

            lastMessageLearned = messages[messages.length - 1].id;
            trace(`advance cursor`, { lastMessageLearned, batchSize: messages.length });
   
            for (const message of messages) {
               if (message.isBot) continue;
               const text: string = await cleanMessage(message.content, {
                  UseEndearments: true,
                  Balance: true,
                  Case: "lower",
               }, context.memberContext as Parameters<typeof cleanMessage>[2]);
   
               await Brain.learn(text);
               
               totalMessagesLearned++;
            }

            if (totalMessagesLearned > MAX_MESSAGES) isStillLearning = false;

         } while (isStillLearning);

         await platform.reply(
            context.id,
            `learned ${totalMessagesLearned} lines from channel ID ${channel.id} (${
               (Date.now() - startTime) / 1000
            }s)`
         );
   
      } catch (e: unknown) {
         if (e instanceof Error) {
            if (platform) {
               await platform.reply(context.id, `error learning history: ${e.message}`);
            } else {
               output.results = [ { contents: `error learning history: ${e.message}` } ];
            }
         } else {
            const message = `error learning history: ${JSON.stringify(e, null, 2)}`;
            if (platform) {
               await platform.reply(context.id, message);
            } else {
               output.results = [ { contents: message } ];
            }
         }
      }

      
      return output;
   },
};

const triggers = [learnHistory];
export { triggers };
