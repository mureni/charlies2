"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggers = void 0;
const discord_js_1 = require("discord.js");
const core_1 = require("../core");
const controllers_1 = require("../controllers");
const tarot = {
    id: "tarot",
    name: "Tarot",
    description: "Draws a tarot hand",
    usage: "tarot",
    command: /^tarot ?(?<spread>.+)?$/ui,
    action: (context, matches = []) => {
        var _a, _b;
        const output = { results: [], modifications: core_1.Modifications.AsIs, directedTo: undefined };
        const spread = (_b = (_a = matches.groups) === null || _a === void 0 ? void 0 : _a.spread) !== null && _b !== void 0 ? _b : "standard";
        try {
            controllers_1.getTarotHand(spread).then(image => {
                const tarot = new discord_js_1.Attachment(image);
                context.channel.send(tarot);
                output.results = [];
            }).catch(reason => {
                output.results = [reason];
            });
        }
        catch (_c) {
            output.results = ["can't do that right now"];
        }
        return output;
    }
};
const triggers = [tarot];
exports.triggers = triggers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFyb3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdHJpZ2dlcnMvdGFyb3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsMkNBQXdDO0FBQ3hDLGtDQUF5RTtBQUN6RSxnREFBOEM7QUFFOUMsTUFBTSxLQUFLLEdBQVk7SUFDcEIsRUFBRSxFQUFFLE9BQU87SUFDWCxJQUFJLEVBQUUsT0FBTztJQUNiLFdBQVcsRUFBRSxvQkFBb0I7SUFDakMsS0FBSyxFQUFFLE9BQU87SUFDZCxPQUFPLEVBQUUsMkJBQTJCO0lBQ3BDLE1BQU0sRUFBRSxDQUFDLE9BQWdCLEVBQUUsVUFBNEIsRUFBRSxFQUFFLEVBQUU7O1FBQzFELE1BQU0sTUFBTSxHQUFrQixFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsYUFBYSxFQUFFLG9CQUFhLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsQ0FBQztRQUN4RyxNQUFNLE1BQU0sZUFBRyxPQUFPLENBQUMsTUFBTSwwQ0FBRSxNQUFNLG1DQUFJLFVBQVUsQ0FBQztRQUNwRCxJQUFJO1lBQ0QsMEJBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUU7Z0JBQy9CLE1BQU0sS0FBSyxHQUFHLElBQUksdUJBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDcEMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzVCLE1BQU0sQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1lBQ3ZCLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDZixNQUFNLENBQUMsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDN0IsQ0FBQyxDQUFDLENBQUM7U0FDTDtRQUFDLFdBQU07WUFDTCxNQUFNLENBQUMsT0FBTyxHQUFHLENBQUMseUJBQXlCLENBQUMsQ0FBQztTQUMvQztRQUVELE9BQU8sTUFBTSxDQUFDO0lBQ2pCLENBQUM7Q0FDSCxDQUFBO0FBRUQsTUFBTSxRQUFRLEdBQUcsQ0FBRSxLQUFLLENBQUUsQ0FBQztBQUVsQiw0QkFBUSJ9