"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Brain = void 0;
const fs_1 = require("fs");
const saveBigJSON_1 = require("./saveBigJSON");
const path_1 = require("path");
const config_1 = require("../config");
const SENTENCE_REGEX = /\n/;
const WORD_REGEX = /\s+/;
const WORD_SEPARATOR = "│";
const STACK_MAX = 192;
const EMPTY_BRAIN = "huh";
class Brain {
    static save(filename = config_1.checkFilePath("data", "brain.json")) {
        try {
            const realFile = path_1.resolve(filename);
            saveBigJSON_1.saveBigJSON(realFile, Brain.toJSON());
            return true;
        }
        catch (error) {
            return error;
        }
    }
    static load(filename = config_1.checkFilePath("data", "brain.json")) {
        try {
            const realFile = path_1.resolve(filename);
            if (!fs_1.existsSync(realFile))
                return new Error(`Unable to load brain data file '${realFile}': file does not exist.`);
            const json = fs_1.readFileSync(realFile, "utf8");
            return Brain.fromJSON(JSON.parse(json));
        }
        catch (error) {
            return error;
        }
    }
    static toJSON() {
        const lexicon = {};
        const ngrams = {};
        for (const word of Brain.lexicon.keys()) {
            lexicon[word] = [];
            const ngrams = Brain.lexicon.get(word);
            for (const ngram of ngrams.keys()) {
                lexicon[word].push(ngram);
            }
        }
        for (const hash of Brain.nGrams.keys()) {
            const ngram = Brain.nGrams.get(hash);
            ngrams[hash] = { t: ngram.tokens, s: ngram.canStart, e: ngram.canEnd, n: {}, p: {} };
            for (const word of ngram.nextTokens.keys()) {
                const frequency = ngram.nextTokens.get(word);
                ngrams[hash].n[word] = frequency;
            }
            for (const word of ngram.previousTokens.keys()) {
                const frequency = ngram.previousTokens.get(word);
                ngrams[hash].p[word] = frequency;
            }
        }
        return { Lexicon: lexicon, nGrams: ngrams, Settings: Brain.settings };
    }
    static fromJSON(json) {
        if (!Reflect.has(json, "Lexicon") || !Reflect.has(json, "nGrams") || !Reflect.has(json, "Settings"))
            return false;
        const lexicon = Reflect.get(json, "Lexicon");
        for (const word of Object.keys(lexicon)) {
            Brain.lexicon.set(word, new Set(lexicon[word]));
        }
        const ngrams = Reflect.get(json, "nGrams");
        for (const hash of Object.keys(ngrams)) {
            if (!Reflect.has(ngrams[hash], "e")
                || !Reflect.has(ngrams[hash], "n")
                || !Reflect.has(ngrams[hash], "p")
                || !Reflect.has(ngrams[hash], "t")
                || !Reflect.has(ngrams[hash], "s"))
                return false;
            const next = new Map();
            const prev = new Map();
            if (Reflect.getPrototypeOf(ngrams[hash].n) === Array.prototype) {
                // Parse old brain format (no frequency for previous/next words)      
                for (const word in Reflect.get(ngrams[hash], "n")) {
                    next.set(word, 1);
                }
            }
            else {
                for (const word of Object.keys(ngrams[hash].n)) {
                    next.set(word, Reflect.get(ngrams[hash].n, word));
                }
            }
            if (Reflect.getPrototypeOf(ngrams[hash].p) === Array.prototype) {
                // Parse old brain format (no frequency for previous/next words)      
                for (const word in Reflect.get(ngrams[hash], "p")) {
                    prev.set(word, 1);
                }
            }
            else {
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
        const settings = Reflect.get(json, "Settings");
        Brain.settings = {
            ...config_1.CONFIG.initialSettings,
            name: config_1.CONFIG.name,
            angerLevel: settings.angerLevel
        };
        return true;
    }
    static learn(text = "") {
        /* Learn a line */
        let learned = false;
        if (!text)
            return learned;
        const lines = text.trim().split(SENTENCE_REGEX);
        if (lines.length === 0)
            return learned;
        for (const line of lines) {
            const words = line.trim().split(WORD_REGEX);
            if (words.length < Brain.chainLength)
                continue;
            for (let c = 0; c < words.length - (Brain.chainLength - 1); c++) {
                const slice = words.slice(c, c + Brain.chainLength);
                const hash = slice.join(WORD_SEPARATOR);
                let nGram = Brain.nGrams.get(hash) || {
                    canStart: c === 0,
                    canEnd: c === words.length - Brain.chainLength,
                    tokens: slice,
                    nextTokens: new Map(),
                    previousTokens: new Map()
                };
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
                    if (!Brain.lexicon.has(word))
                        Brain.lexicon.set(word, new Set());
                    const ngrams = Brain.lexicon.get(word);
                    ngrams.add(hash);
                    Brain.lexicon.set(word, ngrams);
                }
            }
            learned = true;
        }
        return learned;
    }
    static getResponse(seed) {
        let response = EMPTY_BRAIN;
        if (Brain.lexicon.size === 0 || Brain.nGrams.size === 0)
            return response;
        for (let recursiveThought = 0; recursiveThought < Math.max(Brain.settings.recursion, 1); recursiveThought++) {
            if (!Brain.lexicon.has(seed))
                seed = Brain.getRandomSeed();
            const hashes = Array.from(Brain.lexicon.get(seed));
            if (hashes.length === 0)
                return response;
            const seedHash = hashes[Math.floor(Math.random() * hashes.length)];
            const initialNGram = Brain.nGrams.get(seedHash);
            if (!initialNGram || !initialNGram.tokens)
                return response;
            const reply = initialNGram.tokens.slice(0);
            let stack = 0;
            let ngram = initialNGram;
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
                if (!Brain.nGrams.has(nextHash))
                    break;
                ngram = Brain.nGrams.get(nextHash);
                if (!ngram.tokens)
                    break;
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
                if (!Brain.nGrams.has(prevHash))
                    break;
                ngram = Brain.nGrams.get(prevHash);
                if (!ngram.tokens)
                    break;
            }
            response = reply.join(' ').trim();
            seed = Brain.getSeed(response);
        }
        return response;
    }
    static getRandomSeed() {
        const lexiconWords = Array.from(Brain.lexicon.keys());
        if (lexiconWords.length === 0)
            return EMPTY_BRAIN;
        return lexiconWords[Math.floor(Math.random() * lexiconWords.length)];
    }
    static getSeed(text = "") {
        if (text === "")
            return Brain.getRandomSeed();
        const words = text.split(WORD_REGEX);
        if (words.length === 0)
            return Brain.getRandomSeed();
        return words[Math.floor(Math.random() * words.length)];
    }
    static shouldYell(text) {
        let yelledAt = false;
        if (text === text.toUpperCase())
            yelledAt = true;
        Brain.settings.angerLevel = Math.max(0.01, Math.min(10, Brain.settings.angerLevel * (yelledAt ? Brain.settings.angerIncrease : Brain.settings.angerDecrease)));
        return (Math.random() < Brain.settings.angerLevel);
    }
    static shouldRespond(text) {
        let respond = false;
        if (text.match(new RegExp(Brain.settings.name, "giu")))
            respond = true;
        if (Math.random() < Brain.settings.outburstThreshold)
            respond = true;
        return respond;
    }
}
exports.Brain = Brain;
Brain.lexicon = new Map();
Brain.nGrams = new Map();
Brain.chainLength = 3;
Brain.settings = {
    name: config_1.CONFIG.name,
    outburstThreshold: config_1.CONFIG.initialSettings.outburstThreshold,
    numberOfLines: config_1.CONFIG.initialSettings.numberOfLines,
    angerLevel: config_1.CONFIG.initialSettings.angerLevel,
    angerIncrease: config_1.CONFIG.initialSettings.angerIncrease,
    angerDecrease: config_1.CONFIG.initialSettings.angerDecrease,
    recursion: config_1.CONFIG.initialSettings.recursion,
    conversationTimeLimit: config_1.CONFIG.initialSettings.conversationTimeLimit,
    conversationMemoryLength: config_1.CONFIG.initialSettings.conversationMemoryLength,
    learnFromBots: config_1.CONFIG.initialSettings.learnFromBots
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJhaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29yZS9icmFpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwyQkFBOEM7QUFDOUMsK0NBQTRDO0FBQzVDLCtCQUErQjtBQUMvQixzQ0FBa0Q7QUFFbEQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDO0FBQzVCLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQztBQUN6QixNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUM7QUFDM0IsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDO0FBQ3RCLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQztBQTRDMUIsTUFBTSxLQUFLO0lBaUJELE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBbUIsc0JBQWEsQ0FBQyxNQUFNLEVBQUUsWUFBWSxDQUFDO1FBQ3RFLElBQUk7WUFDRCxNQUFNLFFBQVEsR0FBRyxjQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7WUFFbkMseUJBQVcsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7WUFDdEMsT0FBTyxJQUFJLENBQUM7U0FFZDtRQUFDLE9BQU8sS0FBSyxFQUFFO1lBQ2IsT0FBTyxLQUFLLENBQUM7U0FDZjtJQUNKLENBQUM7SUFDTSxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQW1CLHNCQUFhLENBQUMsTUFBTSxFQUFFLFlBQVksQ0FBQztRQUN0RSxJQUFJO1lBQ0QsTUFBTSxRQUFRLEdBQUcsY0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ25DLElBQUksQ0FBQyxlQUFVLENBQUMsUUFBUSxDQUFDO2dCQUFFLE9BQU8sSUFBSSxLQUFLLENBQUMsbUNBQW1DLFFBQVEseUJBQXlCLENBQUMsQ0FBQztZQUNsSCxNQUFNLElBQUksR0FBRyxpQkFBWSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUM1QyxPQUFPLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtB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