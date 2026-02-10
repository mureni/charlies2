import type { BrainSettings } from "./botSettings";
import { clamp, escapeRegExp, newRX } from "@/utils";

const shouldYell = (text: string, settings: BrainSettings, rng: () => number = Math.random): boolean => {
   let newAngerLevel = settings.angerLevel;
   newAngerLevel *= (text === text.toUpperCase()) ? settings.angerIncrease : settings.angerDecrease;
   settings.angerLevel = clamp(newAngerLevel, 0.01, 10);
   return rng() < settings.angerLevel;
};

const shouldRespond = (respondsTo: string | RegExp, text: string, settings: BrainSettings, rng: () => number = Math.random): boolean => {
   if (rng() < settings.outburstThreshold) return true;
   if (respondsTo instanceof RegExp) return Boolean(text.match(respondsTo));
   if (!respondsTo) return false;
   const rx = newRX(escapeRegExp(respondsTo), "giu");
   return Boolean(text.match(rx));
};

export { shouldRespond, shouldYell };
