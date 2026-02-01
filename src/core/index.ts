import { Brain } from "./brain";
import { log } from "./log";
import { ProcessResults, processMessage, cleanMessage } from "./messageProcessor";
import { Trigger, TriggerResult, ModificationType } from "./triggerTypes";
import { InteractionRouter } from "./interactionRouter";
import { Conversation, KnownUsers, interpolateUsers, getEndearment } from "./user";
import {
   CoreMessage,
   OutgoingAttachment,
   OutgoingEmbed,
   OutgoingEmbedField,
   OutgoingMessage,
   PlatformAdapter,
   PlatformHistoryQuery,
   PlatformMemberQuery,
   PlatformPermission
} from "@/platform";

export {
   Conversation,
   KnownUsers,
   Brain,
   log,
   ModificationType,
   ProcessResults,
   processMessage,
   cleanMessage,
   Trigger,
   InteractionRouter,
   TriggerResult,
   interpolateUsers,
   getEndearment,
   CoreMessage,
   OutgoingAttachment,
   OutgoingEmbed,
   OutgoingEmbedField,
   OutgoingMessage,
   PlatformAdapter,
   PlatformHistoryQuery,
   PlatformMemberQuery,
   PlatformPermission
};
