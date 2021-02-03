import { Intents, Message, TextChannel, Client } from "discord.js";
import { log, Brain, ProcessResults, processMessage, getDisplayName, KnownUsers, Conversation } from "./core";
import { Swap, Blacklist, Madlibs } from "./controllers";
import { env } from "./config";

// TODO: Refactor everything for cleaner code 

/* ACTIVATE */
const initialize = async () => {
   log(`Initializing...`);
   let loadResults: boolean | Error;

   log(`Loading environment variables...`);
   const mandatoryEnvVars = ["DISCORD_AUTH", "BOT_OWNER_DISCORD_ID", "BOT_NAME", "NODE_ENV"];

   for (const envVar in mandatoryEnvVars) {
      if (env(envVar) === "") throw new Error(`Environment variable ${envVar} not found in environment. This value must be set to continue. Exiting...`);
      process.exit();
   }

   const botName = env("BOT_NAME") ?? "default";

   log (`Loading brain settings...`);
   loadResults = Brain.loadSettings(botName);
   if (loadResults instanceof Error) log(`Error loading brain settings: ${loadResults.message}. Starting with default settings.`, "warn");

   if (Brain.lexicon.size === 0 || Brain.nGrams.size === 0) {
      log(`Brain is apparently empty. Loading from default trainer file '../resources/${botName}-trainer.json'. This will take a very long time, be patient.`);
      loadResults = await Brain.trainFromFile(botName);      
      if (loadResults instanceof Error) log(`Error loading trainer file: ${loadResults.message}. Going to have a broken brain.`, "error");
   }

   log (`Loading swap settings...`);
   loadResults = Swap.load();
   if (loadResults instanceof Error) log(`Error loading swap data: ${loadResults.message}. Starting with empty swap data.`, "warn");
   log (`Loading blacklist settings...`);
   loadResults = Blacklist.load();
   if (loadResults instanceof Error) log(`Error loading blacklist data: ${loadResults.message}. Starting with empty blacklist data.`, "warn");
   log (`Loading madlib settings...`);
   loadResults = Madlibs.load();
   if (loadResults instanceof Error) log(`Error loading madlibs data: ${loadResults.message}. Starting with empty madlibs data.`, "warn");

   if (Brain.lexicon.size === 0 || Brain.nGrams.size === 0) {
      log(`Error initializing brain: no data was retrieved.`);
   }
}

initialize();

/* Initialize discord client */
let reconnectAttempts: number = 0;
const intents = new Intents();
intents.add("GUILD_MEMBERS")
       .add("GUILD_MESSAGES")
       .add("GUILD_MESSAGE_REACTIONS")
       .add("GUILD_EMOJIS");       
const client = new Client({
   fetchAllMembers: false,
   shards: "auto",   
   /* ws: {
      intents: intents
   }, 
   http: {
      version: 8
   } */
});
const dirty = {
   brain: false,
   swaps: false,
   blacklist: false,
   madlibs: false
}


