import { Message, TriggerResult, Trigger, getDisplayName, Brain } from "../core";

const story: Trigger = {
   id: "story",
   name: "Story mode",
   description: "Tells a story about a topic. Text in < > are optional, text in [] can be changed.",
   usage: "tell <me/[person]/yourself> a<nother> <long> story <about [topic]>",
   command: /tell (?<person>.+)? ?(?:a(?:nother)?) (?<long>long)? ?story(?: about (?<topic>.+))?/ui,
   action: async (context: Message, matches?: RegExpMatchArray) => {
      const output: TriggerResult = { results: [], modifications: { ProcessSwaps: true }, directedTo: undefined };
      if (!matches || matches.length === 0 || !matches.groups) return output;
      const storyLength = (3 + Math.floor(Math.random() * 5)) * (matches.groups.long !== undefined ? 3 : 1);
      const directedTo = (matches.groups.person || "").trim();
      let seed = (matches.groups.topic || "").trim();
      const story: Set<string> = new Set<string>();
      let topic = seed;

      while (story.size < storyLength) {
         topic = await Brain.getSeed(topic);
         const line = await Brain.getResponse(topic);
         if (story.has(line)) seed = await Brain.getSeed();
         story.add(line);
         topic = seed !== "" ? seed : line;
      }
      const lines: string[] = [];      
      for (let line of story.values()) {
         if (/yourself/iu.test(directedTo)) {
            line = `*${line.trim()}*`;
         } else if (/me/iu.test(directedTo)) {
            output.directedTo = await getDisplayName(context.author);
         } else if (directedTo !== "") {
            output.directedTo = directedTo;
         }
         lines.push(line);
      }
      output.results = [ { contents: lines.join("\n") }];
      return output;
   }
}

const triggers = [ story ];
export { triggers }
