import { MessageEmbed, MessageAttachment } from "discord.js";
import { Message, TriggerResult, Trigger } from "../core";
import { GCPDot } from "../controllers";

const gcp: Trigger = {
   id: "gcp",
   name: "GCP Dot",
   description: "Shows the current status of the Global Consciousness Project Dot",
   usage: "gcp",   
   command: /\bgcp\b/ui,
   action: async (_context: Message, _matches?: RegExpMatchArray) => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" }, directedTo: undefined };
      
      try {
         const dot = await GCPDot.getDotData();
         const attachment = new MessageAttachment(dot.image, "gcpdot.png");
         const embed = new MessageEmbed()
            .setTitle("The current state of the GCP Dot")
            .setColor("#ffffff")
            .setDescription(dot.data.explanation);
         embed.setImage("attachment://gcpdot.png");
         embed.addField("Index value", `${(dot.data.index * 100).toFixed(1)}%`);
         output.results = [ { contents: "", embeds: [embed], attachments: [attachment] } ];
         output.triggered = true;         
         return output;
      } catch (error) {         
         const errString: string = (error instanceof Error) ? error.message : error as string;
         output.results = [ { contents: `Error occurred while generating GCP Dot image: ${errString}`, error: { message: errString }} ];
         return output;
      }      
   }
}

const triggers = [ gcp ];

export { triggers };
