import { Message } from "discord.js";
import { TriggerResult, Trigger } from "./";
import { getUser } from "../lib/user";
import { Brain } from "../lib/brain";

const story: Trigger = {
   name: "Story mode",
   description: "Tells a story about a topic",
   usage: "tell [me/<person>/yourself] a[nother] [long] story [about <topic>]",
   command: /tell (?<person>.+)? ?(?:a(?:nother)?) (?<long>long)? ?story(?: about (?<topic>.+))?/ui,
   action: (context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], caseSensitive: false, processSwaps: true, directedTo: undefined };
      if (matches.length === 0 || !matches.groups) return output;
      const storyLength = 3 + Math.floor(Math.random() * 3) * (matches.groups.long ? 3 : 1);
      const directedTo = (matches.groups.person || "").trim();
      const seed = (matches.groups.topic || "").trim();
      const story: Set<string> = new Set<string>();
      let topic = seed;

      for (let lineCounter = 0; lineCounter <= storyLength; lineCounter++) {
         topic = Brain.getSeed(topic);
         let line = Brain.getResponse(topic).trim();         
         story.add(line);
         topic = seed !== "" ? seed : line;
      }
      
      for (let line of story.values()) {
         if (/yourself/iu.test(directedTo)) {
            line = `*${line}*`;
         } else if (/me/iu.test(directedTo)) {
            output.directedTo = getUser(context.member);
         } else if (directedTo !== "") {
            output.directedTo = directedTo;
         }
         output.results.push(line);
      }
      return output;         
   }
}

export { story }