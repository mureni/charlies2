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
exports.Triggers = void 0;
const fs_1 = require("fs");
const messageProcessor_1 = require("./messageProcessor");
const log_1 = require("./log");
const controllers_1 = require("../controllers");
const config_1 = require("../config");
class Triggers {
    static import() {
        const triggers = [];
        const triggerFiles = fs_1.readdirSync(config_1.checkFilePath("code", "triggers/"));
        for (const file of triggerFiles) {
            const fullPath = config_1.checkFilePath("code", `triggers/${file}`);
            log_1.log(`Loading trigger file ${fullPath}...`);
            Promise.resolve().then(() => __importStar(require(fullPath))).then((importedTriggers) => {
                for (const trigger of importedTriggers.triggers) {
                    log_1.log(`Loaded trigger ${trigger.id}`);
                    triggers.push(trigger);
                }
            }).catch(error => {
                log_1.log(`Error loading trigger file ${file}: ${error}`, 'error');
            });
        }
        return triggers;
    }
    static process(context) {
        const output = Triggers.help(context);
        if (output.results.length > 0)
            return { ...output, triggered: true, triggeredBy: "help" };
        if (context.author.bot)
            return output;
        const isAdmin = context.member.hasPermission("ADMINISTRATOR") || context.member.hasPermission("MANAGE_GUILD");
        const isBotOwner = context.author.id === config_1.CONFIG.ownerID;
        for (const trigger of Triggers.list) {
            if (trigger.ownerOnly && !isBotOwner)
                continue;
            if (trigger.adminOnly && !isAdmin)
                continue;
            const matches = context.content.match(trigger.command);
            if (!matches)
                continue;
            if (!controllers_1.Blacklist.allowed(context.guild.id, context.author.id, trigger.id)) {
                output.directedTo = context.member.displayName;
                output.results = [`you are not allowed to execute \`${trigger.id}\` on ${context.guild.name}`];
                return { ...output, triggered: true, triggeredBy: trigger.id };
            }
            const triggerOutput = trigger.action(context, matches);
            if (triggerOutput.results.length > 0)
                return { ...triggerOutput, triggered: true, triggeredBy: trigger.id };
        }
        return { ...output, triggered: false };
    }
    static help(context) {
        const help = context.content.match(/^!help\s*(?<command>.+)?/);
        const output = { results: [], modifications: messageProcessor_1.Modifications.AsIs };
        if (!help)
            return output;
        if (!help.groups || !help.groups.command) {
            // Get help for all triggers
            for (const trigger of Triggers.list) {
                if (!trigger.ownerOnly)
                    output.results.push(`**${trigger.name}** - *${trigger.description}*.`, `➥ **Usage:** \`${trigger.usage}\``);
            }
        }
        else {
            // Get help for specific trigger
            const command = help.groups.command.toLowerCase();
            if (command === "commands") {
                const list = [];
                Triggers.list.forEach(trigger => list.push(trigger.id));
                output.results = [`Available commands: \`${list.join(", ")}\``];
            }
            else {
                const found = Triggers.list.find(trigger => (command.match(trigger.command) !== null || command.match(trigger.id) !== null));
                if (!found) {
                    output.results = ["no such command exists"];
                    return output;
                }
                output.results.push(`${found.ownerOnly ? `***(Bot owner only)*** - ` : ``}**${found.name}** - *${found.description}*.`, `➥ **Usage:** \`${found.usage}\``);
            }
        }
        return output;
    }
}
exports.Triggers = Triggers;
Triggers.list = Triggers.import();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJpZ2dlclByb2Nlc3Nvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb3JlL3RyaWdnZXJQcm9jZXNzb3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLDJCQUFpQztBQUNqQyx5REFBbUQ7QUFDbkQsK0JBQTRCO0FBQzVCLGdEQUEyQztBQUMzQyxzQ0FBa0Q7QUFvQmxELE1BQU0sUUFBUTtJQUdILE1BQU0sQ0FBQyxNQUFNO1FBQ2xCLE1BQU0sUUFBUSxHQUFjLEVBQUUsQ0FBQztRQUMvQixNQUFNLFlBQVksR0FBRyxnQkFBVyxDQUFDLHNCQUFhLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7UUFDckUsS0FBSyxNQUFNLElBQUksSUFBSSxZQUFZLEVBQUU7WUFDOUIsTUFBTSxRQUFRLEdBQUcsc0JBQWEsQ0FBQyxNQUFNLEVBQUUsWUFBWSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQzNELFNBQUcsQ0FBQyx3QkFBd0IsUUFBUSxLQUFLLENBQUMsQ0FBQztZQUMzQyxrREFBTyxRQUFRLElBQUUsSUFBSSxDQUFDLENBQUMsZ0JBQXlDLEVBQUUsRUFBRTtnQkFDakUsS0FBSyxNQUFNLE9BQU8sSUFBSSxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUU7b0JBQzlDLFNBQUcsQ0FBQyxrQkFBa0IsT0FBTyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ3BDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7aUJBQ3pCO1lBQ0osQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUNkLFNBQUcsQ0FBQyw4QkFBOEIsSUFBSSxLQUFLLEtBQUssRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ2hFLENBQUMsQ0FBQyxDQUFDO1NBQ0w7UUFDRCxPQUFPLFFBQVEsQ0FBQztJQUNuQixDQUFDO0lBQ00sTUFBTSxDQUFDLE9BQU8sQ0FBQyxP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