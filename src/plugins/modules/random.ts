import type { CoreMessage } from "@/platform";
import type { TriggerResult } from "@/core/triggerTypes";
import type { TriggerPlugin } from "@/plugins/types";
import { env } from "@/utils";

const rollMatcher = /!r(oll)? (?<rolls>\d+)?\s*d\s*(?<sides>\d+)/ui;
const lottoMatcher = /give me (?<number>\d+) ?(?<unique>unique)? ?(?:lotto|lottery)? numbers? ?(?:between (?<low>\d+) and (?<high>\d+))?/ui;
const checkemMatcher = /checkem|dubs|trips|quads/ui;

const clamp = (n: number, low: number, high: number): number => Math.max(Math.min(high, n), low);

const rollDie = (rolls: number, sides: number): number[] => {
   const rollResults: number[] = [];
   for (let curRoll = 0; curRoll < rolls; curRoll++) {
      const result = Math.round(Math.random() * (sides - 1)) + 1;
      rollResults.push(result);
   }
   return rollResults;
};

const executeRoll = (context: CoreMessage, matches?: RegExpMatchArray): TriggerResult => {
   const output: TriggerResult = { results: [], modifications: { Case: "unchanged" } };
   if (!matches?.groups?.sides) return output;

   const sum = (values: number[]): number => values.reduce((prev, cur) => prev + cur, 0);
   const numRolls: number = clamp(Number(matches.groups.rolls ?? 1), 1, 100);
   const numSides: number = clamp(Number(matches.groups.sides), 4, 120);
   const rollResults = rollDie(numRolls, numSides);

   output.directedTo = context.authorName;
   output.results = [
      { contents: `**Result**: ${numRolls}d${numSides} (${rollResults.join(", ")})` },
      { contents: `**Total**: ${sum(rollResults)}` }
   ];
   return output;
};

const drawLotto = (howMany: number, low: number, high: number, unique: boolean = false): number[] => {
   const l = Math.min(low, high);
   const h = Math.max(low, high);
   const results: Set<number> | number[] = unique ? new Set<number>() : [];
   let size = 0;
   if (unique) howMany = Math.min(howMany, h - l + 1);
   while (size < howMany) {
      const n = Math.round(Math.random() * (h - l)) + l;
      if (results instanceof Set) {
         results.add(n);
         size = results.size;
      } else {
         results.push(n);
         size++;
      }
   }
   return Array.from(results);
};

const executeLotto = (_context: CoreMessage, matches?: RegExpMatchArray): TriggerResult => {
   const output: TriggerResult = { results: [], modifications: { Case: "unchanged" } };
   if (!matches?.groups?.number) return output;

   const howMany: number = clamp(parseInt(matches.groups.number), 0, 200);
   if (howMany <= 0) return output;

   let low = 0, high = 100;
   if (matches.groups.low !== undefined && matches.groups.high !== undefined) {
      low = clamp(parseInt(matches.groups.low), 0, 999999999);
      high = clamp(parseInt(matches.groups.high), 0, 999999999);
   }

   const unique = matches.groups.unique ? true : false;
   const numbers = drawLotto(howMany, low, high, unique);
   output.results = [
      { contents: `${unique && (howMany > Math.abs(high - low) + 1) ? "not enough unique numbers to do that, but i did my best! " : ""}providing ${numbers.length}${unique ? " unique" : ""} number${numbers.length !== 1 ? "s" : ""} between ${low} and ${high}${howMany <= numbers.length && parseInt(matches.groups.number) > howMany ? ` (cutting you off at ${howMany} numbers btw)` : ""}:` },
      { contents: numbers.join(", ") }
   ];
   return output;
};

const executeCheckem = (context: CoreMessage): TriggerResult => {
   const output: TriggerResult = { results: [], modifications: { Case: "unchanged" } };
   const isDubs = (str: string) => /(.)\1{1}$/.test(str);
   const isTrips = (str: string) => /(.)\1{2}$/.test(str);
   const isQuads = (str: string) => /(.)\1{3}$/.test(str);

   const getNumber = (): string => Math.round(Math.random() * 9999).toString();

   let result = getNumber();
   if (context.authorId === env("BOT_OWNER_DISCORD_ID")) {
      const quads = Math.random() > 0.9;
      const trips = Math.random() > 0.8;
      const dubs = Math.random() > 0.7;

      if (quads) {
         while (!isQuads(result)) result = getNumber();
      } else if (trips) {
         while (!isTrips(result)) result = getNumber();
      } else if (dubs) {
         while (!isDubs(result)) result = getNumber();
      }
   }

   if (isQuads(result)) {
      result = `***${result}***`;
   } else if (isTrips(result)) {
      result = `**${result}**`;
   } else if (isDubs(result)) {
      result = `*${result}*`;
   }

   output.results = [{ contents: result }];
   return output;
};

const rollPlugin: TriggerPlugin = {
   id: "roll",
   name: "roll",
   description: "Rolls one or more Dungeons and Dragons type multi-sided di(c)e. Minimum of 1 roll, minimum of 4 sides. Maximum of 100 rolls, maximum of 120 sides.",
   usage: "!roll [number-of-rolls] d [number-of-sides]",
   example: "!roll d20, !roll 4d24, !roll 1d6",
   icon: "icons/dnd.png",
   matcher: rollMatcher,
   execute: async (context: CoreMessage, matches?: RegExpMatchArray) => executeRoll(context, matches)
};

const lottoPlugin: TriggerPlugin = {
   id: "lotto",
   name: "lotto",
   description: "Draws up to 200 random lottery numbers. Defaults to between 1 and 100, negatives are ignored",
   usage: "give me <number> [unique] [lotto/lottery] numbers [between <low> and <high>]",
   matcher: lottoMatcher,
   execute: async (context: CoreMessage, matches?: RegExpMatchArray) => executeLotto(context, matches)
};

const checkemPlugin: TriggerPlugin = {
   id: "checkem",
   name: "checkem",
   description: "Returns a random number between 1 and 9999 to check if the chaos gods are smiling",
   usage: "checkem",
   icon: "icons/checkem.png",
   matcher: checkemMatcher,
   execute: async (context: CoreMessage) => executeCheckem(context)
};

const plugins = [rollPlugin, lottoPlugin, checkemPlugin];
export { plugins };
