import http from "node:http";
import type { AddressInfo } from "node:net";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { createGzip } from "node:zlib";
import { Brain } from "@/core/brain";
import { BrainOverlays } from "@/core/brainOverlays";
import { log } from "@/core/log";
import { env } from "@/utils";
import { Madlibs } from "@/plugins/modules/madlibs/manager";
import { Swaps } from "@/filters/swaps/manager";

const DEFAULT_PORT = Number(env("ADMIN_PORTAL_PORT", "3140"));
const DEFAULT_HOST = env("ADMIN_PORTAL_HOST", "127.0.0.1");
const DEFAULT_PUBLIC_DIR = resolve(env("BOT_ROOT") ?? process.cwd(), "resources", "admin-portal");

interface PluginInfo { id: string; name: string; script: string }

interface AdminServerOptions {
   port?: number;
   host?: string;
   publicDir?: string;
   quiet?: boolean;
   plugins?: PluginInfo[];
}

const contentTypeByExt: Record<string, string> = {
   ".html": "text/html; charset=utf-8",
   ".css": "text/css; charset=utf-8",
   ".js": "text/javascript; charset=utf-8",
   ".json": "application/json; charset=utf-8"
};

interface BrainLexiconItem {
   word: string;
   ngramCount: number;
}

interface BrainLexiconPage {
   total: number;
   offset: number;
   limit: number;
   items: BrainLexiconItem[];
}

interface BrainTokenCount {
   token: string;
   count: number;
}

interface BrainNgramDetail {
   hash: string;
   tokens: string[];
   canStart: boolean;
   canEnd: boolean;
   nextTokens: BrainTokenCount[];
   previousTokens: BrainTokenCount[];
}

interface BrainNgramListItem {
   hash: string;
   tokens: string;
   canStart: boolean;
   canEnd: boolean;
   nextCount: number;
   prevCount: number;
   tokenCount: number;
   minTokenLength: number;
   maxTokenLength: number;
}

interface BrainNgramPage {
   total: number;
   offset: number;
   limit: number;
   items: BrainNgramListItem[];
   index: {
      state: "idle" | "building" | "ready";
      scanned: number;
      total: number;
      builtAt: string | null;
      stale: boolean;
   };
}

interface BrainWordDetail {
   word: string;
   ngramCount: number;
   ngrams: BrainNgramDetail[];
}

const sendJson = (res: http.ServerResponse, status: number, payload: unknown): void => {
   const body = JSON.stringify(payload, null, 2);
   res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
   res.end(body);
};

const readBody = async (req: http.IncomingMessage): Promise<string> =>
   new Promise((resolveBody) => {
      let data = "";
      req.on("data", chunk => {
         data += chunk;
      });
      req.on("end", () => resolveBody(data));
   });

const ensureBrainSettings = (): void => {
   if (Brain.settings) return;
   const configuredName = (env("BOT_NAME") ?? "").trim();
   const preferredName = configuredName ? Brain.botName : "default";
   const result = Brain.loadSettings(preferredName);
   if (!(result instanceof Error)) return;
   if (preferredName !== "default") {
      const fallback = Brain.loadSettings("default");
      if (!(fallback instanceof Error)) return;
      log(`Brain settings not loaded: ${fallback.message}`, "warn");
      return;
   }
   log(`Brain settings not loaded: ${result.message}`, "warn");
};

const getBrainDbPath = (): string => resolve(env("BOT_ROOT") ?? process.cwd(), "data", `${Brain.botName}.sqlite`);

const getDefaultPlugins = (): PluginInfo[] => ([
   { id: "brain", name: "Brain", script: "/plugins/brain/index.js" },
   { id: "madlibs", name: "Madlibs", script: "/plugins/madlibs/index.js" },
   { id: "swaps", name: "Swaps", script: "/plugins/swaps/index.js" }
]);

const buildBrainStats = () => {
   ensureBrainSettings();
   const dbPath = getBrainDbPath();
   const dbBytes = existsSync(dbPath) ? statSync(dbPath).size : 0;
   const overlays = BrainOverlays.listContexts();
   return {
      brainName: Brain.botName,
      lexiconCount: Brain.lexicon.size,
      ngramCount: Brain.nGrams.size,
      chainLength: Brain.chainLength,
      dbBytes,
      overlays: {
         total: overlays.length,
         contexts: overlays
      }
   };
};

