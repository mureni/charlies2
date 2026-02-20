import { existsSync, readFileSync } from "fs";
import { InteractionResult } from "./interactionTypes";
import { log } from "./log";
import { summarizeInteractionResultForLog } from "./interactionLogSummary";
import { PluginRegistry, type PluginCommand, type InteractionPlugin } from "@/plugins";
import { Filters } from "@/filters";
import { registerSwapFilters } from "@/filters/swaps";
import { checkFilePath, envFlag } from "@/utils";
import type {
   StandardMessage,
   StandardOutgoingAttachment,
   StandardOutgoingEmbed,
   StandardOutgoingEmbedField,
   StandardOutgoingMessage,
   StandardCommand
} from "@/contracts";
import type { PlatformAdapter, StandardCommandInteraction } from "@/contracts";

interface HelpEntry {
   id: string;
   name: string;
   description: string;
   usage: string;
   example?: string;
   icon?: string;
   ownerOnly?: boolean;
   adminOnly?: boolean;
   hidden?: boolean;
}

class InteractionRouter {
   private static pluginManager = new PluginRegistry();
   private static commandsRegistered = false;
   private static commandsRegistering = false;
   private static commandHandlerRegistered = false;
   private static watching = false;
   
   public static async initialize(): Promise<InteractionPlugin[]> {
      await Filters.reload();
      if (envFlag("FILTERS_WATCH")) {
         Filters.startWatching(() => {
            void Filters.reload().then(() => {
               if (InteractionRouter.pluginManager.getPlugins().some(plugin => plugin.id === "swaps")) {
                  registerSwapFilters();
               }
            });
         });
      }
      InteractionRouter.pluginManager.clear();
      await InteractionRouter.pluginManager.loadFromDist();
      InteractionRouter.startWatching();
      return InteractionRouter.pluginManager.getPlugins();
   }

   public static async registerCommands(platform?: PlatformAdapter): Promise<void> {
      if (InteractionRouter.commandsRegistered || InteractionRouter.commandsRegistering) return;
      if (!platform || !platform.supportsCommands || !platform.registerCommands) return;
      if (InteractionRouter.pluginManager.getPlugins().length === 0) await InteractionRouter.initialize();
      const commands = InteractionRouter.getRegisteredCommands();
      if (commands.length === 0) return;
      InteractionRouter.commandsRegistering = true;
      try {
         await platform.registerCommands(commands);
         InteractionRouter.commandsRegistered = true;
         if (platform.onCommand && !InteractionRouter.commandHandlerRegistered) {
            platform.onCommand(async (interaction: StandardCommandInteraction) => {
               await InteractionRouter.handleCommand(interaction);
            });
            InteractionRouter.commandHandlerRegistered = true;
         }
      } catch (error: unknown) {
         const message = error instanceof Error ? error.message : String(error);
         log(`Error registering commands: ${message}`, "error");
      } finally {
         InteractionRouter.commandsRegistering = false;
      }
   }

   public static async handleCommand(interaction: StandardCommandInteraction): Promise<void> {
      if (InteractionRouter.pluginManager.getPlugins().length === 0) {
         await InteractionRouter.initialize();
      }
      if (interaction.command === "help") {
         const request = typeof interaction.options.command === "string"
            ? String(interaction.options.command).trim()
            : undefined;
         const output = InteractionRouter.buildHelpResponse(request);
         for (const payload of output.results) {
            await interaction.reply(payload);
         }
         return;
      }
      const result = await InteractionRouter.pluginManager.handleCommand(interaction);
      if (!result || result.results.length === 0) return;
      for (const payload of result.results) {
         await interaction.reply(payload);
      }
   }

   public static async reload(): Promise<InteractionPlugin[]> {
      await InteractionRouter.pluginManager.unloadAll();
      InteractionRouter.commandsRegistered = false;
      InteractionRouter.commandsRegistering = false;
      return InteractionRouter.initialize();
   }

   public static startWatching(): void {
      if (InteractionRouter.watching) return;
      if (!envFlag("PLUGINS_WATCH")) return;
      InteractionRouter.watching = true;
      InteractionRouter.pluginManager.startWatching(() => {
         void InteractionRouter.reload();
      });
   }

   public static async process(message: StandardMessage): Promise<InteractionResult> {
      if (InteractionRouter.pluginManager.getPlugins().length === 0) {
         await InteractionRouter.initialize();
      }
      const output: InteractionResult = { results: [], modifications: { Case: "unchanged" } };
      if (message.isBot) return { ...output, triggered: false };

      const helpRequest = InteractionRouter.parseHelpRequest(message.content);
      if (helpRequest) {
         const output = InteractionRouter.buildHelpResponse(helpRequest);
         if (output.results.length > 0) return { ...output, triggered: true, triggeredBy: "help" };
      }
      
      const isAdmin = Boolean(message.isAdmin);
      const isBotOwner = Boolean(message.isBotOwner);

      const plugins = InteractionRouter.pluginManager.getPlugins();
      for (const plugin of plugins) {
         if (plugin.permissions?.ownerOnly && !isBotOwner) continue;
         if (plugin.permissions?.adminOnly && !(isAdmin || isBotOwner)) continue;

         if (plugin.matcher && plugin.execute) {
            const matches = message.content.match(plugin.matcher);
            if (matches) {
               const result = await plugin.execute(message, matches);
               if (result.results.length > 0 || result.triggered) {
                  log({
                     message: "Successful interaction output",
                     data: summarizeInteractionResultForLog(result)
                  }, "debug");
                  return { ...result, triggered: true, triggeredBy: plugin.id };
               }
            }
         }

         if (plugin.commands && plugin.execute) {
            for (const command of plugin.commands) {
               if (!command.fallbackMatcher) continue;
               const matches = message.content.match(command.fallbackMatcher);
               if (!matches) continue;
               const result = await plugin.execute(message, matches);
               if (result.results.length > 0 || result.triggered) {
                  log({
                     message: "Successful interaction output",
                     data: summarizeInteractionResultForLog(result)
                  }, "debug");
                  return { ...result, triggered: true, triggeredBy: command.name };
               }
            }
         }
      }
      log({
         message: "Interaction output",
         data: summarizeInteractionResultForLog(output)
      }, "debug");
      return { ...output, triggered: false };
   }
   
