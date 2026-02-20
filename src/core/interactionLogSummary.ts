import type { InteractionResult } from "./interactionTypes";
import type { StandardOutgoingAttachment, StandardOutgoingEmbed, StandardOutgoingMessage } from "@/contracts";

const CONTENT_PREVIEW_LIMIT = 120;

const truncate = (value: string, maxLength: number): string =>
   value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 3))}...`;

const attachmentSize = (attachment: StandardOutgoingAttachment): number => {
   const data = attachment.data as unknown as { byteLength?: number; length?: number };
   if (typeof data?.byteLength === "number") return data.byteLength;
   if (typeof data?.length === "number") return data.length;
   return 0;
};

const summarizeEmbed = (embed: StandardOutgoingEmbed): Record<string, unknown> => ({
   title: embed.title,
   descriptionLength: embed.description?.length ?? 0,
   fieldCount: embed.fields?.length ?? 0,
   hasFooter: Boolean(embed.footer),
   imageAttachmentName: embed.imageAttachmentName,
   thumbnailAttachmentName: embed.thumbnailAttachmentName
});

const summarizeAttachment = (attachment: StandardOutgoingAttachment): Record<string, unknown> => ({
   name: attachment.name,
   bytes: attachmentSize(attachment),
   contentType: attachment.contentType
});

const summarizeOutgoingMessage = (message: StandardOutgoingMessage): Record<string, unknown> => ({
   contentsLength: message.contents.length,
   contentsPreview: truncate(message.contents, CONTENT_PREVIEW_LIMIT),
   embedCount: message.embeds?.length ?? 0,
   embeds: message.embeds?.map(summarizeEmbed),
   attachmentCount: message.attachments?.length ?? 0,
   attachments: message.attachments?.map(summarizeAttachment),
   tts: Boolean(message.tts),
   error: message.error?.message
});

const summarizeInteractionResultForLog = (result: InteractionResult): Record<string, unknown> => ({
   triggered: Boolean(result.triggered),
   triggeredBy: result.triggeredBy,
   directedTo: result.directedTo,
   modifications: result.modifications,
   error: result.error?.message,
   resultCount: result.results.length,
   results: result.results.map(summarizeOutgoingMessage)
});

export { summarizeInteractionResultForLog };
