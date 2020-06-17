"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bullshit = void 0;
const fs_1 = require("fs");
const config_1 = require("../config");
const DATA_FILE = config_1.checkFilePath("data", "hippy.json");
class Bullshit {
    static load(filename = DATA_FILE) {
        if (!fs_1.existsSync(filename))
            return new Error(`Unable to load bullshit data file '${filename}': file does not exist.`);
        const data = JSON.parse(fs_1.readFileSync(filename, "utf8"));
        if (!Reflect.has(data, "vocab") || !Reflect.has(data, "patterns"))
            return false;
        for (const vocabType of Object.keys(data.vocab)) {
            const words = new Set();
            const wordArray = Array.from(data.vocab[vocabType]) || [];
            for (const word of wordArray) {
                words.add(word);
            }
            Bullshit.vocab.set(vocabType, words);
        }
        Bullshit.patterns = new Set(data.patterns);
        return true;
    }
    static generate(numLines = 4) {
        if (Bullshit.patterns.size === 0 || Bullshit.vocab.size === 0) {
            const loadResults = Bullshit.load();
            if (loadResults instanceof Error)
                throw loadResults;
        }
        const patterns = Array.from(Bullshit.patterns);
        const response = [];
        for (let l = 0; l < numLines; l++) {
            // Get a pattern and remove it from the list
            let [pulledPattern] = patterns.splice(Math.floor(Math.random() * patterns.length), 1);
            // Replace vocab words in the pattern with random options from that vocab type
            for (const vocabType of Bullshit.vocab.keys()) {
                if (pulledPattern.indexOf(vocabType) === -1)
                    continue;
                const words = Array.from(Bullshit.vocab.get(vocabType));
                if (words.length === 0)
                    continue;
                while (pulledPattern.indexOf(vocabType) >= 0) {
                    const [word] = words.splice(Math.floor(Math.random() * words.length), 1);
                    pulledPattern = pulledPattern.replace(vocabType, word);
                }
            }
            response.push(pulledPattern);
        }
        return response.join(" ").trim();
    }
}
exports.Bullshit = Bullshit;
Bullshit.patterns = new Set();
Bullshit.vocab = new Map();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVsbHNoaXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29udHJvbGxlcnMvYnVsbHNoaXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsMkJBQThDO0FBQzlDLHNDQUEwQztBQUMxQyxNQUFNLFNBQVMsR0FBRyxzQkFBYSxDQUFDLE1BQU0sRUFBRSxZQUFZLENBQUMsQ0FBQztBQUV0RCxNQUFNLFFBQVE7SUFJSixNQUFNLENBQUMsSUFBSSxDQUFDLFdBQW1CLFNBQVM7UUFDNUMsSUFBSSxDQUFDLGVBQVUsQ0FBQyxRQUFRLENBQUM7WUFBRSxPQUFPLElBQUksS0FBSyxDQUFDLHNDQUFzQyxRQUFRLHlCQUF5QixDQUFDLENBQUM7UUFDckgsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxpQkFBWSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBRXhELElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBRWhGLEtBQUssTUFBTSxTQUFTLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDOUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztZQUNoQyxNQUFNLFNBQVMsR0FBYSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDcEUsS0FBSyxNQUFNLElBQUksSUFBSSxTQUFTLEVBQUU7Z0JBQzNCLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDbEI7WUFDRCxRQUFRLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDdkM7UUFFRCxRQUFRLENBQUMsUUFBUSxHQUFHLElBQUksR0FBRyxDQUFTLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUVuRCxPQUFPLElBQUksQ0FBQztJQUNmLENBQUM7SUFFTSxNQUFNLENBQUMsUUFBUSxDQUFDLFdBQW1CLENBQUM7UUFDeEMsSUFBSSxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFO1lBQzVELE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNwQyxJQUFJLFdBQVcsWUFBWSxLQUFLO2dCQUFFLE1BQU0sV0FBVyxDQUFDO1NBQ3REO1FBQ0QsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDL0MsTUFBTSxRQUFRLEdBQWEsRUFBRSxDQUFDO1FBQzlCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDaEMsNENBQTRDO1lBQzVDLElBQUksQ0FBRSxhQUFhLENBQUUsR0FBYSxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUVsRyw4RUFBOEU7WUFDOUUsS0FBSyxNQUFNLFNBQVMsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxFQUFFO2dCQUU1QyxJQUFJLGFBQWEsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUFFLFNBQVM7Z0JBRXRELE1BQU0sS0FBSyxHQUFhLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFnQixDQUFDLENBQUM7Z0JBQ2pGLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDO29CQUFFLFNBQVM7Z0JBRWpDLE9BQU8sYUFBYSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQzNDLE1BQU0sQ0FBRSxJQUFJLENBQUUsR0FBYSxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDckYsYUFBYSxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO2lCQUN6RDthQUNIO1lBQ0QsUUFBUSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztTQUMvQjtRQUNELE9BQU8sUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNwQyxDQUFDOztBQUdLLDRCQUFRO0FBckRBLGlCQUFRLEdBQWdCLElBQUksR0FBRyxFQUFVLENBQUM7QUFDMUMsY0FBSyxHQUE2QixJQUFJLEdBQUcsRUFBdUIsQ0FBQyJ9