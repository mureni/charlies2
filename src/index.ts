import Discord from "discord.js";
import log from "./lib/log";
import { Brain } from "./lib/brain";
import { ProcessResults, processMessage } from "./lib/messageProcessor";
import { getUser } from "./lib/user";
import { Swap } from "./lib/swap";

/* Initialize client */
const client = new Discord.Client();

/* Define exit handler and exit events */
const exitHandler = (): void => {   
   log(`Exiting cleanly.`);
   const brainSaveResults: boolean | Error = Brain.save();
   log(`Saving brain... ${(brainSaveResults instanceof Error) ? `Error saving brain data: ${brainSaveResults.message}` : `Brain data saved`}`);
   const swapSaveResults: boolean | Error = Swap.save();
   log(`Saving swap data... ${(swapSaveResults instanceof Error) ? `Error saving swap data: ${swapSaveResults.message}` : `Swap data saved`}`);
   client.destroy();
   process.exit();
}
process.stdin.resume(); 
process
   .on('exit', exitHandler)
   .on('SIGTERM', exitHandler)
   .on('SIGUSR1', exitHandler)
   .on('SIGUSR2', exitHandler)
   .on('SIGINT', exitHandler);  
   if (process.env.NODE_ENV === "production") {
      process.on('uncaughtException', exitHandler);
   } else {
      process.on('uncaughtException', (error: Error) => {
         exitHandler();
         throw error;
      })
   }

/* Attempt login */
const login = (): Promise<any> => client.login(process.env.DISCORD_AUTH)
   .then(_token => log(`Logged in to Discord server.`))
   .catch(_token => log(`Error logging in to Discord server.`, "error"));

/* Define client events (as of Discord.js version 11.4.2) */
client
   /* General client events */
   .on("error", error => {
      log(`Error occurred: ${error.message}`, "error");      
   })
   .on("ready", () => {
      log(`Connected to Discord server.`); 
   })
   .on("disconnect", event => {
      log(`Disconnected from Discord server. Reason: ${event.reason}. Attempting to reconnect in 1 minute.`);      
      setTimeout(login, 60000);
   })   
   .on("reconnecting", () => {
      log(`Reconnecting to Discord server.`);
   })
   .on("resume", replayed => {
      log(`Connection resumed. Number of replayed events: ${replayed}`);
   })
   .on("debug", _info => {})
   .on("warn", info => {
      log(`Warning information received: ${info}`, "warn");
   })

   /* Client user (bot user) event handling */
   .on("clientUserGuildSettingsUpdate", _userGuildSettings => {})
   .on("clientUserSettingsUpdate", _userSettings => {})
   .on("userNoteUpdate", (_user, _oldNote, _newNote) => {})
   .on("userUpdate", (_oldUser, _newUser) => {})
   .on("rateLimit", _rateLimit => {})

   /* Emoji handling */
   .on("emojiCreate", _emoji => {})
   .on("emojiDelete", _emoji => {})
   .on("emojiUpdate", _emoji => {})

   /* Guild handling */
   .on("guildUnavailable", _guild => {})
   .on("guildCreate", _guild => {})
   .on("guildDelete", _guild => {})
   .on("guildUpdate", (_oldGuild, _newGuild) => {})
   .on("guildBanAdd", (_guild, _user) => {})
   .on("guildBanRemove", (_guild, _user) => {})

   /* Guild member handling */
   .on("guildMemberAdd", _member => {})
   .on("guildMemberRemove", _member => {})
   .on("guildMemberUpdate", (_oldMember, _newMember) => {})
   .on("guildMembersChunk", (_members, _guild) => {})
   .on("guildMemberAvailable", _member => {})
   .on("guildMemberSpeaking", (_member, _speaking) => {})
   .on("presenceUpdate", (_oldMember, _newMember) => {})
   .on("voiceStateUpdate", (_oldMember, _newMember) => {})

   /* Guild role handling */
   .on("roleCreate", _role => {})
   .on("roleDelete", _role => {})
   .on("roleUpdate", (_oldRole, _newRole) => {})

   /* Guild channel handling */
   .on("channelCreate", _channel => {})
   .on("channelDelete", _channel => {})
   .on("channelUpdate", (_oldChannel, _newChannel) => {})
   .on("channelPinsUpdate", (_channel, _time) => {})
   .on("typingStart", (_channel, _user) => {})
   .on("typingStop", (_channel, _user) => {})

   /* Message handling */
   .on("messageUpdate", (_oldMessage, _newMessage) => {})
   .on("messageDelete", _message => {})
   .on("messageDeleteBulk", _messages => {})
   .on("messageReactionAdd", (_reaction, _user) => {})
   .on("messageReactionRemove", (_reaction, _user) => {})
   .on("messageReactionRemoveAll", _message => {})
   .on("message", (message: Discord.Message): void => {
      if (!(message.channel instanceof Discord.TextChannel) || message.type !== "DEFAULT") return;
      const messageSource: string = `${message.guild.name}:#${message.channel.name}:${getUser(message.member)}`;
      log(`<${messageSource}> ${message.content}`);      
      const results: ProcessResults = processMessage(client.user, message);
      if (results.learned) log(`Learned: ${results.processedText}`, "debug");
      if (results.triggeredBy) log(`Processing trigger: ${results.triggeredBy}`, "debug");
      if (results.response) log(`Responded with: ${results.response}.`, "debug");
   })



/* ACTIVATE */
const brainLoadResults: boolean | Error = Brain.load();
if (brainLoadResults instanceof Error) log(`Error loading brain data: ${brainLoadResults.message}. Starting with empty brain.`, "warn");
const swapLoadResults: boolean | Error = Swap.load();
if (swapLoadResults instanceof Error) log(`Error loading swap data: ${swapLoadResults.message}. Starting with empty swap data.`, "warn");
login();