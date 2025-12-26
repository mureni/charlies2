import { MessageEmbed, MessageAttachment } from "discord.js";
import { Message, TriggerResult, Trigger, log } from "../core";
import { getTarotHand } from "../controllers";

const tarot: Trigger = {
   id: "tarot",
   name: "Tarot",
   description: "Draws a tarot hand. Options for tarot spreads are: star, horseshoe, and standard (default) 3-card",
   usage: "tarot [spread]",
   example: "tarot star",
   command: /^tarot ?(?<spread>.+)?$/ui,
   action: async (_context: Message, matches?: RegExpMatchArray) => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" }, directedTo: undefined };
      const spread = matches?.groups?.spread ?? "standard";
      try {
         const hand = await getTarotHand(spread);
         const attachment = new MessageAttachment(hand.image, "tarot.png");
         const embed = new MessageEmbed()
            .setTitle("Explanation")
            .setColor("#ffffff")
            .setDescription("Following is a brief explanation of your tarot hand");               
         const explanation = hand.explanation;
         for (let card in Object.keys(explanation)) {
            embed.addField(explanation[card].name, `${explanation[card].description}\n*${explanation[card].meaning}*`);
         }            
         embed.setImage("attachment://tarot.png");
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
