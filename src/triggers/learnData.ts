import {
    Message,
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
    action: async (context: Message, _matches: RegExpMatchArray = []) => {      
       const output: TriggerResult = {
          results: [],
          modifications: { KeepOriginal: true },
          directedTo: undefined,
       };              
             
       try {
            // step 1: get the list of guilds the bot is in            
            const guilds = context.client.guilds.cache.map(v => v);
            const channels = context.client.channels.cache.map(v => v);

            for (let guild of guilds) {

                let lines: string[] = ['```md'];
                lines.push(`*guild id:* ${guild.id} | *guild name:* ${guild.name}`);
                log(`*guild id:* ${guild.id} | *guild name:* ${guild.name}`, "debug");               
                
                for (let channel of channels) {
                    if (channel.type !== "GUILD_TEXT" || channel.guildId !== guild.id) continue;
                    lines.push(` - *channel id:* ${channel.id} | *channel name:* ${channel.name}`);
                    log(` - *channel id:* ${channel.id} | *channel name:* ${channel.name}`, "debug");
                }

                lines.push('```');
                const line = lines.join('\n');
                log(line);
                output.results.push({ contents: line });                
            }

                
       } catch (e: unknown) {
          if (e instanceof Error) {
             await context.reply(`error retrieving channel list: ${e.message}`);
          } else {
             await context.reply(`error retrieving channel list: ${JSON.stringify(e, null, 2)}`);
          }          
       }
       
       
       return output;
    }
 };
 
 const triggers = [listChannels];
 export { triggers };
 