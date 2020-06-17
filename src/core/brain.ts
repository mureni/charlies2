import { readFileSync, existsSync } from "fs";
import { saveBigJSON } from "./saveBigJSON";
import { resolve } from "path";
import { CONFIG, checkFilePath } from "../config"; 

const SENTENCE_REGEX = /\n/;
const WORD_REGEX = /\s+/;
const WORD_SEPARATOR = "│";
const STACK_MAX = 192;
const EMPTY_BRAIN = "huh";
interface BrainSettings {   
   name: string,                       /* Username of the bot */
   outburstThreshold: number,          /* 0..1 chance of speaking without being spoken to */
   numberOfLines: number,              /* # of lines to speak at once */
   angerLevel: number,                 /* 0..1 chance of yelling */
   angerIncrease: number,              /* multiplier to increase anger if yelled at */
   angerDecrease: number,              /* multiplier to decrease anger if not yelled at */
   recursion: number,                  /* # of times to think about a line before responding */
   conversationTimeLimit: number,      /* number of seconds to wait for a response */
   conversationMemoryLength: number,   /* number of seconds before forgetting a topic */
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
   public static lexicon: Map<string, Set<string>> = new Map<string, Set<string>>();
   public static nGrams: Map<string, nGram> = new Map<string, nGram>();
   public static chainLength: number = 3;
   public static settings: BrainSettings = {
         name: CONFIG.name,   
         outburstThreshold: CONFIG.initialSettings.outburstThreshold,      
         numberOfLines: CONFIG.initialSettings.numberOfLines,
         angerLevel: CONFIG.initialSettings.angerLevel,
         angerIncrease: CONFIG.initialSettings.angerIncrease,
         angerDecrease: CONFIG.initialSettings.angerDecrease,
         recursion: CONFIG.initialSettings.recursion,
         conversationTimeLimit: CONFIG.initialSettings.conversationTimeLimit,
         conversationMemoryLength: CONFIG.initialSettings.conversationMemoryLength,
         learnFromBots: CONFIG.initialSettings.learnFromBots
   }

