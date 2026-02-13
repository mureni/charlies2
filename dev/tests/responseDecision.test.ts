import { describe, expect, it } from "vitest";
import { shouldRespond, shouldYell } from "@/core/responseDecision";
import type { BrainSettings } from "@/core/botSettings";

describe("responseDecision", () => {
   it("updates anger levels and triggers yelling based on rng", () => {
      const settings: BrainSettings = {
         angerLevel: 0.2,
         surprise: 0,
         angerIncrease: 2,
         angerDecrease: 0.5,
         outburstThreshold: 0.1,
         numberOfLines: 1,
         recursion: 1,
         conversationTimeLimit: 60,
         learnFromBots: false
      };

      const result = shouldYell("LOUD", settings, () => 0.05);

      expect(result).toBe(true);
      expect(settings.angerLevel).toBeGreaterThan(0.2);
   });

   it("reduces anger on lowercase input and respects clamp", () => {
      const settings: BrainSettings = {
         angerLevel: 0.02,
         surprise: 0,
         angerIncrease: 2,
         angerDecrease: 0.1,
         outburstThreshold: 0.1,
         numberOfLines: 1,
         recursion: 1,
         conversationTimeLimit: 60,
         learnFromBots: false
      };

      const result = shouldYell("quiet", settings, () => 0.99);

      expect(result).toBe(false);
      expect(settings.angerLevel).toBeGreaterThanOrEqual(0.01);
   });

   it("responds based on threshold or explicit matches", () => {
      const baseSettings: BrainSettings = {
         angerLevel: 0.1,
         surprise: 0,
         angerIncrease: 1,
         angerDecrease: 1,
         outburstThreshold: 0,
         numberOfLines: 1,
         recursion: 1,
         conversationTimeLimit: 60,
         learnFromBots: false
      };

      const respondsTo = "needle";
      const outburstSettings = { ...baseSettings, outburstThreshold: 1 };

      expect(shouldRespond(respondsTo, "hi", outburstSettings, () => 0.9)).toBe(true);
      expect(shouldRespond(respondsTo, "find the needle", baseSettings, () => 0.9)).toBe(true);
      expect(shouldRespond("Needle", "needle", baseSettings, () => 0.9)).toBe(true);
      expect(shouldRespond(/hello/i, "hello there", baseSettings, () => 0.9)).toBe(true);
      expect(shouldRespond(respondsTo, "no match", baseSettings, () => 0.9)).toBe(false);
   });

   it("returns false when respondsTo is empty", () => {
      const settings: BrainSettings = {
         angerLevel: 0.1,
         surprise: 0,
         angerIncrease: 1,
         angerDecrease: 1,
         outburstThreshold: 0,
         numberOfLines: 1,
         recursion: 1,
         conversationTimeLimit: 60,
         learnFromBots: false
      };

      expect(shouldRespond("", "anything", settings, () => 0.9)).toBe(false);
   });
});
