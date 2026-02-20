import type Canvas from "canvas";

export type CardOrientation = "upright" | "reversed";

export interface CardMeaning {
   upright: string;
   reversed: string;
}

export interface TarotCard {
   id: string;
   name: string;
   filename: string;
   image: Canvas.Image;
   dimensions: {
      width: number;
      height: number;
   };
   meaning?: CardMeaning;
   orientation: CardOrientation;
}

export interface TarotDeck {
   cards: TarotCard[];
   cardWidth: number;
   cardHeight: number;
}

export interface SpreadSlot {
   slotId: string;
   order: number;
   grid?: {
      row: number;
      col: number;
   };
   position?: {
      x: number;
      y: number;
   };
   rotation?: number;
   scale?: number;
   zIndex?: number;
}

export interface SpreadLayoutDefinition {
   id: string;
   name: string;
   slots: SpreadSlot[];
   forcedCols?: number;
   forcedRows?: number;
   renderHints?: {
      aspect?: number;
   };
}

export interface SpreadThemeDefinition {
   id: string;
   name: string;
   labelsByLayout: Record<string, Record<string, { name: string; description: string }>>;
}

export interface TarotDefaults {
   spread?: string;
   theme?: string;
   deck?: string;
}

export interface SpreadLayoutDetails {
   [cardNumber: number]: {
      name: string;
      description: string;
   };
}

export interface SpreadDefinition {
   id: string;
   name: string;
   layout: number[][];
   details?: SpreadLayoutDetails;
   forcedCols?: number;
   forcedRows?: number;
}

export interface SpreadLayout {
   data: number[][];
   rows: number;
   cols: number;
   details?: SpreadLayoutDetails;
}

export interface TarotExplanation {
   name: string;
   description: string;
   meaning: string;
}

export interface TarotExplanations {
   [cardNumber: number]: TarotExplanation;
}

export interface TarotReading {
   image: Buffer;
   explanation: TarotExplanations;
}

export type TarotReadingResult =
   | { ok: true; reading: TarotReading }
   | { ok: false; reason: string };
