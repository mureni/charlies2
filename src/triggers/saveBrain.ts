import { Modifications, TriggerResult, Trigger, Brain } from "../core";

const saveBrain: Trigger = { 
   id: "save-brain",
   name: "Save brain",
   description: "Saves chatbot brain",
   usage: "save-brain",
   command: /^save-brain$/ui,
   ownerOnly: true,
   action: () => {
      const output: TriggerResult = { results: [], modifications: Modifications.AsIs };
      const saveResults: boolean | Error = Brain.save();      
      output.results = (saveResults instanceof Error) ? ["can't save brain, check error log for details"] : ["brain saved"];
      return output;
   }
}

const enableBotLearning: Trigger = { 
   id: "enable-bot-learning",
   name: "Enable bot learning",
   description: "Allows learning from other bots",
   usage: "enable-bot-learning",
   command: /^enable-bot-learning$/ui,
   ownerOnly: true,
   action: () => {
      const output: TriggerResult = { results: [], modifications: Modifications.AsIs };
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
      const output: TriggerResult = { results: [], modifications: Modifications.AsIs };
      Brain.settings.learnFromBots = false;
      output.results = ["bot learning disabled"];
      return output;
   }
}

const triggers = [ saveBrain, disableBotLearning, enableBotLearning ];
export { triggers }