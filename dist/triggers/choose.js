"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggers = void 0;
const core_1 = require("../core");
const choose = {
    id: "choose",
    name: "Choose an option",
    description: "Choose an option from a list of possibilities, with commentary on the choice",
    usage: "choose [option 1] or [option 2]< or [option 3], etc.> ",
    command: /^choose (?:(.+) or (.+))+$/ui,
    action: (context, matches) => {
        const output = { results: [], modifications: core_1.Modifications.ProcessSwaps, directedTo: undefined };
        const options = matches[0].replace(/^choose\s+/iu, '').split(/\s+or\s+/gui);
        const selectedOption = options[Math.floor(Math.random() * options.length)];
        output.directedTo = core_1.getDisplayName(context.member);
        output.results = [`${selectedOption}, because: ${core_1.Brain.getResponse(core_1.Brain.getSeed(selectedOption))}`];
        return output;
    }
};
const triggers = [choose];
exports.triggers = triggers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hvb3NlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3RyaWdnZXJzL2Nob29zZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxrQ0FBZ0c7QUFFaEcsTUFBTSxNQUFNLEdBQVk7SUFDckIsRUFBRSxFQUFFLFFBQVE7SUFDWixJQUFJLEVBQUUsa0JBQWtCO0lBQ3hCLFdBQVcsRUFBRSw4RUFBOEU7SUFDM0YsS0FBSyxFQUFFLHdEQUF3RDtJQUMvRCxPQUFPLEVBQUUsOEJBQThCO0lBQ3ZDLE1BQU0sRUFBRSxDQUFDLE9BQWdCLEVBQUUsT0FBeUIsRUFBRSxFQUFFO1FBQ3JELE1BQU0sTUFBTSxHQUFrQixFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsYUFBYSxFQUFFLG9CQUFhLENBQUMsWUFBWSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsQ0FBQztRQUVoSCxNQUFNLE9BQU8sR0FBYSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGNBQWMsRUFBRSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDdEYsTUFBTSxjQUFjLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBRTNFLE1BQU0sQ0FBQyxVQUFVLEdBQUcscUJBQWMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbkQsTUFBTSxDQUFDLE9BQU8sR0FBRyxDQUFDLEdBQUcsY0FBYyxjQUFjLFlBQUssQ0FBQyxXQUFXLENBQUMsWUFBSyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNyRyxPQUFPLE1BQU0sQ0FBQztJQUNqQixDQUFDO0NBQ0gsQ0FBQTtBQUNELE1BQU0sUUFBUSxHQUFHLENBQUUsTUFBTSxDQUFFLENBQUM7QUFDbkIsNEJBQVEifQ==