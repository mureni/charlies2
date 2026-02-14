import type { FSWatcher } from "fs";
import { existsSync, readdirSync, statSync, watch } from "fs";
import { extname, resolve } from "path";
import { log } from "@/core/log";
import { checkFilePath } from "@/utils";
import type { InteractionResult } from "@/core/interactionTypes";
import type { StandardMessage, StandardCommand, StandardCommandInteraction } from "@/contracts";
import type { PluginCommand, PluginModule, InteractionPlugin } from "./types";

class PluginRegistry {
   private plugins: InteractionPlugin[] = [];
   private pluginIds = new Set<string>();
   private watchers: FSWatcher[] = [];
   private watching = false;
   private watchTimer: NodeJS.Timeout | undefined;

   public clear(): void {
      this.plugins = [];
      this.pluginIds.clear();
   }

   public async unloadAll(): Promise<void> {
      for (const plugin of this.plugins) {
         if (plugin.onUnload) await plugin.onUnload();
      }
   }

   public register(plugin: InteractionPlugin): void {
      if (!plugin.id) {
         log(`Skipping plugin with missing id`, "warn");
         return;
      }
      if (this.pluginIds.has(plugin.id)) {
         log(`Skipping duplicate plugin id ${plugin.id}`, "warn");
         return;
      }
      this.plugins.push(plugin);
      this.pluginIds.add(plugin.id);
   }

   public registerAll(plugins: InteractionPlugin[]): void {
      for (const plugin of plugins) {
         this.register(plugin);
      }
   }

   public getPlugins(): InteractionPlugin[] {
      return [...this.plugins];
   }

   public getCommands(): StandardCommand[] {
      const commands: StandardCommand[] = [];
      for (const plugin of this.plugins) {
         if (!plugin.commands) continue;
         for (const command of plugin.commands) {
            if (command.hidden) continue;
            const { name, description, options, permissions } = command;
            commands.push({ name, description, options, permissions, form: command.form });
         }
      }
      return commands;
   }

   public async handleCommand(interaction: StandardCommandInteraction): Promise<InteractionResult | null> {
      for (const plugin of this.plugins) {
         if (plugin.permissions?.ownerOnly && !interaction.isBotOwner) continue;
         if (plugin.permissions?.adminOnly && !(interaction.isAdmin || interaction.isBotOwner)) continue;
         if (!plugin.commands || plugin.commands.length === 0) continue;
         for (const command of plugin.commands) {
            if (command.hidden || command.name !== interaction.command) continue;
            if (plugin.onCommand) {
               await plugin.onCommand(interaction);
               return null;
            }
            if (plugin.execute && command.fallbackMatcher) {
               const synthetic = buildCommandContent(command, interaction.options);
               const matches = synthetic.match(command.fallbackMatcher) ?? undefined;
               const context = buildCommandContext(interaction, synthetic);
               return await plugin.execute(context, matches);
            }
         }
      }
      return null;
   }

   public async loadFromDist(): Promise<void> {
      const pluginsDir = this.getPluginsDir();
      if (!pluginsDir || !existsSync(pluginsDir)) return;
      const files = readdirSync(pluginsDir);
      for (const file of files) {
         if (extname(file) !== ".js") continue;
         const fullPath = resolve(pluginsDir, file);
         try {
            const module = (await import(fullPath)) as PluginModule;
            if (!module.plugins || !Array.isArray(module.plugins)) {
               log(`Plugin module ${file} missing export 'plugins'`, "warn");
               continue;
            }
            this.registerAll(module.plugins);
            for (const plugin of module.plugins) {
               if (plugin.onLoad) await plugin.onLoad();
            }
         } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            log(`Error loading plugin module ${file}: ${message}`, "error");
         }
      }
   }

   public startWatching(onChange: () => void): void {
      if (this.watching) return;
      const pluginsDir = this.getPluginsDir();
      if (!pluginsDir || !existsSync(pluginsDir)) return;
      this.watching = true;
      this.setupWatchers(pluginsDir, onChange);
   }

   public stopWatching(): void {
      this.watching = false;
      if (this.watchTimer) {
         clearTimeout(this.watchTimer);
         this.watchTimer = undefined;
      }
      for (const watcher of this.watchers) {
         watcher.close();
      }
      this.watchers = [];
   }

   private getPluginsDir(): string {
      const distRoot = resolve(checkFilePath("code"), "plugins", "modules");
      const srcRoot = resolve(checkFilePath("code"), "..", "src", "plugins", "modules");
      const distFiles = existsSync(distRoot)
         ? readdirSync(distRoot).filter(file => extname(file) === ".js")
         : [];
      if (distFiles.length > 0) return distRoot;
      if (existsSync(srcRoot)) return srcRoot;
      return distRoot;
   }

   private setupWatchers(pluginsDir: string, onChange: () => void): void {
      this.stopWatching();
      this.watching = true;
      const dirs = this.collectWatchDirs(pluginsDir);
      for (const dir of dirs) {
         try {
            const watcher = watch(dir, () => {
               this.scheduleWatchRefresh(pluginsDir, onChange);
            });
            this.watchers.push(watcher);
         } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            log(`Plugin watch failed for ${dir}: ${message}`, "warn");
         }
      }
   }

   private collectWatchDirs(pluginsDir: string, depth: number = 2): string[] {
      const dirs: string[] = [];
      if (!existsSync(pluginsDir)) return dirs;
      dirs.push(pluginsDir);
      if (depth <= 0) return dirs;
      const entries = readdirSync(pluginsDir);
      for (const entry of entries) {
         const fullPath = resolve(pluginsDir, entry);
         try {
            if (statSync(fullPath).isDirectory()) {
               dirs.push(...this.collectWatchDirs(fullPath, depth - 1));
            }
         } catch {
            // Ignore racing deletes.
         }
      }
      return dirs;
   }

   private scheduleWatchRefresh(pluginsDir: string, onChange: () => void): void {
      if (this.watchTimer) clearTimeout(this.watchTimer);
      this.watchTimer = setTimeout(() => {
         this.setupWatchers(pluginsDir, onChange);
         onChange();
      }, 200);
   }
}

export { PluginRegistry };

const buildCommandContent = (command: PluginCommand, options: Record<string, unknown>): string => {
   const parts: string[] = [command.name];
   if (!command.options || command.options.length === 0) return parts.join(" ");
   for (const option of command.options) {
      const value = options[option.name];
      if (value === undefined || value === null) continue;
      parts.push(String(value));
   }
   return parts.join(" ");
};

const buildCommandContext = (interaction: StandardCommandInteraction, content: string): StandardMessage => ({
   id: `command:${interaction.command}:${Date.now()}`,
   content,
   authorId: interaction.userId,
   authorName: interaction.userId,
   isBot: false,
   isSelf: false,
   channelId: interaction.channelId,
   guildId: interaction.guildId
});