const MAX_BRAIN_PAGE = 200;
const DEFAULT_BRAIN_PAGE = 50;
const DEFAULT_NGRAM_LIMIT = 12;
const DEFAULT_TOP_TOKENS = 20;
const DEFAULT_NGRAM_TABLE_LIMIT = 200;
const NGRAM_INDEX_CHUNK = 5000;
const NGRAM_SORT_KEYS: Array<keyof NgramIndexItem> = [
   "hash",
   "tokens",
   "canStart",
   "canEnd",
   "nextCount",
   "prevCount",
   "tokenCount",
   "minTokenLength",
   "maxTokenLength"
];

const clampNumber = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const parseNumber = (value: string | null, fallback: number): number => {
   const parsed = Number(value);
   return Number.isFinite(parsed) ? parsed : fallback;
};
const parseLimitAllowZero = (value: string | null, fallback: number): number => {
   if (value === null || value === "") return fallback;
   const parsed = Number(value);
   if (!Number.isFinite(parsed)) return fallback;
   return Math.max(0, parsed);
};
const parseOptionalNumber = (value: string | null): number | undefined => {
   if (value === null || value === "") return undefined;
   const parsed = Number(value);
   if (!Number.isFinite(parsed)) return undefined;
   return parsed;
};
const parseBooleanFilter = (value: string | null): boolean | null => {
   if (value === null || value === "" || value === "any") return null;
   if (/^(1|true|yes|on)$/i.test(value)) return true;
   if (/^(0|false|no|off)$/i.test(value)) return false;
   return null;
};
const parseSortKey = (value: string | null): NgramQueryOptions["sortKey"] => {
   if (!value || value === "ingest") return "ingest";
   return NGRAM_SORT_KEYS.includes(value as keyof NgramIndexItem) ? (value as keyof NgramIndexItem) : "ingest";
};

const sortTokenCounts = (map: Map<string, number>, limit: number): BrainTokenCount[] => {
   const pairs: BrainTokenCount[] = [];
   for (const [token, count] of map.entries()) {
      pairs.push({ token, count });
   }
   pairs.sort((a, b) => b.count - a.count);
   return limit > 0 ? pairs.slice(0, limit) : pairs;
};

type NgramIndexItem = BrainNgramListItem;

interface NgramIndexCache {
   items: NgramIndexItem[];
   state: "idle" | "building" | "ready";
   scanned: number;
   total: number;
   builtAt: number | null;
   dbMtimeMs: number | null;
   dbSize: number | null;
   stale: boolean;
   buildId: number;
   viewCache?: { key: string; items: NgramIndexItem[] };
}

const ngramIndex: NgramIndexCache = {
   items: [],
   state: "idle",
   scanned: 0,
   total: 0,
   builtAt: null,
   dbMtimeMs: null,
   dbSize: null,
   stale: false,
   buildId: 0
};

const getBrainDbStats = (): { mtimeMs: number; size: number } | null => {
   const dbPath = getBrainDbPath();
   if (!existsSync(dbPath)) return null;
   const stat = statSync(dbPath);
   return { mtimeMs: stat.mtimeMs, size: stat.size };
};

const markNgramIndexStaleIfNeeded = (): void => {
   if (ngramIndex.state === "idle") return;
   const stats = getBrainDbStats();
   if (!stats || ngramIndex.dbMtimeMs === null) return;
   if (stats.mtimeMs !== ngramIndex.dbMtimeMs || stats.size !== ngramIndex.dbSize) {
      ngramIndex.stale = true;
   }
};

const getTokenCollectionSize = (value: unknown): number => {
   if (value instanceof Map || value instanceof Set) return value.size;
   if (Array.isArray(value)) return value.length;
   if (value && typeof value === "object") return Object.keys(value).length;
   return 0;
};

const normalizeTokenCounts = (value: unknown): Map<string, number> => {
   if (value instanceof Map) {
      const normalized = new Map<string, number>();
      for (const [token, count] of value.entries()) {
         normalized.set(String(token), Number(count) || 0);
      }
      return normalized;
   }
   if (Array.isArray(value)) {
      const normalized = new Map<string, number>();
      for (const token of value) {
         const key = String(token);
         normalized.set(key, (normalized.get(key) ?? 0) + 1);
      }
      return normalized;
   }
   if (value && typeof value === "object") {
      const normalized = new Map<string, number>();
      for (const [token, count] of Object.entries(value as Record<string, unknown>)) {
         normalized.set(token, Number(count) || 0);
      }
      return normalized;
   }
   return new Map<string, number>();
};

