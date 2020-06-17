"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggers = void 0;
const core_1 = require("../core");
const saveBrain = {
    id: "save-brain",
    name: "Save brain",
    description: "Saves chatbot brain",
    usage: "save-brain",
    command: /^save-brain$/ui,
    ownerOnly: true,
    action: () => {
        const output = { results: [], modifications: core_1.Modifications.AsIs };
        const saveResults = core_1.Brain.save();
        output.results = (saveResults instanceof Error) ? ["can't save brain, check error log for details"] : ["brain saved"];
        return output;
    }
};
const reloadBrain = {
    id: "reload-brain",
    name: "Reload brain",
    description: "Reloads chatbot brain without saving first",
    usage: "reload-brain",
    command: /^reload-brain$/ui,
    ownerOnly: true,
    action: () => {
        const output = { results: [], modifications: core_1.Modifications.AsIs };
        const loadResults = core_1.Brain.load();
        output.results = (loadResults instanceof Error) ? [`error reloading brain data, check error log for details`] : ["brain reloaded"];
        return output;
    }
};
const enableBotLearning = {
    id: "enable-bot-learning",
    name: "Enable bot learning",
    description: "Allows learning from other bots",
    usage: "enable-bot-learning",
    command: /^enable-bot-learning$/ui,
    ownerOnly: true,
    action: () => {
        const output = { results: [], modifications: core_1.Modifications.AsIs };
        core_1.Brain.settings.learnFromBots = true;
        output.results = ["bot learning enabled"];
        return output;
    }
};
const disableBotLearning = {
    id: "disable-bot-learning",
    name: "Disable bot learning",
    description: "Prevents learning from other bots",
    usage: "disable-bot-learning",
    command: /^disable-bot-learning$/ui,
    ownerOnly: true,
    action: () => {
        const output = { results: [], modifications: core_1.Modifications.AsIs };
        core_1.Brain.settings.learnFromBots = false;
        output.results = ["bot learning disabled"];
        return output;
    }
};
const triggers = [saveBrain, reloadBrain, disableBotLearning, enableBotLearning];
exports.triggers = triggers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2F2ZUJyYWluLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3RyaWdnZXJzL3NhdmVCcmFpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxrQ0FBdUU7QUFFdkUsTUFBTSxTQUFTLEdBQVk7SUFDeEIsRUFBRSxFQUFFLFlBQVk7SUFDaEIsSUFBSSxFQUFFLFlBQVk7SUFDbEIsV0FBVyxFQUFFLHFCQUFxQjtJQUNsQyxLQUFLLEVBQUUsWUFBWTtJQUNuQixPQUFPLEVBQUUsZ0JBQWdCO0lBQ3pCLFNBQVMsRUFBRSxJQUFJO0lBQ2YsTUFBTSxFQUFFLEdBQUcsRUFBRTtRQUNWLE1BQU0sTUFBTSxHQUFrQixFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsYUFBYSxFQUFFLG9CQUFhLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDakYsTUFBTSxXQUFXLEdBQW9CLFlBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNsRCxNQUFNLENBQUMsT0FBTyxHQUFHLENBQUMsV0FBVyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLCtDQUErQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDdEgsT0FBTyxNQUFNLENBQUM7SUFDakIsQ0FBQztDQUNILENBQUE7QUFFRCxNQUFNLFdBQVcsR0FBWTtJQUMxQixFQUFFLEVBQUUsY0FBYztJQUNsQixJQUFJLEVBQUUsY0FBYztJQUNwQixXQUFXLEVBQUUsNENBQTRDO0lBQ3pELEtBQUssRUFBRSxjQUFjO0lBQ3JCLE9BQU8sRUFBRSxrQkFBa0I7SUFDM0IsU0FBUyxFQUFFLElBQUk7SUFDZixNQUFNLEVBQUUsR0FBRyxFQUFFO1FBQ1YsTUFBTSxNQUFNLEdBQWtCLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxhQUFhLEVBQUUsb0JBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNqRixNQUFNLFdBQVcsR0FBb0IsWUFBSyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2xELE1BQU0sQ0FBQyxPQUFPLEdBQUcsQ0FBQyxXQUFXLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMseURBQXlELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ25JLE9BQU8sTUFBTSxDQUFDO0lBQ2pCLENBQUM7Q0FDSCxDQUFBO0FBRUQsTUFBTSxpQkFBaUIsR0FBWTtJQUNoQyxFQUFFLEVBQUUscUJBQXFCO0lBQ3pCLElBQUksRUFBRSxxQkFBcUI7SUFDM0IsV0FBVyxFQUFFLGlDQUFpQztJQUM5QyxLQUFLLEVBQUUscUJBQXFCO0lBQzVCLE9BQU8sRUFBRSx5QkFBeUI7SUFDbEMsU0FBUyxFQUFFLElBQUk7SUFDZixNQUFNLEVBQUUsR0FBRyxFQUFFO1FBQ1YsTUFBTSxNQUFNLEdBQWtCLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxhQUFhLEVBQUUsb0JBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNqRixZQUFLLENBQUMsUUFBUSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUM7UUFDcEMsTUFBTSxDQUFDLE9BQU8sR0FBRyxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFDMUMsT0FBTyxNQUFNLENBQUM7SUFDakIsQ0FBQztDQUNILENBQUE7QUFJRCxNQUFNLGtCQUFrQixHQUFZO0lBQ2pDLEVBQUUsRUFBRSxzQkFBc0I7SUFDMUIsSUFBSSxFQUFFLHNCQUFzQjtJQUM1QixXQUFXLEVBQUUsbUNBQW1DO0lBQ2hELEtBQUssRUFBRSxzQkFBc0I7SUFDN0IsT0FBTyxFQUFFLDBCQUEwQjtJQUNuQyxTQUFTLEVBQUUsSUFBSTtJQUNmLE1BQU0sRUFBRSxHQUFHLEVBQUU7UUFDVixNQUFNLE1BQU0sR0FBa0IsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLGFBQWEsRUFBRSxvQkFBYSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2pGLFlBQUssQ0FBQyxRQUFRLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQztRQUNyQyxNQUFNLENBQUMsT0FBTyxHQUFHLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUMzQyxPQUFPLE1BQU0sQ0FBQztJQUNqQixDQUFDO0NBQ0gsQ0FBQTtBQUVELE1BQU0sUUFBUSxHQUFHLENBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxrQkFBa0IsRUFBRSxpQkFBaUIsQ0FBRSxDQUFDO0FBQzFFLDRCQUFRIn0=