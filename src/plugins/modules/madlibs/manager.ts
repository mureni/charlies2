import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, extname, resolve } from "path";
import { SQLiteMap } from "../../../core/SQLiteCollections";
import { log } from "../../../core/log";
import { checkFilePath, env } from "../../../utils";
import { resolvePluginPaths } from "../../paths";
import type { CoreMessage } from "../../../platform";

type MadlibPatterns = Set<string>;
type MadlibVocab = Map<string, Set<string>>;
type MadlibCategory = {
   patterns: MadlibPatterns;
   vocab: MadlibVocab;
};

type MadlibTombstones = {
   patterns: Set<string>;
   vocab: Map<string, Set<string>>;
};

type MadlibOverlay = MadlibCategory & {
   tombstones?: MadlibTombstones;
};

type MadlibMeta = {
   id?: string;
   name?: string;
   description?: string;
   usage?: string;
   example?: string;
   matcher?: string;
   matcherFlags?: string;
};

type MadlibCategoryJSON = {
   meta?: MadlibMeta;
   vocab: Record<string, string[]>;
   patterns: string[];
};

type MadlibBuiltin = {
   id: string;
   meta: MadlibMeta;
   category: MadlibCategory;
};

export type MadlibBuiltinInfo = {
   id: string;
   name: string;
   description?: string;
   usage?: string;
   example?: string;
   matcher?: string;
   matcherFlags?: string;
};

export type MadlibCategoryInfo = {
   id: string;
   source: "builtin" | "base" | "overlay" | "overlay-only";
   readOnly: boolean;
   patterns: number;
   vocabTypes: number;
};

type MadlibAccessRule = {
   allow?: string[];
   deny?: string[];
};

type MadlibAccessConfig = {
   default?: MadlibAccessRule;
   guilds?: Record<string, MadlibAccessRule>;
   channels?: Record<string, MadlibAccessRule>;
};

type MadlibCategorySnapshot = {
   id: string;
   readOnly: boolean;
   meta?: MadlibMeta;
   base?: { patterns: string[]; vocab: Record<string, string[]> };
   overlay?: { patterns: string[]; vocab: Record<string, string[]>; tombstones: { patterns: string[]; vocab: Record<string, string[]> } };
   merged?: { patterns: string[]; vocab: Record<string, string[]> };
};

const normalizeCategoryId = (value: string): string => value.trim().toLowerCase();
const BOT_NAME = (env("BOT_NAME") ?? "").trim() || "chatbot";
const { resourcesDir, dataDir } = resolvePluginPaths("madlibs");
const builtinsDir = resolve(resourcesDir, "builtins");
const baseDir = resolve(resourcesDir, "base");
const accessConfigPath = resolve(dataDir, "access.json");
const metaOverridesPath = resolve(dataDir, "meta.json");
const MAX_TEMPLATE_REPEAT = 64;

const ensureDir = (dir: string): void => {
   if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
};

const ensureDataFile = (): string => {
   ensureDir(dataDir);
   const currentPath = resolve(dataDir, "madlibs.sqlite");
   if (existsSync(currentPath)) return currentPath;
   const legacyRoot = checkFilePath("data");
   const legacyPath = resolve(legacyRoot, `${BOT_NAME}-madlibs.sql`);
   if (existsSync(legacyPath)) {
      try {
         copyFileSync(legacyPath, currentPath);
      } catch (error: unknown) {
         const message = error instanceof Error ? error.message : String(error);
         log(`Madlibs migration copy failed: ${message}`, "warn");
      }
   }
   return currentPath;
};

class Madlibs {
   private static categories = new SQLiteMap<string, MadlibOverlay>({
      filename: ensureDataFile(),
      table: "categories",
      allowSchemaMigration: true,
      cacheSize: 64
   });
   private static builtinsLoaded = false;
   private static builtins = new Map<string, MadlibBuiltin>();
   private static baseLoaded = false;
   private static baseCategories = new Map<string, MadlibCategory>();
   private static baseMeta = new Map<string, MadlibMeta>();
   private static accessLoaded = false;
   private static accessConfig: MadlibAccessConfig = {};
   private static metaLoaded = false;
   private static metaOverrides = new Map<string, MadlibMeta>();