const buildNgramIndexItem = (hash: string, ngram: { tokens: string[]; canStart: boolean; canEnd: boolean; nextTokens: unknown; previousTokens: unknown }): NgramIndexItem => {
   const tokens = Array.isArray(ngram.tokens) ? ngram.tokens : [];
   let minTokenLength = 0;
   let maxTokenLength = 0;
   for (const token of tokens) {
      const length = token.length;
      if (minTokenLength === 0 || length < minTokenLength) minTokenLength = length;
      if (length > maxTokenLength) maxTokenLength = length;
   }
   const tokenText = tokens.join(" ").toLowerCase();
   return {
      hash,
      tokens: tokenText,
      canStart: Boolean(ngram.canStart),
      canEnd: Boolean(ngram.canEnd),
      nextCount: getTokenCollectionSize(ngram.nextTokens),
      prevCount: getTokenCollectionSize(ngram.previousTokens),
      tokenCount: tokens.length,
      minTokenLength,
      maxTokenLength
   };
};

const startNgramIndexBuild = (): void => {
   if (ngramIndex.state === "building") return;
   ensureBrainSettings();
   ngramIndex.state = "building";
   ngramIndex.items = [];
   ngramIndex.scanned = 0;
   ngramIndex.total = Brain.nGrams.size;
   ngramIndex.builtAt = null;
   ngramIndex.stale = false;
   ngramIndex.viewCache = undefined;
   ngramIndex.buildId += 1;
   const buildId = ngramIndex.buildId;
   const stats = getBrainDbStats();
   ngramIndex.dbMtimeMs = stats?.mtimeMs ?? null;
   ngramIndex.dbSize = stats?.size ?? null;

   const iterator = Brain.nGrams.entries();
   const step = (): void => {
      if (ngramIndex.buildId !== buildId) return;
      let count = 0;
      while (count < NGRAM_INDEX_CHUNK) {
         const next = iterator.next();
         if (next.done) {
            ngramIndex.state = "ready";
            ngramIndex.builtAt = Date.now();
            return;
         }
         const [hash, ngram] = next.value;
         ngramIndex.items.push(buildNgramIndexItem(String(hash), ngram as { tokens: string[]; canStart: boolean; canEnd: boolean; nextTokens: unknown; previousTokens: unknown }));
         ngramIndex.scanned += 1;
         count += 1;
      }
      setImmediate(step);
   };

   step();
};

const ensureNgramIndex = (): void => {
   if (ngramIndex.state === "idle") {
      startNgramIndexBuild();
      return;
   }
   markNgramIndexStaleIfNeeded();
};

const getNgramDetail = (hash: string, tokenLimit: number = 8): BrainNgramDetail | undefined => {
   const ngram = Brain.nGrams.get(hash);
   if (!ngram) return undefined;
   const nextTokens = normalizeTokenCounts(ngram.nextTokens);
   const previousTokens = normalizeTokenCounts(ngram.previousTokens);
   return {
      hash,
      tokens: ngram.tokens,
      canStart: ngram.canStart,
      canEnd: ngram.canEnd,
      nextTokens: sortTokenCounts(nextTokens, tokenLimit),
      previousTokens: sortTokenCounts(previousTokens, tokenLimit)
   };
};

const getWordDetail = (word: string, limit: number = DEFAULT_NGRAM_LIMIT): BrainWordDetail | undefined => {
   const normalized = word.trim().toLowerCase();
   if (!normalized) return undefined;
   const hashes = Brain.lexicon.get(normalized);
   if (!hashes) return undefined;
   const allHashes = Array.from(hashes.values());
   const slice = allHashes.slice(0, limit);
   const ngrams = slice
      .map(hash => getNgramDetail(hash))
      .filter((entry): entry is BrainNgramDetail => Boolean(entry));
   return {
      word: normalized,
      ngramCount: allHashes.length,
      ngrams
   };
};

