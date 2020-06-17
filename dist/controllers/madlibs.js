"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Madlibs = void 0;
const fs_1 = require("fs");
const config_1 = require("../config");
const DATA_FILE = config_1.checkFilePath("data", "madlibs.json");
class Madlibs {
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
            Madlibs.vocab.set(vocabType, words);
        }
        Madlibs.patterns = new Set(data.patterns);
        return true;
    }
    static save(filename = DATA_FILE) {
        const data = { vocab: {}, patterns: [] };
        if (Madlibs.vocab.size === 0)
            return new Error(`Unable to save madlibs data: no data found.`);
        for (let vocabType of Madlibs.vocab.keys()) {
            data.vocab[vocabType] = Array.from(Madlibs.vocab.get(vocabType));
        }
        data.patterns = Array.from(Madlibs.patterns);
        fs_1.writeFileSync(filename, JSON.stringify(data, null, 2), "utf8");
        return true;
    }
    static generate(numLines = 4) {
        if (Madlibs.patterns.size === 0 || Madlibs.vocab.size === 0) {
            const loadResults = Madlibs.load();
            if (loadResults instanceof Error)
                throw loadResults;
        }
        const patterns = Array.from(Madlibs.patterns);
        const response = [];
        for (let l = 0; l < numLines; l++) {
            // Get a pattern and remove it from the list
            let [pulledPattern] = patterns.splice(Math.floor(Math.random() * patterns.length), 1);
            if (!pulledPattern)
                break;
            // Replace vocab words in the pattern with random options from that vocab type
            for (const vocabType of Madlibs.vocab.keys()) {
                if (pulledPattern.indexOf(vocabType) === -1)
                    continue;
                let word = "";
                let words = [];
                while (pulledPattern.indexOf(vocabType) >= 0) {
                    if (!word) {
                        // First run or ran out of words, refill the list and try again
                        words = Array.from(Madlibs.vocab.get(vocabType));
                        if (words.length === 0)
                            break;
                    }
                    [word] = words.splice(Math.floor(Math.random() * words.length), 1);
                    if (!word)
                        break;
                    pulledPattern = pulledPattern.replace(vocabType, word);
                }
            }
            response.push(pulledPattern.concat("."));
        }
        return response.join(" ").trim();
    }
    static addVocab(vocabType, word) {
        if (!vocabType || !word)
            return false;
        if (!Madlibs.vocab.has(vocabType))
            Madlibs.vocab.set(vocabType, new Set());
        const words = Madlibs.vocab.get(vocabType);
        words.add(word);
        return true;
    }
    static removeVocab(vocabType, word) {
        if (!vocabType || !word)
            return false;
        if (!Madlibs.vocab.has(vocabType))
            return false;
        const words = Madlibs.vocab.get(vocabType);
        words.delete(word);
        return true;
    }
    static addPattern(pattern) {
        if (!pattern)
            return false;
        Madlibs.patterns.add(pattern);
        return true;
    }
    static removePattern(pattern) {
        if (!pattern || !Madlibs.patterns.has(pattern))
            return false;
        Madlibs.patterns.delete(pattern);
        return true;
    }
}
exports.Madlibs = Madlibs;
Madlibs.patterns = new Set();
Madlibs.vocab = new Map();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFkbGlicy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb250cm9sbGVycy9tYWRsaWJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDJCQUE2RDtBQUM3RCxzQ0FBMEM7QUFFMUMsTUFBTSxTQUFTLEdBQUcsc0JBQWEsQ0FBQyxNQUFNLEVBQUUsY0FBYyxDQUFDLENBQUM7QUFFeEQsTUFBTSxPQUFPO0lBSUgsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFtQixTQUFTO1FBQzVDLElBQUksQ0FBQyxlQUFVLENBQUMsUUFBUSxDQUFDO1lBQUUsT0FBTyxJQUFJLEtBQUssQ0FBQyxzQ0FBc0MsUUFBUSx5QkFBeUIsQ0FBQyxDQUFDO1FBQ3JILE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsaUJBQVksQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUV4RCxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUM7WUFBRSxPQUFPLEtBQUssQ0FBQztRQUVoRixLQUFLLE1BQU0sU0FBUyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQzlDLE1BQU0sS0FBSyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7WUFDaEMsTUFBTSxTQUFTLEdBQWEsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ3BFLEtBQUssTUFBTSxJQUFJLElBQUksU0FBUyxFQUFFO2dCQUMzQixLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ2xCO1lBQ0QsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ3RDO1FBRUQsT0FBTyxDQUFDLFFBQVEsR0FBRyxJQUFJLEdBQUcsQ0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFbEQsT0FBTyxJQUFJLENBQUM7SUFDZixDQUFDO0lBRU0sTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFtQixTQUFTO1FBQzVDLE1BQU0sSUFBSSxHQUFxRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxDQUFDO1FBQzNHLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQztZQUFFLE9BQU8sSUFBSSxLQUFLLENBQUMsNkNBQTZDLENBQUMsQ0FBQztRQUM5RixLQUFLLElBQUksU0FBUyxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEVBQUU7WUFDekMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBZ0IsQ0FBQyxDQUFDO1NBQ2xGO1FBQ0QsSUFBSSxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM3QyxrQkFBYSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDL0QsT0FBTyxJQUFJLENBQUM7SUFDZixDQUFDO0lBRU0sTUFBTSxDQUFDLFFBQVEsQ0FBQyxXQUFtQixDQUFDO1FBQ3hDLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRTtZQUMxRCxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDbkMsSUFBSSxXQUFXLFlBQVksS0FBSztnQkFBRSxNQUFNLFdBQVcsQ0FBQztTQUN0RDtRQUNELE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzlDLE1BQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztRQUM5QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ2hDLDRDQUE0QztZQUM1QyxJQUFJLENBQUUsYUFBYSxDQUFFLEdBQWEsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDbEcsSUFBSSxDQUFDLGFBQWE7Z0JBQUUsTUFBTTtZQUUxQiw4RUFBOEU7WUFDOUUsS0FBSyxNQUFNLFNBQVMsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxFQUFFO2dCQUUzQyxJQUFJLGFBQWEsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUFFLFNBQVM7Z0JBRXRELElBQUksSUFBSSxHQUFXLEVBQUUsQ0FBQztnQkFDdEIsSUFBSSxLQUFLLEdBQWEsRUFBRSxDQUFDO2dCQUV6QixPQUFPLGFBQWEsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUMzQyxJQUFJLENBQUMsSUFBSSxFQUFFO3dCQUNSLCtEQUErRDt3QkFDL0QsS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFnQixDQUFDLENBQUM7d0JBQ2hFLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDOzRCQUFFLE1BQU07cUJBQ2hDO29CQUNELENBQUUsSUFBSSxDQUFFLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQ3JFLElBQUksQ0FBQyxJQUFJO3dCQUFFLE1BQU07b0JBQ2pCLGFBQWEsR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztpQkFDekQ7YUFDSDtZQUNELFFBQVEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1NBQzNDO1FBQ0QsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ3BDLENBQUM7SUFFTSxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQWlCLEVBQUUsSUFBWTtRQUNuRCxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsSUFBSTtZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUM7WUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxHQUFHLEVBQVUsQ0FBQyxDQUFDO1FBQ25GLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBZ0IsQ0FBQztRQUMxRCxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hCLE9BQU8sSUFBSSxDQUFDO0lBQ2YsQ0FBQztJQUVNLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBaUIsRUFBRSxJQUFZO1FBQ3RELElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxJQUFJO1lBQUUsT0FBTyxLQUFLLENBQUM7UUFDdEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQ2hELE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBZ0IsQ0FBQztRQUMxRCxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ25CLE9BQU8sSUFBSSxDQUFDO0lBQ2YsQ0FBQztJQUVNLE1BQU0sQ0FBQyxVQUFVLENBQUMsT0FBZTtRQUNyQyxJQUFJLENBQUMsT0FBTztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQzNCLE9BQU8sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzlCLE9BQU8sSUFBSSxDQUFDO0lBQ2YsQ0FBQztJQUVNLE1BQU0sQ0FBQyxhQUFhLENBQUMsT0FBZTtRQUN4QyxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDO1lBQUUsT0FBTyxLQUFLLENBQUM7UUFDN0QsT0FBTyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDakMsT0FBTyxJQUFJLENBQUM7SUFDZixDQUFDOztBQUtLLDBCQUFPO0FBckdDLGdCQUFRLEdBQWdCLElBQUksR0FBRyxFQUFVLENBQUM7QUFDMUMsYUFBSyxHQUE2QixJQUFJLEdBQUcsRUFBdUIsQ0FBQyJ9