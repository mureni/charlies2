import { TriggerResult, Trigger } from "../core";
import { Corpo } from "../controllers";

const corpo: Trigger = {
   id: "corpo",
   name: "Corporate nonsense",
   description: "Generates a paragraph of corporate nonsense",
   usage: "corpo",
   command: /\bcorpo\b/ui,
   action: () => {
      const output: TriggerResult = { results: [], modifications: { ProcessSwaps: true }, directedTo: undefined };            
      const size = 6 + Math.floor(Math.random() * 3);
      output.results = [ { contents: Corpo.generate(size) }];
      return output;
   }
}
const triggers = [ corpo ];
export { triggers };