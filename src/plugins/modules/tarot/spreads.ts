import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { log } from "../../../core/log";
import { resolvePluginPaths } from "../../paths";
import { normalizeThemeId } from "./defaults";
import type {
   SpreadDefinition,
   SpreadLayout,
   SpreadLayoutDefinition,
   SpreadLayoutDetails,
   SpreadThemeDefinition
} from "./types";

const { resourcesDir } = resolvePluginPaths("tarot");
const layoutsDir = resolve(resourcesDir, "layouts");
const themesDir = resolve(resourcesDir, "themes");

let cachedLayouts: SpreadLayoutDefinition[] | null = null;
let cachedThemes: SpreadThemeDefinition[] | null = null;

const loadJsonFile = <T>(filePath: string): T =>
   JSON.parse(readFileSync(filePath, { encoding: "utf-8" })) as T;

const loadLayouts = (): SpreadLayoutDefinition[] => {
   if (cachedLayouts) return cachedLayouts;
   const layouts = readdirSync(layoutsDir)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => loadJsonFile<SpreadLayoutDefinition>(resolve(layoutsDir, file)));
   cachedLayouts = layouts;
   return layouts;
};

const loadThemes = (): SpreadThemeDefinition[] => {
   if (cachedThemes) return cachedThemes;
   const themes = readdirSync(themesDir)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => loadJsonFile<SpreadThemeDefinition>(resolve(themesDir, file)));
   cachedThemes = themes;
   return themes;
};

const listSpreads = (): string[] => loadLayouts().map((layout) => layout.id);

const listThemes = (): string[] => loadThemes().map((theme) => theme.id);

const getLayout = (id: string): SpreadLayoutDefinition | undefined =>
   loadLayouts().find((layout) => layout.id.toLowerCase() === id.toLowerCase());

const getTheme = (id: string): SpreadThemeDefinition | undefined =>
   loadThemes().find((theme) => theme.id.toLowerCase() === id.toLowerCase());

const buildGridLayout = (layout: SpreadLayoutDefinition): number[][] => {
   let maxRow = -1;
   let maxCol = -1;
   const usedOrders = new Set<number>();
   const usedCells = new Set<string>();

   for (const slot of layout.slots) {
      if (!slot.grid) {
         throw new Error(`Spread layout '${layout.id}' is missing grid coordinates for slot '${slot.slotId}'.`);
      }
      if (slot.order <= 0 || Number.isNaN(slot.order)) {
         throw new Error(`Spread layout '${layout.id}' has an invalid order for slot '${slot.slotId}'.`);
      }
      if (usedOrders.has(slot.order)) {
         throw new Error(`Spread layout '${layout.id}' has duplicate order '${slot.order}'.`);
      }
      const key = `${slot.grid.row}:${slot.grid.col}`;
      if (usedCells.has(key)) {
         throw new Error(`Spread layout '${layout.id}' has duplicate grid cell at ${key}.`);
      }
      usedOrders.add(slot.order);
      usedCells.add(key);
      maxRow = Math.max(maxRow, slot.grid.row);
      maxCol = Math.max(maxCol, slot.grid.col);
   }

   const rows = maxRow + 1;
   const cols = maxCol + 1;
   const grid = Array.from({ length: rows }, () => Array(cols).fill(0));

   for (const slot of layout.slots) {
      if (!slot.grid) continue;
      grid[slot.grid.row][slot.grid.col] = slot.order;
   }

   return grid;
};

const buildSpreadDefinition = (layout: SpreadLayoutDefinition, theme: SpreadThemeDefinition): SpreadDefinition | null => {
   const themeLabels = theme.labelsByLayout[layout.id];
   if (!themeLabels) return null;

   const details: SpreadLayoutDetails = {};
   for (const slot of layout.slots) {
      const label = themeLabels[slot.slotId];
      if (!label) {
         log(`Theme '${theme.id}' is missing labels for slot '${slot.slotId}' on '${layout.id}'.`, "warn");
         return null;
      }
      details[slot.order] = label;
   }

   const grid = buildGridLayout(layout);
   return {
      id: layout.id,
      name: layout.name,
      layout: grid,
      details,
      forcedCols: layout.forcedCols,
      forcedRows: layout.forcedRows
   };
};

const getSpread = (spreadId: string, themeId?: string): SpreadDefinition | undefined => {
   const layout = getLayout(spreadId);
   if (!layout) return undefined;
   const theme = getTheme(normalizeThemeId(themeId));
   if (!theme) return undefined;
   return buildSpreadDefinition(layout, theme) ?? undefined;
};

const buildLayout = (data: number[][], details?: SpreadLayoutDetails): SpreadLayout => {
   const rows = data.length;
   const cols = data.reduce((max, row) => Math.max(max, row.length), 0);
   const normalized = data.map((row) => {
      if (row.length === cols) return row.slice();
      return row.concat(Array(cols - row.length).fill(0));
   });

   let resolvedDetails = details;
   if (resolvedDetails) {
      const detailKeys = new Set(Object.keys(resolvedDetails));
      const hasDetails = normalized.flatMap((value) => value).every((value) => value === 0 || detailKeys.has(String(value)));
      if (!hasDetails) {
         log("Tarot spread details mismatch; ignoring card details", "warn");
         resolvedDetails = undefined;
      }
   }

   return { data: normalized, rows, cols, details: resolvedDetails };
};

const countCardsInLayout = (layout: SpreadLayout): number =>
   layout.data.flatMap((value) => value).filter((value) => value > 0).length;

export {
   buildLayout,
   buildSpreadDefinition,
   countCardsInLayout,
   getLayout,
   getSpread,
   getTheme,
   listSpreads,
   listThemes
};
