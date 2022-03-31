import "dotenv/config";

import { Intents, Message, TextChannel, Client } from "discord.js";
import { log, Brain, ProcessResults, processMessage, getDisplayName, KnownUsers, Conversation, Triggers } from "./core";

import { env } from "./utils";

// TODO: Refactor everything for cleaner code 

/* ACTIVATE */
let initialized: boolean = false;
// TODO: Whenever top-level await works properly, await the initialization to avoid initial learning causing a Discord timeout
const initialize = async () => {
   log(`Initializing...`);
   let loadResults: boolean | Error;

   log(`Loading environment variables...`);
   const mandatoryEnvVars = ["DISCORD_AUTH", "BOT_OWNER_DISCORD_ID", "BOT_NAME", "NODE_ENV"];

   for (const envVar of mandatoryEnvVars) {
      if (env(envVar) === "") throw new Error(`Environment variable ${envVar} not found in environment. This value must be set to continue. Exiting...`);      
   }
   
   log (`Loading brain settings for "${Brain.botName}" ...`);
   loadResults = Brain.loadSettings(Brain.botName);
   if (loadResults instanceof Error) {
      log(`Unable to load brain settings: ${loadResults.message}. Trying with default settings.`, "warn");
      loadResults = Brain.loadSettings();
      if (loadResults instanceof Error) {
         log(`Error loading default brain settings: ${loadResults.message}. Unable to continue.`, "error");
         process.exit();
      }
   }

   log(`Brain settings: ${JSON.stringify(Brain.settings, null, 2)}`, "debug");

   if (Brain.lexicon.size === 0 || Brain.nGrams.size === 0) {
      log(`Brain is apparently empty. Loading from trainer file '../resources/${Brain.botName}-trainer.txt'. This may take a very long time, be patient.`);
      loadResults = await Brain.trainFromFile(Brain.botName, "txt");
      if (loadResults instanceof Error) {
         log(`Unable to load trainer file: ${loadResults.message}. Attempting to load default trainer file '../resources/default-trainer.txt'.`, "warn");
         loadResults = await Brain.trainFromFile("default", "txt");
         if (loadResults instanceof Error) log(`Error loading trainer file: ${loadResults.message}. Going to have a broken brain.`, "error");
      }
   }
 
   if (Brain.lexicon.size === 0 || Brain.nGrams.size === 0) {
      log(`Error initializing brain: no data was found.`, "error");
   }

   await Triggers.initialize();

   initialized = true;
}


/* Initialize discord client */
let reconnectAttempts: number = 0;
const intents = new Intents();
intents.add(Intents.FLAGS.GUILD_MEMBERS, 
            Intents.FLAGS.GUILD_MESSAGES,
            Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
            Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
            Intents.FLAGS.DIRECT_MESSAGES,
            Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
            Intents.FLAGS.GUILDS);

