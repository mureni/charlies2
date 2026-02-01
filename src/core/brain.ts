import { SQLiteMap } from "@/core/SQLiteCollections";
import { createReadStream, existsSync, statSync } from "fs";
import { log } from "./log";
import readline from "readline";
import { resolve } from "path";
import { env, checkFilePath, newRX, escapeRegExp, clamp, randFrom, weightedRandFrom } from "@/utils";
import type { BrainSettings } from "./botSettings";
import { loadSettings, saveSettings, getSettings, setSettings } from "./botSettings";



const SENTENCE_REGEX = /\n/;
const WORD_REGEX = /\s+/;
const WORD_SEPARATOR = "│";
const STACK_MAX = 192;
const EMPTY_BRAIN = "huh";
const MAX_RECURSION = 5;
const TRACE_BRAIN = /^(1|true|yes|on)$/i.test(env("TRACE_BRAIN") ?? "");
const traceBrain = (message: string): void => {
   if (TRACE_BRAIN) log(`Brain: ${message}`, "debug");
};
const BOT_NAME = (env("BOT_NAME") ?? "").trim() || "chatbot";

interface nGram {
   tokens: string[];
   canStart: boolean;
   canEnd: boolean;
   nextTokens: Map<string, number>;
   previousTokens: Map<string, number>;
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
      debug: /^(1|true|yes|on)$/i.test(env("TRACE_SQL") ?? "")
   });
   public static nGrams: SQLiteMap<string, nGram> = new SQLiteMap<string, nGram>({
      filename: checkFilePath("data", `${BOT_NAME}.sqlite`),
      table: "ngrams",
      cacheSize: 64,
      allowSchemaMigration: env("NODE_ENV") !== "production",
      debug: /^(1|true|yes|on)$/i.test(env("TRACE_SQL") ?? "")
   });
   public static chainLength: number = 3;
   public static botName: string = BOT_NAME;
   public static get settings(): BrainSettings {
      return getSettings();
   }
   public static set settings(value: BrainSettings) {
      setSettings(value);
   }

   public static saveSettings(brainName: string = "default"): boolean | Error {
      return saveSettings(brainName);
   }

   public static async trainFromFile(trainerName: string = "default", filetype: "txt" = "txt", verbose: boolean = Boolean(env("NODE_ENV") === "development")): Promise<boolean | Error> {
      try {
         const trainerFile = resolve(checkFilePath("resources", `${trainerName}-trainer.${filetype}`));
         if (!existsSync(trainerFile)) throw new Error(`Unable to load brain data from file '${trainerFile}': file does not exist.`);
         traceBrain(`trainFromFile start: file=${trainerFile} type=${filetype} lexicon=${Brain.lexicon.size} ngrams=${Brain.nGrams.size}`);
         
         if (filetype === "txt") {
            
            const size = statSync(trainerFile).size;
            traceBrain(`trainFromFile size: bytes=${size}`);
            

            const readInterface = readline.createInterface({
               input: createReadStream(trainerFile, { encoding: "utf8" })
            });
            
            const percentMark = Math.floor(size / 100);
            let counter = 0;

            readInterface.on("line", async line => {
               const normalized = line.trim().toLowerCase();
               if (normalized) await Brain.learn(normalized);
               counter += line.length;
               if (verbose && ((counter % percentMark) === 0 || counter < percentMark)) log(`Learned ${counter} of ${size} bytes`);
            });

            readInterface.on("close", () => {
               log(`Finished learning!`);
               traceBrain(`trainFromFile done: file=${trainerFile} lexicon=${Brain.lexicon.size} ngrams=${Brain.nGrams.size}`);
            });
         
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

   public static async learn(text: string = ""): Promise<boolean> {
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
      if (learned) traceBrain(`learn: chars=${text.length} lexicon=${Brain.lexicon.size} ngrams=${Brain.nGrams.size}`);
      return learned;
   }

   public static async getResponse(seed: string): Promise<string> {
      log(`Generating response with seed '${seed}'`, "debug");
      let response = EMPTY_BRAIN;
      if (Brain.lexicon.size === 0 || Brain.nGrams.size === 0) return "my brain is empty";
      for (let recursiveThought = 0; recursiveThought < clamp(Brain.settings.recursion, 1, MAX_RECURSION); recursiveThought++) {
         
         let hashes: string[] = [];
         let initialNGram: nGram | null = null;
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
                  break;
               }
               hashes = hashes.filter(hash => hash !== seedHash);
            }
            if (initialNGram !== null) break;
         }
         
         if (initialNGram === null) return "I do not know enough information";

         const reply: string[] = initialNGram.tokens.slice(0);
         let stack = 0;
         let ngram: nGram = initialNGram;

         while (!ngram.canEnd && (stack++ <= STACK_MAX)) {

            const nextWords = Array.from(ngram.nextTokens.keys());
            const nextWord = weightedRandFrom(ngram.nextTokens) ?? randFrom<string>(nextWords);
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
            const prevWord = weightedRandFrom(ngram.previousTokens) ?? randFrom<string>(prevWords);
            if (!prevWord) break;

            reply.unshift(prevWord);
            const prevHash = buildPrevHash(ngram.tokens, prevWord);
            if (!Brain.nGrams.has(prevHash)) break;
            ngram = Brain.nGrams.get(prevHash) as nGram;
            if (!ngram || !ngram.tokens) break;
         }
         response = reply.join(" ").trim();
         seed = await Brain.getSeed(response);
      }
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

   // TODO: Decouple this from the brain -- the settings should be at the bot level (higher than brain)
   public static shouldYell(text: string): boolean {
      
      let newAngerLevel: number = Brain.settings.angerLevel;
      
      // If incoming text is caps, increase anger level; otherwise, decrease it
      newAngerLevel *= (text === text.toUpperCase()) ? Brain.settings.angerIncrease : Brain.settings.angerDecrease;
      Brain.settings.angerLevel = clamp(newAngerLevel, 0.01, 10);
      
      // If random number between 0 and 1 is less than anger level, then should yell is true
      return (Math.random() < Brain.settings.angerLevel);
   }

   // TODO: Decouple this from the brain -- the settings should be at the bot level (higher than brain) and might need to be chat protocol specific
   public static shouldRespond(respondsTo: string | RegExp, text: string): boolean {

      // Respond if random outburst is true
      if (Math.random() < Brain.settings.outburstThreshold) return true;

      // Respond if mentioned
      if (respondsTo instanceof RegExp) {
         if (text.match(respondsTo)) return true;
      } else {
         if (!respondsTo) return false;
         const rx = newRX(escapeRegExp(respondsTo), "giu");
         if (text.match(rx)) return true;
      }

      // Otherwise, do not respond
      return false;
   }
}

export { Brain };
