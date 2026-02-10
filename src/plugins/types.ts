import type { StandardMessage, StandardCommand, StandardCommandInteraction } from "@/contracts";
import type { InteractionResult, InteractionData, InteractionResource } from "@/core/interactionTypes";

export interface PluginPermissions {
   ownerOnly?: boolean;
   adminOnly?: boolean;
}

export interface PluginCommand extends StandardCommand {
   fallbackMatcher?: RegExp;
   usage?: string;
   example?: string;
   icon?: string;
   hidden?: boolean;
}

export interface InteractionPlugin {
   id: string;
   name: string;
   description: string;
   usage: string;
   matcher?: RegExp;
   execute?: (context: StandardMessage, matches?: RegExpMatchArray) => InteractionResult | Promise<InteractionResult>;
   permissions?: PluginPermissions;
   commands?: PluginCommand[];
   onCommand?: (interaction: StandardCommandInteraction) => Promise<void>;
   onLoad?: () => Promise<void> | void;
   onUnload?: () => Promise<void> | void;
   example?: string;
   icon?: string;
   resources?: InteractionResource[];
   data?: InteractionData[];
}

export interface PluginModule {
   plugins: InteractionPlugin[];
}
