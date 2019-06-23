import { Attachment } from "discord.js";
import { Message, Modifications, TriggerResult, Trigger } from "../core";
import { getTarotHand } from "../controllers";

const tarot: Trigger = {
   id: "tarot",
   name: "Tarot",
   description: "Draws a tarot hand",
   usage: "tarot",
   command: /^tarot$/ui,
   action: (context: Message) => {
      const output: TriggerResult = { results: [], modifications: Modifications.AsIs, directedTo: undefined };
      
      getTarotHand().then(image => {
         const tarot = new Attachment(image);
         context.channel.send(tarot);
      });
      output.results = [];      
      return output;
   }
}

const triggers = [ tarot ];

export { triggers };