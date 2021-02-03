import { TriggerResult, Trigger } from "../core";
import { checkFilePath } from "../config";
import { readFileSync } from "fs";

type Bible = [ {
   abbrev: string,
   chapters: [
      string[],
   ],
   name: string
} ];

const file = checkFilePath("resources", "bible_kjv.json", false);
// TODO: Error handling if the file doesn't exist
const data: string = readFileSync(file, "utf8");
const json = JSON.parse(data.trim()) as Bible;

const allWords: string[] = [];

// Load words from resource file
json.map(book => {
   book.chapters.map(chapter => {
      chapter.map(verse => {
         allWords.push(...verse.split(" "));
      })
   });
});

const pray: Trigger = {
   id: "pray",
   name: "Pray - Talk to God",
   description: "Sends your thoughts to God and retrieves a message in return (orig. by Terry Davis)",
   usage: "pray or !pray",
   command: /^!?pray/ui,   
   action: () => {
      const output: TriggerResult = { results: [], modifications: { ProcessSwaps: true }, directedTo: undefined };            
      const numWords = 20 + Math.floor(Math.random() * 30);
      const response: string[] = ["God says..."];
      for (let wordCount = 0; wordCount <= numWords; wordCount++) {
         let wordNumber = Math.floor(Math.random() * allWords.length);
         response.push(allWords[wordNumber]);
      }
      
      output.results = [response.join(" ")];
      return output;
   }
}

const triggers = [ pray ];
export { triggers };