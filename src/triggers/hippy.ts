import { TriggerResult, Trigger } from "./";
import { Bullshit } from "../lib/bullshit";

const trigger: Trigger = {
   name: "New age bullshit",
   description: "Generates a paragraph of new age bullshit",
   usage: "!hippy",
   command: /^!hippy$/ui,
   action: () => {
      const output: TriggerResult = { results: [], caseSensitive: false, processSwaps: true, directedTo: undefined };            
      const size = 6 + Math.floor(Math.random() * 3);
      output.results = [Bullshit.generate(size)];
      return output;
   }
}

export { trigger as hippy };