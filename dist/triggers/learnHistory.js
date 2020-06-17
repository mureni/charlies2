"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggers = void 0;
const core_1 = require("../core");
const fs = __importStar(require("fs"));
const config_1 = require("../config");
const learnHistory = {
    id: "learn-history",
    name: "Learn History",
    description: "Learns the history of a channel",
    usage: "learn-history <channelID>",
    command: /^learn-history ?(?<channelID>.+)?/iu,
    action: (context, matches = []) => {
        const output = { results: [], modifications: core_1.Modifications.ProcessSwaps, directedTo: undefined };
        let channelID = ((matches.groups && matches.groups.channelID) ? matches.groups.channelID.trim() : '');
        if (!channelID)
            channelID = context.channel.id;
        let possibleChannels = context.guild.channels.filter(chan => chan.type === 'text');
        let channel = possibleChannels.get(channelID);
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
        const file = config_1.checkFilePath("logs", `training-${context.guild.nameAcronym}-${channel.name}-${new Date().toISOString()}.txt`);
        const ws = fs.createWriteStream(file, { encoding: 'utf8' });
        let getMessages = async () => {
            let messageCount = 0, lastID = context.id;
            do {
                core_1.log(`Fetching 100 messages at a time from channel ID ${channelID} starting at message ID ${lastID}`);
                let messages = await channel.fetchMessages({ limit: 100, before: lastID });
                messageCount = messages.size;
                core_1.log(`Fetched ${messageCount} messages from channel ID ${channelID}`);
                messages.forEach(message => {
                    let skip = false;
                    // Check if it's a bot message and ignore if so
                    if (message.author.bot)
                        skip = true;
                    if (!skip) {
                        // Clean message and prep for learning
                        let text = core_1.cleanMessage(message.content, core_1.Modifications.FriendlyNames & core_1.Modifications.Balance & core_1.Modifications.AsIs);
                        // Save to log 
                        ws.write(text);
                        // Learn 
                        core_1.Brain.learn(text);
                    }
                    lineCount++;
                    lastID = message.id;
                });
                if (messageCount < 100)
                    break;
            } while (messageCount >= 1);
            context.reply(`learned ${lineCount} lines from channel ID ${channelID} (${(Date.now() - startTime) / 1000}s)`);
        };
        getMessages();
        ws.close();
        output.results.push(`learning complete`);
        return output;
    }
};
const triggers = [learnHistory];
exports.triggers = triggers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGVhcm5IaXN0b3J5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3RyaWdnZXJzL2xlYXJuSGlzdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsa0NBQW1HO0FBRW5HLHVDQUF5QjtBQUN6QixzQ0FBMEM7QUFHMUMsTUFBTSxZQUFZLEdBQVk7SUFDM0IsRUFBRSxFQUFFLGVBQWU7SUFDbkIsSUFBSSxFQUFFLGVBQWU7SUFDckIsV0FBVyxFQUFFLGlDQUFpQztJQUM5QyxLQUFLLEVBQUUsMkJBQTJCO0lBQy9CLE9BQU8sRUFBRSxxQ0FBcUM7SUFDOUMsTUFBTSxFQUFFLENBQUMsT0FBZ0IsRUFBRSxVQUE0QixFQUFFLEVBQUUsRUFBRTtRQUMxRCxNQUFNLE1BQU0sR0FBa0IsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLGFBQWEsRUFBRSxvQkFBYSxDQUFDLFlBQVksRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLENBQUM7UUFDaEgsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLElBQUksT0FBTyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3RHLElBQUksQ0FBQyxTQUFTO1lBQUUsU0FBUyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1FBQy9DLElBQUksZ0JBQWdCLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxNQUFNLENBQUMsQ0FBQztRQUNuRixJQUFJLE9BQU8sR0FBNkIsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3hFLElBQUksQ0FBQyxP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