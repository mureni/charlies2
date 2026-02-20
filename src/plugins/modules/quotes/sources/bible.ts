import { readFileSync } from "fs";
import { resolve } from "path";
import type { StandardMessage } from "@/contracts";
import type { InteractionResult } from "@/core/interactionTypes";
import { resolvePluginPaths } from "@/plugins/paths";
import type { QuoteHelpers, QuoteSource } from "@/plugins/modules/quotes/types";

interface BibleVerse {
   ref: string;
   text: string;
}

interface BibleBook {
   book: string;
   verses: BibleVerse[];
}

interface BibleIndex {
   books: Map<string, { name: string; chapters: Map<number, BibleVerse[]> }>;
}

const MAX_VERSES_AT_ONCE = 5;
const bibleMatcher = /^!?bible\s+(?<book>.+?)(?:\s+(?<chapter>\d+)(?::(?<verse>\d+)(?:\s*-\s*(?<verseRange>\d+))?)?)?\s*$/ui;
const baseModifications = {
   Balance: false,
   ProcessSwaps: false,
   Case: "unchanged",
   UseEndearments: false
} as const;
const bibleFileName = "kjv.json";

let bibleIndex: BibleIndex | undefined;

const loadBibleIndex = (): BibleIndex => {
   if (bibleIndex) return bibleIndex;
   const { resourcesDir } = resolvePluginPaths("quotes");
   const filePath = resolve(resourcesDir, bibleFileName);
   const raw = readFileSync(filePath, "utf8");
   const bible = JSON.parse(raw.trim()) as BibleBook[];
   const books = new Map<string, { name: string; chapters: Map<number, BibleVerse[]> }>();
   for (const book of bible) {
      const chapters = new Map<number, BibleVerse[]>();
      for (const verse of book.verses) {
         const [chapterText] = verse.ref.split(":");
         const chapter = Number.parseInt(chapterText, 10);
         if (!chapters.has(chapter)) chapters.set(chapter, []);
         chapters.get(chapter)?.push(verse);
      }
      books.set(book.book.toLowerCase(), { name: book.book, chapters });
   }
   bibleIndex = { books };
   return bibleIndex;
};

const pickRandomFromList = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const parseQuery = (content: string): {
   book?: string;
   chapter?: number;
   verse?: number;
   verseRange?: number;
} | { error: string } => {
   const trimmed = content.trim();
   if (!/^!?bible\b/i.test(trimmed)) return { error: "invalid bible query" };
   const remainder = trimmed.replace(/^!?bible\b/i, "").trim();
   if (!remainder) return { book: undefined };

   const colonMatch = remainder.match(
      /^(?<book>.+?)\s+(?<chapter>\d+)(?::(?<verse>\d+)(?:\s*-\s*(?<verseRange>\d+))?)?\s*$/ui
   );
   if (colonMatch?.groups?.book) {
      const book = colonMatch.groups.book.trim();
      if (!book) return { error: "book is required" };
      const chapter = Number.parseInt(colonMatch.groups.chapter, 10);
      const verse = colonMatch.groups.verse ? Number.parseInt(colonMatch.groups.verse, 10) : undefined;
      const verseRange = colonMatch.groups.verseRange ? Number.parseInt(colonMatch.groups.verseRange, 10) : undefined;
      return { book, chapter, verse, verseRange };
   }

   const spaceMatch = remainder.match(
      /^(?<book>.+?)\s+(?<chapter>\d+)(?:\s+(?<verse>\d+)(?:\s+(?<verseRange>\d+))?)?\s*$/ui
   );
   if (spaceMatch?.groups?.book) {
      const book = spaceMatch.groups.book.trim();
      if (!book) return { error: "book is required" };
      const chapter = Number.parseInt(spaceMatch.groups.chapter, 10);
      const verse = spaceMatch.groups.verse ? Number.parseInt(spaceMatch.groups.verse, 10) : undefined;
      const verseRange = spaceMatch.groups.verseRange ? Number.parseInt(spaceMatch.groups.verseRange, 10) : undefined;
      return { book, chapter, verse, verseRange };
   }

   return { book: remainder };
};

