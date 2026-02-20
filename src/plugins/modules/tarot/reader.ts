import Canvas from "canvas";
import type { TarotCard, TarotDeck, TarotReadingResult, SpreadDefinition, SpreadLayout } from "./types";
import { buildLayout, countCardsInLayout } from "./spreads";
import { drawCards } from "./deck";

const positionCache = new WeakMap<SpreadLayout, Map<number, { row: number; col: number }>>();

const getTextHeight = (deck: TarotDeck, hasDetails: boolean): number => {
   if (!hasDetails) return 0;
   return Math.round(Math.pow(deck.cardWidth, 1 / Math.PI * 2));
};

const getPositionIndex = (layout: SpreadLayout): Map<number, { row: number; col: number }> => {
   const cached = positionCache.get(layout);
   if (cached) return cached;
   const index = new Map<number, { row: number; col: number }>();
   for (let row = 0; row < layout.rows; row += 1) {
      for (let col = 0; col < layout.cols; col += 1) {
         const value = layout.data[row][col];
         if (value > 0) index.set(value, { row, col });
      }
   }
   positionCache.set(layout, index);
   return index;
};

const getLayoutDimensions = (layout: SpreadLayout, spread: SpreadDefinition, deck: TarotDeck): { pixelWidth: number; pixelHeight: number } => {
   const cols = Math.max(1, spread.forcedCols ?? layout.cols);
   const rows = Math.max(1, spread.forcedRows ?? layout.rows);
   const textHeight = getTextHeight(deck, Boolean(layout.details));
   return {
      pixelWidth: cols * deck.cardWidth,
      pixelHeight: rows * deck.cardHeight + textHeight
   };
};

const getCardPosition = (layout: SpreadLayout, spread: SpreadDefinition, deck: TarotDeck, cardNumber: number): { x: number; y: number } | null => {
   if (cardNumber <= 0) return null;
   const position = getPositionIndex(layout).get(cardNumber);
   if (!position) return null;
   const { row: rowIndex, col: colIndex } = position;

   const cols = Math.max(1, spread.forcedCols ?? layout.cols);
   const rows = Math.max(1, spread.forcedRows ?? layout.rows);
   const xScale = cols / layout.cols;
   const yScale = rows / layout.rows;
   const textOffset = getTextHeight(deck, Boolean(layout.details));
   return {
      x: deck.cardWidth * colIndex * xScale,
      y: textOffset + deck.cardHeight * rowIndex * yScale
   };
};

const paintCard = (
   context: Canvas.CanvasRenderingContext2D,
   card: TarotCard,
   x: number,
   y: number,
   width: number,
   height: number,
   angle: number,
   label?: { text: string; width: number }
): void => {
   const xCenter = width / 2;
   const yCenter = height / 2;

   context.save();
   if (angle % 360 !== 0) {
      context.translate(x + xCenter, y + yCenter);
      context.rotate(Math.PI / 180 * angle);
      context.drawImage(card.image, -xCenter, -yCenter, width, height);
   } else {
      context.translate(x, y);
      context.drawImage(card.image, 0, 0, width, height);
   }
   context.restore();

   if (!label) return;
   context.save();
   context.textAlign = "left";
   context.textBaseline = "bottom";
   context.fillStyle = "white";
   context.shadowColor = "black";
   context.shadowBlur = 5;
   const textWidth = label.width;
   const scaleWidth = textWidth > width;
   const horizontalCenter = scaleWidth ? 0 : width / 2 - textWidth / 2;
   const textXOffset = scaleWidth ? 0 : horizontalCenter;
   if (scaleWidth) {
      const scaled = Math.round(Math.pow(width, 1 / Math.PI * 2));
      context.font = `bold ${scaled}px sans-serif`;
   }
   context.translate(x + textXOffset, y);
   context.fillText(label.text, 0, 0, scaleWidth ? width : undefined);
   context.restore();
};

const buildReading = async (deck: TarotDeck, spread: SpreadDefinition): Promise<TarotReadingResult> => {
   const layout = buildLayout(spread.layout, spread.details);
   const cardCount = countCardsInLayout(layout);
   if (deck.cards.length < cardCount) {
      return {
         ok: false,
         reason: `The tarot deck only has ${deck.cards.length} cards, but the ${spread.id} spread needs ${cardCount}.`
      };
   }

   const cards = drawCards(deck, cardCount);
   const dims = getLayoutDimensions(layout, spread, deck);
   const canvas = Canvas.createCanvas(dims.pixelWidth, dims.pixelHeight);
   const context = canvas.getContext("2d");
   const textHeight = getTextHeight(deck, Boolean(layout.details));
   if (textHeight > 0) context.font = `bold ${textHeight}px sans-serif`;

   let actualWidth = 0;
   let actualHeight = 0;
   const explanations: Record<number, { name: string; description: string; meaning: string }> = {};

   for (let index = 0; index < cards.length; index += 1) {
      const cardNumber = index + 1;
      const position = getCardPosition(layout, spread, deck, cardNumber);
      if (!position) continue;
      actualWidth = Math.max(actualWidth, position.x + deck.cardWidth);
      actualHeight = Math.max(actualHeight, position.y + deck.cardHeight);

      const detail = layout.details?.[cardNumber];
      const displayName = detail?.name ?? `Card #${cardNumber}`;
      const displayDescription = detail?.description ?? "";
      const meaning = cards[index].orientation === "reversed"
         ? cards[index].meaning?.reversed
         : cards[index].meaning?.upright;

      explanations[cardNumber] = {
         name: `${displayName}: ${cards[index].name}${cards[index].orientation === "reversed" ? " (Reversed)" : ""}`,
         description: displayDescription,
         meaning: meaning ?? ""
      };

      const label = layout.details
         ? { text: `${cardNumber}) ${displayName}`, width: context.measureText(`${cardNumber}) ${displayName}`).width }
         : undefined;

      const angle = cards[index].orientation === "reversed" ? 180 : 0;
      paintCard(context, cards[index], position.x, position.y, deck.cardWidth, deck.cardHeight, angle, label);
   }

   const maxHeight = 1200;
   const maxWidth = 1200;
   const scaleFactor = Math.min(
      1,
      actualHeight > 0 ? maxHeight / actualHeight : 1,
      actualWidth > 0 ? maxWidth / actualWidth : 1
   );
   const finalWidth = actualWidth * scaleFactor;
   const finalHeight = actualHeight * scaleFactor;
   const finalCanvas = Canvas.createCanvas(finalWidth, finalHeight);
   const finalContext = finalCanvas.getContext("2d");
   finalContext.drawImage(canvas, 0, 0, actualWidth, actualHeight, 0, 0, finalWidth, finalHeight);

   return { ok: true, reading: { image: finalCanvas.toBuffer(), explanation: explanations } };
};

export { buildReading, getCardPosition, getLayoutDimensions, getTextHeight };
