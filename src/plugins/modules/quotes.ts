import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { resolve, extname } from "path";
import { log } from "../../core/log";
import type { CoreMessage } from "../../platform";
import type { TriggerResult } from "../../core/triggerTypes";
import { checkFilePath } from "../../utils";
import { resolvePluginPaths } from "../paths";
import type { PluginCommand, TriggerPlugin } from "../types";
import type { QuoteHelpers, QuoteSource, QuoteStyle } from "./quotes/types";

const pluginId = "quotes";
const { resourcesDir } = resolvePluginPaths(pluginId);
const quoteCache = new Map<string, string[]>();
const defaultModifications = { Case: "unchanged" } as const;
const commands: PluginCommand[] = [];
let quoteSources: QuoteSource[] = [];
let sourcesLoaded = false;
let sourcesLoading: Promise<void> | undefined;

const loadQuotes = (fileName: string): string[] => {
   const cached = quoteCache.get(fileName);
   if (cached) return cached;
   const filePath = resolve(resourcesDir, fileName);
   try {
      const contents = readFileSync(filePath, "utf8");
      const quotes = contents
         .split(/\r?\n/u)
         .map(line => line.trim())
         .filter(line => line.length > 0);
      quoteCache.set(fileName, quotes);
      return quotes;
   } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Quotes plugin error loading ${filePath}: ${message}`, "error");
      return [];
   }
};

const getQuotes = (source: QuoteSource): string[] => {
   if (!source.fileName) return [];
   return loadQuotes(source.fileName);
};

const randomQuote = (quotes: string[]): string => quotes[Math.floor(Math.random() * quotes.length)];

const applyStyle = (quote: string, style?: QuoteStyle): string => {
   if (!style) return quote;
   let result = quote;
   if (style.wrap) result = `${style.wrap}${result}${style.wrap}`;
   if (style.prefix) result = `${style.prefix}${result}`;
   if (style.suffix) result = `${result}${style.suffix}`;
   return result;
};

const quoteFallbackMatcher = /^quote(?:\s+(?<source>[\w-]+))?$/ui;

const quoteCommand: PluginCommand = {
   name: "quote",
   description: "Random quote from a source",
   options: [
      {
         name: "source",
         description: "Quote source id",
         type: "string",
         required: false
      }
   ],
   fallbackMatcher: quoteFallbackMatcher
};

const updateQuoteCommandDetails = (sources: QuoteSource[]): void => {
   if (sources.length === 0) {
      quoteCommand.description = "Random quote from a source";
      quoteCommand.example = undefined;
      return;
   }
   const sourceList = sources.map(source => source.id).join(", ");
   quoteCommand.description = `Random quote from a source. Available sources: ${sourceList}`;
   quoteCommand.example = `quote ${sources[0].id}`;
};

const buildSourceCommands = (sources: QuoteSource[]): PluginCommand[] =>
   sources
      .map(source => {
         if (source.command) return source.command;
         if (!source.matcher) return undefined;
         return {
            name: source.id,
            description: source.description,
            fallbackMatcher: source.matcher,
            icon: source.icon
         } as PluginCommand;
      })
      .filter((command): command is PluginCommand => Boolean(command));

const applyCommands = (sources: QuoteSource[]): void => {
   updateQuoteCommandDetails(sources);
   const sourceCommands = buildSourceCommands(sources);
   const updated = [...sourceCommands, quoteCommand];
   commands.splice(0, commands.length, ...updated);
};

const findSourceById = (sourceId: string): QuoteSource | undefined =>
   quoteSources.find(source => source.id.toLowerCase() === sourceId.toLowerCase());

const resolveSource = (content: string): { source: QuoteSource; match?: RegExpMatchArray } | { error: string } => {
   for (const source of quoteSources) {
      if (source.matcher) {
         const match = content.match(source.matcher);
         if (match) return { source, match };
      }
      if (source.command?.fallbackMatcher) {
         const match = content.match(source.command.fallbackMatcher);
         if (match) return { source, match };
      }
   }
   const quoteMatch = content.match(quoteFallbackMatcher);
   if (quoteMatch) {
      if (quoteSources.length === 0) {
         return { error: "no quote sources available" };
      }
      const requested = quoteMatch.groups?.source?.trim();
      if (!requested) return { source: quoteSources[0], match: quoteMatch };
      const source = findSourceById(requested);
      if (source) return { source, match: quoteMatch };
      return {
         error: `unknown quote source: ${requested}. available sources: ${quoteSources.map(item => item.id).join(", ")}`
      };
   }
   return { error: "no quote source matched" };
};

const getSourcesDir = (): string => {
   const distRoot = resolve(checkFilePath("code"), "plugins", "modules", "quotes", "sources");
   const srcRoot = resolve(checkFilePath("code"), "..", "src", "plugins", "modules", "quotes", "sources");
   const distFiles = existsSync(distRoot)
      ? readdirSync(distRoot).filter(file => extname(file) === ".js")
      : [];
   if (distFiles.length > 0) return distRoot;
   if (existsSync(srcRoot)) return srcRoot;
   return distRoot;
};

const loadExternalSources = async (): Promise<QuoteSource[]> => {
   const externalSources: QuoteSource[] = [];
   const { dataDir } = resolvePluginPaths(pluginId);
   const externalDir = resolve(dataDir, "sources");
   if (!existsSync(externalDir)) return externalSources;
   const files = readdirSync(externalDir).filter(file => extname(file) === ".js");
   for (const file of files) {
      const fullPath = resolve(externalDir, file);
      try {
         const module = await import(fullPath);
         const moduleSources = module.sources;
         if (!Array.isArray(moduleSources)) {
            log(`Quotes external source ${file} missing export 'sources'`, "warn");
            continue;
         }
         for (const source of moduleSources as QuoteSource[]) {
            externalSources.push(source);
         }
      } catch (error: unknown) {
         const message = error instanceof Error ? error.message : String(error);
         log(`Quotes external source ${file} failed: ${message}`, "error");
      }
   }
   return externalSources;
};

const loadSources = async (): Promise<void> => {
   if (sourcesLoaded) return;
   quoteSources = [];
   const sourceDir = getSourcesDir();
   const files = existsSync(sourceDir)
      ? readdirSync(sourceDir).filter(file => [".js", ".ts"].includes(extname(file)))
      : [];
   for (const file of files) {
      if (file === "types.ts" || file === "types.js") continue;
      const fullPath = resolve(sourceDir, file);
      const stats = statSync(fullPath);
      if (!stats.isFile()) continue;
      try {
         const module = await import(fullPath);
         const moduleSources = module.sources;
         if (!Array.isArray(moduleSources)) continue;
         for (const source of moduleSources as QuoteSource[]) {
            quoteSources.push(source);
         }
      } catch (error: unknown) {
         const message = error instanceof Error ? error.message : String(error);
         log(`Quotes source ${file} failed: ${message}`, "error");
      }
   }
   const externalSources = await loadExternalSources();
   for (const source of externalSources) {
      quoteSources.push(source);
   }
   const deduped: QuoteSource[] = [];
   const seen = new Set<string>();
   for (const source of quoteSources) {
      if (seen.has(source.id)) {
         log(`Quotes source duplicate id skipped: ${source.id}`, "warn");
         continue;
      }
      seen.add(source.id);
      deduped.push(source);
   }
   quoteSources = deduped;
   applyCommands(quoteSources);
   sourcesLoaded = true;
};

const ensureSourcesLoaded = async (): Promise<void> => {
   if (sourcesLoaded) return;
   if (!sourcesLoading) sourcesLoading = loadSources();
   await sourcesLoading;
};

const helpers: QuoteHelpers = {
   getQuotes: (fileName: string) => loadQuotes(fileName),
   randomQuote,
   applyStyle,
   defaultModifications
};

const normalizeResult = (result: TriggerResult): TriggerResult => ({
   ...result,
   modifications: result.modifications ?? defaultModifications
});

const execute = async (context: CoreMessage): Promise<TriggerResult> => {
   await ensureSourcesLoaded();
   const content = context.content.trim();
   const resolved = resolveSource(content);
   if ("error" in resolved) {
      return {
         results: [{ contents: resolved.error }],
         modifications: defaultModifications
      };
   }
   const { source } = resolved;
   if (source.resolveQuote) {
      const result = await source.resolveQuote(context, resolved.match, helpers);
      return normalizeResult(result);
   }
   const quotes = getQuotes(source);
   if (!source.fileName || quotes.length === 0) {
      return {
         results: [{ contents: `no quotes available for ${source.name}` }],
         modifications: source.modifications ?? defaultModifications
      };
   }
   const quote = applyStyle(randomQuote(quotes), source.style);
   return {
      results: [{ contents: quote }],
      modifications: source.modifications ?? defaultModifications
   };
};

const quotesPlugin: TriggerPlugin = {
   id: pluginId,
   name: "quotes",
   description: "Random quotes from multiple sources",
   usage: "quote [source]",
   commands,
   execute,
   onLoad: async () => {
      await ensureSourcesLoaded();
   }
};

const plugins = [quotesPlugin];
export { plugins };
