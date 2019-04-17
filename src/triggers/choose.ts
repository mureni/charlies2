import { Message } from "discord.js";
import { TriggerResult, Trigger } from "./";
import { getUser } from "../lib/user";
import { Brain } from "../lib/brain";

const trigger: Trigger = {
   name: "Choose an option",
   description: "Choose an option from a list of possibilities, with commentary on the choice",
   usage: "choose <option 1> or <option 2>[ or <option 3>, etc.] ",
   command: /^choose (?:(.+) or (.+))+$/ui,
   action: (context: Message, matches: RegExpMatchArray) => {
      const output: TriggerResult = { results: [], caseSensitive: false, processSwaps: true, directedTo: undefined };
            
      const options: string[] = matches[0].replace(/^choose\s+/iu, '').split(/\s+or\s+/gui);
      const selectedOption = options[Math.floor(Math.random() * options.length)];
      
      output.directedTo = getUser(context.member);      
      output.results = [`${selectedOption}, because: ${Brain.getResponse(Brain.getSeed(selectedOption))}`];
      return output;
   }
}

export { trigger as choose };