   public static save(filename: string = checkFilePath("data", "brain.json")): boolean | Error {
      try {
         const realFile = resolve(filename);

         saveBigJSON(realFile, Brain.toJSON());
         return true;

      } catch (error) {
         return error;
      }
   }
   public static load(filename: string = checkFilePath("data", "brain.json")): boolean | Error {
      try {
         const realFile = resolve(filename);
         if (!existsSync(realFile)) return new Error(`Unable to load brain data file '${realFile}': file does not exist.`);
         const json = readFileSync(realFile, "utf8");
         return Brain.fromJSON(JSON.parse(json));                  
      } catch (error) {
         return error;
      }
   }
   public static toJSON(): BrainJSON {
      const lexicon: LexiconJSON = {};
      const ngrams: nGramJSON = {};
      
      for (const word of Brain.lexicon.keys()) {      
         lexicon[word] = [];
         const ngrams = Brain.lexicon.get(word) as Set<string>;
         for (const ngram of ngrams.keys()) {
            lexicon[word].push(ngram);
         }
      }
      for (const hash of Brain.nGrams.keys()) {
         const ngram = Brain.nGrams.get(hash) as nGram;
         ngrams[hash] = { t: ngram.tokens, s: ngram.canStart, e: ngram.canEnd, n: {}, p: {} }
         for (const word of ngram.nextTokens.keys()) {
            const frequency: number = ngram.nextTokens.get(word) as number;
            (ngrams[hash].n as FrequencyJSON)[word] = frequency;                     
         }
         for (const word of ngram.previousTokens.keys()) {
            const frequency: number = ngram.previousTokens.get(word) as number;            
            (ngrams[hash].p as FrequencyJSON)[word] = frequency;            
         }

      }
      
      return { Lexicon: lexicon, nGrams: ngrams, Settings: Brain.settings };
   }
   public static fromJSON(json: BrainJSON): boolean {
      if (!Reflect.has(json, "Lexicon") || !Reflect.has(json, "nGrams") || !Reflect.has(json, "Settings")) return false;
      const lexicon = Reflect.get(json, "Lexicon") as { [word: string]: string[] };
      for (const word of Object.keys(lexicon)) {
         Brain.lexicon.set(word, new Set<string>(lexicon[word]));
      }
      const ngrams = Reflect.get(json, "nGrams") as nGramJSON;
      for (const hash of Object.keys(ngrams)) {
         if (!Reflect.has(ngrams[hash], "e")
         || !Reflect.has(ngrams[hash], "n")
         || !Reflect.has(ngrams[hash], "p")
         || !Reflect.has(ngrams[hash], "t")
         || !Reflect.has(ngrams[hash], "s")) return false;

         const next = new Map<string, number>();
         const prev = new Map<string, number>();
                     
         if (Reflect.getPrototypeOf(ngrams[hash].n) === Array.prototype) {
            // Parse old brain format (no frequency for previous/next words)      
            for (const word in Reflect.get(ngrams[hash], "n")) {
               next.set(word, 1);
            }
         } else {
            for (const word of Object.keys(ngrams[hash].n)) {
               next.set(word, Reflect.get(ngrams[hash].n, word));
            }
         }

         if (Reflect.getPrototypeOf(ngrams[hash].p) === Array.prototype) {
            // Parse old brain format (no frequency for previous/next words)      
            for (const word in Reflect.get(ngrams[hash], "p")) {
               prev.set(word, 1);
            }
         } else {
            for (const word of Object.keys(ngrams[hash].p)) {
               prev.set(word, Reflect.get(ngrams[hash].p, word));
            }
         }
         Brain.nGrams.set(hash, {
            canEnd: ngrams[hash].e,
            canStart: ngrams[hash].s,
            nextTokens: next,
            previousTokens: prev,
            tokens: ngrams[hash].t
         });
      }
      const settings = Reflect.get(json, "Settings") as BrainSettings;
      Brain.settings = {
         ...CONFIG.initialSettings,
         name: CONFIG.name,
         angerLevel: settings.angerLevel
      }
      return true;
   }
   public static learn(text: string = ""): boolean {
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
            let nGram: nGram = Brain.nGrams.get(hash) || {
               canStart: c === 0,
               canEnd: c === words.length - Brain.chainLength,
               tokens: slice,
               nextTokens: new Map<string, number>(),
               previousTokens: new Map<string, number>()
            }
            if (c > 0) {
               /* Get and increase frequency of previous token */
               const word = words[c - 1];
               const frequency = nGram.previousTokens.get(word) || 0;
               nGram.previousTokens.set(word, frequency + 1);
            }
            if (c < words.length - Brain.chainLength) {
               /* Get and increase frequency of next token */
               const word = words[c + Brain.chainLength];
               const frequency = nGram.nextTokens.get(word) || 0;               
               nGram.nextTokens.set(word, frequency + 1);
            }

            Brain.nGrams.set(hash, nGram);

            for (const word of slice) {
               if (!Brain.lexicon.has(word)) Brain.lexicon.set(word, new Set<string>());
               const ngrams = Brain.lexicon.get(word) as Set<string>;
               ngrams.add(hash);
               Brain.lexicon.set(word, ngrams);               
            }
         }
         learned = true;
      }      
      return learned;
   }

   public static getResponse(seed: string): string {
      let response = EMPTY_BRAIN;
      if (Brain.lexicon.size === 0 || Brain.nGrams.size === 0) return response;
      for (let recursiveThought = 0; recursiveThought < Math.max(Brain.settings.recursion, 1); recursiveThought++) {
         if (!Brain.lexicon.has(seed)) seed = Brain.getRandomSeed();
         const hashes = Array.from(Brain.lexicon.get(seed) as Set<string>);
         if (hashes.length === 0) return response;
         const seedHash = hashes[Math.floor(Math.random() * hashes.length)];
         const initialNGram = Brain.nGrams.get(seedHash) as nGram;
         if (!initialNGram || !initialNGram.tokens) return response;
         const reply: string[] = initialNGram.tokens.slice(0);
         let stack = 0;
         let ngram: nGram = initialNGram;

         while (!ngram.canEnd && (stack++ <= STACK_MAX)) {

            /* TODO: Replace random selection with weighted frequency choice */
            const nextWords = Array.from(ngram.nextTokens.keys());            
            const nextWord = nextWords[Math.floor(Math.random() * nextWords.length)];

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
            if (!ngram.tokens) break;
         }
         stack = 0;
         ngram = initialNGram;
         while (!ngram.canStart && (stack++ <= STACK_MAX)) {

            /* TODO: Replace random selection with weighted frequency choice */
            const prevWords = Array.from(ngram.previousTokens.keys());            
            const prevWord = prevWords[Math.floor(Math.random() * prevWords.length)];

            reply.unshift(prevWord);
            const prevSet = ngram.tokens.slice(0, Brain.chainLength - 1);
            prevSet.unshift(prevWord);
            const prevHash = prevSet.join(WORD_SEPARATOR);
            if (!Brain.nGrams.has(prevHash)) break;
            ngram = Brain.nGrams.get(prevHash) as nGram;
            if (!ngram.tokens) break;
         }
         response = reply.join(' ').trim();
         seed = Brain.getSeed(response);
      }
      return response;
   }

   public static getRandomSeed(): string {      
      const lexiconWords: string[] = Array.from(Brain.lexicon.keys());      
      if (lexiconWords.length === 0) return EMPTY_BRAIN;
      return lexiconWords[Math.floor(Math.random() * lexiconWords.length)];
   }

   public static getSeed(text: string = ""): string {
      if (text === "") return Brain.getRandomSeed();
      const words: string[] = text.split(WORD_REGEX);
      if (words.length === 0) return Brain.getRandomSeed();
      return words[Math.floor(Math.random() * words.length)];   
   }

   public static shouldYell(text: string): boolean {
      let yelledAt: boolean = false;
      if (text === text.toUpperCase()) yelledAt = true;
      
      Brain.settings.angerLevel = Math.max(0.01, Math.min(10, Brain.settings.angerLevel * (yelledAt ? Brain.settings.angerIncrease : Brain.settings.angerDecrease)));
      return (Math.random() < Brain.settings.angerLevel);   
   }

   public static shouldRespond(text: string): boolean {
      let respond = false;
      if (text.match(new RegExp(Brain.settings.name, "giu"))) respond = true;
      if (Math.random() < Brain.settings.outburstThreshold) respond = true;
      return respond;   
   }
}

export { Brain };