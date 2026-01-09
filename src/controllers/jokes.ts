import { checkFilePath, randFrom } from "../utils";
import { createInterface } from "readline";
import { createReadStream, existsSync } from "fs";

const API = "https://v2.jokeapi.dev/joke/Any?format=txt";
const DATA_FILE = checkFilePath("resources", "plugins/quotes/jokes.txt");

class Joke {
    public static dadjokes: Array<string> = new Array<string>();

    public static load(filename: string = DATA_FILE): boolean | Error {
        if (!existsSync(filename)) return new Error(`Unable to load joke data file '${filename}': file does not exist.`);        
        
        const fileReader = createInterface(createReadStream(DATA_FILE));
        fileReader.on("line", data => Joke.dadjokes.push(data));                          
  
        return true;
 
    }

    public static getDadJoke(): string {
        if (Joke.dadjokes.length === 0) {
            const loadResults = Joke.load();
            if (loadResults instanceof Error) throw loadResults; 
         }
        return randFrom(Joke.dadjokes ?? ["why did the chicken cross the road? to get to the other side!"]);
    }

    public static async retrieve(topic: string): Promise<string> {
        const backupJoke = Joke.getDadJoke();
        
        try {            
            const response = await fetch(`${API}${topic ? `&contains=${encodeURIComponent(topic)}` : ''}`);

            if (response.ok) {
                let joke = (await response.text()).replace("\n", "");
                if (joke.match(/^Error 106/i)) {
                    if (!backupJoke) return "I am still loading my joke database, hold your horses and ask me later";
                    return `dunno any jokes about ${topic}, but here's one better: ${backupJoke}`;
                }
                return joke;
            } else {
                return backupJoke;
            }

        } catch (_e) {
            return backupJoke;
        }
    }
}

export { Joke }

