import { CoreMessage, TriggerResult, Trigger, OutgoingAttachment, OutgoingEmbed } from "../core";
import { GCPDot } from "../controllers";

const gcp: Trigger = {
   id: "gcp",
   name: "GCP Dot",
   description: "Shows the current status of the Global Consciousness Project Dot",
   usage: "gcp",   
   command: /\bgcp\b/ui,
   action: async (_context: CoreMessage, _matches?: RegExpMatchArray) => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" }, directedTo: undefined };
      
      try {
         const dot = await GCPDot.getDotData();
         const attachment: OutgoingAttachment = { name: "gcpdot.png", data: dot.image };
         const embed: OutgoingEmbed = {
            title: "The current state of the GCP Dot",
            color: "#ffffff",
            description: dot.data.explanation,
            imageAttachmentName: "gcpdot.png",
            fields: [{ name: "Index value", value: `${(dot.data.index * 100).toFixed(1)}%` }]
         };
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
