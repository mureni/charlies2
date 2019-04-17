import { Message } from "discord.js";
import { TriggerResult, Trigger } from "./";

const trigger: Trigger = {
   name: "name of trigger",
   description: "description of trigger",
   usage: "!trigger",
   command: /^!trigger (?<parameters>.+)$/ui,
   ownerOnly: false,
   action: (_context: Message, _matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], caseSensitive: false, processSwaps: true, directedTo: undefined };
      if (_matches.length === 0 || !_matches.groups) return output;
      output.results = [];      
      return output;
   }
}

export { trigger as TriggerName };