"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggers = void 0;
const core_1 = require("../core");
const config_1 = require("../config");
const lotto = {
    id: "lotto",
    name: "lotto",
    description: "Draws up to 200 random lottery numbers. Defaults to between 1 and 100, negatives are ignored",
    usage: "give me <number> [unique] [lotto/lottery] numbers [between <low> and <high>]",
    command: /give me (?<number>\d+) ?(?<unique>unique)? ?(?:lotto|lottery)? numbers? ?(?:between (?<low>\d+) and (?<high>\d+))?/ui,
    action: (_context, matches = []) => {
        const output = { results: [], modifications: core_1.Modifications.AsIs };
        if (matches.length === 0 || !matches.groups || matches.groups.number === undefined)
            return output;
        const clamp = (n, low, high) => Math.max(Math.min(high, n), low);
        const howMany = clamp(parseInt(matches.groups.number), 0, 200);
        if (howMany <= 0)
            return output;
        let low = 0, high = 100;
        if (matches.groups.low !== undefined && matches.groups.high !== undefined) {
            low = clamp(parseInt(matches.groups.low), 0, 999999999);
            high = clamp(parseInt(matches.groups.high), 0, 999999999);
        }
        const drawLotto = (howMany, low, high, unique = false) => {
            let l = Math.min(low, high), h = Math.max(low, high);
            const results = unique ? new Set() : new Array();
            let size = 0;
            if (unique)
                howMany = Math.min(howMany, h - l + 1);
            while (size < howMany) {
                let n = (Math.round(Math.random() * (h - l)) + l);
                if (results instanceof Set) {
                    results.add(n);
                    size = results.size;
                }
                else {
                    results.push(n);
                    size++;
                }
            }
            return Array.from(results);
        };
        const unique = matches.groups.unique ? true : false;
        const numbers = drawLotto(howMany, low, high, unique);
        output.results = [
            `${unique && (howMany > Math.abs(high - low) + 1) ? 'not enough unique numbers to do that, but i did my best! ' : ''}providing ${numbers.length}${unique ? ' unique' : ''} number${numbers.length !== 1 ? 's' : ''} between ${low} and ${high}${howMany <= numbers.length && parseInt(matches.groups.number) > howMany ? ` (cutting you off at ${howMany} numbers btw)` : ''}:`,
            numbers.join(", ")
        ];
        return output;
    }
};
const checkem = {
    id: "checkem",
    name: "checkem",
    description: "Returns a random number between 1 and 9999 to check if the chaos gods are smiling",
    usage: "checkem",
    command: /checkem|dubs|trips|quads/ui,
    action: (context) => {
        const output = { results: [], modifications: core_1.Modifications.AsIs };
        const isDubs = (str) => /(.)\1{1}$/.test(str);
        const isTrips = (str) => /(.)\1{2}$/.test(str);
        const isQuads = (str) => /(.)\1{3}$/.test(str);
        const getNumber = () => Math.round(Math.random() * 9999).toString();
        let result = getNumber();
        if (context.member.id === config_1.CONFIG.ownerID) {
            const quads = !!(Math.random() > .9);
            const trips = !!(Math.random() > .8);
            const dubs = !!(Math.random() > .7);
            if (quads) {
                while (!isQuads(result))
                    result = getNumber();
            }
            else if (trips) {
                while (!isTrips(result))
                    result = getNumber();
            }
            else if (dubs) {
                while (!isDubs(result))
                    result = getNumber();
            }
        }
        if (isQuads(result)) {
            result = `***${result}***`;
        }
        else if (isTrips(result)) {
            result = `**${result}**`;
        }
        else if (isDubs(result)) {
            result = `*${result}*`;
        }
        output.results = [result];
        return output;
    }
};
const triggers = [lotto, checkem];
exports.triggers = triggers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG90dG8uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdHJpZ2dlcnMvbG90dG8udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsa0NBQXlFO0FBQ3pFLHNDQUFtQztBQUVuQyxNQUFNLEtBQUssR0FBWTtJQUNwQixFQUFFLEVBQUUsT0FBTztJQUNYLElBQUksRUFBRSxPQUFPO0lBQ2IsV0FBVyxFQUFFLDhGQUE4RjtJQUMzRyxLQUFLLEVBQUUsOEVBQThFO0lBQ3JGLE9BQU8sRUFBRSxzSEFBc0g7SUFDL0gsTUFBTSxFQUFFLENBQUMsUUFBaUIsRUFBRSxVQUE0QixFQUFFLEVBQUUsRUFBRTtRQUMzRCxNQUFNLE1BQU0sR0FBa0IsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLGFBQWEsRUFBRSxvQkFBYSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2pGLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxLQUFLLFNBQVM7WUFBRSxPQUFPLE1BQU0sQ0FBQztRQUNsRyxNQUFNLEtBQUssR0FBRyxDQUFDLENBQVMsRUFBRSxHQUFXLEVBQUUsSUFBWSxFQUFVLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ2pHLE1BQU0sT0FBTyxHQUFXLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDdkUsSUFBSSxPQUFPLElBQUksQ0FBQztZQUFFLE9BQU8sTUFBTSxDQUFDO1FBQ2hDLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsR0FBRyxDQUFDO1FBQ3hCLElBQUksT0FBTyxDQUFDLE1BQU0sQ0FB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