const client = new Client({
   intents: intents   
});
const dirty = {
   brain: false
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
   
   /* DEPRECATED 
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
      */

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
const login = (): Promise<any> => client.login(env("DISCORD_AUTH"))
   .then(_token => log(`Logged in to Discord server.`))
   .catch(reason => {
      log(`Problem logging in to Discord server: ${reason}`, "error");
      if (reason && /AbortError/gui.test(reason)) {
         // Connection aborted (probably due to an initialization timeout) -- try again in 30 seconds
         log(`Waiting 30 seconds then trying to log in again`);
         setTimeout(login, 1000 * 30);
      };
   });

/* Define client events (as of Discord.js version 12.3.1) */

/* General client events */
client.on("error", error => {
   log(`Error occurred: ${error.message}`, "error");      
});
client.on("ready", async () => {
   log(`Connected to Discord server.`);      
   //setInterval(saveData, 7200000); // Save data every 2 hours if it is dirty

   // List the guilds connected to
   /* const guilds = await client.guilds.fetch();
   guilds.map(async guild => {
      const guildData = await guild.fetch();
      const channels = await guildData.channels.fetch();
      const channelData = `Channels: ${channels.map(channel => channel.name).join(", ")}`;
      log(`Guild: ${guildData.name} / ${channelData}`);
   }); */

});
client.on("disconnect", event => {
   if (event.reason && /Authentication/gui.test(event.reason)) process.exitCode = 1;
   log(`Disconnected from Discord server. Reason: ${event.reason ? event.reason : 'None provided'}. Code: ${event.code ? event.code : 'None provided'}.`);
   if (reconnectAttempts++ >= 10) {
      log(`Exceeded maximum of 10 reconnection attempts. Exiting to prevent bot disabling.`, "error");
      process.exitCode = 2;
   }
   if (!process.exitCode) {
      log(`Attempting to reconnect in 1 minute. Reconnection attempt #${reconnectAttempts}`);
      setTimeout(login, 1000 * 60);
   }
});
client.on("reconnecting", () => {
   log(`Reconnecting to Discord server.`);
});
client.on("resume", replayed => {
   log(`Connection resumed. Number of replayed events: ${replayed}`);
});
client.on("debug", _info => {
   //if (env("NODE_ENV", "development") === "development") log(`Debug info received: ${_info}`, "debug");
});
client.on("warn", info => {
   log(`Warning information received: ${info}`, "warn");
});

/* Client user (bot user) event handling */
client.on("clientUserGuildSettingsUpdate", _userGuildSettings => {});
client.on("clientUserSettingsUpdate", _userSettings => {});
client.on("userNoteUpdate", (_user, _oldNote, _newNote) => {});
client.on("userUpdate", (oldUser, newUser) => {
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
});
client.on("rateLimit", _rateLimit => {});

/* Emoji handling */
client.on("emojiCreate", _emoji => {});
client.on("emojiDelete", _emoji => {});
client.on("emojiUpdate", _emoji => {});

/* Guild handling */
client.on("guildUnavailable", guild => {
   log(`Guild ${guild.name} is unavailable.`);
});
client.on("guildCreate", guild => {
   log(`Guild ${guild.name} has been created or connected to.`);
});
client.on("guildDelete", _guild => {});
client.on("guildUpdate", (_oldGuild, _newGuild) => {});
client.on("guildBanAdd", (_guildBan) => {});
client.on("guildBanRemove", (_guildBan) => {});

/* Guild member handling */
client.on("guildMemberAdd", member => {      
   KnownUsers.set(member.id, {         
      name: member.user.username,
      aliases: new Set<string>([member.user.username, member.displayName]),
      conversations: new Map<string, Conversation>()
   });
});
client.on("guildMemberRemove", _member => {});
client.on("guildMemberUpdate", (oldMember, newMember) => {
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
});
client.on("guildMembersChunk", (members, _guild) => {
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
});
client.on("guildMemberAvailable", _member => {});
client.on("guildMemberSpeaking", (_member, _speaking) => {});
client.on("presenceUpdate", (_oldMember, _newMember) => {});
client.on("voiceStateUpdate", (_oldMember, _newMember) => {});

/* Guild role handling */
client.on("roleCreate", _role => {});
client.on("roleDelete", _role => {});
client.on("roleUpdate", (_oldRole, _newRole) => {});

/* Guild channel handling */
client.on("channelCreate", _channel => {});
client.on("channelDelete", _channel => {});
client.on("channelUpdate", (_oldChannel, _newChannel) => {});
client.on("channelPinsUpdate", (_channel, _time) => {});
client.on("typingStart", (_typing) => {});

/* Message handling */
client.on("messageUpdate", (_oldMessage, _newMessage) => {});
client.on("messageDelete", _message => {});
client.on("messageDeleteBulk", _messages => {});
client.on("messageReactionAdd", (_reaction, _user) => {});
client.on("messageReactionRemove", (_reaction, _user) => {});
client.on("messageReactionRemoveAll", _message => {});

client.on("messageCreate", async (message: Message): Promise<void> => {
   if (!initialized) {
      log(`Bot not yet initialized, cannot process incoming message`, "warn");
      return;
   }
   if (!client.user) {
      log(`No client user found, cannot process incoming message`, "warn");
      return;
   }
   if (!(message.channel instanceof TextChannel)
      || message.type !== "DEFAULT"
      || (message.author.bot && !Brain.settings.learnFromBots)
      || (message.author.id === client.user.id)
   ) {
      //log(`Invalid message: type=${message.type}, author=${message.author.id}, self=${client.user.id}, bot=${message.author.bot}, channel=${message.channel}, guild=${message.guild ?? 'DM'}, message=${message.content}`, "error");
      return;
   }

   if (!KnownUsers.has(message.author.id)) {
      KnownUsers.set(message.author.id, {
         name: message.author.username,
         aliases: new Set<string>([message.author.username, message.member?.displayName ?? message.author.username]),
         conversations: new Map<string, Conversation>()
      });
   }

   const messageSource: string = `${message.guild?.name ?? 'Private'}:#${message.channel.name}:${await getDisplayName(message.author)}`;
   log(`<${messageSource}> ${message.content}`);
   const results: ProcessResults = await processMessage(client.user, message);
   if (results.learned) {
      log(`Learned: ${results.processedText}`, "debug");
      dirty.brain = true;
   }      
   if (results.triggeredBy) {      
      log(`Processing trigger: ${results.triggeredBy}`, "debug");
   }
   if (results.response) log(`Responded with: ${results.response}`, "debug");
});


// TODO: Fix this terribly broken initialization thing so that initial learning doesn't freeze everything up and cause discord to fail on first run
initialize();
login();