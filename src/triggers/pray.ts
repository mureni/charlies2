import { TriggerResult, Trigger } from "../core";
import { checkFilePath } from "../utils";
import { readFileSync } from "fs";

type Bible = [{
   book: string,
   verses: [{
      ref: string,
      text: string
   }]
}];

const file = checkFilePath("resources", "kjv.json", false);
// TODO: Error handling if the file doesn't exist
const data: string = readFileSync(file, "utf8");
const bible = JSON.parse(data.trim()) as Bible;
const allWords: string[] = [];

// Adjust as appropriate I guess
const MAX_VERSES_AT_ONCE = 5;

// Load words from resource file
bible.map(book => {      
   book.verses.map(verse => {
      let words = verse.text.split(" ");   
      allWords.push(...words);
   });
});

const pray: Trigger = {
   id: "pray",
   name: "Pray - Talk to God",
   description: "Sends your thoughts to God and retrieves a message in return (orig. by Terry Davis)",
   usage: "pray or !pray",
   command: /^!?pray/ui,   
   icon: "pray.gif",
   action: () => {
      const output: TriggerResult = { results: [], modifications: { ProcessSwaps: true }, directedTo: undefined };            
      const numWords = 20 + Math.floor(Math.random() * 30);
      const response: string[] = ["God says..."];
      for (let wordCount = 0; wordCount <= numWords; wordCount++) {
         let wordNumber = Math.floor(Math.random() * allWords.length);
         response.push(allWords[wordNumber]);
      }
      
      output.results = [{ contents: response.join(" ") }];
      return output;
   }
}


const bibleVerse: Trigger = {
   id: "bible",
   name: "Bible verse - Retrieve a Bible verse",
   description: "Given a bible verse in the form of 'Book 0:0' this will return the appropriate KJV Bible verse. You can also request a verse range such as 'Genesis 1:5-15' but to avoid spam it will only return up to 5 verses at a time.",
   usage: "!bible [book] [chapter]:[verse[-range]]",
   example: "!bible genesis 1:3-5",
   command: /^!?bible\s+(?<book>.+)\s+(?<chapter>\d+):(?<verse>\d+)\s*-?\s*(?<verseRange>\d+)?\s*$/ui,   
   icon: "bible-verse.png",
   action: async (_context, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: { Balance: false, ProcessSwaps: false, Case: "unchanged", UseEndearments: false }, directedTo: undefined };
      if (matches.length === 0 || !matches.groups) return output;
      const requestedBook = (matches.groups.book ?? "").trim().toLocaleLowerCase();
      // leaving these as integers for easier range checking. do not need to make them strings at this time since it's a fixed format.
      const requestedChapter = parseInt(matches.groups.chapter ?? "1");
      const foundBook = bible.find(books => books.book.toLocaleLowerCase() === requestedBook) ?? { book: "no such book was found", verses: [] };
      
      /* NOTE: this is the total number of verses in the whole book, not the total number per chapter. it's good enough though. */ 
      let numVerses: number = foundBook.verses.length;
      let requestedStartVerse = Math.max(1, Math.min(parseInt(matches.groups.verse ?? "1"), numVerses));
      let requestedEndVerse = Math.max(Math.min(parseInt(matches.groups.verseRange ?? requestedStartVerse.toString()), numVerses));
  
      let verseRange: [number, number];
      if (requestedStartVerse > requestedEndVerse) {
         verseRange = [requestedEndVerse, requestedStartVerse];
      } else {
         verseRange = [requestedStartVerse, requestedEndVerse];
      }

      if (verseRange[1] - verseRange[0] > MAX_VERSES_AT_ONCE) {
         numVerses = MAX_VERSES_AT_ONCE;
         output.results.push({ contents: `*only showing ${numVerses} verses*` });         
      }

      const foundVerses = foundBook.verses.filter(verse => {         
         for (let i = verseRange[0]; i <= verseRange[1] && i <= numVerses; i++) {
            if (verse.ref === `${requestedChapter}:${i}`) return true;
         }
         return false;
      });
      if (foundVerses.length === 0) foundVerses.push({ ref: "😖", text: "no such chapter/verse combo found in that book" });
      
      foundVerses.map(verse => {
         output.results.push({ contents: `${foundBook.book} ${verse.ref} - ${verse.text}` });
      });

      return output;
   }
}

const triggers = [ pray, bibleVerse ];
export { triggers };