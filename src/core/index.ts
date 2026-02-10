import { Brain } from "./brain";
import { log } from "./log";
import { ProcessResults, processMessage, cleanMessage } from "./messageProcessor";
import { InteractionResult, ModificationType } from "./interactionTypes";
import { InteractionRouter } from "./interactionRouter";
import { Conversation, KnownUsers, interpolateUsers, getEndearment } from "./user";

export {
   Conversation,
   KnownUsers,
   Brain,
   log,
   ModificationType,
   ProcessResults,
   processMessage,
   cleanMessage,
   InteractionRouter,
   InteractionResult,
   interpolateUsers,
   getEndearment
};

export type {
   StandardMessage,
   StandardOutgoingAttachment,
   StandardOutgoingEmbed,
   StandardOutgoingEmbedField,
   StandardOutgoingMessage,
   PlatformAdapter,
   StandardHistoryQuery,
   StandardMemberQuery,
   StandardPermission
} from "@/contracts";
