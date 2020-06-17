"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTarotHand = exports.saveHandImage = void 0;
const canvas_1 = __importDefault(require("canvas"));
const fs_1 = require("fs");
const path_1 = require("path");
const config_1 = require("../config");
const TAROT_DIR = config_1.checkFilePath("data", "rider-waite/");
class SpreadLayout {
    constructor(data, details) {
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
            if (!hasDetails)
                this.details = undefined;
        }
        //console.log(`Created spread layout: ${this.data}`);
    }
    getCardCount() {
        return this.data.flatMap(value => value).filter(value => value > 0).length;
    }
    getPosition(cardNumber) {
        //console.log(`Searching [${this.cols} x ${this.rows}] spread layout for card number ${cardNumber}`);
        //console.log(this.data);
        if (cardNumber <= 0)
            return { x: -1, y: -1 };
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.data[row][col] === cardNumber)
                    return { x: col, y: row };
            }
        }
        return { x: -1, y: -1 };
    }
}
class Deck {
    constructor(imageFolder = TAROT_DIR) {
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
    async loadCards(imageFolder = TAROT_DIR) {
        var _a, _b;
        let files = [];
        const results = [];
        files = fs_1.readdirSync(imageFolder).filter((file) => path_1.extname(file).match(/png|jpe?g|webp|gif|tiff?|svg/i));
        if (!files || files.length === 0)
            return Promise.reject(`No image files were found in folder '${imageFolder}'`);
        for (let file of files) {
            const image = await canvas_1.default.loadImage(path_1.join(imageFolder, file));
            const card = {
                dimensions: {
                    width: (_a = image.naturalWidth) !== null && _a !== void 0 ? _a : 0,
                    height: (_b = image.naturalHeight) !== null && _b !== void 0 ? _b : 0,
                },
                orientation: "normal",
                filename: file,
                image: image,
            };
            results.push(card);
            //console.log(`Loaded card ${file}`);
        }
        return Promise.resolve(results);
    }
    ;
    getMaxCardSize(maxWidth, maxHeight) {
        if (this.cards.length === 0)
            return { cardWidth: 0, cardHeight: 0 };
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
    }
    ;
}
class Hand {
    constructor(deck, spread) {
        this.cards = [];
        this.spread = spread;
        this.deck = deck;
        const layout = spread.layout;
        const numCards = layout.data.flatMap(value => value).filter(value => value > 0).length;
        this.cards = this.pullCards(numCards, this.deck);
        if (this.cards.length === 0)
            throw new Error("No cards were pulled");
    }
    pullCards(numCards, deck) {
        const cards = [];
        const readingLength = Math.min(deck.cards.length, numCards);
        // Get the card data and store it as a hand
        for (let cardCount = 0; cardCount < readingLength; ++cardCount) {
            const [pulledCard] = deck.cards.splice(Math.floor(Math.random() * deck.cards.length), 1);
            if (Math.random() < 0.5)
                pulledCard.orientation = "reversed";
            cards.push(pulledCard);
        }
        return cards;
    }
}
class Spread {
    constructor(name, layout, forceCols, forceRows) {
        this.name = name;
        this.layout = layout;
        this.rows = Math.max(1, forceRows !== null && forceRows !== void 0 ? forceRows : layout.rows);
        this.cols = Math.max(1, forceCols !== null && forceCols !== void 0 ? forceCols : layout.cols);
    }
    getDimensions(deck) {
        let pixelWidth = this.layout.cols * deck.cardWidth;
        let pixelHeight = this.layout.rows * deck.cardHeight + this.getTextHeight(deck);
        return { pixelWidth: pixelWidth, pixelHeight: pixelHeight };
    }
    getTextHeight(deck) {
        if (this.layout.details) {
            const cardSize = deck.getMaxCardSize();
            return Math.round(Math.pow(cardSize.cardWidth, 1 / Math.PI * 2));
        }
        else {
            return 0;
        }
    }
    getXYPositionOfCard(hand, cardNumber) {
        if (cardNumber <= 0 || cardNumber > hand.cards.length || !hand.cards[cardNumber - 1])
            return { x: -1, y: -1 };
        // Go through the cards picked up and find where each one belong in the final layout
        let { x, y } = this.layout.getPosition(cardNumber);
        let numCards = this.layout.getCardCount();
        if (numCards <= 1)
            return { x: 0, y: 0 };
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
    async getReading(deck = new Deck(TAROT_DIR)) {
        const hand = new Hand(deck, this);
        const dims = this.getDimensions(hand.deck);
        // Create canvas and context
        const canvas = canvas_1.default.createCanvas(dims.pixelWidth, dims.pixelHeight);
        const context = canvas.getContext("2d");
        const textHeight = this.getTextHeight(deck);
        // const metrics = context.measureText("A Regular Phrase");
        // textHeight = Math.abs(metrics.actualBoundingBoxAscent) + Math.abs(metrics.actualBoundingBoxDescent);
        const paintCard = (context, card, x, y, width, height, angle, cardNumber) => {
            let xCenter = width / 2, yCenter = height / 2;
            context.font = `${textHeight}px bold sans-serif`;
            context.textAlign = "left";
            context.textBaseline = "bottom";
            context.fillStyle = "white";
            context.shadowColor = "black";
            context.shadowBlur = 5;
            let scaleWidth = false;
            const positionName = this.layout.details ? `${cardNumber}) ${this.layout.details[cardNumber].name}` : "";
            const textWidth = this.layout.details ? context.measureText(positionName).width : 0;
            if (textWidth > width)
                scaleWidth = true;
            const horizontalCenter = scaleWidth ? 0 : ((width / 2) - (textWidth / 2));
            const textXOffset = scaleWidth ? 0 : horizontalCenter;
            if (scaleWidth)
                context.font = `${Math.round(Math.pow(width, 1 / Math.PI * 2))}px bold sans-serif`;
            //console.log(`Text width: ${textWidth}; Card width: ${width}; Text offset: ${textXOffset}; Center: ${horizontalCenter}`);
            context.save();
            if (angle % 360 !== 0) {
                //console.log(`Rotating image ${angle} degrees around point (${xCenter}, ${yCenter}), drawing at: ${x}, ${y}`);
                context.translate(x + xCenter, y + yCenter);
                context.rotate(Math.PI / 180 * angle);
                context.drawImage(card.image, -xCenter, -yCenter, width, height);
            }
            else {
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
        };
        //console.log(`Spread width: ${dims.pixelWidth}; height: ${dims.pixelHeight}`);
        //console.log(`Card width: ${deck.cardWidth}; height: ${deck.cardHeight}`);
        let actualWidth = 0;
        let actualHeight = 0;
        for (let card = 0; card < hand.cards.length; card++) {
            let { x, y } = this.getXYPositionOfCard(hand, card + 1);
            if (x + deck.cardWidth > actualWidth)
                actualWidth = x + deck.cardWidth;
            if (y + deck.cardHeight > actualHeight)
                actualHeight = y + deck.cardHeight;
            if (hand.cards[card].orientation === "reversed") {
                //console.log(`Drawing reversed card #${card + 1} at: ${x}, ${y}`);
                paintCard(context, hand.cards[card], x, y, deck.cardWidth, deck.cardHeight, 180, card + 1);
            }
            else {
                //console.log(`Drawing card #${card + 1} at: ${x}, ${y}`);
                paintCard(context, hand.cards[card], x, y, deck.cardWidth, deck.cardHeight, 0, card + 1);
            }
        }
        if (this.layout.details)
            actualHeight += textHeight;
        const maxHeight = 1200;
        const scaleFactor = (actualHeight > maxHeight) ? maxHeight / actualHeight : 1;
        //context.scale(scaleFactor, scaleFactor);
        const finalWidth = actualWidth * scaleFactor;
        const finalHeight = actualHeight * scaleFactor;
        //console.log(`Original size: ${dims.pixelWidth} x ${dims.pixelHeight}`);      
        //console.log(`Actual size: ${actualWidth} x ${actualHeight}`);
        //console.log(`Final size: ${finalWidth} x ${finalHeight}`);
        const finalCanvas = canvas_1.default.createCanvas(finalWidth, finalHeight);
        const finalContext = finalCanvas.getContext("2d");
        finalContext.drawImage(canvas, 0, 0, actualWidth, actualHeight, 0, 0, finalWidth, finalHeight);
        return Promise.resolve(finalCanvas.toBuffer());
    }
    ;
}
const Spreads = [
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
const getTarotHand = (spread = "standard", deck = Decks.default) => {
    let chosenSpread = Spreads.find(item => item.name === spread);
    if (!chosenSpread)
        return Promise.reject("Spread not found");
    return Promise.resolve(chosenSpread.getReading(deck));
};
exports.getTarotHand = getTarotHand;
const saveHandImage = async (filename = path_1.join(TAROT_DIR, "saved-image.png")) => {
    try {
        const image = await getTarotHand();
        fs_1.writeFileSync(filename, image);
    }
    catch (_a) {
    }
};
exports.saveHandImage = saveHandImage;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFyb3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29udHJvbGxlcnMvdGFyb3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUNHOzs7Ozs7Ozs7Ozs7OztFQWNFOzs7Ozs7QUFFTCxvREFBNEI7QUFDNUIsMkJBQWdEO0FBQ2hELCtCQUFxQztBQUNyQyxzQ0FBMEM7QUFvQzFDLE1BQU0sU0FBUyxHQUFHLHNCQUFhLENBQUMsTUFBTSxFQUFFLGNBQWMsQ0FBQyxDQUFDO0FBRXhELE1BQU0sWUFBWTtJQUNmLFlBQVksSUFBZ0IsRUFBRSxPQUE2QjtRQUV4RCxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDeEIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLEdBQUcsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQztRQUV0SCxJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFNUQsSUFBSSxPQUFPLEdBQUcsSUFBSSxLQUFLLEVBQUUsQ0FBQztRQUMxQixLQUFLLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRTtZQUN2QyxJQUFJLE9BQU8sR0FBRyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNDLEtB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