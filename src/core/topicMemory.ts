import type { BrainSettings } from "@/core/botSettings";
import {
   getKnownUserTopicMemory,
   setKnownUserTopicMemory,
   deleteKnownUserTopicMemory,
   getKnownUserTopicProfile,
   setKnownUserTopicProfile,
   deleteKnownUserTopicProfile
} from "@/core/knownUsers";
import { clamp } from "@/utils";

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

const DEFAULT_TTL_MINUTES = 20;
const DEFAULT_MAX_INTERACTIONS = 8;
const DEFAULT_BIAS_STRENGTH = 0.8;
const DEFAULT_KEYWORD_COUNT = 3;
const TOKEN_RX = /[a-z0-9][a-z0-9'_-]*/giu;
const USER_PROFILE_MAX_KEYWORDS = 24;
const USER_PROFILE_MIN_SCORE = 0.05;
const USER_PROFILE_DECAY = 0.92;
const USER_PROFILE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const MAX_COMBINED_KEYWORDS = 32;

const toInteger = (value: number, fallback: number, min: number, max: number): number => {
   if (!Number.isFinite(value)) return fallback;
   return Math.floor(clamp(value, min, max));
};

const clampWeight = (value: number): number => {
   if (!Number.isFinite(value)) return 0;
   return clamp(value, 0, 1);
};

const getConfig = (settings: BrainSettings): TopicMemoryConfig => {
   const rawTtl = Number(settings.topicMemoryTtlMinutes);
   const rawMaxInteractions = Number(settings.topicMemoryMaxInteractions);
   const rawBias = Number(settings.topicMemoryBiasStrength);
   const rawKeywordCount = Number(settings.topicMemoryKeywordCount);

   return {
      ttlMinutes: toInteger(rawTtl, DEFAULT_TTL_MINUTES, 1, 24 * 60),
      maxInteractions: toInteger(rawMaxInteractions, DEFAULT_MAX_INTERACTIONS, 1, 1000),
      biasStrength: Number.isFinite(rawBias) ? clamp(rawBias, 0, 1) : DEFAULT_BIAS_STRENGTH,
      keywordCount: toInteger(rawKeywordCount, DEFAULT_KEYWORD_COUNT, 1, 5)
   };
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

const mergeKeywordWeight = (weights: Map<string, number>, keyword: string, weight: number): void => {
   const normalizedWeight = clampWeight(weight);
   if (!keyword || normalizedWeight <= 0) return;
   const existing = weights.get(keyword) ?? 0;
   weights.set(keyword, Math.max(existing, normalizedWeight));
};

const rankKeywordWeights = (weights: Map<string, number>, limit: number): Map<string, number> => {
   const ranked = Array.from(weights.entries())
      .map(([keyword, weight], index) => ({
         keyword,
         weight: clampWeight(weight),
         index
      }))
      .filter(({ weight }) => weight > 0)
      .sort((a, b) => {
         if (b.weight !== a.weight) return b.weight - a.weight;
         return a.index - b.index;
      })
      .slice(0, limit);
   return new Map(ranked.map(({ keyword, weight }) => [keyword, Number(weight.toFixed(6))]));
};

const scaleKeywordWeights = (weights: Map<string, number>, scale: number): Map<string, number> => {
   const normalizedScale = clampWeight(scale);
   if (normalizedScale <= 0 || weights.size === 0) return new Map<string, number>();
   const scaled = new Map<string, number>();
   for (const [keyword, weight] of weights.entries()) {
      mergeKeywordWeight(scaled, keyword, clampWeight(weight) * normalizedScale);
   }
   return scaled;
};

const getUserProfileKeywordWeights = (userId: string): Map<string, number> => {
   const entry = getKnownUserTopicProfile(userId);
   if (!entry) return new Map<string, number>();
   if (Date.now() - Number(entry.updatedAt || 0) > USER_PROFILE_TTL_MS) {
      deleteKnownUserTopicProfile(userId);
      return new Map<string, number>();
   }
   const keywords = normalizeKeywords(entry.keywords ?? []);
   if (keywords.length === 0) {
      deleteKnownUserTopicProfile(userId);
      return new Map<string, number>();
   }

   const scores = keywords
      .map((keyword) => ({
         keyword,
         score: Number(entry.scores?.[keyword] ?? 0)
      }))
      .filter(({ score }) => Number.isFinite(score) && score > 0);
   if (scores.length === 0) return new Map<string, number>();

   const maxScore = Math.max(...scores.map(({ score }) => score));
   if (!Number.isFinite(maxScore) || maxScore <= 0) return new Map<string, number>();

   const weights = new Map<string, number>();
   for (const { keyword, score } of scores) {
      mergeKeywordWeight(weights, keyword, score / maxScore);
   }
   return weights;
};

const updateUserTopicProfile = (userId: string, keywords: string[]): void => {
   const normalized = normalizeKeywords(keywords);
   if (normalized.length === 0) return;

   const existing = getKnownUserTopicProfile(userId);
   const now = Date.now();
   const workingScores: Record<string, number> = { ...(existing?.scores ?? {}) };

   for (const [keyword, rawScore] of Object.entries(workingScores)) {
      const score = Number(rawScore);
      if (!Number.isFinite(score)) {
         delete workingScores[keyword];
         continue;
      }
      const decayed = score * USER_PROFILE_DECAY;
      if (decayed < USER_PROFILE_MIN_SCORE) {
         delete workingScores[keyword];
      } else {
         workingScores[keyword] = decayed;
      }
   }

   for (const keyword of normalized) {
      const prior = Number(workingScores[keyword] ?? 0);
      workingScores[keyword] = (Number.isFinite(prior) ? prior : 0) + 1;
   }

   const ranked = Object.entries(workingScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, USER_PROFILE_MAX_KEYWORDS);
   if (ranked.length === 0) {
      deleteKnownUserTopicProfile(userId);
      return;
   }

   const nextScores: Record<string, number> = {};
   const nextKeywords: string[] = [];
   for (const [keyword, score] of ranked) {
      nextScores[keyword] = Number(score.toFixed(6));
      nextKeywords.push(keyword);
   }

   setKnownUserTopicProfile(userId, {
      keywords: nextKeywords,
      scores: nextScores,
      updatedAt: now
   });
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

const getEntryFocusWeight = (entry: TopicMemoryEntry, config: TopicMemoryConfig, now: number): number => {
   const totalLifetimeMs = Math.max(Number(entry.expiresAt) - Number(entry.updatedAt), 1);
   const remainingLifetimeMs = Math.max(Number(entry.expiresAt) - now, 0);
   const ttlWeight = clampWeight(remainingLifetimeMs / totalLifetimeMs);
   const interactionWeight = clampWeight(Number(entry.remainingInteractions) / Math.max(config.maxInteractions, 1));
   return Number((((ttlWeight + interactionWeight) / 2)).toFixed(6));
};

const consumeTopicMemoryFocus = (
   scope: TopicMemoryScope,
   settings: BrainSettings
): Map<string, number> => {
   const config = getConfig(settings);
   const combinedWeights = scaleKeywordWeights(getUserProfileKeywordWeights(scope.userId), config.biasStrength);
   const entry = getKnownUserTopicMemory(scope.userId, scope.channelId);
   if (!entry) {
      return rankKeywordWeights(combinedWeights, MAX_COMBINED_KEYWORDS);
   }

   const now = Date.now();
   if (now > entry.expiresAt || entry.remainingInteractions <= 0) {
      deleteKnownUserTopicMemory(scope.userId, scope.channelId);
      return rankKeywordWeights(combinedWeights, MAX_COMBINED_KEYWORDS);
   }

   const keywords = normalizeKeywords(entry.keywords);
   if (keywords.length === 0) {
      deleteKnownUserTopicMemory(scope.userId, scope.channelId);
      return rankKeywordWeights(combinedWeights, MAX_COMBINED_KEYWORDS);
   }

   const entryFocusWeight = clampWeight(getEntryFocusWeight(entry, config, now) * config.biasStrength);
   for (const keyword of keywords) {
      mergeKeywordWeight(combinedWeights, keyword, entryFocusWeight);
   }

   const nextRemainingInteractions = Math.floor(entry.remainingInteractions) - 1;
   if (nextRemainingInteractions <= 0) {
      deleteKnownUserTopicMemory(scope.userId, scope.channelId);
   } else {
      setKnownUserTopicMemory(scope.userId, scope.channelId, {
         ...entry,
         keywords,
         remainingInteractions: nextRemainingInteractions
      });
   }

   return rankKeywordWeights(combinedWeights, MAX_COMBINED_KEYWORDS);
};

const updateTopicMemory = (
   scope: TopicMemoryScope,
   text: string,
   settings: BrainSettings
): string[] => {
   if (!scope.userId || !scope.channelId) return [];

   const config = getConfig(settings);
   const keywords = normalizeKeywords(extractTopicKeywords(text, config.keywordCount));
   if (keywords.length === 0) {
      deleteKnownUserTopicMemory(scope.userId, scope.channelId);
      return [];
   }

   updateUserTopicProfile(scope.userId, keywords);

   const now = Date.now();
   setKnownUserTopicMemory(scope.userId, scope.channelId, {
      keywords,
      updatedAt: now,
      expiresAt: now + (config.ttlMinutes * 60 * 1000),
      remainingInteractions: config.maxInteractions
   });
   return keywords;
};

export type { TopicMemoryEntry };
export { consumeTopicMemoryFocus, updateTopicMemory };
