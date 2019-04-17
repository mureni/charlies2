import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { CONFIG } from "../config"; 

const SENTENCE_REGEX = /\n/;
const WORD_REGEX = /\s+/;
const WORD_SEPARATOR = "│";
const STACK_MAX = 128;
const EMPTY_BRAIN = "huh";
const BRAIN_FILE = "../../data/brain.json";
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
}

interface nGram {
   tokens: string[];
   canStart: boolean;
   canEnd: boolean;
   nextTokens: Set<string>;
   previousTokens: Set<string>;
}
interface nGramJSON {
   [hash: string]: {
      t: string[],
      s: boolean,
      e: boolean,
      n: string[],
      p: string[]
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
   public static chainLength: number = 3;
   public static nGrams: Map<string, nGram> = new Map<string, nGram>();
   public static settings: BrainSettings = {
         name: CONFIG.name,   
         outburstThreshold: CONFIG.settings.outburstThreshold,      
         numberOfLines: CONFIG.settings.numberOfLines,
         angerLevel: CONFIG.settings.angerLevel,
         angerIncrease: CONFIG.settings.angerIncrease,
         angerDecrease: CONFIG.settings.angerDecrease,
         recursion: CONFIG.settings.recursion,
         conversationTimeLimit: CONFIG.settings.conversationTimeLimit,
         conversationMemoryLength: CONFIG.settings.conversationMemoryLength
   }

   public static save(filename: string = BRAIN_FILE): boolean | Error {
      try {
         writeFileSync(resolve(__dirname, filename), JSON.stringify(Brain.toJSON(), null, 2), "utf8");
         return true;
      } catch (error) {
         return error;
      }
   }
   public static load(filename: string = BRAIN_FILE): boolean | Error {
      try {
         const trueFile = resolve(__dirname, filename);
         if (!existsSync(trueFile)) return new Error(`Unable to load brain data file '${trueFile}: file does not exist.`);
         const json = readFileSync(trueFile, "utf8");
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
         ngrams[hash] = { t: ngram.tokens, s: ngram.canStart, e: ngram.canEnd, n: [], p: [] }
         for (const word of ngram.nextTokens.values()) {
            ngrams[hash].n.push(word);
         }
         for (const word of ngram.previousTokens.values()) {
            ngrams[hash].p.push(word);
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

         Brain.nGrams.set(hash, {
            canEnd: ngrams[hash].e,
            canStart: ngrams[hash].s,
            nextTokens: new Set<string>(ngrams[hash].n),
            previousTokens: new Set<string>(ngrams[hash].p),
            tokens: ngrams[hash].t
         });
      }
      Brain.settings = Reflect.get(json, "Settings") as BrainSettings;
      Brain.settings.name = CONFIG.name;
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
               nextTokens: new Set<string>(),
               previousTokens: new Set<string>()
            }            
            if (c > 0) nGram.previousTokens.add(words[c - 1]);            
            if (c < words.length - Brain.chainLength) nGram.nextTokens.add(words[c + Brain.chainLength]);

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
      if (Brain.lexicon.size === 0 || Brain.nGrams.size === 0) return EMPTY_BRAIN;
      if (!Brain.lexicon.has(seed)) seed = Brain.getRandomSeed();
      const hashes = Array.from(Brain.lexicon.get(seed) as Set<string>);
      const seedHash = hashes[Math.floor(Math.random() * hashes.length)];
      const initialNGram = Brain.nGrams.get(seedHash) as nGram;
      if (!initialNGram || !initialNGram.tokens) return EMPTY_BRAIN;
      const reply: string[] = initialNGram.tokens.slice(0);
      let stack = 0;
      let ngram: nGram = initialNGram;

      while (!ngram.canEnd && (stack++ <= STACK_MAX)) {
         const nextWords = Array.from(ngram.nextTokens.values());
         const nextWord = nextWords[Math.floor(Math.random() * nextWords.length)];
         reply.push(nextWord);
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
         const prevWords = Array.from(ngram.previousTokens.values());
         const prevWord = prevWords[Math.floor(Math.random() * prevWords.length)];
         reply.unshift(prevWord);
         const prevSet = ngram.tokens.slice(0, Brain.chainLength - 1);
         prevSet.unshift(prevWord);
         const prevHash = prevSet.join(WORD_SEPARATOR);
         if (!Brain.nGrams.has(prevHash)) break;
         ngram = Brain.nGrams.get(prevHash) as nGram;
         if (!ngram.tokens) break;
      }
      
      return reply.join(' ').trim();
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
      
      Brain.settings.angerLevel = Math.max(0, Math.min(10, Brain.settings.angerLevel * (yelledAt ? Brain.settings.angerIncrease : Brain.settings.angerDecrease)));
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