import { log } from "@/core/log";
import type { StandardMessage } from "@/contracts";
import type { InteractionResult } from "@/core/interactionTypes";
import type { PluginCommand, InteractionPlugin } from "@/plugins/types";
import { loadDeck } from "./tarot/deck";
import { listDecks, resolveDeckPaths } from "./tarot/decks";
import { normalizeDeckId, normalizeSpreadId, normalizeThemeId } from "./tarot/defaults";
import { buildReading } from "./tarot/reader";
import { buildSpreadDefinition, getLayout, getTheme, listSpreads, listThemes } from "./tarot/spreads";

const pluginId = "tarot";
const defaultModifications = { Case: "unchanged" } as const;
const deckPromises = new Map<string, Promise<Awaited<ReturnType<typeof loadDeck>>>>();

const tarotMatcher = /^tarot(?:\s+(?<spread>\S+))?(?:\s+(?<theme>\S+))?(?:\s+(?<deck>\S+))?\s*$/ui;

// TODO: Add slash command registration/handling for tarot once platform adapters support it.
const tarotCommand: PluginCommand = {
   name: "tarot",
   description: "Draws a tarot spread",
   options: [
      {
         name: "spread",
         description: "Spread id (layout)",
         type: "string",
         required: false
      },
      {
         name: "theme",
         description: "Theme id (labels/intent for a spread)",
         type: "string",
         required: false
      },
      {
         name: "deck",
         description: "Deck id (art and meanings)",
         type: "string",
         required: false
      }
   ],
   usage: "tarot [spread] [theme] [deck]",
   example: "tarot horseshoe standard rider-waite",
   fallbackMatcher: tarotMatcher
};

const getDeck = async (deckId: string, deckDir: string, fontPath: string): Promise<Awaited<ReturnType<typeof loadDeck>>> => {
   const cached = deckPromises.get(deckId);
   if (cached) return cached;
   const promise = loadDeck(deckDir, fontPath);
   deckPromises.set(deckId, promise);
   return promise;
};

const buildEmbedFields = (explanation: Record<number, { name: string; description: string; meaning: string }>): Array<{ name: string; value: string }> =>
   Object.values(explanation).map((entry) => ({
      name: entry.name,
      value: `${entry.description}\n*${entry.meaning}*`
   }));

const execute = async (_context: StandardMessage, matches?: RegExpMatchArray): Promise<InteractionResult> => {
   const spreadId = normalizeSpreadId(matches?.groups?.spread);
   const themeId = normalizeThemeId(matches?.groups?.theme);
   const deckId = normalizeDeckId(matches?.groups?.deck);
   const layout = getLayout(spreadId);
   if (!layout) {
      const available = listSpreads().join(", ");
      return {
         results: [{ contents: `Unknown spread \`${spreadId}\`. Available spreads: ${available}.` }],
         modifications: defaultModifications
      };
   }
   const theme = getTheme(themeId);
   if (!theme) {
      const available = listThemes().join(", ");
      return {
         results: [{ contents: `Unknown theme \`${themeId}\`. Available themes: ${available}.` }],
         modifications: defaultModifications
      };
   }
   const spread = buildSpreadDefinition(layout, theme);
   if (!spread) {
      return {
         results: [{ contents: `Theme \`${themeId}\` does not define labels for spread \`${spreadId}\`.` }],
         modifications: defaultModifications
      };
   }
   const deckPaths = resolveDeckPaths(deckId);
   if (!deckPaths) {
      const available = listDecks().join(", ");
      return {
         results: [{ contents: `Unknown deck \`${deckId}\`. Available decks: ${available}.` }],
         modifications: defaultModifications
      };
   }

   try {
      const deck = await getDeck(deckId, deckPaths.deckDir, deckPaths.fontPath);
      const result = await buildReading(deck, spread);
      if (!result.ok) {
         return {
            results: [{ contents: result.reason }],
            modifications: defaultModifications
         };
      }
      const attachment = { name: "tarot.png", data: result.reading.image };
      const embed = {
         title: "Explanation",
         color: "#ffffff",
         description: "Following is a brief explanation of your tarot hand",
         fields: buildEmbedFields(result.reading.explanation),
         imageAttachmentName: "tarot.png"
      };
      log("Generating tarot hand");
      return {
         results: [{ contents: "", embeds: [embed], attachments: [attachment] }],
         modifications: defaultModifications
      };
   } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
         results: [{ contents: `Tarot reading unavailable: ${message}` }],
         modifications: defaultModifications
      };
   }
};

const tarotPlugin: InteractionPlugin = {
   id: pluginId,
   name: "Tarot",
   description: "Draws a tarot spread",
   usage: tarotCommand.usage ?? "tarot [spread]",
   commands: [tarotCommand],
   execute,
   example: tarotCommand.example
};

const plugins = [tarotPlugin];
export { plugins };
