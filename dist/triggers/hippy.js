"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggers = void 0;
const core_1 = require("../core");
const controllers_1 = require("../controllers");
const hippy = {
    id: "hippy",
    name: "New age bullshit",
    description: "Generates a paragraph of new age bullshit",
    usage: "hippy",
    command: /hippy|hippies/ui,
    action: () => {
        const output = { results: [], modifications: core_1.Modifications.ProcessSwaps, directedTo: undefined };
        const size = 6 + Math.floor(Math.random() * 3);
        output.results = [controllers_1.Bullshit.generate(size)];
        return output;
    }
};
const triggers = [hippy];
exports.triggers = triggers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGlwcHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdHJpZ2dlcnMvaGlwcHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsa0NBQWdFO0FBQ2hFLGdEQUEwQztBQUUxQyxNQUFNLEtBQUssR0FBWTtJQUNwQixFQUFFLEVBQUUsT0FBTztJQUNYLElBQUksRUFBRSxrQkFBa0I7SUFDeEIsV0FBVyxFQUFFLDJDQUEyQztJQUN4RCxLQUFLLEVBQUUsT0FBTztJQUNkLE9BQU8sRUFBRSxpQkFBaUI7SUFDMUIsTUFBTSxFQUFFLEdBQUcsRUFBRTtRQUNWLE1BQU0sTUFBTSxHQUFrQixFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsYUFBYSxFQUFFLG9CQUFhLENBQUMsWUFBWSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsQ0FBQztRQUNoSCxNQUFNLElBQUksR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDL0MsTUFBTSxDQUFDLE9BQU8sR0FBRyxDQUFDLHNCQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDM0MsT0FBTyxNQUFNLENBQUM7SUFDakIsQ0FBQztDQUNILENBQUE7QUFDRCxNQUFNLFFBQVEsR0FBRyxDQUFFLEtBQUssQ0FBRSxDQUFDO0FBQ2xCLDRCQUFRIn0=