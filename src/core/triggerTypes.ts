import type { CoreMessage, OutgoingMessage } from "../platform";

export type ModificationType = {
   Case?: "upper" | "lower" | "unchanged";
   KeepOriginal?: boolean;
   ProcessSwaps?: boolean;
   UseEndearments?: boolean;
   TTS?: boolean;
   Balance?: boolean;
   StripFormatting?: boolean;
};

export interface TriggerResult {
   results: OutgoingMessage[];
   modifications: ModificationType;
   directedTo?: string;
   triggered?: boolean;
   triggeredBy?: string;
   error?: {
      message: string;
   };
}

export interface Trigger {
   id: string;
   name: string;
   description: string;
   usage: string;
   command: RegExp;
   action(context?: CoreMessage, matches?: RegExpMatchArray): TriggerResult | Promise<TriggerResult>;
   ownerOnly?: boolean;
   adminOnly?: boolean;
   example?: string;
   icon?: string; // For now, 'icon' refers to a file relative to the "resources" folder.
   hidden?: boolean;
}
