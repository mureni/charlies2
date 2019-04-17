import { TriggerResult, Trigger } from "./";
import { Brain } from "../lib/brain";

const trigger: Trigger = { 
   name: "Save brain",
   description: "Saves chatbot brain",
   usage: "!save-brain",
   command: /^!save-brain$/ui,
   ownerOnly: true,
   action: () => {
      const output: TriggerResult = { results: [], caseSensitive: false, processSwaps: false };
      const saveResults: boolean | Error = Brain.save();      
      output.results = (saveResults instanceof Error) ? ["can't save brain, check error log for details"] : ["brain saved"];
      return output;
   }
}
export { trigger as saveBrain }