   private static parseHelpRequest(text: string): string | null {
      const help = text.match(/^!help\s*(?<command>.+)?/i);
      if (!help) return null;
      const command = help.groups?.command?.trim();
      return command && command.length > 0 ? command : "commands";
   }

   private static buildHelpResponse(command?: string): InteractionResult {
      const output: InteractionResult = { results: [], modifications: { Case: "unchanged" } };
      const entries = InteractionRouter.buildHelpEntries();
      if (entries.length === 0) return output;
      const normalized = command?.trim().toLowerCase() ?? "commands";

      if (normalized === "commands") {
         const list = entries
            .filter(entry => !entry.hidden)
            .map(entry => entry.id)
            .sort((a, b) => a.localeCompare(b));
         if (list.length === 0) return output;
         const embed: StandardOutgoingEmbed = {
            title: "Available commands",
            description: list.join(", ")
         };
         output.results = [
            { contents: "", embeds: [embed] },
            { contents: "Use !help <command> or /help <command> for details." }
         ];
         return output;
      }

      const found = entries.find(entry => {
         if (entry.hidden) return false;
         return entry.id.toLowerCase() === normalized || entry.name.toLowerCase() === normalized;
      });
      if (!found) {
         output.results = [{ contents: "no such command exists" }];
         return output;
      }

      const fields: StandardOutgoingEmbedField[] = [{ name: "Usage", value: found.usage }];
      if (found.example) fields.push({ name: "Example", value: found.example });
      const entry: StandardOutgoingEmbed = {
         color: found.ownerOnly ? "RED" : found.adminOnly ? "ORANGE" : "#0099ff",
         title: `${found.ownerOnly ? "Bot Owner Only - " : found.adminOnly ? "Server Admin Only - " : ""}Help for ${found.name}`,
         description: found.description,
         footer: "Items within [square] or <angled> brackets are optional. [Square brackets] means the contents can be changed by you, <angled brackets> means you have to type exactly the contents of the angled brackets.",
         fields
      };

      const payload: StandardOutgoingMessage = { contents: "", embeds: [entry] };
      const attachmentPath = InteractionRouter.resolveHelpIcon(found.icon);
      if (attachmentPath) {
         const attachment: StandardOutgoingAttachment = {
            name: "help.png",
            data: readFileSync(attachmentPath)
         };
         entry.thumbnailAttachmentName = "help.png";
         entry.imageAttachmentName = "help.png";
         payload.attachments = [attachment];
      }
      output.results = [payload];
      return output;
   }

   private static buildHelpEntries(): HelpEntry[] {
      const entries = new Map<string, HelpEntry>();
      const plugins = InteractionRouter.pluginManager.getPlugins();
      for (const plugin of plugins) {
         if (plugin.hidden) continue;
         if (plugin.commands) {
            for (const command of plugin.commands) {
               if (command.hidden) continue;
               InteractionRouter.registerHelpEntry(entries, plugin, command);
            }
         }
         InteractionRouter.registerHelpEntry(entries, plugin, undefined);
      }
      return Array.from(entries.values());
   }

   private static registerHelpEntry(
      entries: Map<string, HelpEntry>,
      plugin: InteractionPlugin,
      command?: PluginCommand
   ): void {
      const id = command?.name ?? plugin.id;
      if (entries.has(id) && !command) return;
      const usage = command ? InteractionRouter.buildCommandUsage(command) : plugin.usage;
      entries.set(id, {
         id,
         name: command?.name ?? plugin.name,
         description: command?.description ?? plugin.description,
         usage,
         example: command?.example ?? plugin.example,
         icon: command?.icon ?? plugin.icon,
         ownerOnly: plugin.permissions?.ownerOnly,
         adminOnly: plugin.permissions?.adminOnly
      });
   }

   private static buildCommandUsage(command: PluginCommand): string {
      if (command.usage) return command.usage;
      if (!command.options || command.options.length === 0) return command.name;
      const rendered = command.options.map(option => {
         const label = option.name;
         return option.required ? `<${label}>` : `[${label}]`;
      });
      return [command.name, ...rendered].join(" ");
   }

   private static resolveHelpIcon(icon?: string): string | null {
      const attachmentPath = icon
         ? checkFilePath("resources", icon)
         : checkFilePath("resources", "icons/help.png");
      return existsSync(attachmentPath) ? attachmentPath : null;
   }

   private static getRegisteredCommands(): StandardCommand[] {
      const commands = InteractionRouter.pluginManager.getCommands();
      const helpCommand: StandardCommand = {
         name: "help",
         description: "Show available commands or details for one command",
         options: [
            {
               name: "command",
               description: "Command or plugin name",
               type: "string",
               required: false
            }
         ]
      };
      if (!commands.some(command => command.name === helpCommand.name)) {
         commands.push(helpCommand);
      }
      return commands;
   }
}

export { InteractionResult, InteractionRouter }