const saveData = (): void => {
   let saveResults: boolean | Error;

   saveResults = dirty.brain ? Brain.saveSettings(Brain.botName) : false;   
   if (saveResults instanceof Error) {
      log(`Error saving brain settings: ${saveResults.message}`, "error");
   } else if (saveResults) { 
      log(`Brain settings saved.`);
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
const exitHandler = async () => {      
   log(`Saving data, shutting down client, exiting with code: ${process.exitCode}.`);
   saveData();
   client.destroy(); 
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

/* Define client events (as of Discord.js version 12.3.1) */
client
   /* General client events */
   .on("error", error => {
      log(`Error occurred: ${error.message}`, "error");      
   })
   .on("ready", () => {
      log(`Connected to Discord server.`);      
      //setInterval(saveData, 7200000); // Save data every 2 hours if it is dirty
   })
   .on("disconnect", event => {
      if (event.reason && /Authentication/gui.test(event.reason)) process.exitCode = 1;
      log(`Disconnected from Discord server. Reason: ${event.reason ? event.reason : 'None provided'}. Code: ${event.code ? event.code : 'None provided'}.`);
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
   .on("debug", _info => {
      //log(`Debug info received: ${info}`, "debug");
   })
   .on("warn", info => {
      log(`Warning information received: ${info}`, "warn");
   })

   /* Client user (bot user) event handling */
   .on("clientUserGuildSettingsUpdate", _userGuildSettings => {})
   .on("clientUserSettingsUpdate", _userSettings => {})
   .on("userNoteUpdate", (_user, _oldNote, _newNote) => {})
   .on("userUpdate", (oldUser, newUser) => {
      if (oldUser.username !== newUser.username) {
         if (KnownUsers.has(oldUser.id)) {
            const user = KnownUsers.get(oldUser.id)!;
            user.aliases.add(newUser.username);
            user.name = newUser.username
         } else {
            KnownUsers.set(newUser.id, {
               name: newUser.username,
               aliases: new Set<string>([newUser.username]),
               conversations: new Map<string, Conversation>()
            })
         }
      }
   })
   .on("rateLimit", _rateLimit => {})

   /* Emoji handling */
   .on("emojiCreate", _emoji => {})
   .on("emojiDelete", _emoji => {})
   .on("emojiUpdate", _emoji => {})

   /* Guild handling */
   .on("guildUnavailable", _guild => {})
   .on("guildCreate", guild => {
      log(`Guild ${guild.name} has been created or connected to.`);
   })
   .on("guildDelete", _guild => {})
   .on("guildUpdate", (_oldGuild, _newGuild) => {})
   .on("guildBanAdd", (_guild, _user) => {})
   .on("guildBanRemove", (_guild, _user) => {})

   /* Guild member handling */
   .on("guildMemberAdd", member => {      
      KnownUsers.set(member.id, {         
         name: member.user.username,
         aliases: new Set<string>([member.user.username, member.displayName]),
         conversations: new Map<string, Conversation>()
      });
   })
   .on("guildMemberRemove", _member => {})
   .on("guildMemberUpdate", (oldMember, newMember) => {
      if (oldMember.nickname !== newMember.nickname) {
         if (KnownUsers.has(oldMember.id)) {
            KnownUsers.get(oldMember.id)?.aliases.add(newMember.displayName);            
         } else {
            KnownUsers.set(newMember.id, { 
               name: newMember.user.username,
               aliases: new Set<string>([newMember.user.username, newMember.displayName]),
               conversations: new Map<string, Conversation>()
            });
         }
      }
   })
   .on("guildMembersChunk", (members, _guild) => {
      members.forEach(member => {
         if (KnownUsers.has(member.id)) {
            const user = KnownUsers.get(member.id)!;
            user.aliases.add(member.user.username);
            user.aliases.add(member.displayName);            
         }
         KnownUsers.set(member.id, {               
            name: member.user.username,
            aliases: new Set<string>([member.user.username, member.displayName]),
            conversations: new Map<string, Conversation>()
         });            
      });
   })
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
   .on("message", async (message: Message): Promise<void> => {
      
      if (!client.user) {
         log(`No client user found, cannot process incoming message`);
         return;
      }
      if (!(message.channel instanceof TextChannel)
         || message.type !== "DEFAULT"
         || (message.author.bot && !Brain.settings.learnFromBots)
         || (message.author.id === client.user.id)
      ) {
         // log(`Invalid message: type=${message.type}, author=${message.author.id}, self=${client.user.id}, bot=${message.author.bot}, channel=${message.channel}, guild=${message.guild ?? 'DM'}`);
         return;
      }

      if (!KnownUsers.has(message.author.id)) {
         KnownUsers.set(message.author.id, {
            name: message.author.username,
            aliases: new Set<string>([message.author.username, message.member?.displayName ?? message.author.username]),
            conversations: new Map<string, Conversation>()
         });
      }

      const messageSource: string = `${message.guild?.name ?? 'Private'}:#${message.channel.name}:${getDisplayName(message.author)}`;
      log(`<${messageSource}> ${message.content}`);
      const results: ProcessResults = await processMessage(client.user, message);
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



login();