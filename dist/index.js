"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const core_1 = require("./core");
const controllers_1 = require("./controllers");
/* Initialize client */
let reconnectAttempts = 0;
const client = new discord_js_1.Client();
const dirty = {
    brain: false,
    swaps: false,
    blacklist: false,
    madlibs: false
};
const saveData = () => {
    let saveResults;
    saveResults = dirty.brain ? core_1.Brain.save() : false;
    if (saveResults instanceof Error) {
        core_1.log(`Error saving brain data: ${saveResults.message}`, "error");
    }
    else if (saveResults) {
        core_1.log(`Brain data saved.`);
        dirty.brain = false;
    }
    saveResults = dirty.swaps ? controllers_1.Swap.save() : false;
    if (saveResults instanceof Error) {
        core_1.log(`Error saving swap data: ${saveResults.message}`, "error");
    }
    else if (saveResults) {
        core_1.log(`Swap data saved.`);
        dirty.swaps = false;
    }
    saveResults = dirty.madlibs ? controllers_1.Madlibs.save() : false;
    if (saveResults instanceof Error) {
        core_1.log(`Error saving madlibs data: ${saveResults.message}`, "error");
    }
    else if (saveResults) {
        core_1.log(`Madlibs data saved.`);
        dirty.madlibs = false;
    }
    saveResults = dirty.blacklist ? controllers_1.Blacklist.save() : false;
    if (saveResults instanceof Error) {
        core_1.log(`Error saving blacklist data: ${saveResults.message}`, "error");
    }
    else if (saveResults) {
        core_1.log(`Blacklist data saved.`);
        dirty.blacklist = false;
    }
};
/* Define exit handler and exit events */
const exitHandler = () => {
    core_1.log(`Exiting cleanly.`);
    saveData();
    client.destroy();
    process.exitCode = 130;
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
process
    .on('exit', exitHandler)
    .on('SIGINT', exitHandler)
    .on('SIGTERM', exitHandler)
    .on('SIGUSR1', exitHandler)
    .on('SIGUSR2', exitHandler);
/* Attempt login */
const login = () => client.login(process.env.DISCORD_AUTH)
    .then(_token => core_1.log(`Logged in to Discord server.`))
    .catch(_token => core_1.log(`Problem logging in to Discord server.`));
/* Define client events (as of Discord.js version 11.4.2) */
client
    /* General client events */
    .on("error", error => {
    core_1.log(`Error occurred: ${error.message}`, "error");
})
    .on("ready", () => {
    core_1.log(`Connected to Discord server.`);
    setInterval(saveData, 72000000); // Save data every 2 hours if it is dirty
})
    .on("disconnect", event => {
    if (event.reason && /Authentication/gui.test(event.reason))
        process.exitCode = 1;
    core_1.log(`Disconnected from Discord server. Reason: ${event.reason ? event.reason : 'None provided'}. Code: ${event.code ? event.code : 'None provided'}.`, process.exitCode ? "error" : "general");
    if (reconnectAttempts++ >= 10) {
        core_1.log(`Exceeded maximum of 10 reconnection attempts. Exiting to prevent bot disabling.`, "error");
        process.exitCode = 2;
    }
    if (!process.exitCode) {
        core_1.log(`Attempting to reconnect in 1 minute. Reconnection attempt #${reconnectAttempts}`);
        setTimeout(login, 60000);
    }
})
    .on("reconnecting", () => {
    core_1.log(`Reconnecting to Discord server.`);
})
    .on("resume", replayed => {
    core_1.log(`Connection resumed. Number of replayed events: ${replayed}`);
})
    .on("debug", _info => { })
    .on("warn", info => {
    core_1.log(`Warning information received: ${info}`, "warn");
})
    /* Client user (bot user) event handling */
    .on("clientUserGuildSettingsUpdate", _userGuildSettings => { })
    .on("clientUserSettingsUpdate", _userSettings => { })
    .on("userNoteUpdate", (_user, _oldNote, _newNote) => { })
    .on("userUpdate", (_oldUser, _newUser) => { })
    .on("rateLimit", _rateLimit => { })
    /* Emoji handling */
    .on("emojiCreate", _emoji => { })
    .on("emojiDelete", _emoji => { })
    .on("emojiUpdate", _emoji => { })
    /* Guild handling */
    .on("guildUnavailable", _guild => { })
    .on("guildCreate", _guild => { })
    .on("guildDelete", _guild => { })
    .on("guildUpdate", (_oldGuild, _newGuild) => { })
    .on("guildBanAdd", (_guild, _user) => { })
    .on("guildBanRemove", (_guild, _user) => { })
    /* Guild member handling */
    .on("guildMemberAdd", _member => { })
    .on("guildMemberRemove", _member => { })
    .on("guildMemberUpdate", (_oldMember, _newMember) => { })
    .on("guildMembersChunk", (_members, _guild) => { })
    .on("guildMemberAvailable", _member => { })
    .on("guildMemberSpeaking", (_member, _speaking) => { })
    .on("presenceUpdate", (_oldMember, _newMember) => { })
    .on("voiceStateUpdate", (_oldMember, _newMember) => { })
    /* Guild role handling */
    .on("roleCreate", _role => { })
    .on("roleDelete", _role => { })
    .on("roleUpdate", (_oldRole, _newRole) => { })
    /* Guild channel handling */
    .on("channelCreate", _channel => { })
    .on("channelDelete", _channel => { })
    .on("channelUpdate", (_oldChannel, _newChannel) => { })
    .on("channelPinsUpdate", (_channel, _time) => { })
    .on("typingStart", (_channel, _user) => { })
    .on("typingStop", (_channel, _user) => { })
    /* Message handling */
    .on("messageUpdate", (_oldMessage, _newMessage) => { })
    .on("messageDelete", _message => { })
    .on("messageDeleteBulk", _messages => { })
    .on("messageReactionAdd", (_reaction, _user) => { })
    .on("messageReactionRemove", (_reaction, _user) => { })
    .on("messageReactionRemoveAll", _message => { })
    .on("message", (message) => {
    if (!(message.channel instanceof discord_js_1.TextChannel) || message.type !== "DEFAULT" || (message.author.bot && !core_1.Brain.settings.learnFromBots))
        return;
    const messageSource = `${message.guild.name}:#${message.channel.name}:${core_1.getDisplayName(message.member)}`;
    core_1.log(`<${messageSource}> ${message.content}`);
    const results = core_1.processMessage(client.user, message);
    if (results.learned) {
        core_1.log(`Learned: ${results.processedText}`, "debug");
        dirty.brain = true;
    }
    if (results.triggeredBy) {
        dirty.blacklist = true;
        dirty.swaps = true;
        dirty.madlibs = true;
        core_1.log(`Processing trigger: ${results.triggeredBy}`, "debug");
    }
    if (results.response)
        core_1.log(`Responded with: ${results.response}`, "debug");
});
/* ACTIVATE */
core_1.log(`Initializing...`);
let loadResults;
loadResults = core_1.Brain.load();
if (loadResults instanceof Error)
    core_1.log(`Error loading brain data: ${loadResults.message}. Starting with empty brain.`, "warn");
loadResults = controllers_1.Swap.load();
if (loadResults instanceof Error)
    core_1.log(`Error loading swap data: ${loadResults.message}. Starting with empty swap data.`, "warn");
loadResults = controllers_1.Blacklist.load();
if (loadResults instanceof Error)
    core_1.log(`Error loading blacklist data: ${loadResults.message}. Starting with empty blacklist data.`, "warn");
loadResults = controllers_1.Madlibs.load();
if (loadResults instanceof Error)
    core_1.log(`Error loading madlibs data: ${loadResults.message}. Starting with empty madlibs data.`, "warn");
login();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwyQ0FBMEQ7QUFDMUQsaUNBQW9GO0FBQ3BGLCtDQUF5RDtBQUV6RCx1QkFBdUI7QUFDdkIsSUFBSSxpQkFBaUIsR0FBVyxDQUFDLENBQUM7QUFDbEMsTUFBTSxNQUFNLEdBQUcsSUFBSSxtQkFBTSxFQUFFLENBQUM7QUFDNUIsTUFBTSxLQUFLLEdBQUc7SUFDWCxLQUFLLEVBQUUsS0FBSztJQUNaLEtBQUssRUFBRSxLQUFLO0lBQ1osU0FBUyxFQUFFLEtBQUs7SUFDaEIsT0FBTyxFQUFFLEtBQUs7Q0FDaEIsQ0FBQTtBQUdELE1BQU0sUUFBUSxHQUFHLEdBQVMsRUFBRTtJQUN6QixJQUFJLFdBQTRCLENBQUM7SUFFakMsV0FBVyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFlBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0lBQ2pELElBQUksV0FBVyxZQUFZLEtBQUssRUFBRTtRQUMvQixVQUFHLENBQUMsNEJBQTRCLFdBQVcsQ0FBQyxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQztLQUNsRTtTQUFNLElBQUksV0FBVyxFQUFFO1FBQ3JCLFVBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3pCLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0tBQ3RCO0lBRUQsV0FBVyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLGtCQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztJQUNoRCxJQUFJLFdBQVcsWUFBWSxLQUFLLEVBQUU7UUFDL0IsVUFBRyxDQUFDLDJCQUEyQixXQUFXLENBQUMsT0FBTyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7S0FDakU7U0FBTSxJQUFJLFdBQVcsRUFBRTtRQUNyQixVQUFH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