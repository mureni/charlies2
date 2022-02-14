import { Presets, SingleBar } from "cli-progress";
import { DBMap } from "../core/DBMap";
import { createReadStream, readFileSync, existsSync, writeFileSync, statSync } from 'fs';
import { log } from "./log";
import readline from "readline";
import { resolve } from "path";
import { env, checkFilePath } from "../utils"; 

const escapeRegExp = (rxString: string) => rxString.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
function randFrom<T>(array: T[]): T { return array[Math.floor(Math.random() * array.length)] };


const SENTENCE_REGEX = /\n/;
const WORD_REGEX = /\s+/;
const WORD_SEPARATOR = "│";
const STACK_MAX = 192;
const EMPTY_BRAIN = "huh";
const MAX_RECURSION = 5;

interface BrainSettings {      
   outburstThreshold: number,          /* 0..1 chance of speaking without being spoken to */
   numberOfLines: number,              /* # of lines to speak at once */
   angerLevel: number,                 /* 0..1 chance of yelling */
   angerIncrease: number,              /* multiplier to increase anger if yelled at */
   angerDecrease: number,              /* multiplier to decrease anger if not yelled at */
   recursion: number,                  /* # of times to think about a line before responding */
   conversationTimeLimit: number,      /* number of seconds to wait for a response */
   learnFromBots: boolean
}

interface nGram {
   tokens: string[];
   canStart: boolean;
   canEnd: boolean;
   nextTokens: Map<string, number>;
   previousTokens: Map<string, number>;
}
interface FrequencyJSON {
   [word: string]: number;
}
interface nGramJSON {
   [hash: string]: {
      t: string[],
      s: boolean,
      e: boolean,
      n: FrequencyJSON | string[],
      p: FrequencyJSON | string[]
   }
}

interface LexiconJSON {
   [word: string]: string[];
}

