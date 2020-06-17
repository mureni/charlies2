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
const triggers = [saveBrain, disableBotLearning, enableBotLearning];
exports.triggers = triggers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2F2ZUJyYWluLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3RyaWdnZXJzL3NhdmVCcmFpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxrQ0FBdUU7QUFFdkUsTUFBTSxTQUFTLEdBQVk7SUFDeEIsRUFBRSxFQUFFLFlBQVk7SUFDaEIsSUFBSSxFQUFFLFlBQVk7SUFDbEIsV0FBVyxFQUFFLHFCQUFxQjtJQUNsQyxLQUFLLEVBQUUsWUFBWTtJQUNuQixPQUFPLEVBQUUsZ0JBQWdCO0lBQ3pCLFNBQVMsRUFBRSxJQUFJO0lBQ2YsTUFBTSxFQUFFLEdBQUcsRUFBRTtRQUNWLE1BQU0sTUFBTSxHQUFrQixFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsYUFBYSxFQUFFLG9CQUFhLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDakYsTUFBTSxXQUFXLEdBQW9CLFlBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNsRCxNQUFNLENBQUMsT0FBTyxHQUFHLENBQUMsV0FBVyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLCtDQUErQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDdEgsT0FBTyxNQUFNLENBQUM7SUFDakIsQ0FBQztDQUNILENBQUE7QUFFRCxNQUFNLGlCQUFpQixHQUFZO0lBQ2hDLEVBQUUsRUFBRSxxQkFBcUI7SUFDekIsSUFBSSxFQUFFLHFCQUFxQjtJQUMzQixXQUFXLEVBQUUsaUNBQWlDO0lBQzlDLEtBQUssRUFBRSxxQkFBcUI7SUFDNUIsT0FBTyxFQUFFLHlCQUF5QjtJQUNsQyxTQUFTLEVBQUUsSUFBSTtJQUNmLE1BQU0sRUFBRSxHQUFHLEVBQUU7UUFDVixNQUFNLE1BQU0sR0FBa0IsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLGFBQWEsRUFBRSxvQkFBYSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2pGLFlBQUssQ0FBQyxRQUFRLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztRQUNwQyxNQUFNLENBQUMsT0FBTyxHQUFHLENBQUMsc0JBQXNCLENBQUMsQ0FBQztRQUMxQyxPQUFPLE1BQU0sQ0FBQztJQUNqQixDQUFDO0NBQ0gsQ0FBQTtBQUlELE1BQU0sa0JBQWtCLEdBQVk7SUFDakMsRUFBRSxFQUFFLHNCQUFzQjtJQUMxQixJQUFJLEVBQUUsc0JBQXNCO0lBQzVCLFdBQVcsRUFBRSxtQ0FBbUM7SUFDaEQsS0FBSyxFQUFFLHNCQUFzQjtJQUM3QixPQUFPLEVBQUUsMEJBQTBCO0lBQ25DLFNBQVMsRUFBRSxJQUFJO0lBQ2YsTUFBTSxFQUFFLEdBQUcsRUFBRTtRQUNWLE1BQU0sTUFBTSxHQUFrQixFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsYUFBYSxFQUFFLG9CQUFhLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDakYsWUFBSyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEdBQUcsS0FBSyxDQUFDO1FBQ3JDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBQzNDLE9BQU8sTUFBTSxDQUFDO0lBQ2pCLENBQUM7Q0FDSCxDQUFBO0FBRUQsTUFBTSxRQUFRLEdBQUcsQ0FBRSxTQUFTLEVBQUUsa0JBQWtCLEVBQUUsaUJBQWlCLENBQUUsQ0FBQztBQUM3RCw0QkFBUSJ9