   private static loadCategoryFile(filePath: string, fallbackId: string): MadlibBuiltin | Error {
      if (!existsSync(filePath)) {
         return new Error(`Unable to load madlibs data file '${filePath}': file does not exist.`);
      }
      let data: MadlibCategoryJSON;
      try {
         data = JSON.parse(readFileSync(filePath, "utf8")) as MadlibCategoryJSON;
      } catch (error: unknown) {
         const message = error instanceof Error ? error.message : String(error);
         return new Error(`Unable to parse madlibs data file '${filePath}': ${message}`);
      }
      if (!data || !data.vocab || !data.patterns) {
         return new Error(`Unable to load madlibs data file '${filePath}': file is not properly formatted.`);
      }
      const meta: MadlibMeta = data.meta ?? {};
      const id = normalizeCategoryId(meta.id ?? fallbackId);
      if (!id) {
         return new Error(`Unable to load madlibs data file '${filePath}': missing category id.`);
      }
      const vocab = new Map<string, Set<string>>();
      for (const vocabType of Object.keys(data.vocab)) {
         vocab.set(vocabType, new Set<string>(data.vocab[vocabType] ?? []));
      }
      return {
         id,
         meta,
         category: {
            patterns: new Set<string>(data.patterns ?? []),
            vocab
         }
      };
   }

   private static loadBuiltins(): void {
      Madlibs.builtins.clear();
      ensureDir(builtinsDir);
      const files = existsSync(builtinsDir)
         ? readdirSync(builtinsDir).filter(file => extname(file) === ".json")
         : [];
      for (const file of files) {
         const fallbackId = normalizeCategoryId(basename(file, ".json"));
         const filePath = resolve(builtinsDir, file);
         const loaded = Madlibs.loadCategoryFile(filePath, fallbackId);
         if (loaded instanceof Error) {
            log(loaded.message, "error");
            continue;
         }
         const meta: MadlibMeta = {
            ...loaded.meta,
            id: loaded.id,
            name: loaded.meta.name ?? loaded.id
         };
         if (Madlibs.builtins.has(loaded.id)) {
            log(`Madlibs builtin duplicate id skipped: ${loaded.id}`, "warn");
            continue;
         }
         Madlibs.builtins.set(loaded.id, { id: loaded.id, meta, category: loaded.category });
      }
   }

   private static loadBaseCategories(): void {
      Madlibs.baseCategories.clear();
      Madlibs.baseMeta.clear();
      ensureDir(baseDir);
      const files = existsSync(baseDir)
         ? readdirSync(baseDir).filter(file => extname(file) === ".json")
         : [];
      for (const file of files) {
         const fallbackId = normalizeCategoryId(basename(file, ".json"));
         const filePath = resolve(baseDir, file);
         const loaded = Madlibs.loadCategoryFile(filePath, fallbackId);
         if (loaded instanceof Error) {
            log(loaded.message, "error");
            continue;
         }
         if (Madlibs.builtins.has(loaded.id)) {
            log(`Madlibs base category conflicts with builtin, skipping: ${loaded.id}`, "warn");
            continue;
         }
         Madlibs.baseCategories.set(loaded.id, loaded.category);
         Madlibs.baseMeta.set(loaded.id, {
            ...loaded.meta,
            id: loaded.id,
            name: loaded.meta.name ?? loaded.id
         });
      }
   }

   private static loadMetaOverrides(): void {
      Madlibs.metaOverrides.clear();
      if (!existsSync(metaOverridesPath)) {
         ensureDir(dataDir);
         writeFileSync(metaOverridesPath, JSON.stringify({}, null, 2), "utf8");
         return;
      }
      try {
         const raw = JSON.parse(readFileSync(metaOverridesPath, "utf8")) as Record<string, MadlibMeta>;
         for (const [id, meta] of Object.entries(raw ?? {})) {
            if (!id || !meta) continue;
            const normalized = normalizeCategoryId(id);
            Madlibs.metaOverrides.set(normalized, { ...meta, id: normalized });
         }
      } catch (error: unknown) {
         const message = error instanceof Error ? error.message : String(error);
         log(`Madlibs meta override parse failed: ${message}`, "warn");
         Madlibs.metaOverrides.clear();
      }
   }

