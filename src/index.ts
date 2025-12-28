import "source-map-support/register";
import "dotenv/config";

import { GatewayIntentBits, Partials, Message, Client, MessageType } from "discord.js";
import { log, Brain, ProcessResults, processMessage, KnownUsers, Conversation, Triggers } from "./core";
import { toCoreMessage } from "./platform";

import { env } from "./utils";

// TODO: Refactor everything for cleaner code 
const traceFlow = env("TRACE_FLOW") === "true";
const trace = (message: string, data?: unknown): void => {
   if (traceFlow) log(data ? { message: `Flow: ${message}`, data } : `Flow: ${message}`, "trace");
};

/* ACTIVATE */
let initialized: boolean = false;
let initializing: boolean = false;
const mandatoryEnvVars = ["DISCORD_AUTH", "BOT_OWNER_DISCORD_ID", "BOT_NAME", "NODE_ENV"];

const preflightEnv = () => {
   for (const envVar of mandatoryEnvVars) {
      if (env(envVar) === "") throw new Error(`Environment variable ${envVar} not found in environment. This value must be set to continue. Exiting...`);
   }
};

const initialize = async () => {
   log(`Initializing...`);
   let loadResults: boolean | Error;

   log(`Loading environment variables...`);
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

const startInitialization = async () => {
   if (initialized || initializing) return;
   initializing = true;
   try {
      await initialize();
   } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Initialization failed: ${message}`, "error");
   } finally {
      initializing = false;
   }
};


/* Initialize discord client */
let reconnectAttempts: number = 0;
const client = new Client({
   intents: [
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageReactions,
      GatewayIntentBits.Guilds
   ],
   partials: [Partials.Channel]
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
let shuttingDown: boolean = false;
const exitHandler = async (signal?: NodeJS.Signals) => {
   if (shuttingDown) return;
   shuttingDown = true;
   log(`Saving data, shutting down client${signal ? ` (signal: ${signal})` : ""}.`);
   saveData();
   try {
      await client.destroy();
   } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Error during shutdown: ${message}`, "error");
   }
};

/* BAD IDEA: 

if (process.env.NODE_ENV === "production") {
   process.stdin.resume(); 
   process.on('uncaughtException', (error: Error, origin: string) => {
      log(`Uncaught exception.\nError: ${error}\n\nOrigin: ${origin}`);
      exitHandler();
   });
}
*/
const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGUSR1", "SIGUSR2"];
for (const signal of signals) {
   process.once(signal, () => {
      void exitHandler(signal).finally(() => {
         const exitCode = signal === "SIGINT" ? 130 : 0;
         process.exit(exitCode);
      });
   });
}



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
if (env("DISCORD_DEBUG") === "true") {
   client.on("debug", info => {
      log(`Discord debug: ${info}`, "debug");
   });
   client.on("shardDisconnect", (event, shardId) => {
      log(`Discord shard disconnect: shard=${shardId} code=${event.code} reason=${event.reason ?? "none"}`, "warn");
   });
   client.on("shardError", (error, shardId) => {
      log(`Discord shard error: shard=${shardId} error=${error.message}`, "error");
   });
   client.on("shardResume", (shardId, replayedEvents) => {
      log(`Discord shard resume: shard=${shardId} replayed=${replayedEvents}`, "debug");
   });
}
client.on("clientReady", async () => {
   log(`Connected to Discord server.`);      
   //setInterval(saveData, 7200000); // Save data every 2 hours if it is dirty
   setImmediate(() => {
      void startInitialization();
   });

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
   if (!message.inGuild()) {
      // TODO: Remove after DM flow is verified.
      log(`DM received: "${message.content}" (len=${message.content.length})`, "debug");
   }
   if (!initialized) {
      log(`Bot not yet initialized, cannot process incoming message`, "warn");
      return;
   }
   if (!client.user) {
      log(`No client user found, cannot process incoming message`, "warn");
      return;
   }
   if ((message.author.bot && !Brain.settings.learnFromBots)
      || (message.author.id === client.user.id)
      || !(message.type === MessageType.Default || message.type === MessageType.Reply)
   ) {
      trace(`skip messageCreate`, {
         type: message.type,
         author: message.author.id,
         self: client.user.id,
         bot: message.author.bot
      });
      return;
   }

   if (!KnownUsers.has(message.author.id)) {
      KnownUsers.set(message.author.id, {
         name: message.author.username,
         aliases: new Set<string>([message.author.username, message.member?.displayName ?? message.author.username]),
         conversations: new Map<string, Conversation>()
      });
   }

   const channelName = "name" in message.channel ? String(message.channel.name) : "DM";
   const coreMessage = await toCoreMessage(message);
   const messageSource: string = `${message.guild?.name ?? 'Private'}:#${channelName}:${coreMessage.authorName}`;

   // Logging
   let content: string = message.content;
   log(`Message content (raw): "${content}" (len=${content.length})`, "debug");
   if (message.embeds) {
      for (const embed of message.embeds) {
         const url = embed.url ?? `no URL`;
         if (!content.includes(url)) content += `[Embedded content: ${url}]\n`;
      }
   }
   log(`Message content (after embeds): "${content}" (len=${content.length})`, "debug");
   if (message.attachments) {
      for (const [_attachmentSnowflake, attachmentData] of message.attachments) {
         const url = attachmentData.url ?? 'no URL';
         content += `[Attached content: ${url}]\n`;
      }
   }
   log(`Message content (after attachments): "${content}" (len=${content.length})`, "debug");
   // Log the incoming message
   log(`<${messageSource}> ${content}`);
   
   const results: ProcessResults = await processMessage(coreMessage);
   if (results.learned) {
      log(`Learned: ${results.processedText}`, "debug");
      dirty.brain = true;
   }      
   if (results.triggeredBy) {      
      log(`Processing trigger: ${results.triggeredBy}`, "debug");
   }

   // Log the bot response, if any
   const botChannelName = "name" in message.channel ? String(message.channel.name) : "DM";
   const botSource: string = `${message.guild?.name ?? 'Private'}:#${botChannelName}:${Brain.botName}`;
   const botResponse: string | undefined = (results.directedTo ? `${results.directedTo}: ${results.response}` : results.response);
   
   if (botResponse) log(`<${botSource}> ${botResponse}`);  
          
         
});


try {
   preflightEnv();
   log(`Environment variables OK. Attempting Discord login...`);
   log(`Discord Developer Portal: enable the Message Content Intent for this bot to access message.content.`, "warn");
   void login();
} catch (error: unknown) {
   const message = error instanceof Error ? error.message : String(error);
   log(`Startup failed before login: ${message}`, "error");
   process.exitCode = 1;
}
