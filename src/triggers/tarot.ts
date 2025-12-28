import { CoreMessage, TriggerResult, Trigger, log, OutgoingAttachment, OutgoingEmbed } from "../core";
import { getTarotHand } from "../controllers";

const tarot: Trigger = {
   id: "tarot",
   name: "Tarot",
   description: "Draws a tarot hand. Options for tarot spreads are: star, horseshoe, and standard (default) 3-card",
   usage: "tarot [spread]",
   example: "tarot star",
   command: /^tarot ?(?<spread>.+)?$/ui,
   action: async (_context: CoreMessage, matches?: RegExpMatchArray) => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" }, directedTo: undefined };
      const spread = matches?.groups?.spread ?? "standard";
      try {
         const hand = await getTarotHand(spread);
         const attachment: OutgoingAttachment = { name: "tarot.png", data: hand.image };
         const explanation = hand.explanation;
         const fields = Object.values(explanation).map((entry) => ({
            name: entry.name,
            value: `${entry.description}\n*${entry.meaning}*`
         }));
         const embed: OutgoingEmbed = {
            title: "Explanation",
            color: "#ffffff",
            description: "Following is a brief explanation of your tarot hand",
            fields,
            imageAttachmentName: "tarot.png"
         };
         log(`Generating tarot hand`);
         output.results = [ { contents: "", embeds: [embed], attachments: [attachment] } ];
         output.triggered = true;
         log(`Tarot output: ${JSON.stringify(output)}`);
         return output;
      } catch (error) {         
         const errString: string = (error instanceof Error) ? error.message : error as string;
         output.results = [ { contents: `Error occurred while generating tarot card: ${errString}`, error: { message: errString }} ];         
         return output;
      }      
   }
}

const triggers = [ tarot ];

export { triggers };
