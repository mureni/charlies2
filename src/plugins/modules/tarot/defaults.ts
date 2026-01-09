import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { resolvePluginPaths } from "../../paths";
import type { TarotDefaults } from "./types";

const { resourcesDir } = resolvePluginPaths("tarot");
const defaultsPath = resolve(resourcesDir, "defaults.json");

let cachedDefaults: TarotDefaults | null = null;

const loadDefaults = (): TarotDefaults => {
   if (cachedDefaults) return cachedDefaults;
   if (!existsSync(defaultsPath)) {
      cachedDefaults = {};
      return cachedDefaults;
   }
   const contents = readFileSync(defaultsPath, { encoding: "utf-8" });
   cachedDefaults = JSON.parse(contents) as TarotDefaults;
   return cachedDefaults;
};

const normalizeSpreadId = (value?: string): string => {
   const trimmed = (value ?? "").trim().toLowerCase();
   if (trimmed) return trimmed;
   return loadDefaults().spread ?? "standard";
};

const normalizeThemeId = (value?: string): string => {
   const trimmed = (value ?? "").trim().toLowerCase();
   if (trimmed) return trimmed;
   return loadDefaults().theme ?? "standard";
};

const normalizeDeckId = (value?: string): string => {
   const trimmed = (value ?? "").trim().toLowerCase();
   if (trimmed) return trimmed;
   return loadDefaults().deck ?? "rider-waite";
};

export { loadDefaults, normalizeDeckId, normalizeSpreadId, normalizeThemeId };
