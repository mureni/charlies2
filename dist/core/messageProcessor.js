"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanMessage = exports.processMessage = exports.Modifications = void 0;
const discord_js_1 = require("discord.js");
const user_1 = require("./user");
const brain_1 = require("./brain");
const swap_1 = require("../controllers/swap");
const triggerProcessor_1 = require("./triggerProcessor");
// Maximum length of discord message
const MAX_LENGTH = 1950;
var Modifications;
(function (Modifications) {
    Modifications[Modifications["ForceLowercase"] = 0] = "ForceLowercase";
    Modifications[Modifications["AsIs"] = 1] = "AsIs";
    Modifications[Modifications["Yell"] = 2] = "Yell";
    Modifications[Modifications["ProcessSwaps"] = 4] = "ProcessSwaps";
    Modifications[Modifications["FriendlyNames"] = 8] = "FriendlyNames";
    Modifications[Modifications["TTS"] = 16] = "TTS";
    Modifications[Modifications["Balance"] = 32] = "Balance";
})(Modifications = exports.Modifications || (exports.Modifications = {}));
const emoticonRXs = [
    `:-)`, `:)`, `:-]`, `:]`, `:-3`, `:3`, `:->`, `:>`, `8-)`, `8)`, `:-}`, `:}`, `:o)`, `:c)`, `:^)`, `=]`, `=)`,
    `:-D`, `:D`, `8-D`, `8D`, `x-D`, `xD`, `X-D`, `XD`, `=D`, `=3`, `B^D`, `:-))`, `:-(`, `:(`, `:-c`, `:c`, `:-<`,
    `:<`, `:-[`, `:[`, `:-||`, `>:[`, `:{`, `:@`, `>:(`, `:'-(`, `:'(`, `:'-)`, `:')`, `D-':`, `D:<`, `D:`, `D8`,
    `D;`, `D=`, `DX`, `:-O`, `:O`, `:-o`, `:o`, `:-0`, `8-0`, `>:O`, `:-*`, `:*`, `:×`, `;-)`, `;)`, `*-)`, `*)`,
    `;-]`, `;]`, `;^)`, `:-,`, `;D`, `:-P`, `:P`, `X-P`, `XP`, `x-p`, `xp`, `:-p`, `:p`, `:-Þ`, `:Þ`, `:-þ`, `:þ`,
    `:-b`, `:b`, `d:`, `=p`, `>:P`, `:-/`, `:/`, `:-.`, `>:\\`, `>:/`, `:\\`, `=/`, `=\\`, `:L`, `=L`, `:S`, `:-|`,
    `:|`, `:$`, `://)`, `://3`, `:-X`, `:X`, `:-#`, `:#`, `:-&`, `:&`, `O:-)`, `O:)`, `0:-3`, `0:3`, `0:-)`, `0:)`,
    `;^)`, `>:-)`, `>:)`, `}:-)`, `}:)`, `3:-)`, `3:)`, `>;)`, `>:3`, `>;3`, `|;-)`, `|-O`, `:-J`, `#-)`, `%-)`, `%)`,
    `:-###..`, `:###..`, `<:-|`, `',:-|`, `',:-l`, `</3`, `<\\3`, `<3`
].map(emoticon => emoticon.replace(/[.*+?^${}()|[\]\\]/ug, '\\$&')).join('|');
//erx = [`:-)`, `:)`, `:-]`, `:]`, `:-3`, `:3`, `:->`, `:>`, `8-)`, `8)`, `:-}`, `:}`, `:o)`, `:c)`, `:^)`, `=]`, `=)`, `:-D`, `:D`, `8-D`, `8D`, `x-D`, `xD`, `X-D`, `XD`, `=D`, `=3`, `B^D`, `:-))`, `:-(`, `:(`, `:-c`, `:c`,`:-<`, `:<`, `:-[`, `:[`, `:-||`, `>:[`, `:{`, `:@`, `>:(`, `:'-(`, `:'(`, `:'-)`, `:')`, `D-':`, `D:<`, `D:`, `D8`, `D;`, `D=`, `DX`, `:-O`, `:O`, `:-o`, `:o`, `:-0`, `8-0`, `>:O`, `:-*`, `:*`, `:×`, `;-)`, `;)`, `*-)`, `*)`, `;-]`, `;]`, `;^)`, `:-,`, `;D`, `:-P`, `:P`, `X-P`, `XP`, `x-p`, `xp`, `:-p`, `:p`, `:-Þ`, `:Þ`, `:-þ`, `:þ`, `:-b`, `:b`, `d:`, `=p`, `>:P`, `:-/`, `:/`, `:-.`, `>:\\`, `>:/`, `:\\`, `=/`, `=\\`, `:L`, `=L`, `:S`,`:-|`, `:|`, `:$`, `://)`, `://3`, `:-X`, `:X`, `:-#`, `:#`, `:-&`, `:&`, `O:-)`, `O:)`, `0:-3`, `0:3`, `0:-)`, `0:)`, `;^)`, `>:-)`, `>:)`, `}:-)`, `}:)`, `3:-)`, `3:)`, `>;)`, `>:3`, `>;3`, `|;-)`, `|-O`, `:-J`, `#-)`, `%-)`, `%)`, `:-###..`, `:###..`, `<:-|`, `',:-|`, `',:-l`, `</3`, `<\\3`, `<3` ].map(emoticon => emoticon.replace(/[.*+?^${}()|[\]\\\-]/ug, '\\$&')).join('|');
const processMessage = (client, message) => {
    const results = { learned: false, processedText: "" };
    if (!(message.channel instanceof discord_js_1.TextChannel) || message.type !== "DEFAULT")
        return results;
    /* TODO: Process server-specific blacklists to prevent users from responding */
    /* Do not process own messages */
    if (message.author.id === client.id)
        return results;
    const cleanText = cleanMessage(message, Modifications.ForceLowercase & Modifications.FriendlyNames);
    const processed = triggerProcessor_1.Triggers.process(message);
    if (!processed.triggered) {
        results.learned = brain_1.Brain.learn(cleanText);
        if (message.isMentioned(client) || brain_1.Brain.shouldRespond(message.content)) {
            let response = "";
            let seed = brain_1.Brain.getSeed(cleanText);
            /* Try up to 5 times to get a unique response */
            for (let attempt = 0; attempt < 5; attempt++) {
                response = brain_1.Brain.getResponse(seed);
                if (response.toLowerCase() === message.content.toLowerCase() || response.toLowerCase() === cleanText.toLowerCase())
                    seed = brain_1.Brain.getSeed();
            }
            const modifications = processed.modifications
                | (message.tts ? Modifications.TTS : 0)
                | (brain_1.Brain.shouldYell(message.content) ? Modifications.Yell : 0);
            sendMessage(client, message.channel, response, user_1.getDisplayName(message.member), modifications);
            /* Learn what it just created, to create a feedback */
            brain_1.Brain.learn(cleanMessage(response, Modifications.ForceLowercase & Modifications.FriendlyNames));
            results.response = response;
        }
    }
    else {
        results.triggeredBy = processed.triggeredBy;
        let modifications = processed.modifications | Modifications.Balance;
        if (!(modifications & Modifications.AsIs))
            modifications |= (brain_1.Brain.shouldYell(message.content) ? Modifications.Yell : 0);
        for (const line of processed.results) {
            sendMessage(client, message.channel, line, processed.directedTo, processed.modifications);
        }
        results.response = processed.results.join('\n');
    }
    results.processedText = cleanText.trim();
    return results;
};
exports.processMessage = processMessage;
/* Utility functions for bot interface */
const sendMessage = (client, channel, text, directedTo = undefined, modifications = Modifications.AsIs) => {
    const permissions = channel.permissionsFor(client);
    if (!permissions || !permissions.has('SEND_MESSAGES'))
        return false;
    if (modifications & Modifications.ProcessSwaps)
        text = swap_1.Swap.process(channel.guild.id, text);
    text = user_1.interpolateUsers(text, channel.guild.members, !!(modifications & Modifications.FriendlyNames));
    text = cleanMessage(text, modifications);
    if (directedTo) {
        const name = user_1.interpolateUsers(directedTo || "", channel.members, false);
        text = `${name}: ${text}`;
    }
    while (text !== "") {
        channel.send(text.substring(0, MAX_LENGTH), { tts: !!(modifications & Modifications.TTS), split: true });
        text = text.substring(MAX_LENGTH);
    }
    return true;
};
const cleanMessage = (message, modifications = Modifications.AsIs) => {
    var _a;
    let fullText = (message instanceof discord_js_1.Message) ? user_1.interpolateUsers(message.content.trim(), (_a = message.guild) === null || _a === void 0 ? void 0 : _a.members, !!(modifications & Modifications.FriendlyNames)) : message.trim();
    /* Quick bug fix for broken brains that stored "greentext" (>words) in a single line by accident
       words words>more words>even more words ->
          words words
          >more words
          >even more words
    */
    fullText = fullText.replace(/(\D+?)>(.+?)/muig, "$1\n>$2");
    /* Fix any broken custom emojis */
    fullText = fullText.replace(/<:(\w+?):(\d+?)\s+>/muig, "<:$1:$2>");
    const lines = fullText.split(/\n/ug);
    let results = [];
    for (const line of lines) {
        let text = line;
        /* Remove ANSI control characters and RTL marks */
        text = text.replace(/[\u0000-\u001f\u200f\u061c\u00ad]/uig, '');
        const blockCodes = {
            URLs: '🔗',
            emoticons: '☻',
            injections: '⚿'
        };
        /* Prevent injection of block escaping (someone maliciously putting '<CODE-NUMBER>' in the origin text */
        const blocksRX = new RegExp(`<[${Object.values(blockCodes).join('')}]\-\d+>`, 'ug');
        const injectionBlocks = extractBlocks(text, blockCodes.injections, blocksRX);
        const injected = injectionBlocks.blocks;
        text = injectionBlocks.text;
        /* Capture URLs as case-sensitive */
        const urlRX = /((((?:http|https|ftp|sftp):(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9\.-]+|(?:www\.|[-;:&=\+\$,\w]+@)[A-Za-z0-9\.-]+)((?:\/[-\+~%\/\.\w_]*)?\??(?:[-\+=&;%@\.\w_]*)#?(?:[\.!\/\\\w]*))?)/ug;
        const extracted = extractBlocks(text, blockCodes.URLs, urlRX);
        const urls = extracted.blocks;
        text = extracted.text;
        /* Capture emoticons */
        const emoticonRX = new RegExp(emoticonRXs, 'ug');
        const extractedEmoticons = extractBlocks(text, blockCodes.emoticons, emoticonRX);
        const emoticons = extractedEmoticons.blocks;
        text = extractedEmoticons.text;
        /* Replace bot name with 'my friend' (and strip initial) */
        text = text.replace(new RegExp(`^${brain_1.Brain.settings.name}:?\s*`, "ui"), "");
        text = text.replace(new RegExp(brain_1.Brain.settings.name, "uig"), user_1.getEndearment());
        /* Replace all channel mentions with 'my secret place' */
        text = text.replace(/<#\d+>/uig, "my secret place");
        /* Mild bug fix for broken brains: replace periods/other characters in the middle of full words (more than 1 characters) with a period then a space.
           This should avoid causing problems with regular abbreviations (Dr., N.A.S.A, Mrs., etc.), and doing it after URLs should avoid breaking those */
        text = text.replace(/([^\s\.)]{2,}?)([\.")\]?!,])([^\s\.")\]?!,])/uig, "$1$2 $3");
        /* Fix edge cases where it is appropriate to have a character followed immediately by a quotation mark  */
        //text = text.replace(/"?(.+?)([\.)\]?!,])\s+"/uig, '"$1$2"');
        /* If "As Is" flag is not set, modify output for upper/lowercase */
        if (!(modifications & Modifications.AsIs)) {
            /* If "Yell" flag is set, use uppercase -- otherwise, lowercase */
            text = !!(modifications & Modifications.Yell) ? text.toUpperCase() : text.toLowerCase();
            /* If "ForceLowercase" flag is set, force lowercase regardless of yelling (for learning,  comparison, etc.) */
            if (!!(modifications & Modifications.ForceLowercase))
                text = text.toLowerCase();
        }
        /* Restore emoticons */
        if (emoticons.length > 0)
            text = restoreBlocks(text, blockCodes.emoticons, emoticons);
        /* Restore URLs */
        if (urls.length > 0)
            text = restoreBlocks(text, blockCodes.URLs, urls);
        /* Restore injected block escape attempts */
        if (injected.length > 0)
            text = restoreBlocks(text, blockCodes.injections, injected);
        results.push(text);
    }
    let result = results.join("\n");
    // Last step: balance brackets and quotation marks and such
    if (!!(modifications & Modifications.Balance))
        result = balanceText(result, modifications);
    return result;
};
exports.cleanMessage = cleanMessage;
const extractBlocks = (text = "", symbol = "", regEx = null) => {
    if (!text || !symbol || !regEx)
        return { text: text, blocks: [] };
    const blocks = [];
    const matches = text.match(regEx);
    if (matches) {
        for (let i = 0; i < matches.length; i++) {
            blocks.push(matches[i]);
            text = text.replace(matches[i], `<${symbol}-${i}>`);
        }
    }
    return { text: text, blocks: blocks };
};
const restoreBlocks = (text = "", symbol = "", blocks = []) => {
    if (!text || !symbol || blocks.length === 0)
        return text;
    for (let i = 0; i < blocks.length; i++) {
        text = text.replace(`<${symbol}-${i}>`, blocks[i]);
    }
    return text;
};
const balanceText = (text, modifications = (Modifications.AsIs | Modifications.Balance)) => {
    const codeBlock = (text.match(/```/iug) || []).length > 0;
    text = text.replace(/[`"]{2,10}/iug, '');
    /* If "As Is" flag is not set, strip formatting */
    if (!(modifications & Modifications.AsIs))
        text = text.replace(/[*_|]{2,10}/iug, '');
    const codeSegment = (text.match(/`/ug) || []).length % 2 !== 0;
    const parenthesisStart = (text.match(/\(/ug) || []).length;
    const parenthesisEnd = (text.match(/\)/ug) || []).length - (text.match(/\s+\w\)/ug) || []).length;
    const doubleQuote = (text.match(/"/ug) || []).length % 2 !== 0;
    if (doubleQuote)
        text = text.endsWith('"') ? '"'.concat(text) : text.concat('"');
    if (parenthesisStart < parenthesisEnd)
        text = "(".repeat(parenthesisEnd - parenthesisStart).concat(text);
    if (parenthesisStart > parenthesisEnd)
        text = text.concat(")".repeat(parenthesisStart - parenthesisEnd));
    if (codeSegment)
        text = text.endsWith('`') ? '`'.concat(text) : text.concat('`');
    if (codeBlock)
        text = '```'.concat(text, '```');
    return text;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnZVByb2Nlc3Nvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb3JlL21lc3NhZ2VQcm9jZXNzb3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsMkNBQThEO0FBQzlELGlDQUF5RTtBQUN6RSxtQ0FBZ0M7QUFDaEMsOENBQTJDO0FBQzNDLHlEQUE2RDtBQUU3RCxvQ0FBb0M7QUFDcEMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDO0FBU3hCLElBQVksYUFRWDtBQVJELFdBQVksYUFBYTtJQUN0QixxRUFBa0IsQ0FBQTtJQUNsQixpREFBUSxDQUFBO0lBQ1IsaURBQVEsQ0FBQTtJQUNSLGlFQUFnQixDQUFBO0lBQ2hCLG1FQUFpQixDQUFBO0lBQ2pCLGdEQUFRLENBQUE7SUFDUix3REFBWSxDQUFBO0FBQ2YsQ0FBQyxFQVJXLGFBQWEsR0FBYixxQkFBYSxLQUFiLHFCQUFhLFFBUXhCO0FBRUQsTUFBTSxXQUFXLEdBQUc7SUFDakIsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUk7SUFDN0csS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFDLEtBQUs7SUFDN0csSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSTtJQUM1RyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSTtJQUM1RyxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSTtJQUM3RyxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUMsS0FBSztJQUM3RyxJQUFJLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLO0lBQzlHLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUk7SUFD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