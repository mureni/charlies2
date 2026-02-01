import type { TriggerResult } from "@/core/triggerTypes";
import type { CoreMessage, OutgoingAttachment, OutgoingEmbed } from "@/platform";
import type { TriggerPlugin } from "@/plugins/types";
import { GCPDot } from "@/plugins/modules/gcpdot/controller";

const gcpMatcher = /\bgcp\b/ui;

const execute = async (_context: CoreMessage): Promise<TriggerResult> => {
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
      output.results = [{ contents: "", embeds: [embed], attachments: [attachment] }];
      return output;
   } catch (error) {
      const errString: string = error instanceof Error ? error.message : String(error);
      output.results = [{ contents: `Error occurred while generating GCP Dot image: ${errString}`, error: { message: errString } }];
      return output;
   }
};

const gcpPlugin: TriggerPlugin = {
   id: "gcp",
   name: "GCP Dot",
   description: "Shows the current status of the Global Consciousness Project Dot",
   usage: "gcp",
   matcher: gcpMatcher,
   execute
};

const plugins = [gcpPlugin];
export { plugins };
