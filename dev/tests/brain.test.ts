import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Brain } from "@/core/brain";
import type { BrainSettings } from "@/core/botSettings";

const baseSettings: BrainSettings = {
   outburstThreshold: 0,
   numberOfLines: 1,
   angerLevel: 0,
   surprise: 0,
   angerIncrease: 1,
   angerDecrease: 1,
   recursion: 1,
   conversationTimeLimit: 30,
   learnFromBots: false
};

const originalState = {
   lexicon: Brain.lexicon,
   nGrams: Brain.nGrams,
   chainLength: Brain.chainLength,
   settings: Brain.settings as BrainSettings | undefined
};

beforeEach(() => {
   Brain.lexicon = new Map() as unknown as typeof Brain.lexicon;
   Brain.nGrams = new Map() as unknown as typeof Brain.nGrams;
   Brain.chainLength = 3;
   Brain.settings = { ...baseSettings };
});

afterEach(() => {
   Brain.lexicon = originalState.lexicon;
   Brain.nGrams = originalState.nGrams;
   Brain.chainLength = originalState.chainLength;
   if (originalState.settings) {
      Brain.settings = originalState.settings;
   }
});

describe("brain", () => {
   it("returns false when there is nothing to learn", async () => {
      await expect(Brain.learn("")).resolves.toBe(false);
      await expect(Brain.learn("short")).resolves.toBe(false);
   });

   it("learns ngrams and lexicon entries", async () => {
      const learned = await Brain.learn("one two three four");
      expect(learned).toBe(true);
      expect(Brain.nGrams.size).toBe(2);

      const ngrams = Array.from(Brain.nGrams.values());
      const first = ngrams.find(entry => entry.tokens.join(" ") === "one two three");
      const second = ngrams.find(entry => entry.tokens.join(" ") === "two three four");
      expect(first?.canStart).toBe(true);
      expect(first?.canEnd).toBe(false);
      expect(first?.nextTokens.get("four")).toBe(1);
      expect(second?.canStart).toBe(false);
      expect(second?.canEnd).toBe(true);
      expect(second?.previousTokens.get("one")).toBe(1);

      const tokenSet = Brain.lexicon.get("two") as Set<string> | undefined;
      expect(tokenSet?.size).toBe(2);
      for (const hash of tokenSet ?? []) {
         expect(Brain.nGrams.has(hash)).toBe(true);
      }
   });

   it("generates a response from a single learned ngram", async () => {
      await Brain.learn("hello there friend");
      const response = await Brain.getResponse("hello");
      expect(response).toBe("hello there friend");
   });

   it("returns default messages when the brain is empty", async () => {
      const response = await Brain.getResponse("seed");
      expect(response).toBe("my brain is empty");
      await expect(Brain.getRandomSeed()).resolves.toBe("I know no words");
   });

   it("returns a helpful fallback when no ngram matches the seed", async () => {
      Brain.lexicon = new Map([["seed", new Set(["missing-hash"])]] ) as unknown as typeof Brain.lexicon;
      Brain.nGrams = new Map([
         ["other-hash", {
            tokens: ["a", "b", "c"],
            canStart: true,
            canEnd: true,
            nextTokens: new Map<string, number>(),
            previousTokens: new Map<string, number>()
         }]
      ]) as unknown as typeof Brain.nGrams;
      const response = await Brain.getResponse("seed");
      expect(response).toBe("I do not know enough information");
   });

   it("selects a seed from input text when provided", async () => {
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
      await expect(Brain.getSeed("alpha beta")).resolves.toBe("alpha");
      randomSpy.mockRestore();
   });

   it("delegates to random seeds when no input is provided", async () => {
      const seedSpy = vi.spyOn(Brain, "getRandomSeed").mockResolvedValue("fallback");
      await expect(Brain.getSeed("")).resolves.toBe("fallback");
      expect(seedSpy).toHaveBeenCalled();
   });
});
