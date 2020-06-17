"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggers = void 0;
const core_1 = require("../core");
const controllers_1 = require("../controllers");
const blacklistAdd = {
    id: "blacklist-add",
    name: "Add user to command blacklist",
    description: "Adds user to server-specific command blacklist for a given command",
    usage: "blacklist-add <user> <command>",
    command: /^blacklist-add (?<user>.+) (?<command>.+)$/ui,
    ownerOnly: false,
    adminOnly: true,
    action: (context, matches = []) => {
        const output = { results: [], modifications: core_1.Modifications.AsIs, directedTo: undefined };
        if (matches.length === 0 || !matches.groups)
            return output;
        const username = core_1.interpolateUsers(matches.groups.user || "", context.guild.members, false);
        const command = matches.groups.command || "";
        if (!username || !command) {
            output.results = [`missing parameters, see \`!help blacklist-add\` for details`];
            return output;
        }
        const user = context.guild.members.find(member => member.displayName.toLowerCase() === username.toLowerCase());
        if (!user) {
            output.results = [`no user '${username}' found on this guild`];
            return output;
        }
        const trigger = core_1.Triggers.list.find(trigger => trigger.id.toLowerCase() === command.toLowerCase());
        if (!trigger) {
            output.results = [`command '${command}' does not exist. see \`!help commands\` for a simple list of commands.`];
            return output;
        }
        controllers_1.Blacklist.add(context.guild.id, user.id, trigger.id);
        output.results = [`user '${username}' added to blacklist for command \`${command}\``];
        return output;
    }
};
const blacklistRemove = {
    id: "blacklist-remove",
    name: "Remove user from command blacklist",
    description: "Removes user from server-specific command blacklist for a given command",
    usage: "blacklist-remove <user> <command>",
    command: /^blacklist-remove (?<user>.+) (?<command>.+)$/ui,
    ownerOnly: false,
    action: (context, matches = []) => {
        const output = { results: [], modifications: core_1.Modifications.AsIs, directedTo: undefined };
        if (matches.length === 0 || !matches.groups)
            return output;
        const username = core_1.interpolateUsers(matches.groups.user || "", context.guild.members, false);
        const command = matches.groups.command || "";
        if (!username || !command) {
            output.results = [`missing parameters, see \`!help blacklist-add\` for details`];
            return output;
        }
        const user = context.guild.members.find(member => member.displayName.toLowerCase() === username.toLowerCase());
        if (!user) {
            output.results = [`no user '${username}' found on this guild`];
            return output;
        }
        const trigger = core_1.Triggers.list.find(trigger => trigger.id.toLowerCase() === command.toLowerCase());
        if (!trigger) {
            output.results = [`command '${command}' does not exist. see \`!help commands\` for a simple list of commands.`];
            return output;
        }
        controllers_1.Blacklist.remove(context.guild.id, user.id, trigger.id);
        output.results = [`user '${username}' removed from blacklist for command \`${command}\``];
        return output;
    }
};
const triggers = [blacklistAdd, blacklistRemove];
exports.triggers = triggers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmxhY2tsaXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3RyaWdnZXJzL2JsYWNrbGlzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxrQ0FBcUc7QUFDckcsZ0RBQTJDO0FBRTNDLE1BQU0sWUFBWSxHQUFZO0lBQzNCLEVBQUUsRUFBRSxlQUFlO0lBQ25CLElBQUksRUFBRSwrQkFBK0I7SUFDckMsV0FBVyxFQUFFLG9FQUFvRTtJQUNqRixLQUFLLEVBQUUsZ0NBQWdDO0lBQ3ZDLE9BQU8sRUFBRSw4Q0FBOEM7SUFDdkQsU0FBUyxFQUFFLEtBQUs7SUFDaEIsU0FBUyxFQUFFLElBQUk7SUFDZixNQUFNLEVBQUUsQ0FBQyxPQUFnQixFQUFFLFVBQTRCLEVBQUUsRUFBRSxFQUFFO1FBQzFELE1BQU0sTUFBTSxHQUFrQixFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsYUFBYSxFQUFFLG9CQUFhLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsQ0FBQztRQUN4RyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU07WUFBRSxPQUFPLE1BQU0sQ0FBQztRQUMzRCxNQUFNLFFBQVEsR0FBRyx1QkFBZ0IsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxFQUFFLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDM0YsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDO1FBRTdDLElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDeEIsTUFBTSxDQUFDLE9BQU8sR0FBRyxDQUFDLDZEQUE2RCxDQUFDLENBQUM7WUFDakYsT0FBTyxNQUFNLENBQUM7U0FDaEI7UUFFRCxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8s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