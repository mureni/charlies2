import { Message, TextChannel, Client } from "discord.js";
import { log, Brain, ProcessResults, processMessage, getDisplayName } from "./core";
import { Swap, Blacklist, Madlibs } from "./controllers";

/* Initialize client */
let reconnectAttempts: number = 0;
const client = new Client();
const dirty = {
   brain: false,
   swaps: false,
   blacklist: false,
   madlibs: false
}


const saveData = (): void => {
   let saveResults: boolean | Error;

   saveResults = dirty.brain ? Brain.save() : false;   
   if (saveResults instanceof Error) {
      log(`Error saving brain data: ${saveResults.message}`, "error");
   } else if (saveResults) { 
      log(`Brain data saved.`);
      dirty.brain = false;
   }
   
   saveResults = dirty.swaps ? Swap.save() : false;
   if (saveResults instanceof Error) {
      log(`Error saving swap data: ${saveResults.message}`, "error");
   } else if (saveResults) {
      log(`Swap data saved.`);
      dirty.swaps = false;
   } 

   saveResults = dirty.madlibs ? Madlibs.save() : false;
   if (saveResults instanceof Error) {
      log(`Error saving madlibs data: ${saveResults.message}`, "error");
   } else if (saveResults) {
      log(`Madlibs data saved.`);
      dirty.madlibs = false;
   } 

   saveResults = dirty.blacklist ? Blacklist.save() : false;
   if (saveResults instanceof Error) {
      log(`Error saving blacklist data: ${saveResults.message}`, "error");
   } else if (saveResults) {
      log(`Blacklist data saved.`);
      dirty.blacklist = false;
   } 
}

/* Define exit handler and exit events */
const exitHandler = (): void => {   
   log(`Exiting cleanly.`);
   saveData();
   client.destroy();
   process.exitCode = 130;
}
/* BAD IDEA: 

if (process.env.NODE_ENV === "production") {
   process.stdin.resume(); 
   process.on('uncaughtException', (error: Error, origin: string) => {
      log(`Uncaught exception.\nError: ${error}\n\nOrigin: ${origin}`);
      exitHandler();
   });
}

*/
process
   .on('exit', exitHandler)
   .on('SIGINT', exitHandler)      
   .on('SIGTERM', exitHandler)
   .on('SIGUSR1', exitHandler)
   .on('SIGUSR2', exitHandler);


/* Attempt login */
const login = (): Promise<any> => client.login(process.env.DISCORD_AUTH)
   .then(_token => log(`Logged in to Discord server.`))
   .catch(_token => log(`Problem logging in to Discord server.`));

/* Define client events (as of Discord.js version 11.4.2) */
client
   /* General client events */
   .on("error", error => {
      log(`Error occurred: ${error.message}`, "error");      
   })
   .on("ready", () => {
      log(`Connected to Discord server.`);       
      setInterval(saveData, 72000000); // Save data every 2 hours if it is dirty
   })
   .on("disconnect", event => {
      if (event.reason && /Authentication/gui.test(event.reason)) process.exitCode = 1;
      log(`Disconnected from Discord server. Reason: ${event.reason ? event.reason : 'None provided'}. Code: ${event.code ? event.code : 'None provided'}.`, process.exitCode ? "error" : "general");
      if (reconnectAttempts++ >= 10) {
         log(`Exceeded maximum of 10 reconnection attempts. Exiting to prevent bot disabling.`, "error");
         process.exitCode = 2;
      }
      if (!process.exitCode) {
         log(`Attempting to reconnect in 1 minute. Reconnection attempt #${reconnectAttempts}`);
         setTimeout(login, 60000);
      }
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
   .on("message", (message: Message): void => {      
      if (!(message.channel instanceof TextChannel) || message.type !== "DEFAULT" || (message.author.bot && !Brain.settings.learnFromBots)) return;
      const messageSource: string = `${message.guild.name}:#${message.channel.name}:${getDisplayName(message.member)}`;
      log(`<${messageSource}> ${message.content}`);      
      const results: ProcessResults = processMessage(client.user, message);
      if (results.learned) {
         log(`Learned: ${results.processedText}`, "debug");
         dirty.brain = true;
      }      
      if (results.triggeredBy) {
         dirty.blacklist = true;
         dirty.swaps = true;
         dirty.madlibs = true;
         log(`Processing trigger: ${results.triggeredBy}`, "debug");
      }
      if (results.response) log(`Responded with: ${results.response}`, "debug");
   })



/* ACTIVATE */
log(`Initializing...`);
let loadResults: boolean | Error;

loadResults = Brain.load();
if (loadResults instanceof Error) log(`Error loading brain data: ${loadResults.message}. Starting with empty brain.`, "warn");
loadResults = Swap.load();
if (loadResults instanceof Error) log(`Error loading swap data: ${loadResults.message}. Starting with empty swap data.`, "warn");
loadResults = Blacklist.load();
if (loadResults instanceof Error) log(`Error loading blacklist data: ${loadResults.message}. Starting with empty blacklist data.`, "warn");
loadResults = Madlibs.load();
if (loadResults instanceof Error) log(`Error loading madlibs data: ${loadResults.message}. Starting with empty madlibs data.`, "warn");
login();