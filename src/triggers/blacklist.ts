import { Message, TriggerResult, Trigger, Triggers, interpolateUsers } from "../core";
import { Blacklist } from "../controllers";

const blacklistAdd: Trigger = {
   id: "blacklist-add",
   name: "Add user to command blacklist",
   description: "Adds user to server-specific command blacklist for a given command",
   usage: "blacklist-add <user> <command>",
   command: /^blacklist-add (?<user>.+) (?<command>.+)$/ui,
   ownerOnly: false,
   adminOnly: true,
   action: (context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: { Case: 'unchanged' }, directedTo: undefined };
      if (matches.length === 0 || !matches.groups) return output;
      const username = interpolateUsers(matches.groups.user || "", context.guild?.members, false);
      const command = matches.groups.command || "";

      if (!username || !command) {
         output.results = [ { contents: `missing parameters, see \`!help blacklist-add\` for details` } ];
         return output;
      }

      context.guild?.members.fetch(username).then(member => {
         const trigger = Triggers.list.find(trigger => trigger.id.toLowerCase() === command.toLowerCase());
         if (!trigger) { 
            output.results = [ { contents: `command '${command}' does not exist. see \`!help commands\` for a simple list of commands.` } ];
            return output;
         }
         
         Blacklist.add(context.guild?.id ?? "DM", member.user.id, trigger.id);            

         output.results = [ { contents: `user '${username}' added to blacklist for command \`${command}\`` } ];
         return output;
      }).catch(() => {
         output.results = [ { contents: `no user '${username}' found on this guild` } ];
         return output;
      });

      return output;      
   }
}
const blacklistRemove: Trigger = {
   id: "blacklist-remove",
   name: "Remove user from command blacklist",
   description: "Removes user from server-specific command blacklist for a given command",
   usage: "blacklist-remove <user> <command>",
   command: /^blacklist-remove (?<user>.+) (?<command>.+)$/ui,
   ownerOnly: false,
   action: (context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: { Case: 'unchanged' }, directedTo: undefined };
      if (matches.length === 0 || !matches.groups) return output;
      const username = interpolateUsers(matches.groups.user || "", context.guild?.members, false);
      const command = matches.groups.command || "";

      if (!username || !command) {
         output.results = [{ contents: `missing parameters, see \`!help blacklist-add\` for details` }];
         return output;
      }

      context.guild?.members.fetch(username).then(member => {
         const trigger = Triggers.list.find(trigger => trigger.id.toLowerCase() === command.toLowerCase());
         if (!trigger) { 
            output.results = [{ contents: `command '${command}' does not exist. see \`!help commands\` for a simple list of commands.` } ];
            return output;
         }      
         Blacklist.remove(context.guild?.id ?? "DM", member.user.id, trigger.id);
         output.results = [{ contents: `user '${username}' removed from blacklist for command \`${command}\`` } ];
         return output;
      }).catch(() => {
         output.results = [{ contents: `no user '${username}' found on this guild`}];
         return output;
      })
      
      return output;
   }
}
const triggers = [ blacklistAdd, blacklistRemove ];
export { triggers };