import { existsSync, readdirSync } from "fs";
import { resolve } from "path";
import { resolvePluginPaths } from "../../paths";

const { resourcesDir } = resolvePluginPaths("tarot");
const decksDir = resolve(resourcesDir, "decks");
const sharedFontPath = resolve(decksDir, "font.ttf");

const listDecks = (): string[] =>
   readdirSync(decksDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

const resolveDeckPaths = (deckId: string): { deckDir: string; fontPath: string } | null => {
   const deckDir = resolve(decksDir, deckId);
   if (!existsSync(deckDir)) return null;
   const deckFontPath = resolve(deckDir, "font.ttf");
   const fontPath = existsSync(deckFontPath) ? deckFontPath : sharedFontPath;
   return { deckDir, fontPath };
};

export { listDecks, resolveDeckPaths };
