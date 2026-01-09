import { Brain } from "./brain";
import { log } from "./log";
import { ProcessResults, processMessage, cleanMessage } from "./messageProcessor";
import { Trigger, TriggerResult, ModificationType } from "./triggerTypes";
import { Triggers } from "./triggerProcessor";
import { Conversation, KnownUsers, getDisplayName, interpolateUsers, getEndearment } from "./user";
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
} from "../platform";

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
   Triggers,
   TriggerResult,
   getDisplayName,
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
