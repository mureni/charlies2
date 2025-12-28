import {
    CoreMessage,
    TriggerResult,
    Trigger,
 } from "../core";
 import { log } from "../core/log";
  
 const listChannels: Trigger = {
    id: "list-channels",
    name: "Lists channels",
    description: "Lists all the channels the bot is connected to",
    usage: "!list-channels",
    adminOnly: true,
    ownerOnly: true,
    command: /^!list-channels?/iu,
    action: async (context: CoreMessage, _matches?: RegExpMatchArray) => {      
       const output: TriggerResult = {
          results: [],
          modifications: { KeepOriginal: true },
          directedTo: undefined,
       };              
             
       try {
            if (!context.platform) {
                output.results.push({ contents: "platform adapter not available" });
                return output;
            }
            const guilds = await context.platform.fetchGuilds();
            for (const guild of guilds) {

                let lines: string[] = ['```md'];
                lines.push(`*guild id:* ${guild.id} | *guild name:* ${guild.name}`);
                log(`*guild id:* ${guild.id} | *guild name:* ${guild.name}`, "debug");               
                
                const channels = await context.platform.fetchChannels(guild.id);
                for (const channel of channels) {
                    if (channel.type !== "text" || channel.guildId !== guild.id) continue;
                    lines.push(` - *channel id:* ${channel.id} | *channel name:* ${channel.name}`);
                    log(` - *channel id:* ${channel.id} | *channel name:* ${channel.name}`, "debug");
                }

                lines.push('```');
                const line = lines.join('\n');
                log(line);
                output.results.push({ contents: line });                
            }

                
       } catch (e: unknown) {
          const message = e instanceof Error
             ? `error retrieving channel list: ${e.message}`
             : `error retrieving channel list: ${JSON.stringify(e, null, 2)}`;
          if (context.platform) {
             await context.platform.reply(context.id, message);
          } else {
             output.results.push({ contents: message });
          }
       }
       
       
       return output;
    }
 };
 
 const triggers = [listChannels];
 export { triggers };
 
