import { Message, TriggerResult, Trigger, Triggers } from "../core";
import { Blacklist } from "../controllers";
import { Collection, FetchMemberOptions, FetchMembersOptions, UserResolvable } from "discord.js";

const blacklistAdd: Trigger = {
   id: "blacklist-add",
   name: "Add user to command blacklist",
   description: "Adds user to server-specific command blacklist for a given command",
   usage: "blacklist-add <user> <command>",
   command: /^blacklist-add (?<user>.+) (?<command>.+)$/ui,
   ownerOnly: false,
   adminOnly: true,
   action: async (context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: { KeepOriginal: true, UseEndearments: false, Case: 'unchanged' }, directedTo: undefined };
      if (matches.length === 0 || !matches.groups) return output;
      if (!(context.guild && context.guild.members)) return output;
      const username = matches.groups.user ?? "";
      const command = matches.groups.command ?? "";
      const guild = context.guild;
      if (!username || !command) {
         output.results = [ { contents: `missing parameters, see \`!help blacklist-add\` for details` } ];
         return output;
      }
      
      const options: FetchMembersOptions | FetchMemberOptions | UserResolvable = {};
      if (username.match(/<@!\d+>/)) {
         options.user = username.replace(/<@!(\d+)>/, "$1")
      } else {
         options.query = username;
         options.limit = 1;
      }
      
      const fetchedMember = await guild.members.fetch(options);  
      const member = (fetchedMember instanceof Collection) ? fetchedMember.first() : fetchedMember;
         
      if (!member) {
         output.results = [{ contents: `no user '${username}' found on this guild`}];
         return output;
      }
      
      const trigger = Triggers.list.find(trigger => trigger.id.toLowerCase() === command.toLowerCase());
      if (!trigger) { 
         output.results = [ { contents: `command '${command}' does not exist. see \`!help commands\` for a simple list of commands.` } ];
         return output;
      }
         
      Blacklist.add(guild.id ?? "DM", member.user.id, trigger.id);            

      output.results = [ { contents: `user '${member.displayName}' added to blacklist for command \`${command}\`` } ];
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
   action: async (context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: { KeepOriginal: true, UseEndearments: false, Case: 'unchanged' }, directedTo: undefined };
      if (matches.length === 0 || !matches.groups) return output;
      if (!(context.guild && context.guild.members)) return output;
      const guild = context.guild;
      const username = matches.groups.user ?? "";
      const command = matches.groups.command ?? "";

      if (!username || !command) {
         output.results = [{ contents: `missing parameters, see \`!help blacklist-add\` for details` }];
         return output;
      }
      const options: FetchMembersOptions | FetchMemberOptions | UserResolvable = {};
      if (username.match(/<@!\d+>/)) {
         options.user = username.replace(/<@!(\d+)>/, "$1")
      } else {
         options.query = username;
         options.limit = 1;
      }
      
      const fetchedMember = await guild.members.fetch(options);  
      const member = (fetchedMember instanceof Collection) ? fetchedMember.first() : fetchedMember;
         
      if (!member) {
         output.results = [{ contents: `no user '${username}' found on this guild`}];
         return output;
      }
      
      const trigger = Triggers.list.find(trigger => trigger.id.toLowerCase() === command.toLowerCase());
      if (!trigger) { 
         output.results = [{ contents: `command '${command}' does not exist. see \`!help commands\` for a simple list of commands.` } ];
         return output;
      }      
      Blacklist.remove(guild.id ?? "DM", member.user.id, trigger.id);
      output.results = [{ contents: `user '${member.displayName}' removed from blacklist for command \`${command}\`` } ];
      return output;
      
   }
}
const triggers = [ blacklistAdd, blacklistRemove ];
export { triggers };