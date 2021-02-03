import { MessageEmbed, MessageAttachment } from "discord.js";
import { Message, TriggerResult, Trigger } from "../core";
import { getTarotHand } from "../controllers";

const tarot: Trigger = {
   id: "tarot",
   name: "Tarot",
   description: "Draws a tarot hand. Options for tarot spreads are: star, horseshoe, and standard (default) 3-card",
   usage: "tarot [spread]",
   example: "`tarot star`",
   command: /^tarot ?(?<spread>.+)?$/ui,
   action: (context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" }, directedTo: undefined };
      const spread = matches.groups?.spread ?? "standard";
      try {
         getTarotHand(spread).then(hand => {
            const tarot = new MessageAttachment(hand.image, "tarot.png");
            const embed = new MessageEmbed()
               .setTitle("Explanation")
               .setColor("#ffffff")
               .setDescription("Following is a brief explanation of your tarot hand");               
            const explanation = hand.explanation;
            for (let card in Object.keys(explanation)) {
               embed.addField(explanation[card].name, `${explanation[card].description}\n*${explanation[card].meaning}*`);
            }            
            embed.setImage("attachment://tarot.png");
            embed.attachFiles([tarot]);
            context.channel.send(embed);
            output.triggered = true;
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