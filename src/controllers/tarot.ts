
   /* Example:
      cardWidth: 100 (pixels)
      cardHeight: 300 (pixels)
      layoutHeightInCards: 2 (layout is 2 cards high, or 600 pixels)
      matrix: [ 1, 0, 0, 0, 5 ]
              [ 0, 2, 0, 4, 0 ]
              [ 0, 0, 3, 0, 0 ]
      (matrix is 3 rows, or 3 cards high)
      Height adjustment is layout height / matrix height 
        -> 2 / 3 = 0.666
      When the first card is pulled, it will be at {x: 0 * cardWidth, y: 0 * cardHeight * 0.666}  // x: 0, y: 0
      When the second card is pulled, it will be at {x: 1 * cardWidth, y: 1 * cardHeight * 0.666} // x: 100, y: 200 
        -> Note: If layoutHeightInCards was 3, y would be 300 -- the height of one card. Since layoutHeightInCards is 2, we have to shrink the Y position to fit

   */
   
import Canvas from "canvas";
import { readdirSync, writeFileSync, readFileSync } from "fs";
import { join, parse } from "path";
import { checkFilePath } from "../utils";

interface Card {
   dimensions: {
      width: number;
      height: number;
   };
   positionInLayout?: {
      x: number;
      y: number;
   }
   orientation: "upright" | "reversed";   
   filename: string;
   image: Canvas.Image;
   name?: string;
   meaning?: {
      upright: string,
      reversed: string
   };
}
export type SpreadLayoutDetails = {
   [cardNumber: number]: {
      name: string,       // i.e. "Future"
      description: string // i.e. "This card represents your future"
   }
}
interface SpreadLayout {
   data: number[][];
   rows: number;
   cols: number;
   textHeight: number;
   details?: SpreadLayoutDetails;   
}
interface Hand {
   spread: Spread;   
   cards: Card[];
}

interface Meanings {
   [cardName: string]: {
      upright: string,
      reversed: string
   }
}

interface Explanations {
   [card: number]: {
      name: string,
      description: string,
      meaning: string
   }
}

const TAROT_DIR = checkFilePath("resources", "tarot-decks/rider-waite/");
const FONT = checkFilePath("resources", "tarot-decks/font.ttf");
Canvas.registerFont(FONT, { family: 'Sans Serif' });

const toTitleCase = (text: string) => {
   let first = true;
   return text.split(' ').map(word => {      
      let nw: string = word.toLowerCase();
      if (word.length > 2 || first) nw = word.charAt(0).toUpperCase() + word.slice(1);
      if (first) first = false;
      return nw;
   }).join(' ');
}
class SpreadLayout implements SpreadLayout {         
   constructor(data: number[][], details?: SpreadLayoutDetails) {
      
      this.rows = data.length;
      this.cols = data.reduce((longest, col) => col.length > longest.length ? longest = col : longest = longest, []).length;      
      
      this.data = Array(this.rows).fill(Array(this.cols).fill(0));
            
      let newData = new Array();
      for (let row = 0; row < this.rows; row++) {
         let rowData = new Array(this.cols).fill(0);
         for (let col = 0; col < this.cols; col++) {         
            // If current position in normalized matrix row is longer than the layout, set it to 0, otherwise set it to the value of the input data matrix
            rowData[col] = (col >= data[row].length) ? 0 : data[row][col];
         }
         newData.push(rowData);
      }
      this.data = newData;
      this.details = details;

      // Check whether each card in the layout has an assigned detail; if not, undefine it all
      if (this.details) {         
         const withDetails = Object.keys(this.details);
         const hasDetails = this.data.flatMap(value => value).every(value => value === 0 || withDetails.includes(value.toString()));
         //console.log(`Layout has details: ${hasDetails}`);
         if (!hasDetails) this.details = undefined;
      }
   
      //console.log(`Created spread layout: ${this.data}`);
   }

   getCardCount(): number {
      return this.data.flatMap(value => value).filter(value => value > 0).length;  
   }
   
   getPosition(cardNumber: number): { x: number, y: number } {
      //console.log(`Searching [${this.cols} x ${this.rows}] spread layout for card number ${cardNumber}`);
      //console.log(this.data);
      if (cardNumber <= 0) return { x: -1, y: -1 }
      for (let row = 0; row < this.rows; row++) {
         for (let col = 0; col < this.cols; col++) {
            if (this.data[row][col] === cardNumber) return { x: col, y: row }
         }
      }
      return { x: -1, y: -1 }
   }
  
}

