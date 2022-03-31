import { Message, TriggerResult, Trigger, Triggers } from "../core";
import { Blacklist } from "../controllers";
import { Collection, FetchMemberOptions, FetchMembersOptions, UserResolvable } from "discord.js";

// TODO: Change *:* to something that doesn't trigger markdown

const blacklist: Trigger = {
   id: "blacklist",
   name: "Add or remove user to/from command blacklist for a location",
   description: "Adds user to location-specific command blacklist for a given command. Location is defined as `guild:channel`. Must use guild ID and channel ID, not names. For globals, an asterisk (*) can be used for each. A global for guild but not channel will apply to all channels in that guild.",
   usage: "blacklist [add|remove] <location> <user> <command>",
   command: /^blacklist (?<addOrRemove>add|remove) (?<location>.+) (?<user>.+) (?<command>.+)$/ui,
   example: "blacklist add *:* BadGuy a0l",
   ownerOnly: false,
   adminOnly: true,
   action: async (context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: { KeepOriginal: true, UseEndearments: false, Case: 'unchanged' }, directedTo: undefined };
      if (matches.length === 0 || !matches.groups) return output;
      if (!(context.client)) return output;
      const addOrRemove = matches.groups.addOrRemove ?? "";
      const username = matches.groups.user ?? "";
      const command = matches.groups.command ?? "";      
      const location = matches.groups.location ?? "*:*";
      
      if (!addOrRemove || !location.match(/(?:\d+|\*):(?:\d+|\*)/) || !username || !command) {
         output.results = [ { contents: `missing parameters, see \`!help blacklist-add\` for details` } ];
         return output;
      }

      let [requestedServer, requestedChannel] = location.split(":");
      const servers: Set<string> = new Set<string>();
      const channels: Set<string> = new Set<string>();

      if (requestedServer === "*") {
         // apply to all servers and all channels
         const guilds = context.client.guilds.cache.values();
         requestedChannel = "*";
         for (let g of guilds) {
            servers.add(g.id);         
         }         
      } else {
         // apply to specific server only
         const guild = context.client.guilds.cache.get(requestedServer);
         if (!guild) {            
            output.results = [ { contents: `\`${requestedServer}\` is not a valid ID` } ];
            return output;
         }
         servers.add(guild.id);
      }
      if (requestedChannel === "*") {
         // apply to all channels in the given servers
         for (let s of servers) {
            const guild = context.client.guilds.cache.get(s);
            if (!guild) {
               output.results = [ { contents: `\`${s}\` is not a valid ID` } ];
               return output;
            }
            const chans = guild.channels.cache.values();
            for (let c of chans) {
               channels.add(c.id);
            }
         }
      } else {
         // apply to specific channel only
         for (let s of servers) {
            const guild = context.client.guilds.cache.get(s);
            if (!guild) {
               output.results = [ { contents: `\`${s}\` is not a valid ID` } ];
               return output;
            }
            const chan = guild.channels.cache.get(requestedChannel);
            if (!chan) {
               output.results = [ { contents: `\`${requestedChannel}\` is not a valid ID` } ];
               return output;
            }
            channels.add(chan.id);
         }
      }

      const memberSearchOptions: FetchMembersOptions | FetchMemberOptions | UserResolvable = {};      
      if (username.match(/<@!\d+>/)) {
         memberSearchOptions.user = username.replace(/<@!(\d+)>/, "$1")
      } else {
         memberSearchOptions.query = username;
         memberSearchOptions.limit = 1;
      }

      const trigger = Triggers.list.find(trigger => trigger.id.toLowerCase() === command.toLowerCase());
      if (!trigger) { 
         // trigger isn't a real one, so stop things now before they get out of hand
         output.results = [ { contents: `command '${command}' does not exist. see \`!help commands\` for a simple list of commands.` } ];
         return output;
      }

      // by this point there is a 'channels' set and a 'guilds' set, all of which should have the blacklist rule apply
      for (let server of servers) {
         for (let channel of channels) {

            const guild = context.client.guilds.cache.get(server);
            if (!guild) continue;
      

      
            const fetchedMember = await guild.members.fetch(memberSearchOptions);
            const member = (fetchedMember instanceof Collection) ? fetchedMember.first() : fetchedMember;
         
            if (!member) {
               // member isn't part of that guild, so just skip it.
               continue;
            }
      
         
            const ctx = `${server}:${channel}`;
            if (addOrRemove === "add") {
               Blacklist.add(ctx, member.user.id, trigger.id);
            } else if (addOrRemove === "remove") {
               Blacklist.remove(ctx, member.user.id, trigger.id);
            }

            
         }
      }
      

      const ctx = `${requestedServer}:${requestedChannel}`;
      if (addOrRemove === "add") {
         output.results = [{ contents: `user '${memberSearchOptions.user || memberSearchOptions.query}' added to blacklist in ${ctx} for command \`${command}\`` }];
      } else if (addOrRemove === "remove") {
         output.results = [{ contents: `user '${memberSearchOptions.user || memberSearchOptions.query}' removed from blacklist in ${ctx} for command \`${command}\`` }];
      }

      return output;
      
   }
}

const triggers = [ blacklist ];
export { triggers };