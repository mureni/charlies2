"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanMessage = exports.processMessage = exports.Modifications = void 0;
const discord_js_1 = require("discord.js");
const user_1 = require("./user");
const brain_1 = require("./brain");
const swap_1 = require("../controllers/swap");
const triggerProcessor_1 = require("./triggerProcessor");
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
    channel.send(text, { tts: !!(modifications & Modifications.TTS), split: true });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnZVByb2Nlc3Nvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb3JlL21lc3NhZ2VQcm9jZXNzb3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsMkNBQThEO0FBQzlELGlDQUF5RTtBQUN6RSxtQ0FBZ0M7QUFDaEMsOENBQTJDO0FBQzNDLHlEQUE2RDtBQVE3RCxJQUFZLGFBUVg7QUFSRCxXQUFZLGFBQWE7SUFDdEIscUVBQWtCLENBQUE7SUFDbEIsaURBQVEsQ0FBQTtJQUNSLGlEQUFRLENBQUE7SUFDUixpRUFBZ0IsQ0FBQTtJQUNoQixtRUFBaUIsQ0FBQTtJQUNqQixnREFBUSxDQUFBO0lBQ1Isd0RBQVksQ0FBQTtBQUNmLENBQUMsRUFSVyxhQUFhLEdBQWIscUJBQWEsS0FBYixxQkFBYSxRQVF4QjtBQUVELE1BQU0sV0FBVyxHQUFHO0lBQ2pCLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJO0lBQzdHLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBQyxLQUFLO0lBQzdHLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUk7SUFDNUcsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUk7SUFDNUcsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUk7SUFDN0csS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFDLEtBQUs7SUFDN0csSUFBSSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSztJQUM5RyxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxJQUFJO0lBQ2pILFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxP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