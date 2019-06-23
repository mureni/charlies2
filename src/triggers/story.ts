import { Message, Modifications, TriggerResult, Trigger, getDisplayName, Brain } from "../core";

const story: Trigger = {
   id: "story",
   name: "Story mode",
   description: "Tells a story about a topic. Text in < > are optional, text in [] can be changed.",
   usage: "tell <me/[person]/yourself> a<nother> <long> story <about [topic]>",
   command: /tell (?<person>.+)? ?(?:a(?:nother)?) (?<long>long)? ?story(?: about (?<topic>.+))?/ui,
   action: (context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: Modifications.ProcessSwaps, directedTo: undefined };
      if (matches.length === 0 || !matches.groups) return output;
      const storyLength = (3 + Math.floor(Math.random() * 5)) * (matches.groups.long !== undefined ? 3 : 1);
      const directedTo = (matches.groups.person || "").trim();
      let seed = (matches.groups.topic || "").trim();
      const story: Set<string> = new Set<string>();
      let topic = seed;

      while (story.size < storyLength) {
         topic = Brain.getSeed(topic);
         let line = Brain.getResponse(topic).trim();         
         if (story.has(line)) seed = Brain.getSeed();
         story.add(line);
         topic = seed !== "" ? seed : line;
      }
      
      for (let line of story.values()) {
         if (/yourself/iu.test(directedTo)) {
            line = `*${line}*`;
         } else if (/me/iu.test(directedTo)) {
            output.directedTo = getDisplayName(context.member);
         } else if (directedTo !== "") {
            output.directedTo = directedTo;
         }
         output.results.push(line);
      }
      return output;         
   }
}

const triggers = [ story ];
export { triggers }