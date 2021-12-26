import { TriggerResult, Trigger } from "../core";
import { Hippy } from "../controllers";

const hippy: Trigger = {
   id: "hippy",
   name: "New age nonsense",
   description: "Generates a paragraph of new age nonsense",
   usage: "hippy",
   command: /hippy|hippies/ui,
   action: () => {
      const output: TriggerResult = { results: [], modifications: { ProcessSwaps: true }, directedTo: undefined };            
      const size = 6 + Math.floor(Math.random() * 3);
      output.results = [ { contents: Hippy.generate(size) }];
      return output;
   }
}
const triggers = [ hippy ];
export { triggers };