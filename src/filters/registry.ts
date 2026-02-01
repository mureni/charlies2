import type { FSWatcher } from "fs";
import { existsSync, readdirSync, statSync, watch } from "fs";
import { extname, resolve } from "path";
import type { CoreMessage } from "@/platform";
import { log } from "@/core/log";
import { checkFilePath } from "@/utils";

type FilterStage = "preBrain" | "postBrain";
type FilterPhase = "learn" | "respond";
interface FilterApplyOptions { skipIds?: string[] }

interface Filter {
   id: string;
   stage: FilterStage;
   apply: (text: string, context: CoreMessage, phase: FilterPhase) => string;
}

interface FilterModule {
   filters: Filter[];
}

class FilterRegistry {
   private registry: Map<FilterStage, Filter[]> = new Map([
      ["preBrain", []],
      ["postBrain", []]
   ]);
   private watchers: FSWatcher[] = [];
   private watching = false;
   private watchTimer: NodeJS.Timeout | undefined;

   public register(filter: Filter): void {
      const list = this.registry.get(filter.stage);
      if (!list) return;
      const existing = list.findIndex((item) => item.id === filter.id);
      if (existing >= 0) list.splice(existing, 1);
      list.push(filter);
   }

   public unregister(id: string): void {
      for (const [stage, list] of this.registry.entries()) {
         this.registry.set(stage, list.filter((filter) => filter.id !== id));
      }
   }

   public apply(
      stage: FilterStage,
      text: string,
      context: CoreMessage,
      phase: FilterPhase,
      options?: FilterApplyOptions
   ): string {
      const list = this.registry.get(stage);
      if (!list || list.length === 0) return text;
      const skip = new Set(options?.skipIds ?? []);
      let output = text;
      for (const filter of list) {
         if (skip.has(filter.id)) continue;
         output = filter.apply(output, context, phase);
      }
      return output;
   }

   public list(stage?: FilterStage): Filter[] {
      if (!stage) {
         return Array.from(this.registry.values()).flat();
      }
      return [...(this.registry.get(stage) ?? [])];
   }

   public clear(): void {
      for (const stage of this.registry.keys()) {
         this.registry.set(stage, []);
      }
   }

   public registerAll(filters: Filter[]): void {
      for (const filter of filters) {
         this.register(filter);
      }
   }

   public async loadFromDist(): Promise<void> {
      const filtersDir = this.getFiltersDir();
      if (!filtersDir || !existsSync(filtersDir)) return;
      const files = readdirSync(filtersDir);
      for (const file of files) {
         if (extname(file) !== ".js") continue;
         if (file === "index.js" || file === "registry.js") continue;
         const fullPath = resolve(filtersDir, file);
         try {
            const module = (await import(fullPath)) as FilterModule;
            if (!module.filters || !Array.isArray(module.filters)) {
               log(`Filter module ${file} missing export 'filters'`, "warn");
               continue;
            }
            this.registerAll(module.filters);
         } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            log(`Error loading filter module ${file}: ${message}`, "error");
         }
      }
   }

   public async reload(): Promise<void> {
      this.clear();
      await this.loadFromDist();
   }

   public startWatching(onChange: () => void): void {
      if (this.watching) return;
      const filtersDir = this.getFiltersDir();
      if (!filtersDir || !existsSync(filtersDir)) return;
      this.watching = true;
      this.setupWatchers(filtersDir, onChange);
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

   private getFiltersDir(): string {
      const distRoot = resolve(checkFilePath("code"), "filters");
      const srcRoot = resolve(checkFilePath("code"), "..", "src", "filters");
      const distFiles = existsSync(distRoot)
         ? readdirSync(distRoot).filter(file => extname(file) === ".js")
         : [];
      if (distFiles.length > 0) return distRoot;
      if (existsSync(srcRoot)) return srcRoot;
      return distRoot;
   }

   private setupWatchers(filtersDir: string, onChange: () => void): void {
      this.stopWatching();
      this.watching = true;
      const dirs = this.collectWatchDirs(filtersDir);
      for (const dir of dirs) {
         try {
            const watcher = watch(dir, () => {
               this.scheduleWatchRefresh(filtersDir, onChange);
            });
            this.watchers.push(watcher);
         } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            log(`Filter watch failed for ${dir}: ${message}`, "warn");
         }
      }
   }

   private collectWatchDirs(filtersDir: string, depth: number = 2): string[] {
      const dirs: string[] = [];
      if (!existsSync(filtersDir)) return dirs;
      dirs.push(filtersDir);
      if (depth <= 0) return dirs;
      const entries = readdirSync(filtersDir);
      for (const entry of entries) {
         const fullPath = resolve(filtersDir, entry);
         try {
            if (statSync(fullPath).isDirectory()) {
               dirs.push(...this.collectWatchDirs(fullPath, depth - 1));
            }
         } catch {
            // ignore racing deletes
         }
      }
      return dirs;
   }

   private scheduleWatchRefresh(filtersDir: string, onChange: () => void): void {
      if (this.watchTimer) clearTimeout(this.watchTimer);
      this.watchTimer = setTimeout(() => {
         this.setupWatchers(filtersDir, onChange);
         onChange();
      }, 200);
   }
}

const Filters = new FilterRegistry();

export type { Filter, FilterPhase, FilterStage, FilterApplyOptions, FilterModule };
export { FilterRegistry, Filters };