class Deck {
   public cards: Card[];
   public cardWidth: number;
   public cardHeight: number;
   constructor(imageFolder: string = TAROT_DIR) {      
      this.cards = [];
      this.cardWidth = 0;
      this.cardHeight = 0;
      this.loadCards(imageFolder).then(loadedCards => {
         this.cards = loadedCards;
         let { cardWidth, cardHeight } = this.getMaxCardSize();
         this.cardWidth = cardWidth;
         this.cardHeight = cardHeight;
      }).catch(reason => {         
         throw new Error(reason);
      });
      //console.log(`Cards loaded: ${JSON.stringify(this.cards)}`);

   }
   async loadCards(imageFolder: string = TAROT_DIR): Promise<Card[]> {
      let files: string[] = [];
      const results: Card[] = [];
      const meaningFile: string = join(imageFolder, "meanings.json");

      const meaningContents = readFileSync(meaningFile, { encoding: "utf-8" });
      
      const meanings: Meanings = JSON.parse(meaningContents) as Meanings;
      
      files = readdirSync(imageFolder).filter((file) =>
         parse(file).ext.match(/png|jpe?g|webp|gif|tiff?|svg/i)
      );
      if (!files || files.length === 0) return Promise.reject(`No image files were found in folder '${imageFolder}'`);

      for (let file of files) {
         const image: Canvas.Image = await Canvas.loadImage(join(imageFolder, file));
         const name = parse(file).name;
         const meaning = meanings[name];

         const card: Card = {
            dimensions: {
               width: image.naturalWidth ?? 0,
               height: image.naturalHeight ?? 0,
            },
            orientation: "upright",
            filename: file,
            image: image,
            name: toTitleCase(name.replace(/_/g, " ")),
            meaning: meaning
         };
         results.push(card);
         //console.log(`Loaded card ${file}`);
      }
      return Promise.resolve(results);
   };

