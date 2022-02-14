import {
   log,
   Brain,
   Message,
   cleanMessage,
   TriggerResult,
   Trigger,
} from "../core";

import { TextChannel } from "discord.js";

const learnHistory: Trigger = {
   id: "learn-history",
   name: "Learn History",
   description: "Learns the history of a channel",
   usage: "learn-history <channelID>",
   adminOnly: true,
   ownerOnly: true,
   command: /^learn-history ?(?<channelID>.+)?/iu,
   action: async (context: Message, matches: RegExpMatchArray = []) => {      
      const output: TriggerResult = {
         results: [],
         modifications: { ProcessSwaps: true },
         directedTo: undefined,
      };
      
      const MAX_MESSAGES = 2 ** 20; // 1 million messages max - safety first!
            
      try {

         let channelID = matches.groups && matches.groups.channelID ? matches.groups.channelID.trim() : "";
         if (!channelID) channelID = context.channel.id;
         
         const channel: TextChannel | undefined = context.guild?.channels.resolve(channelID) as TextChannel ?? undefined;
         if (!channel || channel.type !== "GUILD_TEXT") {
            await context.reply(`that is not a valid text channel in this guild`);
            return output;
         }
         if (!context.client.user) {
            await context.reply(`I am not allowed to do that because I am not a valid user for some reason`);
            return output;
         }
         const perms = channel.permissionsFor(context.client.user);
         if (!perms || !perms.has("READ_MESSAGE_HISTORY")) {
            await context.reply(`I am not allowed to read message history for that channel`);
            return output;
         }

         const startTime = Date.now();

         await context.reply(
            `trying to learn channel history from ${channel.name}, this might take some time`
         );
         
         let totalMessagesLearned = 0;
         let lastMessageLearned = context.id;
         let isStillLearning = true;

         do {
            const messages = await channel.messages.fetch({               
               limit: 100,
               before: lastMessageLearned,
            });
            if (!messages || messages.size < 1) isStillLearning = false;
            
            log(`Fetched ${messages.size} messages from channel: ${channel.id}`);
   
            for (const [_key, message] of messages) {
               // Check if it's a bot message and ignore if so            
               if (message.author.bot) continue;
                  
               // Clean message and prep for learning
               const text: string = await cleanMessage(message.content, {
                  UseEndearments: true,
                  Balance: true,
                  Case: "unchanged",
               });
   
               // Learn            
               await Brain.learn(text);
               
               lastMessageLearned = message.id;
               totalMessagesLearned++;
            }

            if (totalMessagesLearned > MAX_MESSAGES) isStillLearning = false;

         } while (isStillLearning);

         await context.reply(
            `learned ${totalMessagesLearned} lines from channel ID ${channel.id} (${
               (Date.now() - startTime) / 1000
            }s)`
         );
   
      } catch (e: unknown) {
         if (e instanceof Error) {
            await context.reply(`error learning history: ${e.message}`);
         } else {
            await context.reply(`error learning history: ${JSON.stringify(e, null, 2)}`);
         }
      }

      
      return output;
   },
};

const triggers = [learnHistory];
export { triggers };
