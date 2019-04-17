import { Message, Attachment } from "discord.js";
import { TriggerResult, Trigger } from "./";
import { getTarotHand } from "../lib/tarot";

const tarot: Trigger = {
   name: "Tarot",
   description: "Draws a tarot hand",
   usage: "!tarot",
   command: /^!tarot$/ui,
   action: (context: Message) => {
      const output: TriggerResult = { results: [], caseSensitive: false, processSwaps: true, directedTo: undefined };
      
      getTarotHand().then(image => {
         const tarot = new Attachment(image);
         context.channel.send(tarot);
      });
      output.results = [];      
      return output;
   }
}

export { tarot };