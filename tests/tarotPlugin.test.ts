import { describe, expect, it } from "vitest";
import { buildReading } from "@/plugins/modules/tarot/reader";
import { drawCards, loadDeck } from "@/plugins/modules/tarot/deck";
import { resolveDeckPaths } from "@/plugins/modules/tarot/decks";
import { normalizeDeckId, normalizeSpreadId } from "@/plugins/modules/tarot/defaults";
import { buildLayout, countCardsInLayout, getSpread } from "@/plugins/modules/tarot/spreads";

const deckPaths = resolveDeckPaths(normalizeDeckId());
if (!deckPaths) {
   throw new Error("default deck not found");
}

const loadDefaultDeck = async () => loadDeck(deckPaths.deckDir, deckPaths.fontPath);

describe("tarot plugin", () => {
   it("normalizes spread ids", () => {
      expect(normalizeSpreadId(""))
         .toBe("standard");
      expect(normalizeSpreadId(" Star "))
         .toBe("star");
   });

   it("builds layouts and counts cards", () => {
      const spread = getSpread("horseshoe");
      if (!spread) throw new Error("spread not found");
      const layout = buildLayout(spread.layout, spread.details);
      expect(countCardsInLayout(layout)).toBe(5);
   });

   it("loads the default deck", async () => {
      const deck = await loadDefaultDeck();
      expect(deck.cards.length).toBeGreaterThan(0);
      expect(deck.cardWidth).toBeGreaterThan(0);
      expect(deck.cardHeight).toBeGreaterThan(0);
   });

   it("draws cards without mutating the deck", async () => {
      const deck = await loadDefaultDeck();
      const originalIds = deck.cards.map(card => card.id);
      const drawn = drawCards(deck, 3);
      expect(deck.cards.map(card => card.id)).toEqual(originalIds);
      expect(drawn.length).toBe(3);
      expect(new Set(drawn.map(card => card.id)).size).toBe(drawn.length);
   });

   it("renders a standard spread", async () => {
      const deck = await loadDefaultDeck();
      const spread = getSpread("standard");
      if (!spread) throw new Error("spread not found");
      const result = await buildReading(deck, spread);
      if (!result.ok) throw new Error("reading failed");
      expect(Object.keys(result.reading.explanation).length).toBe(3);
      expect(result.reading.image.length).toBeGreaterThan(0);
   });

   it("refuses readings when deck is too small", async () => {
      const deck = await loadDefaultDeck();
      const spread = getSpread("horseshoe");
      if (!spread) throw new Error("spread not found");
      const tinyDeck = { ...deck, cards: deck.cards.slice(0, 2) };
      const result = await buildReading(tinyDeck, spread);
      expect(result.ok).toBe(false);
      if (!result.ok) {
         expect(result.reason).toMatch(/needs 5/i);
      }
   });
});
