"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggers = void 0;
const core_1 = require("../core");
const story = {
    id: "story",
    name: "Story mode",
    description: "Tells a story about a topic. Text in < > are optional, text in [] can be changed.",
    usage: "tell <me/[person]/yourself> a<nother> <long> story <about [topic]>",
    command: /tell (?<person>.+)? ?(?:a(?:nother)?) (?<long>long)? ?story(?: about (?<topic>.+))?/ui,
    action: (context, matches = []) => {
        const output = { results: [], modifications: core_1.Modifications.ProcessSwaps, directedTo: undefined };
        if (matches.length === 0 || !matches.groups)
            return output;
        const storyLength = (3 + Math.floor(Math.random() * 5)) * (matches.groups.long !== undefined ? 3 : 1);
        const directedTo = (matches.groups.person || "").trim();
        let seed = (matches.groups.topic || "").trim();
        const story = new Set();
        let topic = seed;
        while (story.size < storyLength) {
            topic = core_1.Brain.getSeed(topic);
            let line = core_1.Brain.getResponse(topic).trim();
            if (story.has(line))
                seed = core_1.Brain.getSeed();
            story.add(line);
            topic = seed !== "" ? seed : line;
        }
        for (let line of story.values()) {
            if (/yourself/iu.test(directedTo)) {
                line = `*${line}*`;
            }
            else if (/me/iu.test(directedTo)) {
                output.directedTo = core_1.getDisplayName(context.member);
            }
            else if (directedTo !== "") {
                output.directedTo = directedTo;
            }
            output.results.push(line);
        }
        return output;
    }
};
const triggers = [story];
exports.triggers = triggers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdHJpZ2dlcnMvc3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsa0NBQWdHO0FBRWhHLE1BQU0sS0FBSyxHQUFZO0lBQ3BCLEVBQUUsRUFBRSxPQUFPO0lBQ1gsSUFBSSxFQUFFLFlBQVk7SUFDbEIsV0FBVyxFQUFFLG1GQUFtRjtJQUNoRyxLQUFLLEVBQUUsb0VBQW9FO0lBQzNFLE9BQU8sRUFBRSx1RkFBdUY7SUFDaEcsTUFBTSxFQUFFLENBQUMsT0FBZ0IsRUFBRSxVQUE0QixFQUFFLEVBQUUsRUFBRTtRQUMxRCxNQUFNLE1BQU0sR0FBa0IsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLGFBQWEsRUFBRSxvQkFBYSxDQUFDLFlBQVksRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLENBQUM7UUFDaEgsSUFBSSxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNO1lBQUUsT0FBTyxNQUFNLENBQUM7UUFDM0QsTUFBTSxXQUFXLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN0RyxNQUFNLFVBQVUsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3hELElBQUksSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDL0MsTUFBTSxLQUFLLEdBQWdCLElBQUksR0FBRyxFQUFVLENBQUM7UUFDN0MsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDO1FBRWpCLE9BQU8sS0FBSyxDQUFDLElBQUksR0FBRyxXQUFXLEVBQUU7WUFDOUIsS0FBSyxHQUFHLFlBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDN0IsSUFBSSxJQUFJLEdBQUcsWUFBSyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUMzQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO2dCQUFFLElBQUksR0FBRyxZQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDNUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoQixLQUFLLEdBQUcsSUFBSSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7U0FDcEM7UUFFRCxLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUUsRUFBRTtZQUM5QixJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUU7Z0JBQ2hDLElBQUksR0FBRyxJQUFJLElBQUksR0FBRyxDQUFDO2FBQ3JCO2lCQUFNLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRTtnQkFDakMsTUFBTSxDQUFDLFVBQVUsR0FBRyxxQkFBYyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQzthQUNyRDtpQkFBTSxJQUFJLFVBQVUsS0FBSyxFQUFFLEVBQUU7Z0JBQzNCLE1BQU0sQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO2FBQ2pDO1lBQ0QsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDNUI7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNqQixDQUFDO0NBQ0gsQ0FBQTtBQUVELE1BQU0sUUFBUSxHQUFHLENBQUUsS0FBSyxDQUFFLENBQUM7QUFDbEIsNEJBQVEifQ==