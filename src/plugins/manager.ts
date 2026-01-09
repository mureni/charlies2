import { FSWatcher, existsSync, readdirSync, statSync, watch } from "fs";
import { extname, resolve } from "path";
import { log } from "../core/log";
import { checkFilePath } from "../utils";
import type { Trigger } from "../core/triggerTypes";
import type { PlatformCommand } from "../platform";
import type { PluginCommand, PluginModule, TriggerPlugin } from "./types";

const legacyTriggerToPlugin = (trigger: Trigger): TriggerPlugin => ({
   id: trigger.id,
   name: trigger.name,
   description: trigger.description,
   usage: trigger.usage,
   matcher: trigger.command,
   execute: trigger.action,
   permissions: {
      ownerOnly: trigger.ownerOnly,
      adminOnly: trigger.adminOnly
   },
   example: trigger.example,
   icon: trigger.icon
});

const pluginToLegacyTrigger = (plugin: TriggerPlugin): Trigger | undefined => {
   if (!plugin.matcher || !plugin.execute) return undefined;
   return {
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      usage: plugin.usage,
      command: plugin.matcher,
      action: plugin.execute,
      ownerOnly: plugin.permissions?.ownerOnly,
      adminOnly: plugin.permissions?.adminOnly,
      example: plugin.example,
      icon: plugin.icon
   };
};

const commandUsage = (command: PluginCommand): string => {
   if (command.usage) return command.usage;
   if (!command.options || command.options.length === 0) return command.name;
   const rendered = command.options.map(option => {
      const label = option.name;
      return option.required ? `<${label}>` : `[${label}]`;
   });
   return [command.name, ...rendered].join(" ");
};

const commandToLegacyTrigger = (plugin: TriggerPlugin, command: PluginCommand): Trigger | undefined => {
   if (!plugin.execute || !command.fallbackMatcher) return undefined;
   const { fallbackMatcher } = command;
   return {
      id: command.name,
      name: command.name,
      description: command.description,
      usage: commandUsage(command),
      command: fallbackMatcher,
      action: plugin.execute,
      ownerOnly: plugin.permissions?.ownerOnly,
      adminOnly: plugin.permissions?.adminOnly,
      example: command.example ?? plugin.example,
      icon: command.icon ?? plugin.icon,
      hidden: command.hidden
   };
};

class PluginManager {
   private plugins: TriggerPlugin[] = [];
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

   public register(plugin: TriggerPlugin): void {
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

   public registerAll(plugins: TriggerPlugin[]): void {
      for (const plugin of plugins) {
         this.register(plugin);
      }
   }

   public registerLegacyTrigger(trigger: Trigger): void {
      this.register(legacyTriggerToPlugin(trigger));
   }

   public registerLegacyTriggers(triggers: Trigger[]): void {
      for (const trigger of triggers) {
         this.registerLegacyTrigger(trigger);
      }
   }

   public getPlugins(): TriggerPlugin[] {
      return [...this.plugins];
   }

   public getLegacyTriggers(): Trigger[] {
      const converted: Trigger[] = [];
      for (const plugin of this.plugins) {
         const legacy = pluginToLegacyTrigger(plugin);
         if (legacy) converted.push(legacy);
         if (plugin.commands) {
            for (const command of plugin.commands) {
               const fallback = commandToLegacyTrigger(plugin, command);
               if (fallback) converted.push(fallback);
            }
         }
      }
      return converted;
   }

   public getCommands(): PlatformCommand[] {
      const commands: PlatformCommand[] = [];
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

export { PluginManager };