const getLexiconPage = (query: string, offset: number, limit: number): BrainLexiconPage => {
   const normalizedQuery = query.trim().toLowerCase();
   const clampedLimit = clampNumber(limit, 1, MAX_BRAIN_PAGE);
   const clampedOffset = Math.max(0, offset);
   const items: BrainLexiconItem[] = [];

   if (!normalizedQuery) {
      let index = 0;
      for (const [word, hashes] of Brain.lexicon.entries()) {
         if (index >= clampedOffset && items.length < clampedLimit) {
            items.push({ word, ngramCount: hashes.size });
         }
         if (items.length >= clampedLimit) break;
         index += 1;
      }
      return {
         total: Brain.lexicon.size,
         offset: clampedOffset,
         limit: clampedLimit,
         items
      };
   }

   let matchIndex = 0;
   for (const [word, hashes] of Brain.lexicon.entries()) {
      if (!word.includes(normalizedQuery)) continue;
      if (matchIndex >= clampedOffset && items.length < clampedLimit) {
         items.push({ word, ngramCount: hashes.size });
      }
      matchIndex += 1;
   }

   return {
      total: matchIndex,
      offset: clampedOffset,
      limit: clampedLimit,
      items
   };
};

const getTopTokens = (limit: number = DEFAULT_TOP_TOKENS): BrainTokenCount[] => {
   const clampedLimit = clampNumber(limit, 1, MAX_BRAIN_PAGE);
   const items: BrainTokenCount[] = [];
   for (const [word, hashes] of Brain.lexicon.entries()) {
      items.push({ token: word, count: hashes.size });
   }
   items.sort((a, b) => b.count - a.count);
   return items.slice(0, clampedLimit);
};

interface NgramQueryOptions {
   contains?: string;
   notContains?: string;
   canStart?: boolean | null;
   canEnd?: boolean | null;
   nextMin?: number;
   nextMax?: number;
   prevMin?: number;
   prevMax?: number;
   tokenLenMin?: number;
   tokenLenMax?: number;
   sortKey?: keyof NgramIndexItem | "ingest";
   sortDir?: "asc" | "desc";
   offset: number;
   limit: number;
}

const getNgramPage = (options: NgramQueryOptions): BrainNgramPage => {
   ensureNgramIndex();
   const clampedLimit = clampNumber(options.limit, 1, MAX_BRAIN_PAGE);
   const clampedOffset = Math.max(0, options.offset);
   const contains = (options.contains ?? "").trim().toLowerCase();
   const notContains = (options.notContains ?? "").trim().toLowerCase();
   const sortKey = options.sortKey ?? "ingest";
   const sortDir = options.sortDir ?? "asc";

   const hasFilters = Boolean(
      contains
      || notContains
      || options.canStart !== null && options.canStart !== undefined
      || options.canEnd !== null && options.canEnd !== undefined
      || options.nextMin !== undefined
      || options.nextMax !== undefined
      || options.prevMin !== undefined
      || options.prevMax !== undefined
      || options.tokenLenMin !== undefined
      || options.tokenLenMax !== undefined
   );

   const viewKey = JSON.stringify({
      contains,
      notContains,
      canStart: options.canStart ?? null,
      canEnd: options.canEnd ?? null,
      nextMin: options.nextMin ?? null,
      nextMax: options.nextMax ?? null,
      prevMin: options.prevMin ?? null,
      prevMax: options.prevMax ?? null,
      tokenLenMin: options.tokenLenMin ?? null,
      tokenLenMax: options.tokenLenMax ?? null,
      sortKey,
      sortDir
   });

   let viewItems: NgramIndexItem[];
   const canCacheView = ngramIndex.state === "ready" && !ngramIndex.stale;
   if (canCacheView && ngramIndex.viewCache?.key === viewKey) {
      viewItems = ngramIndex.viewCache.items;
   } else {
      const baseItems = ngramIndex.items;
      let filteredItems: NgramIndexItem[];
      if (!hasFilters) {
         filteredItems = baseItems;
      } else {
         filteredItems = [];
         for (const item of baseItems) {
            if (contains && !item.tokens.includes(contains)) continue;
            if (notContains && item.tokens.includes(notContains)) continue;
            if (options.canStart !== null && options.canStart !== undefined && item.canStart !== options.canStart) continue;
            if (options.canEnd !== null && options.canEnd !== undefined && item.canEnd !== options.canEnd) continue;
            if (options.nextMin !== undefined && item.nextCount < options.nextMin) continue;
            if (options.nextMax !== undefined && item.nextCount > options.nextMax) continue;
            if (options.prevMin !== undefined && item.prevCount < options.prevMin) continue;
            if (options.prevMax !== undefined && item.prevCount > options.prevMax) continue;
            if (options.tokenLenMin !== undefined && item.minTokenLength < options.tokenLenMin) continue;
            if (options.tokenLenMax !== undefined && item.maxTokenLength > options.tokenLenMax) continue;
            filteredItems.push(item);
         }
      }

      if (sortKey && sortKey !== "ingest") {
         const sorted = (filteredItems === baseItems ? baseItems.slice() : filteredItems.slice());
         const direction = sortDir === "desc" ? -1 : 1;
         sorted.sort((a, b) => {
            const valueA = a[sortKey];
            const valueB = b[sortKey];
            if (typeof valueA === "string" && typeof valueB === "string") {
               return valueA.localeCompare(valueB) * direction;
            }
            return (Number(valueA) - Number(valueB)) * direction;
         });
         viewItems = sorted;
      } else {
         viewItems = filteredItems;
      }

      if (canCacheView) {
         ngramIndex.viewCache = { key: viewKey, items: viewItems };
      }
   }

   const total = viewItems.length;
   const items = viewItems.slice(clampedOffset, clampedOffset + clampedLimit);
   return {
      total,
      offset: clampedOffset,
      limit: clampedLimit,
      items,
      index: {
         state: ngramIndex.state,
         scanned: ngramIndex.scanned,
         total: ngramIndex.total,
         builtAt: ngramIndex.builtAt ? new Date(ngramIndex.builtAt).toISOString() : null,
         stale: ngramIndex.stale
      }
   };
};

