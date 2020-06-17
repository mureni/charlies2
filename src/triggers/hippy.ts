import { Modifications, TriggerResult, Trigger } from "../core";
import { Bullshit } from "../controllers";

const hippy: Trigger = {
   id: "hippy",
   name: "New age bullshit",
   description: "Generates a paragraph of new age bullshit",
   usage: "hippy",
   command: /hippy|hippies/ui,
   action: () => {
      const output: TriggerResult = { results: [], modifications: Modifications.ProcessSwaps, directedTo: undefined };            
      const size = 6 + Math.floor(Math.random() * 3);
      output.results = [Bullshit.generate(size)];
      return output;
   }
}
const triggers = [ hippy ];
export { triggers };