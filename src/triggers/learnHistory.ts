import { log, Brain, Message, Modifications, cleanMessage, TriggerResult, Trigger } from "../core";
import { TextChannel, GuildChannel } from "discord.js";
import * as fs from "fs";
import { checkFilePath } from "../config";
 

const learnHistory: Trigger = {
   id: "learn-history",
   name: "Learn History",
   description: "Learns the history of a channel",
   usage: "learn-history <channelID>",
      command: /^learn-history ?(?<channelID>.+)?/iu,
      action: (context: Message, matches: RegExpMatchArray = []) => {
         const output: TriggerResult = { results: [], modifications: Modifications.ProcessSwaps, directedTo: undefined };            
         let channelID = ((matches.groups && matches.groups.channelID) ? matches.groups.channelID.trim() : '');
         if (!channelID) channelID = context.channel.id;
         let possibleChannels = context.guild.channels.filter(chan => chan.type === 'text');
         let channel: GuildChannel | undefined = possibleChannels.get(channelID);
         if (!channel || channel.type !== 'text') {
            context.reply(`no that is not a real channel`);
            return output;
         } 
            
         let perms = channel.permissionsFor(context.client.user);
         if (!perms || !perms.has("READ_MESSAGE_HISTORY")) {
            context.reply(`not allowed to read message history for that channel`);
            return output;
         }                                   
         let lineCount = 0, startTime = Date.now();
            
         output.results.push(`trying to learn channel history from ${channel.name}, this might take some time`);


         // Prepare file
         const file = checkFilePath("logs", `training-${context.guild.nameAcronym}-${channel.name}-${new Date().toISOString()}.txt`);
         const ws = fs.createWriteStream(file, { encoding: 'utf8' });

         let getMessages = async () => {
            let messageCount = 0, lastID = context.id;
            do {
               log(`Fetching 100 messages at a time from channel ID ${channelID} starting at message ID ${lastID}`);
               let messages = await (channel as TextChannel).fetchMessages({ limit: 100, before: lastID });
               messageCount = messages.size;
               log(`Fetched ${messageCount} messages from channel ID ${channelID}`);               
               messages.forEach(message => {
                  let skip: boolean = false;

                  // Check if it's a bot message and ignore if so
                  if (message.author.bot) skip = true;

                  if (!skip) {
                     // Clean message and prep for learning
                     let text: string = cleanMessage(message.content, Modifications.FriendlyNames & Modifications.Balance & Modifications.AsIs);
                     // Save to log 
                     ws.write(text);                  
                     // Learn 
                     Brain.learn(text);
                  }

                  lineCount++;
                  lastID = message.id;
               });
               if (messageCount < 100) break;
            } while (messageCount >= 1);
            context.reply(`learned ${lineCount} lines from channel ID ${channelID} (${(Date.now() - startTime) / 1000}s)`);
         }
         
         getMessages();
         
         ws.close();

         output.results.push(`learning complete`);         
         return output;
      }
}


const triggers = [ learnHistory ];
export { triggers };