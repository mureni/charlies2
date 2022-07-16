
import { TriggerResult, Trigger, Message, getDisplayName } from "../core/index";
import { Joke } from "../controllers/jokes";

const joke: Trigger = {
   id: "joke",
   name: "joke",
   description: "jokes",
   usage: "tell <me/[person]/yourself> a<nother> joke <about [topic]>",
   command: /tell (?<person>.+)? ?(?:a(?:nother)?) ?joke(?: about (?<topic>.+))?/ui,
   icon: "joke.png",
   action: async (context: Message, matches: RegExpMatchArray = []) => {
        
        const output: TriggerResult = { results: [ { contents: "I don't know any jokes" } ],  modifications: { ProcessSwaps: true }, directedTo: undefined };

        if (matches.length === 0 || !matches.groups) return output;      
        const directedTo = (matches.groups.person ?? "").trim();
        const topic = (matches.groups.topic ?? "").trim();
        
        let line = await Joke.retrieve(topic);

        if (/yourself/iu.test(directedTo)) {
            line = `*${line.trim()}*`;
        } else if (/me/iu.test(directedTo)) {
            output.directedTo = await getDisplayName(context.author);
        } else if (directedTo !== "") {
            output.directedTo = directedTo;
        }
        output.results = [ { contents: line } ];                
    
        return output;
   }
}

const triggers = [ joke ];
export { triggers };
