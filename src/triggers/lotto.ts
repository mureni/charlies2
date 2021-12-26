import { Message, TriggerResult, Trigger } from "../core";
import { env } from "../utils";

const lotto: Trigger = {
   id: "lotto",
   name: "lotto",
   description: "Draws up to 200 random lottery numbers. Defaults to between 1 and 100, negatives are ignored",
   usage: "give me <number> [unique] [lotto/lottery] numbers [between <low> and <high>]",
   command: /give me (?<number>\d+) ?(?<unique>unique)? ?(?:lotto|lottery)? numbers? ?(?:between (?<low>\d+) and (?<high>\d+))?/ui,
   action: (_context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: { Case: 'unchanged' } };      
      if (matches.length === 0 || !matches.groups || matches.groups.number === undefined) return output;
      const clamp = (n: number, low: number, high: number): number => Math.max(Math.min(high, n), low);
      const howMany: number = clamp(parseInt(matches.groups.number), 0, 200);
      if (howMany <= 0) return output;
      let low = 0, high = 100;
      if (matches.groups.low !== undefined && matches.groups.high !== undefined) {
         low = clamp(parseInt(matches.groups.low), 0, 999999999);
         high = clamp(parseInt(matches.groups.high), 0, 999999999);

      }
      const drawLotto = (howMany: number, low: number, high: number, unique: boolean = false) => {
         let l = Math.min(low, high), h = Math.max(low, high);
         const results: Set<number> | Array<number> = unique ? new Set<number>() : new Array<number>();
         let size = 0;
         if (unique) howMany = Math.min(howMany, h - l + 1);
         while (size < howMany) {
            let n = (Math.round(Math.random() * (h - l)) + l);            
            if (results instanceof Set) {
               results.add(n);
               size = results.size;
            } else {
               results.push(n);
               size++;
            }            
         }
         return Array.from(results);
      }
      const unique = matches.groups.unique ? true : false;
      const numbers = drawLotto(howMany, low, high, unique);
      output.results = [
         { contents: `${unique && (howMany > Math.abs(high - low) + 1) ? 'not enough unique numbers to do that, but i did my best! ' : ''}providing ${numbers.length}${unique ? ' unique' : ''} number${numbers.length !== 1 ? 's' : ''} between ${low} and ${high}${howMany <= numbers.length && parseInt(matches.groups.number) > howMany ? ` (cutting you off at ${howMany} numbers btw)` : ''}:` },
         { contents: numbers.join(", ") }
      ];
      return output;
   }
}

const checkem: Trigger = {
   id: "checkem",
   name: "checkem",
   description: "Returns a random number between 1 and 9999 to check if the chaos gods are smiling",
   usage: "checkem",
   command: /checkem|dubs|trips|quads/ui,
   icon: "checkem.png",
   action: (context: Message) => {
      const output: TriggerResult = { results: [], modifications: { Case: 'unchanged' } };            
      const isDubs = (str: string) => /(.)\1{1}$/.test(str);
      const isTrips = (str: string) => /(.)\1{2}$/.test(str);
      const isQuads = (str: string) => /(.)\1{3}$/.test(str);
      
      const getNumber = (): string => Math.round(Math.random() * 9999).toString();
      
      let result = getNumber();
      if (context.author.id === env("BOT_OWNER_DISCORD_ID")) {
         const quads = !!(Math.random() > .9);
         const trips = !!(Math.random() > .8);
         const dubs = !!(Math.random() > .7);
         
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
   }
}


const triggers = [ lotto, checkem ];
export { triggers };
