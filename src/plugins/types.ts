import type { CoreMessage, PlatformCommand, PlatformCommandInteraction } from "../platform";
import type { TriggerResult } from "../core/triggerTypes";

export type PluginPermissions = {
   ownerOnly?: boolean;
   adminOnly?: boolean;
};

export interface PluginCommand extends PlatformCommand {
   fallbackMatcher?: RegExp;
   usage?: string;
   example?: string;
   icon?: string;
   hidden?: boolean;
}

export interface TriggerPlugin {
   id: string;
   name: string;
   description: string;
   usage: string;
   matcher?: RegExp;
   execute?: (context: CoreMessage, matches?: RegExpMatchArray) => TriggerResult | Promise<TriggerResult>;
   permissions?: PluginPermissions;
   commands?: PluginCommand[];
   onCommand?: (interaction: PlatformCommandInteraction) => Promise<void>;
   onLoad?: () => Promise<void> | void;
   onUnload?: () => Promise<void> | void;
   example?: string;
   icon?: string;
}

export interface PluginModule {
   plugins: TriggerPlugin[];
}
