import { SQLiteMap } from "@/core/SQLiteCollections";
import { createReadStream, existsSync, statSync } from "fs";
import { log } from "./log";
import readline from "readline";
import { resolve } from "path";
import { env, envFlag, getBotName, checkFilePath, clamp, randFrom, weightedRandFromWithTrace } from "@/utils";
import type { BrainSettings } from "./botSettings";
import { loadSettings, saveSettings, getSettings, setSettings } from "./botSettings";



const SENTENCE_REGEX = /\n/;
const WORD_REGEX = /\s+/;
const WORD_SEPARATOR = "│";
const STACK_MAX = 192;
const EMPTY_BRAIN = "huh";
const MAX_RECURSION = 5;
const DEFAULT_SURPRISE = 0.5;
const INSIGHT_CANDIDATE_LIMIT = 6;
const FOCUS_TOKEN_RX = /[a-z0-9][a-z0-9'_-]*/giu;
const MAX_FOCUS_TOKENS = 32;
const START_HASH_CANDIDATE_LIMIT = 256;
const NGRAM_MATCH_BONUS_WEIGHT = 0.25;
const START_LIKELIHOOD_WEIGHT = 0.35;
const START_SEED_COVERAGE_WEIGHT = 1.0;
const START_NGRAM_FOCUS_WEIGHT = 1.25;
const TRANSITION_TOKEN_FOCUS_WEIGHT = 0.8;
const TRANSITION_NGRAM_FOCUS_WEIGHT = 1.1;
const END_PRESSURE_SCALE = 0.75;
const END_PRESSURE_MIN_STEPS = 4;
const TARGET_RESEED_FOCUS = 0.45;
const MAX_BOUNDARY_RESEEDS = 1;
const TRACE_BRAIN = envFlag("TRACE_BRAIN");
const TRACE_SURPRISE = envFlag("TRACE_SURPRISE");
const TRACE_SURPRISE_TOP_CANDIDATES = 3;
const traceBrain = (message: string): void => {
   if (TRACE_BRAIN) log(`Brain: ${message}`, "debug");
};
interface SurpriseTraceCandidate {
   token: unknown;
   weight: number;
   logWeight: number;
   gumbel: number;
   score: number;
}
interface SurpriseTraceStart {
   phase: "response.start";
   recursiveThought: number;
   surprise: number;
   rawSurprise: unknown;
   usedDefaultSurprise: boolean;
}
interface SurpriseTraceStep {
   phase: "next" | "previous";
   step: number;
   surprise: number;
   candidateCount: number;
   weightedChoice: unknown;
   chosen: unknown;
   usedFallback: boolean;
   topCandidates: SurpriseTraceCandidate[];
}
type SurpriseTracePayload = SurpriseTraceStart | SurpriseTraceStep;
const formatNumber = (value: number, digits: number = 4): string => {
   if (!Number.isFinite(value)) return String(value);
   return value.toFixed(digits);
};
const formatToken = (value: unknown): string => {
   if (value === null || value === undefined) return "<none>";
   const text = String(value).replace(/\s+/gu, " ").trim();
   if (!text) return "<empty>";
   return text.length > 24 ? `"${text.slice(0, 21)}..."` : `"${text}"`;
};
const formatCandidates = (candidates: SurpriseTraceCandidate[]): string => {
   const limited = candidates.slice(0, TRACE_SURPRISE_TOP_CANDIDATES);
   if (limited.length === 0) return "none";
   return limited
      .map((candidate, index) =>
         `#${index + 1} ${formatToken(candidate.token)} w=${formatNumber(candidate.weight, 2)} lw=${formatNumber(candidate.logWeight)} g=${formatNumber(candidate.gumbel)} s=${formatNumber(candidate.score)}`
      )
      .join(" | ");
};
const traceSurprise = (payload: SurpriseTracePayload): void => {
   if (!TRACE_SURPRISE) return;
   if (payload.phase === "response.start") {
      log(
         `Brain surprise start: recursion=${payload.recursiveThought} surprise=${formatNumber(payload.surprise, 3)} raw=${String(payload.rawSurprise)} defaulted=${payload.usedDefaultSurprise ? "yes" : "no"}`,
         "debug"
      );
      return;
   }
   log(
      `Brain surprise ${payload.phase}#${payload.step}: surprise=${formatNumber(payload.surprise, 3)} candidates=${payload.candidateCount} weighted=${formatToken(payload.weightedChoice)} chosen=${formatToken(payload.chosen)} fallback=${payload.usedFallback ? "yes" : "no"} top=[${formatCandidates(payload.topCandidates)}]`,
      "debug"
   );
};
const BOT_NAME = getBotName();

interface nGram {
   tokens: string[];
   canStart: boolean;
   canEnd: boolean;
   count?: number;
   startCount?: number;
   endCount?: number;
   nextTokens: Map<string, number>;
   previousTokens: Map<string, number>;
}

interface BrainChoiceCandidate {
   token: string;
   weight: number;
   logWeight: number;
   gumbel: number;
   score: number;
}

interface BrainChoiceStep {
   phase: "next" | "previous";
   step: number;
   surprise: number;
   candidateCount: number;
   weightedChoice?: string;
   chosen?: string;
   usedFallback: boolean;
   candidates: BrainChoiceCandidate[];
}

interface BrainGenerationInsight {
   createdAt: number;
   requestedSeed: string;
   response: string;
   surprise: number;
   recursion: number;
   recursiveThought: number;
   initialHash: string;
   initialTokens: string[];
   steps: BrainChoiceStep[];
}

export interface BrainResponseOverlays {
   tokens?: Map<string, number>;
   ngrams?: Map<string, number>;
}

export interface BrainResponseOptions {
   focusText?: string;
   overlays?: BrainResponseOverlays;
}

interface BrainPreparedFocus {
   inputTokens: Map<string, number>;
   tokens: Map<string, number>;
   ngrams: Map<string, number>;
}

interface BrainStartCandidate {
   value: string;
   weight: number;
}

interface BrainTransitionCandidate {
   value: string;
   weight: number;
   tokenFocus: number;
   ngramFocus: number;
   endLikelihood: number;
}

const buildNextHash = (tokens: string[], nextWord: string): string => {
   const nextSet = tokens.slice(1, Brain.chainLength);
   nextSet.push(nextWord);
   return nextSet.join(WORD_SEPARATOR);
};

const buildPrevHash = (tokens: string[], prevWord: string): string => {
   const prevSet = tokens.slice(0, Brain.chainLength - 1);
   prevSet.unshift(prevWord);
   return prevSet.join(WORD_SEPARATOR);
};
class Brain {
   /*
   lexicon: {
      "word": ["word|something|something", "word|something|somethings"];
   }
   nGrams: {
      "word|something|something": {
         tokens: ["word", "something", "something"],
         start: true,
         end: false,
         next: {
            "something": 2,
            "nothing": 0
         },
         previous: {
            "<EOL>": 1
         }
      }
   }
   */
   public static lexicon: SQLiteMap<string, Set<string>> = new SQLiteMap<string, Set<string>>({
      filename: checkFilePath("data", `${BOT_NAME}.sqlite`),
      table: "lexicon",
      cacheSize: 128,
      deferInitialSize: true,
      purgeStaleObjectKeys: false,
      allowSchemaMigration: env("NODE_ENV") !== "production",
      debug: envFlag("TRACE_SQL")
   });
   public static nGrams: SQLiteMap<string, nGram> = new SQLiteMap<string, nGram>({
      filename: checkFilePath("data", `${BOT_NAME}.sqlite`),
      table: "ngrams",
      cacheSize: 64,
      deferInitialSize: true,
      purgeStaleObjectKeys: false,
      allowSchemaMigration: env("NODE_ENV") !== "production",
      debug: envFlag("TRACE_SQL")
   });
   public static chainLength: number = 3;
   public static botName: string = BOT_NAME;
   private static lastGenerationInsight: BrainGenerationInsight | null = null;
   public static get settings(): BrainSettings {
      return getSettings();
   }
   public static set settings(value: BrainSettings) {
      setSettings(value);
   }
   public static getLastGenerationInsight(): BrainGenerationInsight | null {
      if (!Brain.lastGenerationInsight) return null;
      return {
         ...Brain.lastGenerationInsight,
         initialHash: Brain.lastGenerationInsight.initialHash,
         initialTokens: Brain.lastGenerationInsight.initialTokens.slice(),
         steps: Brain.lastGenerationInsight.steps.map((step) => ({
            ...step,
            candidates: step.candidates.map((candidate) => ({ ...candidate }))
         }))
      };
   }
   public static getNGramHash(tokens: string[]): string {
      return tokens.join(WORD_SEPARATOR);
   }
   public static hasCorpusData(): boolean {
      return Brain.lexicon.hasEntries() && Brain.nGrams.hasEntries();
   }
   private static clampFocusWeight(value: number): number {
      if (!Number.isFinite(value)) return 0;
      return clamp(value, 0, 1);
   }
   private static sumTransitionWeights(weights: Map<string, number>): number {
      let total = 0;
      for (const weight of weights.values()) {
         if (!Number.isFinite(weight) || weight <= 0) continue;
         total += weight;
      }
      return total;
   }
   private static normalizeNGram(hash: string, value: nGram): nGram {
      let changed = false;
      const startCount = Number.isFinite(value.startCount)
         ? Math.max(0, Math.floor(Number(value.startCount)))
         : (value.canStart ? 1 : 0);
      if (value.startCount !== startCount) {
         value.startCount = startCount;
         changed = true;
      }

      const endCount = Number.isFinite(value.endCount)
         ? Math.max(0, Math.floor(Number(value.endCount)))
         : (value.canEnd ? 1 : 0);
      if (value.endCount !== endCount) {
         value.endCount = endCount;
         changed = true;
      }

      const nextTotal = Brain.sumTransitionWeights(value.nextTokens);
      const prevTotal = Brain.sumTransitionWeights(value.previousTokens);
      const derivedCount = Math.max(nextTotal + endCount, prevTotal + startCount, 1);
      const count = Number.isFinite(value.count)
         ? Math.max(Math.floor(Number(value.count)), derivedCount)
         : derivedCount;
      if (value.count !== count) {
         value.count = count;
         changed = true;
      }

      const canStart = startCount > 0 || Boolean(value.canStart);
      if (value.canStart !== canStart) {
         value.canStart = canStart;
         changed = true;
      }

      const canEnd = endCount > 0 || Boolean(value.canEnd);
      if (value.canEnd !== canEnd) {
         value.canEnd = canEnd;
         changed = true;
      }

      if (changed) Brain.nGrams.set(hash, value);
      return value;
   }
   private static getNGram(hash: string): nGram | undefined {
      const value = Brain.nGrams.get(hash);
      if (!value) return undefined;
      return Brain.normalizeNGram(hash, value);
   }
   private static getNGramCount(ngram: nGram): number {
      return Math.max(Number(ngram.count ?? 0), 1);
   }
   private static getStartLikelihood(ngram: nGram): number {
      return Brain.clampFocusWeight(Number(ngram.startCount ?? 0) / Brain.getNGramCount(ngram));
   }
   private static getEndLikelihood(ngram: nGram): number {
      return Brain.clampFocusWeight(Number(ngram.endCount ?? 0) / Brain.getNGramCount(ngram));
   }
   private static mergeFocusMap(target: Map<string, number>, source?: Map<string, number>): Map<string, number> {
      if (!source) return target;
      for (const [key, value] of source.entries()) {
         const normalizedKey = String(key).trim().toLowerCase();
         const normalizedValue = Brain.clampFocusWeight(Number(value));
         if (!normalizedKey || normalizedValue <= 0) continue;
         const existing = target.get(normalizedKey) ?? 0;
         target.set(normalizedKey, Math.max(existing, normalizedValue));
      }
      return target;
   }
   private static getOverlayWeight(weights: Map<string, number> | undefined, key: string): number {
      const rawWeight = Number(weights?.get(key) ?? 0);
      if (!Number.isFinite(rawWeight)) return 0;
      return clamp(rawWeight, 0, 1);
   }
   private static extractFocusTokens(text: string): Map<string, number> {
      const ranked = new Map<string, { count: number; firstSeenAt: number }>();
      const tokens = String(text ?? "").match(FOCUS_TOKEN_RX) ?? [];
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

      const entries = Array.from(ranked.entries())
         .sort((a, b) => {
            if (b[1].count !== a[1].count) return b[1].count - a[1].count;
            return a[1].firstSeenAt - b[1].firstSeenAt;
         })
         .slice(0, MAX_FOCUS_TOKENS);
      const maxCount = Math.max(...entries.map(([, entry]) => entry.count), 1);
      const weights = new Map<string, number>();
      for (const [token, entry] of entries) {
         weights.set(token, Number((entry.count / maxCount).toFixed(6)));
      }
      return weights;
   }
   private static buildNGramFocusMap(
      tokenFocus: Map<string, number>,
      overlayNgrams?: Map<string, number>
   ): Map<string, number> {
      const accumulated = new Map<string, { rawScore: number; matchCount: number }>();
      for (const [token, rawFocusWeight] of tokenFocus.entries()) {
         const focusWeight = Brain.clampFocusWeight(rawFocusWeight);
         if (focusWeight <= 0) continue;
         const hashes = Brain.lexicon.get(token) as Set<string> | undefined;
         if (!hashes || hashes.size === 0) continue;
         const contribution = focusWeight / Math.sqrt(Math.max(hashes.size, 1));
         for (const hash of hashes.values()) {
            const current = accumulated.get(hash) ?? { rawScore: 0, matchCount: 0 };
            current.rawScore += contribution;
            current.matchCount += 1;
            accumulated.set(hash, current);
         }
      }

      let maxScore = 0;
      const derived = new Map<string, number>();
      for (const [hash, entry] of accumulated.entries()) {
         const score = entry.rawScore * (1 + (NGRAM_MATCH_BONUS_WEIGHT * Math.max(entry.matchCount - 1, 0)));
         if (score <= 0) continue;
         derived.set(hash, score);
         if (score > maxScore) maxScore = score;
      }

      const normalized = new Map<string, number>();
      if (maxScore > 0) {
         for (const [hash, score] of derived.entries()) {
            normalized.set(hash, Number(Brain.clampFocusWeight(score / maxScore).toFixed(6)));
         }
      }
      Brain.mergeFocusMap(normalized, overlayNgrams);
      return normalized;
   }
   private static prepareResponseFocus(seed: string, options: BrainResponseOptions): BrainPreparedFocus {
      const inputTokens = Brain.extractFocusTokens(options.focusText ?? seed);
      if (inputTokens.size === 0) {
         const normalizedSeed = String(seed).trim().toLowerCase();
         if (normalizedSeed) inputTokens.set(normalizedSeed, 1);
      }
      const tokenFocus = Brain.mergeFocusMap(new Map<string, number>(), inputTokens);
      Brain.mergeFocusMap(tokenFocus, options.overlays?.tokens);
      return {
         inputTokens,
         tokens: tokenFocus,
         ngrams: Brain.buildNGramFocusMap(tokenFocus, options.overlays?.ngrams)
      };
   }
   private static buildInitialHashWeights(seed: string, focus: BrainPreparedFocus): BrainStartCandidate[] {
      const candidateHashes = new Set<string>();
      const prioritizedFocusHashes = Array.from(focus.ngrams.entries())
         .sort((a, b) => b[1] - a[1])
         .slice(0, START_HASH_CANDIDATE_LIMIT);
      for (const [hash] of prioritizedFocusHashes) candidateHashes.add(hash);

      const normalizedSeed = String(seed).trim().toLowerCase();
      const seedHashes = normalizedSeed ? (Brain.lexicon.get(normalizedSeed) as Set<string> | undefined) : undefined;
      if (candidateHashes.size < START_HASH_CANDIDATE_LIMIT) {
         for (const hash of seedHashes ?? []) {
            candidateHashes.add(hash);
            if (candidateHashes.size >= START_HASH_CANDIDATE_LIMIT) break;
         }
      }

      const weightedCandidates: BrainStartCandidate[] = [];
      for (const hash of candidateHashes.values()) {
         const ngram = Brain.getNGram(hash);
         if (!ngram?.tokens) continue;
         let seedCoverage = 0;
         for (const token of ngram.tokens) {
            seedCoverage = Math.max(seedCoverage, Brain.getOverlayWeight(focus.inputTokens, token));
         }
         const ngramFocus = Brain.getOverlayWeight(focus.ngrams, hash);
         const startLikelihood = Brain.getStartLikelihood(ngram);
         const count = Brain.getNGramCount(ngram);
         const weight = Math.log1p(count)
            * (1 + (START_LIKELIHOOD_WEIGHT * startLikelihood))
            * (1 + (START_SEED_COVERAGE_WEIGHT * seedCoverage))
            * (1 + (START_NGRAM_FOCUS_WEIGHT * ngramFocus));
         if (!Number.isFinite(weight) || weight <= 0) continue;
         weightedCandidates.push({ value: hash, weight });
      }
      return weightedCandidates
         .sort((a, b) => b.weight - a.weight)
         .slice(0, START_HASH_CANDIDATE_LIMIT);
   }
   private static buildBoundaryReseedWeights(
      focus: BrainPreparedFocus,
      exclude: Set<string>
   ): BrainStartCandidate[] {
      const candidates: BrainStartCandidate[] = [];
      for (const [hash] of Array.from(focus.ngrams.entries()).sort((a, b) => b[1] - a[1]).slice(0, START_HASH_CANDIDATE_LIMIT)) {
         if (exclude.has(hash)) continue;
         const ngram = Brain.getNGram(hash);
         if (!ngram?.tokens || !ngram.canStart) continue;
         let seedCoverage = 0;
         for (const token of ngram.tokens) {
            seedCoverage = Math.max(seedCoverage, Brain.getOverlayWeight(focus.inputTokens, token));
         }
         const ngramFocus = Brain.getOverlayWeight(focus.ngrams, hash);
         const startLikelihood = Brain.getStartLikelihood(ngram);
         const count = Brain.getNGramCount(ngram);
         const weight = Math.log1p(count)
            * (1 + (START_LIKELIHOOD_WEIGHT * startLikelihood))
            * (1 + (START_SEED_COVERAGE_WEIGHT * seedCoverage))
            * (1 + (START_NGRAM_FOCUS_WEIGHT * ngramFocus));
         if (!Number.isFinite(weight) || weight <= 0) continue;
         candidates.push({ value: hash, weight });
      }
      return candidates;
   }
   private static buildTransitionCandidates(
      ngram: nGram,
      phase: "next" | "previous",
      focus: BrainPreparedFocus,
      endPressure: number = 0
   ): BrainTransitionCandidate[] {
      const source = phase === "next" ? ngram.nextTokens : ngram.previousTokens;
      const candidates: BrainTransitionCandidate[] = [];
      const safeEndPressure = Brain.clampFocusWeight(endPressure);
      for (const [token, rawBaseWeight] of source.entries()) {
         const baseWeight = Number(rawBaseWeight);
         if (!Number.isFinite(baseWeight) || baseWeight <= 0) continue;
         const relatedHash = phase === "next"
            ? buildNextHash(ngram.tokens, token)
            : buildPrevHash(ngram.tokens, token);
         const relatedNGram = Brain.getNGram(relatedHash);
         const tokenFocus = Brain.getOverlayWeight(focus.tokens, token);
         const ngramFocus = Brain.getOverlayWeight(focus.ngrams, relatedHash);
         const endLikelihood = phase === "next" && relatedNGram ? Brain.getEndLikelihood(relatedNGram) : 0;
         let weight = baseWeight
            * (1 + (TRANSITION_TOKEN_FOCUS_WEIGHT * tokenFocus))
            * (1 + (TRANSITION_NGRAM_FOCUS_WEIGHT * ngramFocus));
         if (safeEndPressure > 0 && endLikelihood > 0) {
            weight *= 1 + (safeEndPressure * endLikelihood);
         }
         if (!Number.isFinite(weight) || weight <= 0) continue;
         candidates.push({
            value: token,
            weight,
            tokenFocus,
            ngramFocus,
            endLikelihood
         });
      }
      return candidates;
   }
   private static getBestOutgoingFocus(candidates: BrainTransitionCandidate[]): number {
      let bestFocus = 0;
      for (const candidate of candidates) {
         bestFocus = Math.max(bestFocus, candidate.tokenFocus, candidate.ngramFocus);
      }
      return Brain.clampFocusWeight(bestFocus);
   }
   private static selectWeightedValue(
      candidates: Array<{ value: string; weight: number }>,
      surprise: number
   ): string | undefined {
      const selection = weightedRandFromWithTrace(candidates, { surprise });
      return selection.value ?? randFrom(candidates.map((candidate) => candidate.value));
   }
   // TODO: Global consciousness project -- periodically set Brain.settings.surprise based on GCP 2.0 NetVar.
   // TODO: Future feature — reintroduce a maintainable "reveal" reasoning-graph plugin once layout/UX design is finalized.

   public static saveSettings(brainName: string = "default"): boolean | Error {
      return saveSettings(brainName);
   }

   public static async trainFromFile(
      trainerName: string = "default",
      filetype: "txt" = "txt",
      verbose: boolean = Boolean(env("NODE_ENV") === "development")
   ): Promise<boolean | Error> {
      try {
         const trainerFile = resolve(checkFilePath("resources", `${trainerName}-trainer.${filetype}`));
         if (!existsSync(trainerFile)) throw new Error(`Unable to load brain data from file '${trainerFile}': file does not exist.`);
         if (TRACE_BRAIN) traceBrain(`trainFromFile start: file=${trainerFile} type=${filetype}`);
         
         if (filetype === "txt") {
            
            const size = statSync(trainerFile).size;
            traceBrain(`trainFromFile size: bytes=${size}`);
            

            const readInterface = readline.createInterface({
               input: createReadStream(trainerFile, { encoding: "utf8" }),
               crlfDelay: Infinity
            });

            const percentMark = Math.max(1, Math.floor(size / 100));
            let counter = 0;

            for await (const line of readInterface) {
               const normalized = String(line).trim().toLowerCase();
               if (normalized) await Brain.learn(normalized, { silent: true });
               counter += String(line).length;
               if (verbose && ((counter % percentMark) === 0 || counter < percentMark)) log(`Learned ${counter} of ${size} bytes`);
            }

            log(`Finished learning!`);
            if (TRACE_BRAIN) traceBrain(`trainFromFile done: file=${trainerFile}`);
            return true;
         } else {
            throw new Error(`Unable to load brain data from file '${trainerFile}': unknown file type. Must be plain text.`);
         }
      } catch (error: unknown) {
         if (error instanceof Error) return error;
         return false;
      }
   }

   public static loadSettings(brainName: string = "default"): boolean | Error {
      return loadSettings(brainName);
   }

   public static async learn(text: string = "", options: { silent?: boolean } = {}): Promise<boolean> {
      /* Learn a line */
      let learned: boolean = false;
      if (!text) return learned;

      const lines = text.trim().split(SENTENCE_REGEX);
      if (lines.length === 0) return learned;

      for (const line of lines) {
         const words = line.trim().split(WORD_REGEX);
         if (words.length < Brain.chainLength) continue;
         
         for (let c = 0; c < words.length - (Brain.chainLength - 1); c++) {
            const slice = words.slice(c, c + Brain.chainLength);
            const hash = slice.join(WORD_SEPARATOR);
            const nGram: nGram = Brain.getNGram(hash) ?? {
               canStart: false,
               canEnd: false,
               count: 0,
               startCount: 0,
               endCount: 0,
               tokens: slice,
               nextTokens: new Map<string, number>(),
               previousTokens: new Map<string, number>()
            };
            nGram.count = Math.max(0, Number(nGram.count ?? 0)) + 1;
            if (c === 0) {
               nGram.canStart = true;
               nGram.startCount = Number(nGram.startCount ?? 0) + 1;
            }
            if (c === words.length - Brain.chainLength) {
               nGram.canEnd = true;
               nGram.endCount = Number(nGram.endCount ?? 0) + 1;
            }
            if (c > 0) {
               /* Get and increase frequency of previous token */
               const word = words[c - 1];
               const frequency = nGram.previousTokens.get(word) ?? 0;
               nGram.previousTokens.set(word, frequency + 1);
            }
            if (c < words.length - Brain.chainLength) {
               /* Get and increase frequency of next token */
               const word = words[c + Brain.chainLength];
               const frequency = nGram.nextTokens.get(word) ?? 0;
               nGram.nextTokens.set(word, frequency + 1);
            }

            Brain.nGrams.set(hash, nGram);

            for (const word of slice) {
               const ngrams = (Brain.lexicon.get(word) as Set<string>) ?? new Set<string>();
               ngrams.add(hash);
               Brain.lexicon.set(word, ngrams);
            }
         }
         learned = true;
      }
      if (learned && !options.silent) {
         if (TRACE_BRAIN) traceBrain(`learn: chars=${text.length}`);
      }
      return learned;
   }

   public static async getResponse(seed: string, options: BrainResponseOptions = {}): Promise<string> {
      log(`Generating response with seed '${seed}'`, "debug");
      let response = EMPTY_BRAIN;
      if (!Brain.hasCorpusData()) return "my brain is empty";
      const recursionLimit = clamp(Brain.settings.recursion, 1, MAX_RECURSION);
      const focus = Brain.prepareResponseFocus(seed, options);
      let latestInsight: BrainGenerationInsight | null = null;
      for (let recursiveThought = 0; recursiveThought < recursionLimit; recursiveThought++) {
         const rawSurprise = Number(Brain.settings.surprise);
         const surprise = Number.isFinite(rawSurprise) ? clamp(rawSurprise, 0, 1) : DEFAULT_SURPRISE;
         const steps: BrainChoiceStep[] = [];
         traceSurprise({
            phase: "response.start",
            recursiveThought: recursiveThought + 1,
            surprise,
            rawSurprise: Brain.settings.surprise,
            usedDefaultSurprise: !Number.isFinite(rawSurprise)
         });

         let initialNGram: nGram | null = null;
         let initialNGramHash = "";
         for (let seedAttempt = 0; seedAttempt < 3; seedAttempt++) {
            if (!Brain.lexicon.has(seed) && focus.ngrams.size === 0) seed = await Brain.getRandomSeed();
            const hashCandidates = Brain.buildInitialHashWeights(seed, focus);
            log(`Seed attempt ${seedAttempt + 1}: seed='${seed}' hashes=${hashCandidates.length}`, "debug");
            const seedHash = Brain.selectWeightedValue(hashCandidates, surprise);
            if (!seedHash) {
               seed = await Brain.getRandomSeed();
               continue;
            }
            const candidate = Brain.getNGram(seedHash);
            log(`Inspecting hash candidate:\n\t${JSON.stringify(candidate, null, 2)}`, "debug");
            if (candidate && candidate.tokens) {
               initialNGram = candidate;
               initialNGramHash = seedHash;
            }
            if (initialNGram !== null) break;
         }
         
         if (initialNGram === null) return "I do not know enough information";
         const insightSeed = seed;

         const reply: string[] = initialNGram.tokens.slice(0);
         let stack = 0;
         let ngram: nGram = initialNGram;
         let currentHash = initialNGramHash;
         let boundaryReseedsRemaining = MAX_BOUNDARY_RESEEDS;
         let segmentSteps = 0;
         let shouldBoundaryReseed = false;
         const usedBoundaryHashes = new Set<string>();
         if (initialNGramHash && initialNGram.canStart) usedBoundaryHashes.add(initialNGramHash);

         while (stack++ <= STACK_MAX) {
            if (ngram.canEnd) {
               if (boundaryReseedsRemaining > 0 && shouldBoundaryReseed) {
                  const reseedCandidates = Brain.buildBoundaryReseedWeights(focus, usedBoundaryHashes);
                  const reseedHash = Brain.selectWeightedValue(reseedCandidates, surprise);
                  const reseedNGram = reseedHash ? Brain.getNGram(reseedHash) : undefined;
                  if (reseedHash && reseedNGram?.tokens && reseedNGram.canStart) {
                     traceBrain(`boundary reseed: from=${formatToken(currentHash)} to=${formatToken(reseedHash)}`);
                     boundaryReseedsRemaining -= 1;
                     shouldBoundaryReseed = false;
                     segmentSteps = 0;
                     usedBoundaryHashes.add(reseedHash);
                     reply.push(...reseedNGram.tokens);
                     ngram = reseedNGram;
                     currentHash = reseedHash;
                     continue;
                  }
               }
               break;
            }

            segmentSteps += 1;
            const baselineNextCandidates = Brain.buildTransitionCandidates(ngram, "next", focus);
            const bestOutgoingFocus = Brain.getBestOutgoingFocus(baselineNextCandidates);
            const endPressure = boundaryReseedsRemaining > 0 && segmentSteps >= END_PRESSURE_MIN_STEPS
               ? Brain.clampFocusWeight(END_PRESSURE_SCALE * Math.max(TARGET_RESEED_FOCUS - bestOutgoingFocus, 0))
               : 0;
            const nextWeights = endPressure > 0
               ? Brain.buildTransitionCandidates(ngram, "next", focus, endPressure)
               : baselineNextCandidates;
            const nextWords = nextWeights.map((candidate) => candidate.value);
            const nextSelection = weightedRandFromWithTrace(nextWeights, { surprise });
            const nextWord = nextSelection.value ?? randFrom<string>(nextWords);
            const nextCandidates = nextSelection.trace.candidates.slice(0, INSIGHT_CANDIDATE_LIMIT).map((candidate) => ({
               token: String(candidate.value),
               weight: candidate.weight,
               logWeight: candidate.logWeight,
               gumbel: candidate.gumbel,
               score: candidate.score
            }));
            steps.push({
               phase: "next",
               step: stack,
               surprise,
               candidateCount: nextSelection.trace.candidateCount,
               weightedChoice: nextSelection.value ? String(nextSelection.value) : undefined,
               chosen: nextWord ? String(nextWord) : undefined,
               usedFallback: nextSelection.value === undefined && nextWord !== undefined,
               candidates: nextCandidates
            });
            traceSurprise({
               phase: "next",
               step: stack,
               surprise: nextSelection.trace.surprise,
               candidateCount: nextSelection.trace.candidateCount,
               weightedChoice: nextSelection.value ?? null,
               chosen: nextWord ?? null,
               usedFallback: nextSelection.value === undefined && nextWord !== undefined,
               topCandidates: nextCandidates.map((candidate) => ({
                  token: candidate.token,
                  weight: Number(candidate.weight.toFixed(4)),
                  logWeight: Number(candidate.logWeight.toFixed(4)),
                  gumbel: Number(candidate.gumbel.toFixed(4)),
                  score: Number(candidate.score.toFixed(4))
               }))
            });
            if (endPressure > 0) shouldBoundaryReseed = true;
            if (!nextWord) break;

            reply.push(nextWord);
            // Build the next hash by shifting the current token window and appending the selected word.
            const nextHash = buildNextHash(ngram.tokens, nextWord);
            ngram = Brain.getNGram(nextHash) as nGram;
            if (!ngram || !ngram.tokens) break;
            currentHash = nextHash;
         }
         stack = 0;
         ngram = initialNGram;
         while (!ngram.canStart && (stack++ <= STACK_MAX)) {

            const prevWeights = Brain.buildTransitionCandidates(ngram, "previous", focus);
            const prevWords = prevWeights.map((candidate) => candidate.value);
            const prevSelection = weightedRandFromWithTrace(prevWeights, { surprise });
            const prevWord = prevSelection.value ?? randFrom<string>(prevWords);
            const prevCandidates = prevSelection.trace.candidates.slice(0, INSIGHT_CANDIDATE_LIMIT).map((candidate) => ({
               token: String(candidate.value),
               weight: candidate.weight,
               logWeight: candidate.logWeight,
               gumbel: candidate.gumbel,
               score: candidate.score
            }));
            steps.push({
               phase: "previous",
               step: stack,
               surprise,
               candidateCount: prevSelection.trace.candidateCount,
               weightedChoice: prevSelection.value ? String(prevSelection.value) : undefined,
               chosen: prevWord ? String(prevWord) : undefined,
               usedFallback: prevSelection.value === undefined && prevWord !== undefined,
               candidates: prevCandidates
            });
            traceSurprise({
               phase: "previous",
               step: stack,
               surprise: prevSelection.trace.surprise,
               candidateCount: prevSelection.trace.candidateCount,
               weightedChoice: prevSelection.value ?? null,
               chosen: prevWord ?? null,
               usedFallback: prevSelection.value === undefined && prevWord !== undefined,
               topCandidates: prevCandidates.map((candidate) => ({
                  token: candidate.token,
                  weight: Number(candidate.weight.toFixed(4)),
                  logWeight: Number(candidate.logWeight.toFixed(4)),
                  gumbel: Number(candidate.gumbel.toFixed(4)),
                  score: Number(candidate.score.toFixed(4))
               }))
            });
            if (!prevWord) break;

            reply.unshift(prevWord);
            const prevHash = buildPrevHash(ngram.tokens, prevWord);
            ngram = Brain.getNGram(prevHash) as nGram;
            if (!ngram || !ngram.tokens) break;
         }
         response = reply.join(" ").trim();
         latestInsight = {
            createdAt: Date.now(),
            requestedSeed: insightSeed,
            response,
            surprise,
            recursion: recursionLimit,
            recursiveThought: recursiveThought + 1,
            initialHash: initialNGramHash || initialNGram.tokens.join(WORD_SEPARATOR),
            initialTokens: initialNGram.tokens.slice(),
            steps
         };
         seed = await Brain.getSeed(response);
      }
      if (latestInsight) Brain.lastGenerationInsight = latestInsight;
      return response;
   }

   public static async getRandomSeed(): Promise<string> {
      const lexiconWords: string[] = Array.from(Brain.lexicon.keys());
      if (lexiconWords.length === 0) return "I know no words";
      return randFrom<string>(lexiconWords);
   }

   public static async getSeed(text: string = ""): Promise<string> {
      // Returns a random seed from the provided text, or a random seed from entire lexicon if no text was provided
      if (text === "") return await Brain.getRandomSeed();
      const words: string[] = text.split(WORD_REGEX);
      if (words.length === 0) return await Brain.getRandomSeed();
      return randFrom<string>(words);
   }

}

export { Brain };