   private static loadAccessConfig(): void {
      Madlibs.accessConfig = {};
      if (!existsSync(accessConfigPath)) return;
      try {
         const raw = JSON.parse(readFileSync(accessConfigPath, "utf8")) as MadlibAccessConfig;
         Madlibs.accessConfig = raw ?? {};
      } catch (error: unknown) {
         const message = error instanceof Error ? error.message : String(error);
         log(`Madlibs access config parse failed: ${message}`, "warn");
         Madlibs.accessConfig = {};
      }
   }

   private static ensureBuiltinsLoaded(): void {
      if (Madlibs.builtinsLoaded) return;
      Madlibs.loadBuiltins();
      Madlibs.builtinsLoaded = true;
   }

   private static ensureBaseLoaded(): void {
      if (Madlibs.baseLoaded) return;
      Madlibs.ensureBuiltinsLoaded();
      Madlibs.loadBaseCategories();
      Madlibs.baseLoaded = true;
   }

   private static ensureAccessLoaded(): void {
      if (Madlibs.accessLoaded) return;
      Madlibs.loadAccessConfig();
      Madlibs.accessLoaded = true;
   }

   private static ensureMetaLoaded(): void {
      if (Madlibs.metaLoaded) return;
      Madlibs.loadMetaOverrides();
      Madlibs.metaLoaded = true;
   }

   public static refreshBuiltins(): void {
      Madlibs.builtinsLoaded = false;
      Madlibs.loadBuiltins();
      Madlibs.builtinsLoaded = true;
   }

   public static refreshBaseCategories(): void {
      Madlibs.baseLoaded = false;
      Madlibs.loadBaseCategories();
      Madlibs.baseLoaded = true;
   }

   public static refreshAccessConfig(): void {
      Madlibs.accessLoaded = false;
      Madlibs.loadAccessConfig();
      Madlibs.accessLoaded = true;
   }

   public static refreshMetaOverrides(): void {
      Madlibs.metaLoaded = false;
      Madlibs.loadMetaOverrides();
      Madlibs.metaLoaded = true;
   }

   public static listBuiltins(): MadlibBuiltinInfo[] {
      Madlibs.ensureBuiltinsLoaded();
      Madlibs.ensureMetaLoaded();
      return Array.from(Madlibs.builtins.values()).map((builtin) => {
         const meta = Madlibs.mergeMeta(builtin.meta, Madlibs.metaOverrides.get(builtin.id), builtin.id);
         return {
            id: builtin.id,
            name: meta?.name ?? builtin.id,
            description: meta?.description,
            usage: meta?.usage,
            example: meta?.example,
            matcher: meta?.matcher,
            matcherFlags: meta?.matcherFlags
         };
      });
   }

   public static listCommandCategories(): MadlibBuiltinInfo[] {
      Madlibs.ensureBuiltinsLoaded();
      Madlibs.ensureBaseLoaded();
      Madlibs.ensureMetaLoaded();
      const entries: MadlibBuiltinInfo[] = [];
      for (const builtin of Madlibs.builtins.values()) {
         const meta = Madlibs.mergeMeta(builtin.meta, Madlibs.metaOverrides.get(builtin.id), builtin.id);
         if (!meta) continue;
         entries.push({
            id: builtin.id,
            name: meta.name ?? builtin.id,
            description: meta.description,
            usage: meta.usage,
            example: meta.example,
            matcher: meta.matcher,
            matcherFlags: meta.matcherFlags
         });
      }
      const overlayIds = Array.from(Madlibs.categories.keys());
      const baseIds = Array.from(Madlibs.baseCategories.keys());
      const knownIds = new Set<string>([...overlayIds, ...baseIds]);
      for (const id of knownIds) {
         if (Madlibs.builtins.has(id)) continue;
         const meta = Madlibs.getCategoryMeta(id);
         if (!meta?.matcher) continue;
         entries.push({
            id,
            name: meta.name ?? id,
            description: meta.description,
            usage: meta.usage,
            example: meta.example,
            matcher: meta.matcher,
            matcherFlags: meta.matcherFlags
         });
      }
      return entries.sort((a, b) => a.id.localeCompare(b.id));
   }

