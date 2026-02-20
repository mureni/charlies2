import { Brain } from "@/core";
import type { InteractionResult } from "@/core/interactionTypes";
import type { StandardMessage } from "@/contracts";
import type { InteractionPlugin } from "@/plugins/types";

const storyMatcher = /tell (?<person>.+)? ?(?:a(?:nother)?) (?<long>long)? ?story(?: about (?<topic>.+))?/ui;

const buildStory = async (seedInput: string, storyLength: number): Promise<string[]> => {
   const storyLines: string[] = [];
   const storySet = new Set<string>();
   let seed = seedInput;
   let topic = seed;
   const maxAttempts = Math.max(storyLength * 6, 12);

   for (let attempts = 0; attempts < maxAttempts && storySet.size < storyLength; attempts++) {
      topic = await Brain.getSeed(topic);
      const line = await Brain.getResponse(topic);
      if (!line) continue;
      if (storySet.has(line)) {
         seed = await Brain.getSeed();
         topic = seed !== "" ? seed : line;
         continue;
      }
      storySet.add(line);
      storyLines.push(line);
      topic = seed !== "" ? seed : line;
   }

   return storyLines;
};

const execute = async (context: StandardMessage, matches?: RegExpMatchArray): Promise<InteractionResult> => {
   const output: InteractionResult = { results: [], modifications: { ProcessSwaps: true }, directedTo: undefined };
   if (!matches?.groups) return output;

   const storyLength = (3 + Math.floor(Math.random() * 5)) * (matches.groups.long !== undefined ? 3 : 1);
   const directedRaw = (matches.groups.person ?? "").trim();
   const seed = (matches.groups.topic ?? "").trim();
   const lines = await buildStory(seed, storyLength);

   if (lines.length === 0) {
      output.results = [{ contents: "my brain is empty" }];
      return output;
   }

   let directedTo: string | undefined;
   let italicize = false;
   if (directedRaw) {
      if (/yourself/iu.test(directedRaw)) {
         italicize = true;
      } else if (/me/iu.test(directedRaw)) {
         directedTo = context.authorName;
      } else {
         directedTo = directedRaw;
      }
   }

   const rendered = italicize
      ? lines.map(line => `*${line.trim()}*`)
      : lines.map(line => line.trim());

   output.results = [{ contents: rendered.join("\n") }];
   output.directedTo = directedTo;
   return output;
};

const storyPlugin: InteractionPlugin = {
   id: "story",
   name: "Story mode",
   description: "Tells a story about a topic. Text in < > are optional, text in [] can be changed.",
   usage: "tell <me/[person]/yourself> a<nother> <long> story <about [topic]>",
   matcher: storyMatcher,
   execute
};

const plugins = [storyPlugin];
export { plugins };
