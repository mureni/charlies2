import { Attachment } from "discord.js";
import { Message, Modifications, TriggerResult, Trigger } from "../core";
import { getTarotHand } from "../controllers";

const tarot: Trigger = {
   id: "tarot",
   name: "Tarot",
   description: "Draws a tarot hand",
   usage: "tarot",
   command: /^tarot ?(?<spread>.+)?$/ui,
   action: (context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: Modifications.AsIs, directedTo: undefined };
      const spread = matches.groups?.spread ?? "standard";
      try {
         getTarotHand(spread).then(image => {
            const tarot = new Attachment(image);
            context.channel.send(tarot);
            output.results = [];
         }).catch(reason => {
            output.results = [reason];
         });
      } catch {
         output.results = ["can't do that right now"];
      }
            
      return output;
   }
}

const triggers = [ tarot ];

export { triggers };