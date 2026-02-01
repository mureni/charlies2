import type { CoreMessage } from "@/platform";
import type { TriggerResult } from "@/core/triggerTypes";
import type { TriggerPlugin } from "@/plugins/types";
import { Brain } from "@/core";

const chooseMatcher = /^choose (?:(.+) or (.+))+$/ui;

const execute = async (context: CoreMessage, matches?: RegExpMatchArray): Promise<TriggerResult> => {
   const output: TriggerResult = { results: [], modifications: { ProcessSwaps: true }, directedTo: undefined };
   if (!matches || !matches[0]) return output;

   const options: string[] = matches[0]
      .replace(/^choose\s+/iu, "")
      .split(/\s+or\s+/gui)
      .map(option => option.trim())
      .filter(Boolean);

   if (options.length === 0) return output;

   const selectedOption = options[Math.floor(Math.random() * options.length)];
   const seed = await Brain.getSeed(selectedOption);
   const response = await Brain.getResponse(seed);
   output.directedTo = context.authorName;
   output.results = [{ contents: `${selectedOption}, because: ${response}` }];
   return output;
};

const choosePlugin: TriggerPlugin = {
   id: "choose",
   name: "Choose an option",
   description: "Choose an option from a list of possibilities, with commentary on the choice",
   usage: "choose [option 1] or [option 2]< or [option 3], etc.>",
   matcher: chooseMatcher,
   execute
};

const plugins = [choosePlugin];
export { plugins };
