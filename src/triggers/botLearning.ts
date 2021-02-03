import { TriggerResult, Trigger, Brain } from "../core";

const enableBotLearning: Trigger = { 
   id: "enable-bot-learning",
   name: "Enable bot learning",
   description: "Allows learning from other bots",
   usage: "enable-bot-learning",
   command: /^enable-bot-learning$/ui,
   ownerOnly: true,
   action: () => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" } };
      Brain.settings.learnFromBots = true;
      output.results = ["bot learning enabled"];
      return output;
   }
}

const disableBotLearning: Trigger = { 
   id: "disable-bot-learning",
   name: "Disable bot learning",
   description: "Prevents learning from other bots",
   usage: "disable-bot-learning",
   command: /^disable-bot-learning$/ui,
   ownerOnly: true,
   action: () => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" } };
      Brain.settings.learnFromBots = false;
      output.results = ["bot learning disabled"];
      return output;
   }
}

const triggers = [ disableBotLearning, enableBotLearning ];
export { triggers }