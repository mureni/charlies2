import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { checkFilePath } from "@/utils";

interface BrainSettings {
   outburstThreshold: number;          /* 0..1 chance of speaking without being spoken to */
   numberOfLines: number;              /* # of lines to speak at once */
   angerLevel: number;                 /* 0..1 chance of yelling */
   surprise: number;                   /* 0..1 randomness factor for weighted selections */
   angerIncrease: number;              /* multiplier to increase anger if yelled at */
   angerDecrease: number;              /* multiplier to decrease anger if not yelled at */
   recursion: number;                  /* # of times to think about a line before responding */
   conversationTimeLimit: number;      /* number of milliseconds to wait for a response */
   topicMemoryTtlMinutes: number;      /* topic memory time-to-live in minutes */
   topicMemoryMaxInteractions: number; /* topic memory interactions remaining before expiration */
   topicMemoryBiasStrength: number;    /* 0..1 chance to prefer remembered topic seed when active */
   topicMemoryKeywordCount: number;    /* number of topic keywords extracted per update (1..5) */
   learnFromBots: boolean;
   secretPlaces?: string[];
}

let currentSettings: BrainSettings;

const getSettings = (): BrainSettings => currentSettings;

const setSettings = (settings: BrainSettings): void => {
   currentSettings = settings;
};

const loadSettings = (brainName: string = "default"): boolean | Error => {
   try {
      const settingsFile = resolve(checkFilePath("data", `${brainName}-settings.json`));
      const fallbackFile = resolve(checkFilePath("resources", `${brainName}-settings.json`));
      const resolvedFile = existsSync(settingsFile) ? settingsFile : fallbackFile;
      if (!existsSync(resolvedFile)) throw new Error(`Unable to load settings from file ${settingsFile}: file does not exist.`);

      const json = readFileSync(resolvedFile, "utf8");
      currentSettings = JSON.parse(json) as BrainSettings;
      return true;
   } catch (error: unknown) {
      if (error instanceof Error) return error;
      return false;
   }
};

const saveSettings = (brainName: string = "default"): boolean | Error => {
   try {
      const brainFile = resolve(checkFilePath("data", `${brainName}-settings.json`));
      const json = JSON.stringify(currentSettings);
      writeFileSync(brainFile, json, "utf8");
      return true;
   } catch (error: unknown) {
      if (error instanceof Error) return error;
      return false;
   }
};

export type { BrainSettings };
export { getSettings, setSettings, loadSettings, saveSettings };
