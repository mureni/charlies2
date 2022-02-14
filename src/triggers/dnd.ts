import { Message, TriggerResult, Trigger, getDisplayName } from "../core";

const roll: Trigger = {
   id: "roll",
   name: "roll",
   description: "Rolls one or more Dungeons and Dragons type multi-sided di(c)e. Minimum of 1 roll, minimum of 4 sides. Maximum of 100 rolls, maximum of 120 sides.",
   usage: "!roll [number-of-rolls] d [number-of-sides]",
   example: "!roll d20, !roll 4d24, !roll 1d6",
   icon: "dnd.png",
   command: /!r(oll)? (?<rolls>\d+)?\s*d\s*(?<sides>\d+)/ui,
   action: async (context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: { Case: 'unchanged' } };
      if (matches.length === 0 || !matches.groups || matches.groups.sides === undefined) return output;
      
      const clamp = (n: number, low: number, high: number): number => Math.max(Math.min(high, n), low);
      const sum = (values: Array<number>): number => values.reduce((prev, cur) => prev + cur, 0);
      const numRolls: number = clamp(Number(matches.groups.rolls ?? 1), 1, 100);
      const numSides: number = clamp(Number(matches.groups.sides), 4, 120);
      
      const rollDie = (rolls: number, sides: number): Array<number> => {        
        const rollResults = [];        
        for (let curRoll = 0; curRoll < rolls; curRoll++) {
            const result = Math.round(Math.random() * (sides - 1)) + 1;            
            rollResults.push(result);
         }
         return rollResults;
      }
      
      const rollResults = rollDie(numRolls, numSides);

      output.directedTo = await getDisplayName(context.author);
      output.results = [          
         { contents: `**Result**: ${numRolls}d${numSides} (${rollResults.join(", ")})` },
         { contents: `**Total**: ${sum(rollResults)}` }
      ];
      return output;
   }
}

const triggers = [ roll ];
export { triggers };