const createAdminServer = (options: AdminServerOptions = {}) => {
   const publicDir = options.publicDir ?? DEFAULT_PUBLIC_DIR;
   const plugins: PluginInfo[] = options.plugins ?? getDefaultPlugins();

   const serveStatic = (req: http.IncomingMessage, res: http.ServerResponse): void => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
      const filePath = resolve(publicDir, pathname.replace(/^\//, ""));
      if (!filePath.startsWith(publicDir)) {
         res.writeHead(400);
         res.end("bad request");
         return;
      }
      if (!existsSync(filePath)) {
         res.writeHead(404);
         res.end("not found");
         return;
      }
      const ext = extname(filePath);
      const contentType = contentTypeByExt[ext] ?? "application/octet-stream";
      const data = readFileSync(filePath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
   };

   const handleMadlibsApi = async (req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<boolean> => {
      if (pathname === "/api/madlibs/categories" && req.method === "GET") {
         sendJson(res, 200, { categories: Madlibs.listCategories() });
         return true;
      }
      if (pathname === "/api/madlibs/category" && req.method === "GET") {
         const url = new URL(req.url ?? "", "http://localhost");
         const id = url.searchParams.get("id") ?? "";
         const snapshot = Madlibs.getCategorySnapshot(id);
         if (!snapshot) {
            sendJson(res, 404, { error: "category not found" });
            return true;
         }
         sendJson(res, 200, snapshot);
         return true;
      }
      if (pathname === "/api/madlibs/category" && req.method === "POST") {
         const raw = await readBody(req);
         const parsed = JSON.parse(raw || "{}") as { id?: string; meta?: Record<string, string> };
         const id = parsed.id ?? "";
         if (!id) {
            sendJson(res, 400, { error: "missing category id" });
            return true;
         }
         if (Madlibs.isBuiltinCategory(id)) {
            sendJson(res, 400, { error: "category already exists as builtin" });
            return true;
         }
         const created = Madlibs.createCategory(id);
         if (parsed.meta) {
            Madlibs.setCategoryMeta(id, parsed.meta);
         }
         sendJson(res, 200, { success: created });
         return true;
      }
      if (pathname === "/api/madlibs/vocab" && req.method === "POST") {
         const raw = await readBody(req);
         const parsed = JSON.parse(raw || "{}") as { category?: string; type?: string; word?: string; action?: string };
         const category = parsed.category ?? "";
         const vocabType = parsed.type ?? "";
         const word = parsed.word ?? "";
         const action = parsed.action ?? "add";
         const success = action === "remove"
            ? Madlibs.removeVocab(category, vocabType, word)
            : Madlibs.addVocab(category, vocabType, word);
         sendJson(res, 200, { success });
         return true;
      }
      if (pathname === "/api/madlibs/vocab-type" && req.method === "POST") {
         const raw = await readBody(req);
         const parsed = JSON.parse(raw || "{}") as { category?: string; type?: string; action?: string };
         const category = parsed.category ?? "";
         const vocabType = parsed.type ?? "";
         const action = parsed.action ?? "add";
         if (action !== "add") {
            sendJson(res, 400, { error: "unsupported action" });
            return true;
         }
         const success = Madlibs.addVocabType(category, vocabType);
         sendJson(res, 200, { success });
         return true;
      }
      if (pathname === "/api/madlibs/pattern" && req.method === "POST") {
         const raw = await readBody(req);
         const parsed = JSON.parse(raw || "{}") as { category?: string; pattern?: string; action?: string };
         const category = parsed.category ?? "";
         const pattern = parsed.pattern ?? "";
         const action = parsed.action ?? "add";
         const success = action === "remove"
            ? Madlibs.removePattern(category, pattern)
            : Madlibs.addPattern(category, pattern);
         sendJson(res, 200, { success });
         return true;
      }
      if (pathname === "/api/madlibs/access" && req.method === "GET") {
         sendJson(res, 200, Madlibs.getAccessConfig());
         return true;
      }
      if (pathname === "/api/madlibs/access" && req.method === "POST") {
         const raw = await readBody(req);
         const parsed = JSON.parse(raw || "{}");
         Madlibs.saveAccessConfig(parsed);
         sendJson(res, 200, { success: true });
         return true;
      }
      if (pathname === "/api/madlibs/meta" && req.method === "POST") {
         const raw = await readBody(req);
         const parsed = JSON.parse(raw || "{}") as { id?: string; meta?: Record<string, string>; action?: string };
         const id = parsed.id ?? "";
         if (!id) {
            sendJson(res, 400, { error: "missing category id" });
            return true;
         }
         if (parsed.action === "clear") {
            Madlibs.clearCategoryMeta(id);
            sendJson(res, 200, { success: true });
            return true;
         }
         if (!parsed.meta) {
            sendJson(res, 400, { error: "missing meta payload" });
            return true;
         }
         Madlibs.setCategoryMeta(id, parsed.meta);
         sendJson(res, 200, { success: true });
         return true;
      }
      return false;
   };

   const handleBrainApi = async (req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<boolean> => {
      if (pathname === "/api/brain/stats" && req.method === "GET") {
         sendJson(res, 200, buildBrainStats());
         return true;
      }
      if (pathname === "/api/brain/lexicon" && req.method === "GET") {
         const url = new URL(req.url ?? "", "http://localhost");
         const query = url.searchParams.get("query") ?? "";
         const offset = parseNumber(url.searchParams.get("offset"), 0);
         const limit = parseNumber(url.searchParams.get("limit"), DEFAULT_BRAIN_PAGE);
         sendJson(res, 200, getLexiconPage(query, offset, limit));
         return true;
      }
      if (pathname === "/api/brain/ngrams" && req.method === "GET") {
         const url = new URL(req.url ?? "", "http://localhost");
         const offset = parseNumber(url.searchParams.get("offset"), 0);
         const limit = parseNumber(url.searchParams.get("limit"), DEFAULT_NGRAM_TABLE_LIMIT);
         const options: NgramQueryOptions = {
            contains: url.searchParams.get("contains") ?? "",
            notContains: url.searchParams.get("notContains") ?? "",
            canStart: parseBooleanFilter(url.searchParams.get("canStart")),
            canEnd: parseBooleanFilter(url.searchParams.get("canEnd")),
            nextMin: parseOptionalNumber(url.searchParams.get("nextMin")),
            nextMax: parseOptionalNumber(url.searchParams.get("nextMax")),
            prevMin: parseOptionalNumber(url.searchParams.get("prevMin")),
            prevMax: parseOptionalNumber(url.searchParams.get("prevMax")),
            tokenLenMin: parseOptionalNumber(url.searchParams.get("tokenLenMin")),
            tokenLenMax: parseOptionalNumber(url.searchParams.get("tokenLenMax")),
            sortKey: parseSortKey(url.searchParams.get("sortKey")),
            sortDir: url.searchParams.get("sortDir") === "desc" ? "desc" : "asc",
            offset,
            limit
         };
         sendJson(res, 200, getNgramPage(options));
         return true;
      }
      if (pathname === "/api/brain/ngrams/refresh" && req.method === "POST") {
         startNgramIndexBuild();
         sendJson(res, 200, { success: true });
         return true;
      }
      if (pathname === "/api/brain/word" && req.method === "GET") {
         const url = new URL(req.url ?? "", "http://localhost");
         const word = url.searchParams.get("word") ?? "";
         const limit = clampNumber(parseNumber(url.searchParams.get("limit"), DEFAULT_NGRAM_LIMIT), 1, MAX_BRAIN_PAGE);
         const detail = getWordDetail(word, limit);
         if (!detail) {
            sendJson(res, 404, { error: "word not found" });
            return true;
         }
         sendJson(res, 200, detail);
         return true;
      }
      if (pathname === "/api/brain/top" && req.method === "GET") {
         const url = new URL(req.url ?? "", "http://localhost");
         const limit = clampNumber(parseNumber(url.searchParams.get("limit"), DEFAULT_TOP_TOKENS), 1, MAX_BRAIN_PAGE);
         sendJson(res, 200, { items: getTopTokens(limit) });
         return true;
      }
      if (pathname === "/api/brain/ngram" && req.method === "GET") {
         const url = new URL(req.url ?? "", "http://localhost");
         const hash = url.searchParams.get("hash") ?? "";
         const limit = parseLimitAllowZero(url.searchParams.get("limit"), 0);
         const detail = getNgramDetail(hash, limit);
         if (!detail) {
            sendJson(res, 404, { error: "ngram not found" });
            return true;
         }
         sendJson(res, 200, detail);
         return true;
      }
      if (pathname === "/api/brain/snapshot" && req.method === "GET") {
         const url = new URL(req.url ?? "", "http://localhost");
         const compress = url.searchParams.get("compress");
         const dbPath = getBrainDbPath();
         if (!existsSync(dbPath)) {
            sendJson(res, 404, { error: "brain sqlite not found" });
            return true;
         }
         const filenameBase = `${Brain.botName}-brain.sqlite`;
         if (compress === "gzip") {
            res.writeHead(200, {
               "Content-Type": "application/x-sqlite3",
               "Content-Encoding": "gzip",
               "Content-Disposition": `attachment; filename="${filenameBase}.gz"`
            });
            createReadStream(dbPath).pipe(createGzip()).pipe(res);
            return true;
         }
         res.writeHead(200, {
            "Content-Type": "application/x-sqlite3",
            "Content-Disposition": `attachment; filename="${filenameBase}"`
         });
         createReadStream(dbPath).pipe(res);
         return true;
      }
      return false;
   };

   const handleSwapsApi = async (req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<boolean> => {
      if (pathname === "/api/swaps/rules" && req.method === "GET") {
         const url = new URL(req.url ?? "", "http://localhost");
         const query = url.searchParams.get("q") ?? undefined;
         const scopeRaw = url.searchParams.get("scope") ?? "";
         const scope = scopeRaw ? Swaps.normalizeScope(scopeRaw) : null;
         const scopeId = url.searchParams.get("scopeId") ?? undefined;
         const rules = Swaps.listRules({
            scope: scope ?? undefined,
            scopeId,
            query
         });
         sendJson(res, 200, { rules });
         return true;
      }
      if (pathname === "/api/swaps/rule" && req.method === "POST") {
         const raw = await readBody(req);
         const parsed = JSON.parse(raw || "{}") as {
            action?: string;
            id?: string;
            scope?: string;
            scopeId?: string;
            pattern?: string;
            replacement?: string;
            mode?: string;
            caseSensitive?: boolean;
            applyLearn?: boolean;
            applyRespond?: boolean;
            enabled?: boolean;
         };
         const scope = Swaps.normalizeScope(parsed.scope ?? "");
         const scopeId = parsed.scopeId?.trim() ?? "";
         if (!scope || !scopeId) {
            sendJson(res, 400, { error: "missing or invalid scope/scopeId" });
            return true;
         }
         if (parsed.action === "delete") {
            if (!parsed.id) {
               sendJson(res, 400, { error: "missing rule id" });
               return true;
            }
            const removed = Swaps.deleteRule(scope, scopeId, parsed.id);
            sendJson(res, 200, { success: removed });
            return true;
         }
         const result = Swaps.saveRule({
            id: parsed.id,
            scope,
            scopeId,
            pattern: parsed.pattern ?? "",
            replacement: parsed.replacement ?? "",
            mode: parsed.mode === "regex" ? "regex" : "word",
            caseSensitive: Boolean(parsed.caseSensitive),
            applyLearn: parsed.applyLearn ?? true,
            applyRespond: parsed.applyRespond ?? true,
            enabled: parsed.enabled ?? true
         });
         if (result instanceof Error) {
            sendJson(res, 400, { error: result.message });
            return true;
         }
         sendJson(res, 200, { rule: result });
         return true;
      }
      if (pathname === "/api/swaps/groups" && req.method === "GET") {
         sendJson(res, 200, { groups: Swaps.listGroups() });
         return true;
      }
      if (pathname === "/api/swaps/group" && req.method === "POST") {
         const raw = await readBody(req);
         const parsed = JSON.parse(raw || "{}") as { action?: string; id?: string; name?: string; notes?: string };
         if (parsed.action === "delete") {
            if (!parsed.id) {
               sendJson(res, 400, { error: "missing group id" });
               return true;
            }
            const removed = Swaps.deleteGroup(parsed.id);
            sendJson(res, 200, { success: removed });
            return true;
         }
         if (!parsed.id || !parsed.name) {
            sendJson(res, 400, { error: "missing group id or name" });
            return true;
         }
         const group = Swaps.saveGroup({
            id: parsed.id,
            name: parsed.name,
            notes: parsed.notes
         });
         sendJson(res, 200, { group });
         return true;
      }
      if (pathname === "/api/swaps/group/member" && req.method === "POST") {
         const raw = await readBody(req);
         const parsed = JSON.parse(raw || "{}") as { action?: string; groupId?: string; memberId?: string };
         const groupId = parsed.groupId?.trim() ?? "";
         const memberId = parsed.memberId?.trim() ?? "";
         if (!groupId || !memberId) {
            sendJson(res, 400, { error: "missing groupId or memberId" });
            return true;
         }
         const success = parsed.action === "remove"
            ? Swaps.removeGroupMember(groupId, memberId)
            : Swaps.addGroupMember(groupId, memberId);
         sendJson(res, 200, { success });
         return true;
      }
      return false;
   };

   const handleSettingsApi = async (req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<boolean> => {
      if (pathname !== "/api/settings/brain") return false;
      ensureBrainSettings();
      if (req.method === "GET") {
         sendJson(res, 200, { settings: { learnFromBots: Brain.settings.learnFromBots } });
         return true;
      }
      if (req.method === "POST") {
         const raw = await readBody(req);
         const parsed = JSON.parse(raw || "{}") as { learnFromBots?: boolean };
         if (typeof parsed.learnFromBots !== "boolean") {
            sendJson(res, 400, { error: "learnFromBots must be a boolean" });
            return true;
         }
         Brain.settings.learnFromBots = parsed.learnFromBots;
         const saved = Brain.saveSettings(Brain.botName || "default");
         if (saved instanceof Error) {
            sendJson(res, 500, { error: saved.message });
            return true;
         }
         sendJson(res, 200, { settings: { learnFromBots: Brain.settings.learnFromBots } });
         return true;
      }
      return false;
   };

   const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const pathname = url.pathname;
      try {
         if (pathname === "/api/plugins" && req.method === "GET") {
            sendJson(res, 200, { plugins });
            return;
         }
         if (pathname.startsWith("/api/madlibs/")) {
            const handled = await handleMadlibsApi(req, res, pathname);
            if (handled) return;
         }
         if (pathname.startsWith("/api/brain/")) {
            const handled = await handleBrainApi(req, res, pathname);
            if (handled) return;
         }
         if (pathname.startsWith("/api/swaps/")) {
            const handled = await handleSwapsApi(req, res, pathname);
            if (handled) return;
         }
         if (pathname.startsWith("/api/settings/")) {
            const handled = await handleSettingsApi(req, res, pathname);
            if (handled) return;
         }
         return serveStatic(req, res);
      } catch (error: unknown) {
         const message = error instanceof Error ? error.message : String(error);
         log(`Admin portal error: ${message}`, "error");
         res.writeHead(500);
         res.end("server error");
      }
   });

   const start = (port: number = options.port ?? DEFAULT_PORT): Promise<number> =>
      new Promise((resolvePort) => {
         const host = options.host ?? DEFAULT_HOST;
         server.listen(port, host, () => {
            const address = server.address() as AddressInfo | null;
            const resolvedPort = address?.port ?? port;
            if (!options.quiet) {
               log(`Admin portal listening on http://${host}:${resolvedPort}`);
            }
            resolvePort(resolvedPort);
         });
      });

   const stop = (): Promise<void> =>
      new Promise((resolveStop) => {
         server.close(() => resolveStop());
      });

   return { server, start, stop };
};

export type { PluginInfo, AdminServerOptions, BrainLexiconPage, BrainWordDetail, BrainNgramDetail, BrainNgramPage };
export { createAdminServer, buildBrainStats, getBrainDbPath, getDefaultPlugins, getLexiconPage, getWordDetail, getNgramDetail, getNgramPage, getTopTokens };