interface BrainJSON {
   Lexicon: LexiconJSON;
   nGrams: nGramJSON;
   Settings: BrainSettings;
}

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
   public static lexicon: DBMap<string, Set<string>> = new DBMap<string, Set<string>>(checkFilePath("data", env("BOT_NAME") + ".sql"), "lexicon", false);
   public static nGrams: DBMap<string, nGram> = new DBMap<string, nGram>(checkFilePath("data", env("BOT_NAME") + ".sql"), "ngrams", false);
   public static chainLength: number = 3;
   public static botName: string = env("BOT_NAME") ?? "chatbot";
   public static settings: BrainSettings;

   public static saveSettings(brainName: string = "default"): boolean | Error {
      try {
         const brainFile = resolve(checkFilePath("data", `${brainName}-settings.json`));
         const json = JSON.stringify(Brain.settings);
         writeFileSync(brainFile, json, "utf8");         
         return true;
      } catch (error: unknown) {
         if (error instanceof Error) return error;
         return false;
      }
   }

   public static async trainFromFile(trainerName: string = "default", filetype: "json" | "txt" = "txt", verbose: boolean = Boolean(env("NODE_ENV") === "development")): Promise<boolean | Error> {
      try {
         const trainerFile = resolve(checkFilePath("resources", `${trainerName}-trainer.${filetype}`));
         if (!existsSync(trainerFile)) throw new Error(`Unable to load brain data from file '${trainerFile}': file does not exist.`);
         
         if (filetype === "json") {
            const data = readFileSync(trainerFile, "utf8");
            return await Brain.fromJSON(JSON.parse(data));
         } else if (filetype === "txt") {            
            
            const size = statSync(trainerFile).size;            
            

            const readInterface = readline.createInterface({
               input: createReadStream(trainerFile, { encoding: "utf8" })
            });
            
            const percentMark = Math.floor(size / 100);            
            let counter = 0;

            readInterface.on("line", async line => {
               await Brain.learn(line);               
               counter += line.length;
               if (verbose && ((counter % percentMark) === 0 || counter < percentMark)) log(`Learned ${counter} of ${size} bytes`);
            });

            readInterface.on("close", () => {               
               log(`Finished learning!`);               
            });
         
            return true;
         } else {
            throw new Error(`Unable to load brain data from file '${trainerFile}': unknown file type. Must be plain text or JSON with proper schema.`);
         }
      } catch (error: unknown) {
         if (error instanceof Error) return error;
         return false;
      }
   }

   public static loadSettings(brainName: string = "default"): boolean | Error {
      try {
         const settingsFile = resolve(checkFilePath("resources", `${brainName}-settings.json`));
         if (!existsSync(settingsFile)) throw new Error(`Unable to load settings from file ${settingsFile}: file does not exist.`);

         const json = readFileSync(settingsFile, "utf8");
         Brain.settings = JSON.parse(json) as BrainSettings;         

         return true;
      } catch (error: unknown) {
         if (error instanceof Error) return error;
         return false;
      }
   }

   public static async fromJSON(json: BrainJSON, verbose: boolean = Boolean(env("NODE_ENV") === "development")): Promise<boolean> {
      const hasLexicon = Reflect.has(json, "Lexicon");
      const hasNGrams = Reflect.has(json, "nGrams");
      
      // Wrong JSON format
      // TODO: Better error handling
      if (!hasLexicon && !hasNGrams) return false;
      
      // Parse lexicon if it exists
      if (hasLexicon) {         

         const lexiconData = Reflect.get(json, "Lexicon") as { [word: string]: string[] };
         const size = Object.keys(lexiconData).length;
         const percentMark = Math.floor(size / 100);
         const progress = new SingleBar({
            format: 'Learning Lexicon: {bar} {percentage}% || {value}/{total} Words Learned || ETA: {eta_formatted}',
         }, Presets.shades_classic);
         if (verbose) progress.start(size, 0);
         let counter = 0;
         for (const word of Object.keys(lexiconData)) {
            const hashes: Set<string> = Brain.lexicon.get(word) ?? new Set<string>();
            const newHashes: string[] = Reflect.get(lexiconData, word) ?? [];
            newHashes.forEach(hash => hashes.add(hash));                           
            Brain.lexicon.set(word, hashes);
            counter++;
            if (verbose && ((counter % percentMark) === 0 || counter < percentMark)) progress.update(counter);            
         }
         if (verbose) progress.stop();
      }

      // Parse ngram data if it exists
      if (hasNGrams) {
         const ngramData = Reflect.get(json, "nGrams") as nGramJSON;

         const size = Object.keys(ngramData).length;
         const percentMark = Math.floor(size / 100);
         const progress = new SingleBar({
            format: 'Learning Trigrams: {bar} {percentage}% || {value}/{total} Trigrams Learned || ETA: {eta_formatted}',
         }, Presets.shades_classic);

         if (verbose) progress.start(size, 0);
         let counter = 0;

         for (const hash of Object.keys(ngramData)) {
            
            // Ensure ngram matches the expected format, or skip if it doesn't
            if (!Reflect.has(ngramData[hash], "e")
             || !Reflect.has(ngramData[hash], "n")
             || !Reflect.has(ngramData[hash], "p")
             || !Reflect.has(ngramData[hash], "t")
             || !Reflect.has(ngramData[hash], "s")) continue;
            
            const curNGram = Brain.nGrams.get(hash) ?? {
               canEnd: false,
               canStart: false,
               nextTokens: new Map<string, number>(),
               previousTokens: new Map<string, number>(),
               tokens: []
            };
            
            // Sanity check to see if incoming tokens matches existing tokens for the same hash
            if (curNGram.tokens.length > 0 && (JSON.stringify(curNGram.tokens) !== JSON.stringify(ngramData[hash].t))) {               
               // This is an existing ngram with mismatched tokens, which means that the incoming ngram may be malformed (hash doesn't match tokens)
               // In this case, do not add the incoming token.
               continue;
            }

            const next = curNGram.nextTokens;
            const prev = curNGram.previousTokens;
            
            // Older brain formats used string[], rather than a map of { [word: string]: number }            
            if (Reflect.getPrototypeOf(ngramData[hash].n) === Array.prototype) {
               // Parse old brain format (no frequency for previous/next words)      
               for (const word in Reflect.get(ngramData[hash], "n")) {
                  const curFreq = next.get(word) ?? 0;
                  next.set(word, curFreq + 1);
               }
            } else {
               // Add frequency of word to existing database
               for (const word of Object.keys(ngramData[hash].n)) {
                  const curFreq = next.get(word) ?? 0;
                  const newFreq = Reflect.get(ngramData[hash].n, word) ?? 1;
                  next.set(word, curFreq + newFreq);
               }
            }

            if (Reflect.getPrototypeOf(ngramData[hash].p) === Array.prototype) {
               // Parse old brain format (no frequency for previous/next words)      
               for (const word in Reflect.get(ngramData[hash], "p")) {
                  const curFreq = prev.get(word) ?? 0;
                  prev.set(word, curFreq + 1);
               }
            } else {
               // Add frequency of word to existing database
               for (const word of Object.keys(ngramData[hash].p)) {
                  const curFreq = prev.get(word) ?? 0;
                  const newFreq = Reflect.get(ngramData[hash].p, word) ?? 1;
                  prev.set(word, curFreq + newFreq);
               }
            }

            // Combine existing ngram data (or empty ngram) with new ngram data
            Brain.nGrams.set(hash, {
               canEnd: ngramData[hash].e || curNGram.canEnd,
               canStart: ngramData[hash].s || curNGram.canStart,
               nextTokens: next,
               previousTokens: prev,
               tokens: ngramData[hash].t
            });

            counter++;
            
            if (verbose && ((counter % percentMark) === 0 || counter < percentMark)) progress.update(counter);          
         }
         if (verbose) progress.stop();
      }

      return true;
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
            let nGram: nGram = Brain.nGrams.get(hash) ?? {
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
      return learned;
   }

   public static async getResponse(seed: string): Promise<string> {
      let response = EMPTY_BRAIN;
      if (Brain.lexicon.size === 0 || Brain.nGrams.size === 0) return "my brain is empty";
      for (let recursiveThought = 0; recursiveThought < clamp(Brain.settings.recursion, 1, MAX_RECURSION); recursiveThought++) {
         
         let hashes: string[] = [];
         for (let seedAttempt = 0; seedAttempt < 3; seedAttempt++) {
            if (!Brain.lexicon.has(seed)) seed = await Brain.getRandomSeed();
            let hashset = Brain.lexicon.get(seed);
                        
            hashes = Array.from(hashset ?? new Set<string>());
            if (hashes.length === 0) seed = await Brain.getRandomSeed();
         }
         
         if (hashes.length === 0) return "couldn't find a seed";

         const seedHash = randFrom<string>(hashes);
         const initialNGram = Brain.nGrams.get(seedHash);
         if (!initialNGram || !initialNGram.tokens) return "I do not know enough information";

         const reply: string[] = initialNGram.tokens.slice(0);
         let stack = 0;
         let ngram: nGram = initialNGram;

         while (!ngram.canEnd && (stack++ <= STACK_MAX)) {

            /* TODO: Replace random selection with weighted frequency choice */
            const nextWords = Array.from(ngram.nextTokens.keys());            
            const nextWord = randFrom<string>(nextWords);

            reply.push(nextWord);
            // TODO: here is where it doesn't use the 'next' word properly
            // it adds the next word to a new hash instead, which
            // increases the likelihood of never adjusting based on 
            // other uses of the word. 
            const nextSet = ngram.tokens.slice(1, Brain.chainLength);
            nextSet.push(nextWord);
            const nextHash = nextSet.join(WORD_SEPARATOR);
            if (!Brain.nGrams.has(nextHash)) break;
            ngram = Brain.nGrams.get(nextHash) as nGram;
            if (!ngram || !ngram.tokens) break;
         }
         stack = 0;
         ngram = initialNGram;
         while (!ngram.canStart && (stack++ <= STACK_MAX)) {

            /* TODO: Replace random selection with weighted frequency choice */
            const prevWords = Array.from(ngram.previousTokens.keys());            
            const prevWord = randFrom<string>(prevWords);

            reply.unshift(prevWord);
            const prevSet = ngram.tokens.slice(0, Brain.chainLength - 1);
            prevSet.unshift(prevWord);
            const prevHash = prevSet.join(WORD_SEPARATOR);
            if (!Brain.nGrams.has(prevHash)) break;
            ngram = Brain.nGrams.get(prevHash) as nGram;
            if (!ngram || !ngram.tokens) break;
         }
         response = reply.join(' ').trim();
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
         // TODO: Memoize this regexp
         if (text.match(new RegExp(escapeRegExp(respondsTo), "giu"))) return true;
      }

      // Otherwise, do not respond
      return false;      
   }
}

export { Brain };