   public static listCategories(): MadlibCategoryInfo[] {
      Madlibs.ensureBuiltinsLoaded();
      Madlibs.ensureBaseLoaded();
      const entries = new Map<string, MadlibCategoryInfo>();
      for (const builtin of Madlibs.builtins.values()) {
         entries.set(builtin.id, {
            id: builtin.id,
            source: "builtin",
            readOnly: true,
            patterns: builtin.category.patterns.size,
            vocabTypes: builtin.category.vocab.size
         });
      }
      for (const [id, category] of Madlibs.baseCategories.entries()) {
         if (entries.has(id)) continue;
         entries.set(id, {
            id,
            source: "base",
            readOnly: false,
            patterns: category.patterns.size,
            vocabTypes: category.vocab.size
         });
      }
      for (const [id, overlay] of Madlibs.categories.entries()) {
         if (entries.has(id) && entries.get(id)?.source === "builtin") continue;
         const hasBase = Madlibs.baseCategories.has(id);
         const source = hasBase ? "overlay" : "overlay-only";
         entries.set(id, {
            id,
            source,
            readOnly: false,
            patterns: overlay.patterns.size,
            vocabTypes: overlay.vocab.size
         });
      }
      for (const [id, entry] of entries.entries()) {
         if (entry.readOnly) continue;
         const merged = Madlibs.getMergedCategory(id);
         if (!merged) continue;
         entry.patterns = merged.patterns.size;
         entry.vocabTypes = merged.vocab.size;
      }
      return Array.from(entries.values()).sort((a, b) => a.id.localeCompare(b.id));
   }

   public static getCategorySnapshot(category: string): MadlibCategorySnapshot | undefined {
      const normalized = normalizeCategoryId(category);
      Madlibs.ensureBuiltinsLoaded();
      Madlibs.ensureBaseLoaded();
      Madlibs.ensureMetaLoaded();
      const builtin = Madlibs.builtins.get(normalized);
      const base = Madlibs.baseCategories.get(normalized);
      const overlay = Madlibs.categories.get(normalized);
      const merged = Madlibs.getMergedCategory(normalized);
      if (!builtin && !base && !overlay && !merged) return undefined;

      const formatCategory = (cat: MadlibCategory | undefined) => {
         if (!cat) return undefined;
         const vocab: Record<string, string[]> = {};
         for (const [key, words] of cat.vocab.entries()) {
            vocab[key] = Array.from(words.values()).sort();
         }
         return {
            patterns: Array.from(cat.patterns.values()).sort(),
            vocab
         };
      };

      const formatTombstones = (tombstones: MadlibTombstones | undefined) => {
         if (!tombstones) return { patterns: [], vocab: {} };
         const vocab: Record<string, string[]> = {};
         for (const [key, words] of tombstones.vocab.entries()) {
            vocab[key] = Array.from(words.values()).sort();
         }
         return {
            patterns: Array.from(tombstones.patterns.values()).sort(),
            vocab
         };
      };

      return {
         id: normalized,
         readOnly: Boolean(builtin),
         meta: Madlibs.getCategoryMeta(normalized),
         base: builtin ? formatCategory(builtin.category) : formatCategory(base),
         overlay: overlay
            ? {
               patterns: Array.from(overlay.patterns.values()).sort(),
               vocab: Object.fromEntries(Array.from(overlay.vocab.entries()).map(([k, v]) => [k, Array.from(v.values()).sort()])),
               tombstones: formatTombstones(overlay.tombstones)
            }
            : undefined,
         merged: formatCategory(merged ?? undefined)
      };
   }

   public static getAccessConfig(): MadlibAccessConfig {
      Madlibs.ensureAccessLoaded();
      return Madlibs.accessConfig;
   }

