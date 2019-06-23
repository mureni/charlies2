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

const triggers = [ saveBrain ];
export { triggers }