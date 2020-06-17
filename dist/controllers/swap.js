"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Swap = void 0;
const fs_1 = require("fs");
const config_1 = require("../config");
const SWAP_FILE = config_1.checkFilePath("data", "swaps.json");
class Swap {
    static save(filename = SWAP_FILE) {
        try {
            const data = {};
            if (Swap.list.size === 0)
                return new Error(`Unable to save swap data: no swap data found.`);
            for (let guildID of Swap.list.keys()) {
                data[guildID] = {};
                const guild = Swap.list.get(guildID);
                for (let word of guild.keys()) {
                    data[guildID][word] = guild.get(word);
                }
            }
            fs_1.writeFileSync(filename, JSON.stringify(data, null, 2), "utf8");
            return true;
        }
        catch (error) {
            return error;
        }
    }
    static load(filename = SWAP_FILE) {
        try {
            if (!fs_1.existsSync(filename))
                return new Error(`Unable to load swap data file '${filename}': file does not exist.`);
            const data = JSON.parse(fs_1.readFileSync(filename, "utf8"));
            Swap.list.clear();
            for (const guildID of Object.keys(data)) {
                const words = data[guildID];
                const wordList = new Map();
                for (const word of Object.keys(words)) {
                    wordList.set(word, words[word]);
                }
                Swap.list.set(guildID, wordList);
            }
            return true;
        }
        catch (error) {
            return error;
        }
    }
    static process(guildID, text) {
        text = text.trim();
        if (!Swap.list.has(guildID))
            return text;
        const guildList = Swap.list.get(guildID);
        if (guildList.size === 0)
            return text;
        for (const word of guildList.keys()) {
            let newWord = guildList.get(word) || "";
            if (newWord === `<blank>`)
                newWord = "";
            text = text.replace(new RegExp(word, "uig"), newWord);
        }
        text = text.replace(/\s{2,}/g, ' ');
        return text;
    }
    static getList(guildID) {
        const results = [];
        if (!Swap.list.has(guildID))
            return results;
        const guildList = Swap.list.get(guildID);
        if (guildList.size === 0)
            return results;
        for (const word of guildList.keys()) {
            let newWord = guildList.get(word) || "";
            if (newWord === "")
                newWord = "<blank>";
            results.push(`\`${word} → ${newWord}\``);
        }
        ;
        return results;
    }
    static add(guildID, swapThis, withThis = "") {
        if (!Swap.list.has(guildID))
            Swap.list.set(guildID, new Map());
        const guildList = Swap.list.get(guildID);
        if (withThis === "")
            withThis = `<blank>`;
        guildList.set(swapThis.trim(), withThis.trim());
    }
    static remove(guildID, word) {
        if (!Swap.list.has(guildID))
            Swap.list.set(guildID, new Map());
        const guildList = Swap.list.get(guildID);
        if (guildList.has(word))
            guildList.delete(word);
    }
    static clear(guildID) {
        if (!Swap.list.has(guildID))
            Swap.list.set(guildID, new Map());
        const guildList = Swap.list.get(guildID);
        if (guildList.size > 0)
            guildList.clear();
    }
}
exports.Swap = Swap;
Swap.list = new Map();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3dhcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb250cm9sbGVycy9zd2FwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDJCQUE2RDtBQUM3RCxzQ0FBMEM7QUFDMUMsTUFBTSxTQUFTLEdBQUcsc0JBQWEsQ0FBQyxNQUFNLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFDdEQsTUFBTSxJQUFJO0lBR0EsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFtQixTQUFTO1FBQzVDLElBQUk7WUFDRCxNQUFNLElBQUksR0FBcUQsRUFBRSxDQUFDO1lBQ2xFLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQztnQkFBRSxPQUFPLElBQUksS0FBSyxDQUFDLCtDQUErQyxDQUFDLENBQUM7WUFDNUYsS0FBSyxJQUFJLE9BQU8sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFO2dCQUNuQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFBO2dCQUNsQixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQXdCLENBQUM7Z0JBQzVELEtBQUssSUFBSSxJQUFJLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxFQUFFO29CQUM1QixJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQVcsQ0FBQztpQkFDbEQ7YUFDSDtZQUNELGtCQUFhLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUMvRCxPQUFPLElBQUksQ0FBQztTQUNkO1FBQUMsT0FBTyxLQUFLLEVBQUU7WUFDYixPQUFPLEtBQUssQ0FBQztTQUNmO0lBQ0osQ0FBQztJQUVNLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBbUIsU0FBUztRQUM1QyxJQUFJO1lBQ0QsSUFBSSxDQUFDLGVBQVUsQ0FBQyxRQUFRLENBQUM7Z0JBQUUsT0FBTyxJQUFJLEtBQUssQ0FBQyxrQ0FBa0MsUUFBUSx5QkFBeUIsQ0FBQyxDQUFDO1lBQ2pILE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsaUJBQVksQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUN4RCxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2xCLEtBQUssTUFBTSxPQUFPLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDdEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUM1QixNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztnQkFDM0MsS0FBSyxNQUFNLElBQUksSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFO29CQUNwQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztpQkFDbEM7Z0JBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO2FBQ25DO1lBQ0QsT0FBTyxJQUFJLENBQUM7U0FDZDtRQUFDLE9BQU8sS0FBSyxFQUFFO1lBQ2IsT0FBTyxLQUFLLENBQUM7U0FDZjtJQUNKLENBQUM7SUFFTSxNQUFNLENBQUMsT0FBTyxDQUFFLE9BQWUsRUFBRSxJQUFZO1FBQ2pELElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDbkIsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBQ3pDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBd0IsQ0FBQztRQUNoRSxJQUFJLFNBQVMsQ0FBQyxJQUFJLEtBQUssQ0FBQztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBQ3RDLEtBQUssTUFBTSxJQUFJLElBQUksU0FBUyxDQUFDLElBQUksRUFBRSxFQUFFO1lBQ2xDLElBQUksT0FBTyxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFXLElBQUksRUFBRSxDQUFDO1lBQ2xELElBQUksT0FBTyxLQUFLLFNBQVM7Z0JBQUUsT0FBTyxHQUFHLEVBQUUsQ0FBQztZQUN4QyxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7U0FDeEQ7UUFDRCxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDcEMsT0FBTyxJQUFJLENBQUM7SUFDZixDQUFDO0lBQ00sTUFBTSxDQUFDLE9BQU8sQ0FBRSxPQUFlO1FBQ25DLE1BQU0sT0FBTyxHQUFhLEVBQUUsQ0FBQztRQUM3QixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDO1lBQUUsT0FBTyxPQUFPLENBQUM7UUFDNUMsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUF3QixDQUFDO1FBQ2hFLElBQUksU0FBUyxDQUFDLElBQUksS0FBSyxDQUFDO1lBQUUsT0FBTyxPQUFPLENBQUM7UUFDekMsS0FBSyxNQUFNLElBQUksSUFBSSxTQUFTLENBQUMsSUFBSSxFQUFFLEVBQUU7WUFDbEMsSUFBSSxPQUFPLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQVcsSUFBSSxFQUFFLENBQUM7WUFDbEQsSUFBSSxPQUFPLEtBQUssRUFBRTtnQkFBRSxPQUFPLEdBQUcsU0FBUyxDQUFDO1lBQ3hDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLE1BQU0sT0FBTyxJQUFJLENBQUMsQ0FBQztTQUMzQztRQUFBLENBQUM7UUFDRixPQUFPLE9BQU8sQ0FBQztJQUNsQixDQUFDO0lBQ00sTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFlLEVBQUUsUUFBZ0IsRUFBRSxXQUFtQixFQUFFO1FBQ3ZFLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUM7WUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxHQUFHLEVBQWtCLENBQUMsQ0FBQztRQUMvRSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQXdCLENBQUM7UUFDaEUsSUFBSSxRQUFRLEtBQUssRUFBRTtZQUFFLFFBQVEsR0FBRyxTQUFTLENBQUM7UUFDMUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVNLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBZSxFQUFFLElBQVk7UUFDL0MsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQztZQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxJQUFJLEdBQUcsRUFBa0IsQ0FBQyxDQUFDO1FBQy9FLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBd0IsQ0FBQztRQUNoRSxJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO1lBQUUsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBQ00sTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFlO1FBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUM7WUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxHQUFHLEVBQWtCLENBQUMsQ0FBQztRQUMvRSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQXdCLENBQUM7UUFDaEUsSUFBSSxTQUFTLENBQUMsSUFBSSxHQUFHLENBQUM7WUFBRSxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDN0MsQ0FBQzs7QUFHSyxvQkFBSTtBQW5GSyxTQUFJLEdBQXFDLElBQUksR0FBRyxFQUFFLENBQUMifQ==