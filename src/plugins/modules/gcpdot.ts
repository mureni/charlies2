import type { InteractionResult } from "@/core/interactionTypes";
import type { StandardMessage, StandardOutgoingAttachment, StandardOutgoingEmbed } from "@/contracts";
import type { InteractionPlugin } from "@/plugins/types";
import { GCPDot } from "@/plugins/modules/gcpdot/controller";

const gcpMatcher = /\bgcp\b/ui;

const execute = async (_context: StandardMessage): Promise<InteractionResult> => {
   const output: InteractionResult = { results: [], modifications: { Case: "unchanged" }, directedTo: undefined };

   try {
      const dot = await GCPDot.getDotData();
      const attachment: StandardOutgoingAttachment = { name: "gcpdot.png", data: dot.image };
      const embed: StandardOutgoingEmbed = {
         title: "The current state of the GCP Dot",
         color: "#ffffff",
         description: dot.data.explanation,
         imageAttachmentName: "gcpdot.png",
         fields: [{ name: "Index value", value: `${(dot.data.index * 100).toFixed(1)}%` }]
      };
      output.results = [{ contents: "", embeds: [embed], attachments: [attachment] }];
      return output;
   } catch (error) {
      const errString: string = error instanceof Error ? error.message : String(error);
      output.results = [{ contents: `Error occurred while generating GCP Dot image: ${errString}`, error: { message: errString } }];
      return output;
   }
};

const gcpPlugin: InteractionPlugin = {
   id: "gcp",
   name: "GCP Dot",
   description: "Shows the current status of the Global Consciousness Project Dot",
   usage: "gcp",
   matcher: gcpMatcher,
   execute
};

const plugins = [gcpPlugin];
export { plugins };
