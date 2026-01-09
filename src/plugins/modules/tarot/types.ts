import type Canvas from "canvas";

export type CardOrientation = "upright" | "reversed";

export type CardMeaning = {
   upright: string;
   reversed: string;
};

export type TarotCard = {
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
};

export type TarotDeck = {
   cards: TarotCard[];
   cardWidth: number;
   cardHeight: number;
};

export type SpreadSlot = {
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
};

export type SpreadLayoutDefinition = {
   id: string;
   name: string;
   slots: SpreadSlot[];
   forcedCols?: number;
   forcedRows?: number;
   renderHints?: {
      aspect?: number;
   };
};

export type SpreadThemeDefinition = {
   id: string;
   name: string;
   labelsByLayout: Record<string, Record<string, { name: string; description: string }>>;
};

export type TarotDefaults = {
   spread?: string;
   theme?: string;
   deck?: string;
};

export type SpreadLayoutDetails = {
   [cardNumber: number]: {
      name: string;
      description: string;
   };
};

export type SpreadDefinition = {
   id: string;
   name: string;
   layout: number[][];
   details?: SpreadLayoutDetails;
   forcedCols?: number;
   forcedRows?: number;
};

export type SpreadLayout = {
   data: number[][];
   rows: number;
   cols: number;
   details?: SpreadLayoutDetails;
};

export type TarotExplanation = {
   name: string;
   description: string;
   meaning: string;
};

export type TarotExplanations = {
   [cardNumber: number]: TarotExplanation;
};

export type TarotReading = {
   image: Buffer;
   explanation: TarotExplanations;
};

export type TarotReadingResult =
   | { ok: true; reading: TarotReading }
   | { ok: false; reason: string };
