import type { StandardOutgoingMessage } from "@/contracts";

export interface ModificationType {
   Case?: "upper" | "lower" | "unchanged";
   KeepOriginal?: boolean;
   ProcessSwaps?: boolean;
   UseEndearments?: boolean;
   TTS?: boolean;
   Balance?: boolean;
}

export type InteractionDataScope = "global" | "server" | "channel" | "user" | "self";

export interface InteractionResource {
   id: string;
   description?: string;
   path?: string;
   type?: "file" | "dir";
}

export interface InteractionData {
   id: string;
   description?: string;
   scope?: InteractionDataScope;
}

export interface InteractionResult {
   results: StandardOutgoingMessage[];
   modifications: ModificationType;
   directedTo?: string;
   triggered?: boolean;
   triggeredBy?: string;
   error?: {
      message: string;
   };
}
