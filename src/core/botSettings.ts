import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { checkFilePath } from "@/utils";

interface BrainSettings {
   outburstThreshold: number;          /* 0..1 chance of speaking without being spoken to */
   angerLevel: number;                 /* 0..1 chance of yelling */
   surprise: number;                   /* 0..1 randomness factor for weighted selections */
   angerIncrease: number;              /* multiplier to increase anger if yelled at */
   angerDecrease: number;              /* multiplier to decrease anger if not yelled at */
   recursion: number;                  /* # of times to think about a line before responding */
   topicMemoryTtlMinutes: number;      /* topic memory time-to-live in minutes */
   topicMemoryMaxInteractions: number; /* topic memory interactions remaining before expiration */
   topicMemoryBiasStrength: number;    /* 0..1 multiplier applied to remembered-topic overlay weights */
   topicMemoryKeywordCount: number;    /* number of topic keywords extracted per update (1..5) */
   learnFromBots: boolean;
   secretPlaces?: string[];
}

type BrainSettingsRecord = BrainSettings & Record<string, unknown>;

let currentSettings: BrainSettingsRecord;

const readSettingsObject = (filename: string): Record<string, unknown> => {
   const json = readFileSync(filename, "utf8");
   const parsed = JSON.parse(json);
   if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`Settings file must contain a JSON object: ${filename}`);
   }
   return parsed as Record<string, unknown>;
};

const getDefaultSettings = (): Record<string, unknown> => {
   const defaultFile = resolve(checkFilePath("resources", "default-settings.json"));
   if (!existsSync(defaultFile)) throw new Error(`Unable to load default settings from file ${defaultFile}: file does not exist.`);
   return readSettingsObject(defaultFile);
};

const mergeSettingsByDefaults = (
   defaults: Record<string, unknown>,
   ...overrides: Record<string, unknown>[]
): BrainSettingsRecord => {
   const merged: Record<string, unknown> = { ...defaults };
   for (const override of overrides) {
      for (const [key, value] of Object.entries(override)) {
         if (key in defaults) merged[key] = value;
      }
   }
   return merged as BrainSettingsRecord;
};

const getSettings = (): BrainSettings => currentSettings;

const setSettings = (settings: BrainSettings): void => {
   currentSettings = settings as BrainSettingsRecord;
};

const loadSettings = (brainName: string = "default"): boolean | Error => {
   try {
      const settingsFile = resolve(checkFilePath("data", `${brainName}-settings.json`));
      const resourceFile = resolve(checkFilePath("resources", `${brainName}-settings.json`));
      const defaults = getDefaultSettings();
      const resourceOverrides = existsSync(resourceFile) ? readSettingsObject(resourceFile) : {};
      const dataOverrides = existsSync(settingsFile) ? readSettingsObject(settingsFile) : {};

      currentSettings = mergeSettingsByDefaults(defaults, resourceOverrides, dataOverrides);
      return true;
   } catch (error: unknown) {
      if (error instanceof Error) return error;
      return false;
   }
};

const saveSettings = (brainName: string = "default"): boolean | Error => {
   try {
      const brainFile = resolve(checkFilePath("data", `${brainName}-settings.json`));
      const defaults = getDefaultSettings();
      const persistedSettings = mergeSettingsByDefaults(defaults, currentSettings);
      const json = `${JSON.stringify(persistedSettings, null, 2)}\n`;
      writeFileSync(brainFile, json, "utf8");
      currentSettings = persistedSettings;
      return true;
   } catch (error: unknown) {
      if (error instanceof Error) return error;
      return false;
   }
};

export type { BrainSettings };
export { getSettings, setSettings, loadSettings, saveSettings };