const resolveBible = (
   context: StandardMessage,
   match: RegExpMatchArray | undefined,
   _helpers: QuoteHelpers
): InteractionResult => {
   const content = match?.input ?? context.content;
   const parsed = parseQuery(content);
   if ("error" in parsed) {
      return { results: [{ contents: parsed.error }], modifications: baseModifications };
   }
   const index = loadBibleIndex();
   const requestedBook = parsed.book?.trim();
   if (!requestedBook) {
      const allVerses: Array<{ bookName: string; verse: BibleVerse }> = [];
      for (const book of index.books.values()) {
         for (const verseList of book.chapters.values()) {
            for (const verseEntry of verseList) {
               allVerses.push({ bookName: book.name, verse: verseEntry });
            }
         }
      }
      if (allVerses.length === 0) {
         return { results: [{ contents: "no verses found in the bible" }], modifications: baseModifications };
      }
      const selection = pickRandomFromList(allVerses);
      return {
         results: [{ contents: `${selection.bookName} ${selection.verse.ref} - ${selection.verse.text}` }],
         modifications: baseModifications
      };
   }

   const bookKey = requestedBook.toLowerCase();
   const found = index.books.get(bookKey);
   if (!found) {
      return { results: [{ contents: "no such book was found" }], modifications: baseModifications };
   }
   const chapters = found.chapters;
   const chapter = parsed.chapter;
   const verse = parsed.verse;
   const verseRange = parsed.verseRange;

   if (!chapter) {
      const allVerses: BibleVerse[] = [];
      for (const verseList of chapters.values()) {
         allVerses.push(...verseList);
      }
      if (allVerses.length === 0) {
         return { results: [{ contents: "no verses found in that book" }], modifications: baseModifications };
      }
      const selection = pickRandomFromList(allVerses);
      return {
         results: [{ contents: `${found.name} ${selection.ref} - ${selection.text}` }],
         modifications: baseModifications
      };
   }

   const chapterVerses = chapters.get(chapter);
   if (!chapterVerses || chapterVerses.length === 0) {
      return { results: [{ contents: "no such chapter found in that book" }], modifications: baseModifications };
   }

   if (!verse) {
      const selection = pickRandomFromList(chapterVerses);
      return {
         results: [{ contents: `${found.name} ${selection.ref} - ${selection.text}` }],
         modifications: baseModifications
      };
   }

   const total = chapterVerses.length;
   let start = Math.max(1, Math.min(verse, total));
   let end = Math.max(1, Math.min(verseRange ?? verse, total));
   if (start > end) [start, end] = [end, start];

   const results: InteractionResult = { results: [], modifications: baseModifications };
   if (end - start + 1 > MAX_VERSES_AT_ONCE) {
      end = Math.min(start + MAX_VERSES_AT_ONCE - 1, total);
      results.results.push({ contents: `*only showing ${MAX_VERSES_AT_ONCE} verses*` });
   }

   for (let verseNumber = start; verseNumber <= end; verseNumber += 1) {
      const verseEntry = chapterVerses.find(entry => entry.ref === `${chapter}:${verseNumber}`);
      if (!verseEntry) continue;
      results.results.push({ contents: `${found.name} ${verseEntry.ref} - ${verseEntry.text}` });
   }

   if (results.results.length === 0) {
      results.results.push({ contents: "no such chapter/verse combo found in that book" });
   }

   return results;
};

const bibleSource: QuoteSource = {
   id: "bible",
   name: "Bible verse",
   description: "Retrieve a KJV Bible verse.",
   matcher: bibleMatcher,
   icon: "plugins/quotes/bible-verse.png",
   command: {
      name: "bible",
      description: "Retrieve a KJV Bible verse.",
      options: [
         { name: "book", description: "Book name", type: "string", required: true },
         { name: "chapter", description: "Chapter number", type: "number", required: false },
         { name: "verse", description: "Verse number", type: "number", required: false },
         { name: "range", description: "Verse range end", type: "number", required: false }
      ],
      usage: "!bible [book] [chapter]:[verse[-range]]",
      example: "!bible genesis 1:3-5",
      fallbackMatcher: bibleMatcher,
      icon: "plugins/quotes/bible-verse.png"
   },
   resolveQuote: resolveBible
};

const sources = [bibleSource];
export { sources };
