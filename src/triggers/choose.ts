import { Message, Modifications, TriggerResult, Trigger, getDisplayName, Brain } from "../core";

const choose: Trigger = {
   id: "choose",
   name: "Choose an option",
   description: "Choose an option from a list of possibilities, with commentary on the choice",
   usage: "choose [option 1] or [option 2]< or [option 3], etc.> ",
   command: /^choose (?:(.+) or (.+))+$/ui,
   action: (context: Message, matches: RegExpMatchArray) => {
      const output: TriggerResult = { results: [], modifications: Modifications.ProcessSwaps, directedTo: undefined };
            
      const options: string[] = matches[0].replace(/^choose\s+/iu, '').split(/\s+or\s+/gui);
      const selectedOption = options[Math.floor(Math.random() * options.length)];
      
      output.directedTo = getDisplayName(context.member);      
      output.results = [`${selectedOption}, because: ${Brain.getResponse(Brain.getSeed(selectedOption))}`];
      return output;
   }
}
const triggers = [ choose ];
export { triggers };