   public static getCategoryMeta(category: string): MadlibMeta | undefined {
      const normalized = normalizeCategoryId(category);
      Madlibs.ensureBuiltinsLoaded();
      Madlibs.ensureBaseLoaded();
      Madlibs.ensureMetaLoaded();
      const builtin = Madlibs.builtins.get(normalized);
      const baseMeta = Madlibs.baseMeta.get(normalized);
      const override = Madlibs.metaOverrides.get(normalized);
      const base = builtin?.meta ?? baseMeta;
      if (!base && !override) {
         if (Madlibs.builtins.has(normalized) || Madlibs.baseCategories.has(normalized) || Madlibs.categories.has(normalized)) {
            return { id: normalized, name: normalized };
         }
         return undefined;
      }
      return Madlibs.mergeMeta(base, override, normalized);
   }

   public static saveAccessConfig(config: MadlibAccessConfig): void {
      Madlibs.accessConfig = config;
      Madlibs.accessLoaded = true;
      ensureDir(dataDir);
      writeFileSync(accessConfigPath, JSON.stringify(config, null, 2), "utf8");
   }

   private static saveMetaOverrides(): void {
      Madlibs.ensureMetaLoaded();
      ensureDir(dataDir);
      const payload: Record<string, MadlibMeta> = {};
      for (const [id, meta] of Madlibs.metaOverrides.entries()) {
         payload[id] = meta;
      }
      writeFileSync(metaOverridesPath, JSON.stringify(payload, null, 2), "utf8");
   }

   private static mergeMeta(base?: MadlibMeta, override?: MadlibMeta, id?: string): MadlibMeta | undefined {
      if (!base && !override && !id) return undefined;
      const merged: MadlibMeta = { ...(base ?? {}), ...(override ?? {}) };
      if (id) merged.id = id;
      if (!merged.name && merged.id) merged.name = merged.id;
      return merged;
   }

   private static sanitizeMeta(meta: MadlibMeta): MadlibMeta {
      const sanitized: MadlibMeta = {};
      const fields: Array<keyof MadlibMeta> = ["name", "description", "usage", "example", "matcher", "matcherFlags"];
      for (const field of fields) {
         const value = meta[field];
         if (typeof value !== "string") continue;
         const trimmed = value.trim();
         if (trimmed) sanitized[field] = trimmed;
      }
      return sanitized;
   }

   public static setCategoryMeta(category: string, meta: MadlibMeta): boolean {
      if (!category) return false;
      const normalized = normalizeCategoryId(category);
      Madlibs.ensureMetaLoaded();
      const sanitized = Madlibs.sanitizeMeta(meta);
      const entries = Object.keys(sanitized);
      if (entries.length === 0) {
         Madlibs.metaOverrides.delete(normalized);
         Madlibs.saveMetaOverrides();
         return true;
      }
      Madlibs.metaOverrides.set(normalized, { ...sanitized, id: normalized });
      Madlibs.saveMetaOverrides();
      return true;
   }

   public static clearCategoryMeta(category: string): boolean {
      if (!category) return false;
      const normalized = normalizeCategoryId(category);
      Madlibs.ensureMetaLoaded();
      const removed = Madlibs.metaOverrides.delete(normalized);
      Madlibs.saveMetaOverrides();
      return removed;
   }

   public static setAccessRule(scope: "default" | "guild" | "channel", id: string, rule: MadlibAccessRule): void {
      Madlibs.ensureAccessLoaded();
      if (scope === "default") {
         Madlibs.accessConfig.default = rule;
      } else if (scope === "guild") {
         Madlibs.accessConfig.guilds = Madlibs.accessConfig.guilds ?? {};
         Madlibs.accessConfig.guilds[id] = rule;
      } else {
         Madlibs.accessConfig.channels = Madlibs.accessConfig.channels ?? {};
         Madlibs.accessConfig.channels[id] = rule;
      }
      Madlibs.saveAccessConfig(Madlibs.accessConfig);
   }

   public static clearAccessRule(scope: "default" | "guild" | "channel", id?: string): void {
      Madlibs.ensureAccessLoaded();
      if (scope === "default") {
         delete Madlibs.accessConfig.default;
      } else if (scope === "guild" && id && Madlibs.accessConfig.guilds) {
         delete Madlibs.accessConfig.guilds[id];
      } else if (scope === "channel" && id && Madlibs.accessConfig.channels) {
         delete Madlibs.accessConfig.channels[id];
      }
      Madlibs.saveAccessConfig(Madlibs.accessConfig);
   }

