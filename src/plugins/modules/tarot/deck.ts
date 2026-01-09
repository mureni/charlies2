import Canvas from "canvas";
import { readdirSync, readFileSync } from "fs";
import { join, parse } from "path";
import { log } from "../../../core/log";
import type { TarotCard, TarotDeck } from "./types";

const registeredFonts = new Set<string>();

const registerFontOnce = (fontPath: string): void => {
   if (registeredFonts.has(fontPath)) return;
   Canvas.registerFont(fontPath, { family: "Sans Serif" });
   registeredFonts.add(fontPath);
};

const computeDeckDimensions = (cards: TarotCard[]): { cardWidth: number; cardHeight: number } => {
   let cardWidth = 0;
   let cardHeight = 0;
   for (const card of cards) {
      cardWidth = Math.max(cardWidth, card.dimensions.width);
      cardHeight = Math.max(cardHeight, card.dimensions.height);
   }
   return { cardWidth, cardHeight };
};

const loadCards = async (deckDir: string): Promise<TarotCard[]> => {
   const results: TarotCard[] = [];
   const meaningFile = join(deckDir, "meanings.json");
   const meaningContents = readFileSync(meaningFile, { encoding: "utf-8" });
   const meanings = JSON.parse(meaningContents) as Record<string, { upright: string; reversed: string }>;

   const files = readdirSync(deckDir).filter((file) =>
      parse(file).ext.match(/png|jpe?g|webp|gif|tiff?|svg/i)
   );

   if (!files.length) {
      throw new Error(`No image files were found in folder '${deckDir}'`);
   }

   for (const file of files) {
      const image = await Canvas.loadImage(join(deckDir, file));
      const id = parse(file).name;
      const meaning = meanings[id];
      results.push({
         id,
         name: id.replace(/_/g, " "),
         filename: file,
         image,
         dimensions: {
            width: image.naturalWidth ?? 0,
            height: image.naturalHeight ?? 0
         },
         meaning,
         orientation: "upright"
      });
   }

   return results;
};

const toTitleCase = (text: string): string => {
   let first = true;
   return text
      .split(" ")
      .map((word) => {
         let next = word.toLowerCase();
         if (word.length > 2 || first) next = word.charAt(0).toUpperCase() + word.slice(1);
         if (first) first = false;
         return next;
      })
      .join(" ");
};

const shuffleCards = <T>(cards: T[]): T[] => {
   const result = cards.slice();
   for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
   }
   return result;
};

const drawCards = (deck: TarotDeck, count: number): TarotCard[] => {
   const shuffled = shuffleCards(deck.cards);
   return shuffled.slice(0, count).map((card) => ({
      ...card,
      name: toTitleCase(card.name),
      orientation: Math.random() < 0.5 ? "reversed" : "upright"
   }));
};

const loadDeck = async (deckDir: string, fontPath: string): Promise<TarotDeck> => {
   registerFontOnce(fontPath);
   try {
      const cards = await loadCards(deckDir);
      const { cardWidth, cardHeight } = computeDeckDimensions(cards);
      return { cards, cardWidth, cardHeight };
   } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Tarot deck load failed: ${message}`, "error");
      throw error;
   }
};

export { loadDeck, drawCards, shuffleCards };
