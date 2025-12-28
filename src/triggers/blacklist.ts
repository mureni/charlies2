import { CoreMessage, TriggerResult, Trigger, Triggers, PlatformMemberQuery } from "../core";
import { Blacklist } from "../controllers";

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
   action: async (context: CoreMessage, matches?: RegExpMatchArray) => {
      const output: TriggerResult = { results: [], modifications: { KeepOriginal: true, UseEndearments: false, Case: 'unchanged' }, directedTo: undefined };
      if (!matches || matches.length === 0 || !matches.groups) return output;
      if (!context.platform) return output;
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
         const guilds = await context.platform.fetchGuilds();
         requestedChannel = "*";
         for (const guild of guilds) servers.add(guild.id);
      } else {
         const guild = await context.platform.fetchGuild(requestedServer);
         if (!guild) {
            output.results = [ { contents: `\`${requestedServer}\` is not a valid ID` } ];
            return output;
         }
         servers.add(guild.id);
      }

      if (requestedChannel === "*") {
         for (const s of servers) {
            const chans = await context.platform.fetchChannels(s);
            for (const c of chans) {
               channels.add(c.id);
            }
         }
      } else {
         for (const s of servers) {
            const chan = await context.platform.fetchChannel(s, requestedChannel);
            if (!chan) {
               output.results = [ { contents: `\`${requestedChannel}\` is not a valid ID` } ];
               return output;
            }
            channels.add(chan.id);
         }
      }

      const memberSearchOptions: PlatformMemberQuery = {};      
      if (username.match(/<@!\d+>/)) {
         memberSearchOptions.userId = username.replace(/<@!(\d+)>/, "$1");
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
      for (const server of servers) {
         for (const channel of channels) {
            const member = await context.platform.fetchMember(server, memberSearchOptions);
            if (!member) continue;
            const ctx = `${server}:${channel}`;
            if (addOrRemove === "add") {
               Blacklist.add(ctx, member.userId, trigger.id);
            } else if (addOrRemove === "remove") {
               Blacklist.remove(ctx, member.userId, trigger.id);
            }
         }
      }
      

      const ctx = `${requestedServer}:${requestedChannel}`;
      if (addOrRemove === "add") {
         output.results = [{ contents: `user '${memberSearchOptions.userId || memberSearchOptions.query}' added to blacklist in ${ctx} for command \`${command}\`` }];
      } else if (addOrRemove === "remove") {
         output.results = [{ contents: `user '${memberSearchOptions.userId || memberSearchOptions.query}' removed from blacklist in ${ctx} for command \`${command}\`` }];
      }

      return output;
      
   }
}

const triggers = [ blacklist ];
export { triggers };
