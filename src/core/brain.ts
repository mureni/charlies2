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
      allowSchemaMigration: env("NODE_ENV") !== "production",
      debug: envFlag("TRACE_SQL")
   });
   public static nGrams: SQLiteMap<string, nGram> = new SQLiteMap<string, nGram>({
      filename: checkFilePath("data", `${BOT_NAME}.sqlite`),
      table: "ngrams",
      cacheSize: 64,
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
   // TODO: Global consciousness project — periodically set Brain.settings.surprise based on GCP dot index (normalize so 0/1 -> 0, 0.5 -> 1).
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
         traceBrain(`trainFromFile start: file=${trainerFile} type=${filetype} lexicon=${Brain.lexicon.size} ngrams=${Brain.nGrams.size}`);
         
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
            traceBrain(`trainFromFile done: file=${trainerFile} lexicon=${Brain.lexicon.size} ngrams=${Brain.nGrams.size}`);
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
            const nGram: nGram = Brain.nGrams.get(hash) ?? {
               canStart: c === 0,
               canEnd: c === words.length - Brain.chainLength,
               tokens: slice,
               nextTokens: new Map<string, number>(),
               previousTokens: new Map<string, number>()
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
         traceBrain(`learn: chars=${text.length} lexicon=${Brain.lexicon.size} ngrams=${Brain.nGrams.size}`);
      }
      return learned;
   }

   public static async getResponse(seed: string): Promise<string> {
      log(`Generating response with seed '${seed}'`, "debug");
      let response = EMPTY_BRAIN;
      if (Brain.lexicon.size === 0 || Brain.nGrams.size === 0) return "my brain is empty";
      const recursionLimit = clamp(Brain.settings.recursion, 1, MAX_RECURSION);
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
         
         let hashes: string[] = [];
         let initialNGram: nGram | null = null;
         let initialNGramHash = "";
         for (let seedAttempt = 0; seedAttempt < 3; seedAttempt++) {
            if (!Brain.lexicon.has(seed)) seed = await Brain.getRandomSeed();
            const hashset = Brain.lexicon.get(seed);
            log(`Seed attempt ${seedAttempt + 1}: seed='${seed}' hashes=${hashset?.size ?? 0}`, "debug");
                        
            hashes = Array.from(hashset ?? new Set<string>());
            if (hashes.length === 0) seed = await Brain.getRandomSeed();
            while (hashes.length > 0 && initialNGram === null) {
               const seedHash = randFrom<string>(hashes);
               const candidate = Brain.nGrams.get(seedHash);
               log(`Inspecting hash candidate:\n\t${JSON.stringify(candidate, null, 2)}`, "debug");
               if (candidate && candidate.tokens) {
                  initialNGram = candidate;
                  initialNGramHash = seedHash;
                  break;
               }
               hashes = hashes.filter(hash => hash !== seedHash);
            }
            if (initialNGram !== null) break;
         }
         
         if (initialNGram === null) return "I do not know enough information";
         const insightSeed = seed;

         const reply: string[] = initialNGram.tokens.slice(0);
         let stack = 0;
         let ngram: nGram = initialNGram;

         while (!ngram.canEnd && (stack++ <= STACK_MAX)) {

            const nextWords = Array.from(ngram.nextTokens.keys());
            const nextSelection = weightedRandFromWithTrace(ngram.nextTokens, { surprise });
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
            if (!nextWord) break;

            reply.push(nextWord);
            // Build the next hash by shifting the current token window and appending the selected word.
            const nextHash = buildNextHash(ngram.tokens, nextWord);
            if (!Brain.nGrams.has(nextHash)) break;
            ngram = Brain.nGrams.get(nextHash) as nGram;
            if (!ngram || !ngram.tokens) break;
         }
         stack = 0;
         ngram = initialNGram;
         while (!ngram.canStart && (stack++ <= STACK_MAX)) {

            const prevWords = Array.from(ngram.previousTokens.keys());
            const prevSelection = weightedRandFromWithTrace(ngram.previousTokens, { surprise });
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
            if (!Brain.nGrams.has(prevHash)) break;
            ngram = Brain.nGrams.get(prevHash) as nGram;
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