   private static applyAccessRule(rule: MadlibAccessRule | undefined, category: string): boolean {
      const normalized = normalizeCategoryId(category);
      if (!rule) return true;
      const allow = rule.allow?.map(normalizeCategoryId) ?? [];
      const deny = rule.deny?.map(normalizeCategoryId) ?? [];
      const allowAll = allow.includes("*");
      const denyAll = deny.includes("*");
      if (denyAll) return false;
      if (allow.length > 0 && !allowAll && !allow.includes(normalized)) return false;
      if (deny.includes(normalized)) return false;
      return true;
   }

   public static isCategoryAllowed(context: CoreMessage, category: string): boolean {
      Madlibs.ensureAccessLoaded();
      const channelId = context.channelId;
      const guildId = context.guildId;
      if (channelId && Madlibs.accessConfig.channels?.[channelId]) {
         return Madlibs.applyAccessRule(Madlibs.accessConfig.channels[channelId], category);
      }
      if (guildId && Madlibs.accessConfig.guilds?.[guildId]) {
         return Madlibs.applyAccessRule(Madlibs.accessConfig.guilds[guildId], category);
      }
      return Madlibs.applyAccessRule(Madlibs.accessConfig.default, category);
   }

   public static isBuiltinCategory(category: string): boolean {
      Madlibs.ensureBuiltinsLoaded();
      return Madlibs.builtins.has(normalizeCategoryId(category));
   }

   public static createCategory(category: string): boolean {
      const normalized = normalizeCategoryId(category);
      if (!normalized) return false;
      if (Madlibs.isBuiltinCategory(normalized)) return false;
      const existing = Madlibs.getOverlay(normalized, false);
      if (existing) return true;
      Madlibs.getOverlay(normalized, true);
      return true;
   }

   private static getOverlay(category: string, createIfMissing: boolean): MadlibOverlay | undefined {
      const normalized = normalizeCategoryId(category);
      const existing = Madlibs.categories.get(normalized);
      if (existing) return existing;
      if (!createIfMissing) return undefined;
      const fresh: MadlibOverlay = { patterns: new Set<string>(), vocab: new Map<string, Set<string>>() };
      Madlibs.categories.set(normalized, fresh);
      return fresh;
   }

   private static ensureTombstones(overlay: MadlibOverlay): MadlibTombstones {
      if (!overlay.tombstones) {
         overlay.tombstones = { patterns: new Set<string>(), vocab: new Map<string, Set<string>>() };
      } else {
         overlay.tombstones.patterns ??= new Set<string>();
         overlay.tombstones.vocab ??= new Map<string, Set<string>>();
      }
      return overlay.tombstones;
   }

   private static mergeCategories(base?: MadlibCategory, overlay?: MadlibOverlay): MadlibCategory {
      const patterns = new Set<string>();
      if (base?.patterns) {
         for (const pattern of base.patterns) patterns.add(pattern);
      }
      if (overlay?.patterns) {
         for (const pattern of overlay.patterns) patterns.add(pattern);
      }

      const vocab = new Map<string, Set<string>>();
      const appendVocab = (source?: MadlibVocab) => {
         if (!source) return;
         for (const [vocabType, words] of source.entries()) {
            const current = vocab.get(vocabType) ?? new Set<string>();
            for (const word of words) current.add(word);
            vocab.set(vocabType, current);
         }
      };
      appendVocab(base?.vocab);
      appendVocab(overlay?.vocab);

      if (overlay?.tombstones) {
         for (const pattern of overlay.tombstones.patterns.values()) {
            patterns.delete(pattern);
         }
         for (const [vocabType, words] of overlay.tombstones.vocab.entries()) {
            const current = vocab.get(vocabType);
            if (!current) continue;
            for (const word of words) current.delete(word);
         }
      }

      return { patterns, vocab };
   }

