import { createHash } from "node:crypto";
import { SQLiteMap } from "@/core/SQLiteCollections";
import { log } from "@/core/log";
import type { BrainSettings } from "@/core/botSettings";
import { checkFilePath, env, envFlag, getBotName, clamp } from "@/utils";

interface TopicMemoryEntry {
   keywords: string[];
   updatedAt: number;
   expiresAt: number;
   remainingInteractions: number;
}

interface TopicMemoryConfig {
   ttlMinutes: number;
   maxInteractions: number;
   biasStrength: number;
   keywordCount: number;
}

interface TopicMemoryScope {
   userId: string;
   channelId: string;
}

const BOT_NAME = getBotName();
const store = new SQLiteMap<string, TopicMemoryEntry>({
   filename: checkFilePath("data", `${BOT_NAME}-topic-memory.sqlite`),
   table: "topic_memory",
   cacheSize: 64,
   allowSchemaMigration: env("NODE_ENV") !== "production",
   debug: envFlag("TRACE_SQL")
});

const DEFAULT_TTL_MINUTES = 20;
const DEFAULT_MAX_INTERACTIONS = 8;
const DEFAULT_BIAS_STRENGTH = 0.8;
const DEFAULT_KEYWORD_COUNT = 3;
const TOKEN_RX = /[a-z0-9][a-z0-9'_-]*/giu;

let cachedSalt: string | null | undefined;
let warnedMissingSalt = false;

const getTopicMemorySalt = (): string | null => {
   if (cachedSalt !== undefined) return cachedSalt;
   const configured = (env("TOPIC_MEMORY_SALT") ?? "").trim();
   if (!configured) {
      cachedSalt = null;
      if (!warnedMissingSalt) {
         warnedMissingSalt = true;
         log(`TOPIC_MEMORY_SALT is unset; topic memory is disabled.`, "warn");
      }
      return null;
   }
   cachedSalt = configured;
   return cachedSalt;
};

const toInteger = (value: number, fallback: number, min: number, max: number): number => {
   if (!Number.isFinite(value)) return fallback;
   return Math.floor(clamp(value, min, max));
};

const getConfig = (settings: BrainSettings): TopicMemoryConfig => {
   const rawTtl = Number((settings as Partial<BrainSettings>).topicMemoryTtlMinutes);
   const rawMaxInteractions = Number((settings as Partial<BrainSettings>).topicMemoryMaxInteractions);
   const rawBias = Number((settings as Partial<BrainSettings>).topicMemoryBiasStrength);
   const rawKeywordCount = Number((settings as Partial<BrainSettings>).topicMemoryKeywordCount);

   return {
      ttlMinutes: toInteger(rawTtl, DEFAULT_TTL_MINUTES, 1, 24 * 60),
      maxInteractions: toInteger(rawMaxInteractions, DEFAULT_MAX_INTERACTIONS, 1, 1000),
      biasStrength: Number.isFinite(rawBias) ? clamp(rawBias, 0, 1) : DEFAULT_BIAS_STRENGTH,
      keywordCount: toInteger(rawKeywordCount, DEFAULT_KEYWORD_COUNT, 1, 5)
   };
};

const buildScopeKey = ({ userId, channelId }: TopicMemoryScope): string | null => {
   const salt = getTopicMemorySalt();
   if (!salt) return null;
   if (!userId || !channelId) return null;
   const userHash = createHash("sha256")
      .update(`${userId}:${salt}`, "utf8")
      .digest("hex");
   return `${userHash}:${channelId}`;
};

const normalizeKeywords = (keywords: string[]): string[] => {
   const unique = new Set<string>();
   for (const keyword of keywords) {
      const normalized = keyword.trim().toLowerCase();
      if (!normalized) continue;
      unique.add(normalized);
   }
   return Array.from(unique);
};

const extractTopicKeywords = (text: string, keywordCount: number): string[] => {
   const tokens = text.match(TOKEN_RX) ?? [];
   const ranked = new Map<string, { count: number; firstSeenAt: number }>();
   tokens.forEach((token, index) => {
      const normalized = token.toLowerCase();
      if (normalized.length < 3) return;
      if (/^\d+$/u.test(normalized)) return;
      const current = ranked.get(normalized);
      if (current) {
         current.count += 1;
         return;
      }
      ranked.set(normalized, { count: 1, firstSeenAt: index });
   });

   return Array.from(ranked.entries())
      .sort((a, b) => {
         if (b[1].count !== a[1].count) return b[1].count - a[1].count;
         return a[1].firstSeenAt - b[1].firstSeenAt;
      })
      .slice(0, keywordCount)
      .map(([token]) => token);
};

const consumeTopicMemoryKeywords = (scope: TopicMemoryScope): string[] => {
   const scopeKey = buildScopeKey(scope);
   if (!scopeKey) return [];

   const entry = store.get(scopeKey);
   if (!entry) return [];

   const now = Date.now();
   if (now > entry.expiresAt || entry.remainingInteractions <= 0) {
      store.delete(scopeKey);
      return [];
   }

   const keywords = normalizeKeywords(entry.keywords);
   if (keywords.length === 0) {
      store.delete(scopeKey);
      return [];
   }

   const nextRemainingInteractions = Math.floor(entry.remainingInteractions) - 1;
   if (nextRemainingInteractions <= 0) {
      store.delete(scopeKey);
   } else {
      store.set(scopeKey, {
         ...entry,
         keywords,
         remainingInteractions: nextRemainingInteractions
      });
   }

   return keywords;
};

const updateTopicMemory = (
   scope: TopicMemoryScope,
   text: string,
   settings: BrainSettings
): string[] => {
   const scopeKey = buildScopeKey(scope);
   if (!scopeKey) return [];

   const config = getConfig(settings);
   const keywords = normalizeKeywords(extractTopicKeywords(text, config.keywordCount));
   if (keywords.length === 0) {
      store.delete(scopeKey);
      return [];
   }

   const now = Date.now();
   store.set(scopeKey, {
      keywords,
      updatedAt: now,
      expiresAt: now + (config.ttlMinutes * 60 * 1000),
      remainingInteractions: config.maxInteractions
   });
   return keywords;
};

const getTopicMemoryBiasStrength = (settings: BrainSettings): number => getConfig(settings).biasStrength;

export type { TopicMemoryEntry };
export { consumeTopicMemoryKeywords, updateTopicMemory, getTopicMemoryBiasStrength };