   public getMaxCardSize(maxWidth?: number, maxHeight?: number) {
      if (this.cards.length === 0) return { cardWidth: 0, cardHeight: 0 };
      let curWidth = 0;
      let curHeight = 0;

      this.cards.forEach(card => {
         curWidth = Math.max(curWidth, card.dimensions.width);
         curHeight = Math.max(curHeight, card.dimensions.height);
      });
      if ((maxWidth && curWidth > maxWidth) || (maxHeight && curHeight > maxHeight)) {
         // TODO: Limit width or height via scaling?
      }
      return { cardWidth: curWidth, cardHeight: curHeight };
   };

}
class Hand implements Hand {
   deck: Deck;
   constructor(deck: Deck, spread: Spread) {
      this.cards = [];            
      this.spread = spread;
      this.deck = deck;
      
      const layout: SpreadLayout = spread.layout;      
      const numCards = layout.data.flatMap(value => value).filter(value => value > 0).length;
   
      this.cards = this.pullCards(numCards, this.deck);
      
      if (this.cards.length === 0) throw new Error("No cards were pulled");  
   }
   pullCards(numCards: number, deck: Deck): Card[] {
      const cards: Card[] = [];
      const readingLength = Math.min(deck.cards.length, numCards);  
      // Get the card data and store it as a hand
      for (let cardCount = 0; cardCount < readingLength; ++cardCount) {
         const [pulledCard] = deck.cards.splice(Math.floor(Math.random() * deck.cards.length), 1);      
         if (Math.random() < 0.5) pulledCard.orientation = "reversed";
         cards.push(pulledCard);
      }
      return cards;
   }


}
class Spread {
   readonly name: string;
   readonly layout: SpreadLayout;
   readonly rows: number;
   readonly cols: number;
   constructor(name: string, layout: SpreadLayout, forceCols?: number, forceRows?: number) {
      this.name = name;
      this.layout = layout;      
      this.rows = Math.max(1, forceRows ?? layout.rows);
      this.cols = Math.max(1, forceCols ?? layout.cols);            
   }
   getDimensions(deck: Deck) {
      let pixelWidth = this.layout.cols * deck.cardWidth;      
      let pixelHeight = this.layout.rows * deck.cardHeight + this.getTextHeight(deck);

      return { pixelWidth: pixelWidth, pixelHeight: pixelHeight }
   }
   getTextHeight(deck: Deck): number {
      if (this.layout.details) {         
         const cardSize = deck.getMaxCardSize();                  
         return Math.round(Math.pow(cardSize.cardWidth, 1/Math.PI*2));
      } else { 
         return 0;         
      }
   }
   getXYPositionOfCard(hand: Hand, cardNumber: number): { x: number, y: number } {
      
      if (cardNumber <= 0 || cardNumber > hand.cards.length || !hand.cards[cardNumber - 1]) return { x: -1, y: -1 }
                  
      // Go through the cards picked up and find where each one belong in the final layout
      let { x, y } = this.layout.getPosition(cardNumber);
      let numCards = this.layout.getCardCount();
      if (numCards <= 1) return { x: 0, y: 0 }

      const xScale = this.cols / this.layout.cols; // if original spread has 6 but we're limiting to 3, xScale is .5
      const yScale = this.rows / this.layout.rows; // if original spread has 4 but we're limiting to 3, yScale is .75
                 
      const textAdjustment = this.getTextHeight(hand.deck);
      const yAdjustment = textAdjustment + (hand.deck.cardHeight * y * yScale);
      const xAdjustment = hand.deck.cardWidth * x * xScale;
      
      //console.log(`Position of card #${cardNumber} (${hand.deck.cardWidth}px * ${hand.deck.cardHeight}px) in spread: [${x}, ${y}]`);
      //console.log(`Original spread layout size: ${this.layout.cols} * ${this.layout.rows}`);
      //console.log(`Desired spread size: ${this.cols} * ${this.rows}`);      
      //console.log(`Scaling from original to desired size: ${xScale}w * ${yScale}h`);
      //console.log(`Adjustment: ${xAdjustment}px * ${yAdjustment}px`);
      return { x: xAdjustment, y: yAdjustment };      
   }
   async getReading (deck: Deck = new Deck(TAROT_DIR)): Promise<{ image: Buffer, explanation: Explanations }> {
            
      const hand = new Hand(deck, this);      
      const dims = this.getDimensions(hand.deck);
      const explanations: Explanations = {};

      // Create canvas and context
      const canvas = Canvas.createCanvas(dims.pixelWidth, dims.pixelHeight);
      const context = canvas.getContext("2d");
      const textHeight = this.getTextHeight(deck);
      // const metrics = context.measureText("A Regular Phrase");
      // textHeight = Math.abs(metrics.actualBoundingBoxAscent) + Math.abs(metrics.actualBoundingBoxDescent);

      const paintCard = (context: Canvas.CanvasRenderingContext2D, card: Card, x: number, y: number, width: number, height: number, angle: number, cardNumber: number) => {
         let xCenter = width / 2, yCenter = height / 2;

         context.font = `${textHeight}px bold sans-serif`;         
         context.textAlign = "left";
         context.textBaseline = "bottom";
         context.fillStyle = "white";
         context.shadowColor = "black";
         context.shadowBlur = 5;

         let scaleWidth: boolean = false;
         const positionName = this.layout.details ? `${cardNumber}) ${this.layout.details[cardNumber].name}` : "";
         const textWidth = this.layout.details ? context.measureText(positionName).width : 0;
         if (textWidth > width) scaleWidth = true;

         const horizontalCenter = scaleWidth ? 0 : ((width / 2) - (textWidth / 2));
         const textXOffset = scaleWidth ? 0 : horizontalCenter;

         if (scaleWidth) context.font = `${Math.round(Math.pow(width, 1/Math.PI*2))}px bold sans-serif`;   
         //console.log(`Text width: ${textWidth}; Card width: ${width}; Text offset: ${textXOffset}; Center: ${horizontalCenter}`);
         context.save();         
         if (angle % 360 !== 0) {
            //console.log(`Rotating image ${angle} degrees around point (${xCenter}, ${yCenter}), drawing at: ${x}, ${y}`);
            context.translate(x + xCenter, y + yCenter);
            context.rotate(Math.PI/180 * angle);
            context.drawImage(card.image, -xCenter, -yCenter, width, height);         
         } else {
            context.translate(x, y);
            context.drawImage(card.image, 0, 0, width, height);
         }         
         context.restore();

         if (this.layout.details) {            
            //console.log(`Drawing layout position name ${positionName} at [${textXOffset + x}px, ${y - textHeight}px]`);
            context.save();            
            context.translate(x + textXOffset, y);
            context.fillText(positionName, 0, 0, scaleWidth ? width : undefined);
            context.restore();            
         }
      }

      //console.log(`Spread width: ${dims.pixelWidth}; height: ${dims.pixelHeight}`);
      //console.log(`Card width: ${deck.cardWidth}; height: ${deck.cardHeight}`);

      let actualWidth: number = 0;
      let actualHeight: number = 0;

      for (let card = 0; card < hand.cards.length; card++) {
         let { x, y } = this.getXYPositionOfCard(hand, card + 1);
         if (x + deck.cardWidth > actualWidth) actualWidth = x + deck.cardWidth;
         if (y + deck.cardHeight > actualHeight) actualHeight = y + deck.cardHeight;         
         let cardNumber = this.layout.details ? this.layout.details[card + 1].name : `Card #${card + 1}`;
         let cardDescription = this.layout.details ? this.layout.details[card + 1].description : ``;
         explanations[card] = {
            name: `${cardNumber}: ${hand.cards[card].name}${(hand.cards[card].orientation === "reversed") ? ' (Reversed)' : ''}`,
            description: cardDescription,
            meaning: ((hand.cards[card].orientation === "reversed") ? hand.cards[card].meaning?.reversed : hand.cards[card].meaning?.upright) ?? ""
         }
         
         if (hand.cards[card].orientation === "reversed") {
            //console.log(`Drawing reversed card #${card + 1} at: ${x}, ${y}`);
            paintCard(context, hand.cards[card], x, y, deck.cardWidth, deck.cardHeight, 180, card + 1);
         } else {
            //console.log(`Drawing card #${card + 1} at: ${x}, ${y}`);
            paintCard(context, hand.cards[card], x, y, deck.cardWidth, deck.cardHeight, 0, card + 1);
         }
      }
      if (this.layout.details) actualHeight += textHeight;

            
      const maxHeight = 1200;
      const scaleFactor = (actualHeight > maxHeight) ? maxHeight / actualHeight : 1;
         
      //context.scale(scaleFactor, scaleFactor);

      const finalWidth = actualWidth * scaleFactor;
      const finalHeight = actualHeight * scaleFactor;

      //console.log(`Original size: ${dims.pixelWidth} x ${dims.pixelHeight}`);      
      //console.log(`Actual size: ${actualWidth} x ${actualHeight}`);
      //console.log(`Final size: ${finalWidth} x ${finalHeight}`);

      const finalCanvas = Canvas.createCanvas(finalWidth, finalHeight);
      const finalContext = finalCanvas.getContext("2d");
      finalContext.drawImage(canvas, 0, 0, actualWidth, actualHeight, 0, 0, finalWidth, finalHeight);
         
      return Promise.resolve({ image: finalCanvas.toBuffer(), explanation: explanations });
   };

}
const Spreads: Spread[] = [
   new Spread("standard", new SpreadLayout([
      [1, 2, 3]
   ], {
      [1]: {
         name: "Past",
         description: "This card represents your past leading up to this moment."
      },
      [2]: {
         name: "Present",
         description: "This card represents you in the present."
      },
      [3]: {
         name: "Future",
         description: "This card represents a future encounter."
      }
   })),
   new Spread("horseshoe", new SpreadLayout([
      [0, 0, 3, 0, 0],
      [0, 2, 0, 4, 0],
      [1, 0, 0, 0, 5],
   ], {
      [1]: {
         name: "You in the Present",
         description: "This card represents you in your present position. That which is the here and now as a culmination of all that has led you to this point."
      },
      [2]: {
         name: "Expectations",
         description: "This card represents your present expectations; that which you believe is in your present or future. Your current and future outlook."
      },
      [3]: {
         name: "The Unexpected",
         description: "This card represents the unexpected. That which is hidden from you, but may come to pass."
      },
      [4]: {
         name: "Coming Soon",
         description: "This card represents your immediate future; those persons, ideas or circumstances which lie just out of reach, but are approaching and will be arriving shortly."
      },
      [5]: {
         name: "The Future",
         description: "This card represents your long-term future."
      }
   }), 5, 2), 
   new Spread("star", new SpreadLayout([
      [0, 7, 0],
      [6, 0, 5],
      [0, 4, 0],
      [3, 0, 2],
      [0, 1, 0],
   ], {
      [1]: {
         name: "Self [Root]",
         description: "This card represents you in your present position; the root of the matter."
      },
      [2]: {
         name: "Feelings",
         description: "This card represents your feelings, emotions and relationships, as they have a direct bearing on the root of the matter."
      },
      [3]: {
         name: "Mind/Status",
         description: "This card represents your mind, thoughts, and concerns of career or social standing, as relates to the root of the matter"
      },
      [4]: {
         name: "Heart",
         description: "This card represents the central force that plays upon your concerns; the heart of the matter."
      }, 
      [5]: {
         name: "Surfacing",
         description: "This card represents that which is surfacing and soon to be come known; your near-future."
      },
      [6]: {
         name: "Desires",
         description: "This card represnts your desires and wants/needs."
      },
      [7]: {
         name: "Outcome",
         description: "This card represents the final outcome; the top of the matter."
      }
   }), 3, 4)
];

const Decks = {
   default: new Deck(TAROT_DIR)
};


const getTarotHand = (spread: string = "standard", deck: Deck = Decks.default): Promise<{ image: Buffer, explanation: Explanations }> => {
   let chosenSpread: Spread | undefined = Spreads.find(item => item.name === spread);
   if (!chosenSpread) return Promise.reject("Spread not found");
   return Promise.resolve(chosenSpread.getReading(deck));
}
const saveHandImage = async (
   filename: string = join(TAROT_DIR, "saved-image.png")
) => {
   try {
      const hand: { image: Buffer, explanation: Explanations } = await getTarotHand();
      writeFileSync(filename, hand.image);
   } catch (e) {
      // TODO: cleaner error handling
      throw e;
   }
};

export { saveHandImage, getTarotHand };