   private static getMergedCategory(category: string): MadlibCategory | undefined {
      const normalized = normalizeCategoryId(category);
      Madlibs.ensureBuiltinsLoaded();
      const builtin = Madlibs.builtins.get(normalized);
      if (builtin) return builtin.category;
      Madlibs.ensureBaseLoaded();
      const base = Madlibs.baseCategories.get(normalized);
      const overlay = Madlibs.getOverlay(normalized, false);
      if (!base && !overlay) return undefined;
      return Madlibs.mergeCategories(base, overlay);
   }

   private static renderPattern(pattern: string, vocab: MadlibVocab): string {
      let rendered = pattern;
      for (const [vocabType, wordSet] of vocab.entries()) {
         if (!rendered.includes(vocabType)) continue;
         const baseWords = Array.from(wordSet);
         if (baseWords.length === 0) continue;
         let pool = [...baseWords];
         while (rendered.includes(vocabType)) {
            if (pool.length === 0) pool = [...baseWords];
            const [word] = pool.splice(Math.floor(Math.random() * pool.length), 1);
            if (!word) break;
            rendered = rendered.replace(vocabType, Madlibs.expandFormatTokens(word));
         }
      }
      return rendered;
   }

   private static expandFormatTokens(value: string): string {
      let output = "";
      for (let i = 0; i < value.length; i++) {
         const char = value[i];
         if (char === "\\") {
            const next = value[i + 1];
            if (next) {
               output += next;
               i += 1;
               continue;
            }
         }

         if (char === "#") {
            const { count, length } = Madlibs.readQuantifier(value, i + 1);
            output += Madlibs.randomDigits(count);
            i += length;
            continue;
         }

         if (char === "[") {
            if (value.startsWith("[A-Z]", i)) {
               const tokenEnd = i + "[A-Z]".length;
               const { count, length } = Madlibs.readQuantifier(value, tokenEnd);
               output += Madlibs.randomLetters("upper", count);
               i = tokenEnd + length - 1;
               continue;
            }
            if (value.startsWith("[a-z]", i)) {
               const tokenEnd = i + "[a-z]".length;
               const { count, length } = Madlibs.readQuantifier(value, tokenEnd);
               output += Madlibs.randomLetters("lower", count);
               i = tokenEnd + length - 1;
               continue;
            }
            const hashMatch = value.slice(i).match(/^\[(#+)\]/);
            if (hashMatch) {
               const tokenLength = hashMatch[0].length;
               const digitsPerGroup = hashMatch[1].length;
               const tokenEnd = i + tokenLength;
               const { count, length } = Madlibs.readQuantifier(value, tokenEnd);
               output += Madlibs.randomDigits(digitsPerGroup * count);
               i = tokenEnd + length - 1;
               continue;
            }
         }

         output += char;
      }
      return output;
   }

   private static readQuantifier(value: string, start: number): { count: number; length: number } {
      if (value[start] !== "{") return { count: 1, length: 0 };
      const end = value.indexOf("}", start);
      if (end === -1) return { count: 1, length: 0 };
      const body = value.slice(start + 1, end);
      if (!/^\d+(,\d+)?$/.test(body)) return { count: 1, length: 0 };
      const [minRaw, maxRaw] = body.split(",");
      const min = Number(minRaw);
      const max = maxRaw === undefined ? min : Number(maxRaw);
      if (!Number.isFinite(min) || !Number.isFinite(max)) return { count: 1, length: 0 };
      const safeMin = Math.max(1, Math.min(min, MAX_TEMPLATE_REPEAT));
      const safeMax = Math.max(1, Math.min(max, MAX_TEMPLATE_REPEAT));
      const low = Math.min(safeMin, safeMax);
      const high = Math.max(safeMin, safeMax);
      const count = low + Math.floor(Math.random() * (high - low + 1));
      return { count, length: end - start + 1 };
   }

   private static randomDigits(count: number): string {
      let result = "";
      for (let i = 0; i < count; i++) {
         result += String(Math.floor(Math.random() * 10));
      }
      return result;
   }

   private static randomLetters(caseType: "upper" | "lower", count: number): string {
      const baseCode = caseType === "upper" ? "A".charCodeAt(0) : "a".charCodeAt(0);
      let result = "";
      for (let i = 0; i < count; i++) {
         result += String.fromCharCode(baseCode + Math.floor(Math.random() * 26));
      }
      return result;
   }

   public static generate(numLines: number = 4, category: string = "general"): string {
      const categoryData = Madlibs.getMergedCategory(category);
      if (!categoryData || categoryData.patterns.size === 0 || categoryData.vocab.size === 0) {
         return "No usable madlib data found";
      }

      const patterns = Array.from(categoryData.patterns.values());
      const response: string[] = [];
      const maxLines = Math.min(numLines, patterns.length);
      for (let l = 0; l < maxLines; l++) {
         let [pulledPattern]: string[] = patterns.splice(Math.floor(Math.random() * patterns.length), 1);
         if (!pulledPattern) break;
         pulledPattern = Madlibs.renderPattern(pulledPattern, categoryData.vocab);
         const trimmed = pulledPattern.trim();
         response.push(/[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`);
      }
      return response.join(" ").trim();
   }

   public static addVocab(category: string = "general", vocabType: string = "", word: string = ""): boolean {
      if (!category || !vocabType || !word) return false;
      if (Madlibs.isBuiltinCategory(category)) return false;
      const categoryData = Madlibs.getOverlay(category, true);
      if (!categoryData) return false;
      const words = categoryData.vocab.get(vocabType) ?? new Set<string>();
      words.add(word);
      categoryData.vocab.set(vocabType, words);
      const tombstones = Madlibs.ensureTombstones(categoryData);
      tombstones.vocab.get(vocabType)?.delete(word);
      Madlibs.categories.set(normalizeCategoryId(category), categoryData);
      return true;
   }

   public static removeVocab(category: string = "general", vocabType: string = "", word: string = ""): boolean {
      if (!vocabType || !word) return false;
      if (Madlibs.isBuiltinCategory(category)) return false;
      const categoryData = Madlibs.getOverlay(category, true);
      if (!categoryData) return false;
      const words = categoryData.vocab.get(vocabType) ?? new Set<string>();
      words.delete(word);
      categoryData.vocab.set(vocabType, words);
      const tombstones = Madlibs.ensureTombstones(categoryData);
      const tombstoneWords = tombstones.vocab.get(vocabType) ?? new Set<string>();
      tombstoneWords.add(word);
      tombstones.vocab.set(vocabType, tombstoneWords);
      Madlibs.categories.set(normalizeCategoryId(category), categoryData);
      return true;
   }

   public static addVocabType(category: string = "general", vocabType: string = ""): boolean {
      if (!vocabType) return false;
      if (Madlibs.isBuiltinCategory(category)) return false;
      const categoryData = Madlibs.getOverlay(category, true);
      if (!categoryData) return false;
      if (!categoryData.vocab.has(vocabType)) {
         categoryData.vocab.set(vocabType, new Set<string>());
      }
      Madlibs.categories.set(normalizeCategoryId(category), categoryData);
      return true;
   }

   public static addPattern(category: string = "general", pattern: string = ""): boolean {
      if (!pattern) return false;
      if (Madlibs.isBuiltinCategory(category)) return false;
      const categoryData = Madlibs.getOverlay(category, true);
      if (!categoryData) return false;
      categoryData.patterns.add(pattern);
      const tombstones = Madlibs.ensureTombstones(categoryData);
      tombstones.patterns.delete(pattern);
      Madlibs.categories.set(normalizeCategoryId(category), categoryData);
      return true;
   }

   public static clearOverlay(category: string): boolean {
      const normalized = normalizeCategoryId(category);
      if (!Madlibs.categories.has(normalized)) return false;
      return Madlibs.categories.delete(normalized);
   }

   public static removePattern(category: string = "general", pattern: string): boolean {
      if (!pattern) return false;
      if (Madlibs.isBuiltinCategory(category)) return false;
      const categoryData = Madlibs.getOverlay(category, true);
      if (!categoryData) return false;
      categoryData.patterns.delete(pattern);
      const tombstones = Madlibs.ensureTombstones(categoryData);
      tombstones.patterns.add(pattern);
      Madlibs.categories.set(normalizeCategoryId(category), categoryData);
      return true;
   }
}

export { Madlibs };
