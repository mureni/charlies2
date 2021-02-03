import {
   log,
   Brain,
   Message,
   cleanMessage,
   TriggerResult,
   Trigger,
} from "../core";
import { TextChannel, GuildChannel } from "discord.js";

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
      let channelID =
         matches.groups && matches.groups.channelID
            ? matches.groups.channelID.trim()
            : "";
      if (!channelID) channelID = context.channel.id;
      
      let channel: GuildChannel | undefined = context.guild?.channels.resolve(channelID) ?? undefined;
      if (!channel || channel.type !== "text") {
         context.reply(`no that is not a valid channel`);
         return output;
      }
      if (!context.client.user) {
         context.reply(`I am not allowed to do that because I am not a valid user for some reason`);
         return output;
      }
      let perms = channel.permissionsFor(context.client.user);
      if (!perms || !perms.has("READ_MESSAGE_HISTORY")) {
         context.reply(`I am not allowed to read message history for that channel`);
         return output;
      }
      let learnedCount = 0,
         startTime = Date.now();

      output.results.push(
         `trying to learn channel history from ${channel.name}, this might take some time`
      );

      const getMessages = async () => {         
         const MAX_MESSAGES = 1048576; // safety first
         let messageCount = 0,
            lastID = context.id;
         while (true) {
            log(`Fetching 100 messages at a time from channel ID ${channelID} starting at message ID ${lastID}`);
            const messages = await (channel as TextChannel).messages.fetch({               
               limit: 100,
               before: lastID,
            });
            if (!messages || messages.size < 1 || learnedCount > MAX_MESSAGES) break;
            messageCount = messages.size;
            log(`Fetched ${messageCount} messages from channel ID ${channelID}`);            
            for (const [_key, message] of messages) {
               
               // Decrease the number of messages left to learn
               messageCount--;

               let shouldLearn: boolean = true;

               // Increase the total number of learned messages
               learnedCount++;
               lastID = message.id;

               // Check if it's a bot message and ignore if so
               if (message.author.bot) shouldLearn = false;

               if (!shouldLearn) continue;
               
               // Clean message and prep for learning
               const text: string = cleanMessage(message.content, {
                  FriendlyNames: true,
                  Balance: true,
                  Case: "unchanged",
               });
               // Learn
               await Brain.learn(text);
            };

         }
         context.reply(
            `learned ${learnedCount} lines from channel ID ${channelID} (${
               (Date.now() - startTime) / 1000
            }s)`
         );            
      };

      try {
         await getMessages();
      } catch (e: unknown) {
         if (e instanceof Error) {
             context.reply(`error learning history: ${e.message}`);
         } else {
            context.reply(`error learning history: ${JSON.stringify(e, null, 2)}`);
         }
      }

      
      return output;
   },
};

const triggers = [learnHistory];
export { triggers };
