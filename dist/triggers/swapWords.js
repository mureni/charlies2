"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggers = void 0;
const core_1 = require("../core");
const controllers_1 = require("../controllers");
const addSwap = {
    id: "swap",
    name: "Swap words",
    description: "Adds words to server-specific swap list",
    usage: "swap [this] with [that]",
    command: /^swap\s+(?:(?<this>.+)\s+with\s+(?<that>.+))?/ui,
    action: (context, matches = []) => {
        const output = { results: [], modifications: core_1.Modifications.AsIs };
        if (matches.length === 0 || !matches.groups)
            return output;
        const these = (matches.groups.this || "").toLowerCase().trim();
        const those = (matches.groups.that || "").toLowerCase().trim();
        if (!these || !those)
            return output;
        controllers_1.Swap.add(context.guild.id, these, those);
        output.results = [`swapping \`${these}\` with \`${those}\` for ${context.guild.name}`];
        return output;
    }
};
const removeSwap = {
    id: "unswap",
    name: "Unswap word",
    description: "Remove a word from the server-specific swap list. Use <all> to remove everything.",
    usage: "unswap [this]/<all>",
    command: /^unswap\s+(?<this>.+)/ui,
    action: (context, matches = []) => {
        const output = { results: [], modifications: core_1.Modifications.AsIs };
        if (matches.length === 0 || !matches.groups)
            return output;
        const these = matches.groups.this || "";
        if (!these)
            return output;
        if (these.match(/<all>/ui)) {
            controllers_1.Swap.clear(context.guild.id);
            output.results = [`removed all words from the swap list for ${context.guild.name}`];
        }
        else {
            controllers_1.Swap.remove(context.guild.id, these);
            output.results = [`removed \`${these}\` from the swap list for ${context.guild.name}`];
        }
        return output;
    }
};
const swapList = {
    id: "swap-list",
    name: "Swap list",
    description: "Displays the list of swapped words for this server",
    usage: "swap-list",
    command: /^swap-list$/ui,
    action: (context) => {
        const output = { results: [], modifications: core_1.Modifications.AsIs };
        const swaps = controllers_1.Swap.getList(context.guild.id);
        if (swaps.length === 0) {
            output.results = ["no swaps defined for this server yet"];
        }
        else {
            output.results = [swaps.join(', ')];
        }
        return output;
    }
};
const swapSave = {
    id: "save-swap",
    name: "Save swap",
    description: "Saves swap data",
    usage: "save-swap",
    command: /^save-swap$/ui,
    ownerOnly: true,
    action: () => {
        const output = { results: [], modifications: core_1.Modifications.AsIs };
        const saveResults = controllers_1.Swap.save();
        output.results = (saveResults instanceof Error) ? ["can't save swap data, check error log for details"] : ["swap data saved"];
        return output;
    }
};
const triggers = [swapSave, swapList, addSwap, removeSwap];
exports.triggers = triggers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3dhcFdvcmRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3RyaWdnZXJzL3N3YXBXb3Jkcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxrQ0FBeUU7QUFDekUsZ0RBQXNDO0FBRXRDLE1BQU0sT0FBTyxHQUFZO0lBQ3RCLEVBQUUsRUFBRSxNQUFNO0lBQ1YsSUFBSSxFQUFFLFlBQVk7SUFDbEIsV0FBVyxFQUFFLHlDQUF5QztJQUN0RCxLQUFLLEVBQUUseUJBQXlCO0lBQ2hDLE9BQU8sRUFBRSxpREFBaUQ7SUFDMUQsTUFBTSxFQUFFLENBQUMsT0FBZ0IsRUFBRSxVQUE0QixFQUFFLEVBQUUsRUFBRTtRQUMxRCxNQUFNLE1BQU0sR0FBa0IsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLGFBQWEsRUFBRSxvQkFBYSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2pGLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTTtZQUFFLE9BQU8sTUFBTSxDQUFDO1FBQzNELE1BQU0sS0FBSyxHQUFHLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDL0QsTUFBTSxLQUFLLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUMvRCxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsS0FBSztZQUFFLE9BQU8sTUFBTSxDQUFDO1FBRXBDLGtCQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN6QyxNQUFNLENBQUMsT0FBTyxHQUFHLENBQUMsY0FBYyxLQUFLLGFBQWEsS0FBSyxVQUFVLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUN2RixPQUFPLE1BQU0sQ0FBQztJQUNqQixDQUFDO0NBQ0gsQ0FBQTtBQUNELE1BQU0sVUFBVSxHQUFZO0lBQ3pCLEVBQUUsRUFBRSxRQUFRO0lBQ1osSUFBSSxFQUFFLGFBQWE7SUFDbkIsV0FBVyxFQUFFLG1GQUFtRjtJQUNoRyxLQUFLLEVBQUUscUJBQXFCO0lBQzVCLE9BQU8sRUFBRSx5QkFBeUI7SUFDbEMsTUFBTSxFQUFFLENBQUMsT0FBZ0IsRUFBRSxVQUE0QixFQUFFLEVBQUUsRUFBRTtRQUMxRCxNQUFNLE1BQU0sR0FBa0IsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLGFBQWEsRUFBRSxvQkFBYSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2pGLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTTtZQUFFLE9BQU8sTUFBTSxDQUFDO1FBQzNELE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUN4QyxJQUFJLENBQUMsS0FBSztZQUFFLE9BQU8sTUFBTSxDQUFDO1FBQzFCLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUN6QixrQkFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzdCLE1BQU0sQ0FBQyxPQUFPLEdBQUcsQ0FBQyw0Q0FBNEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1NBQ3RGO2FBQU07WUFDSixrQkFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNyQyxNQUFNLENBQUMsT0FBTyxHQUFHLENBQUMsYUFBYSxLQUFLLDZCQUE2QixPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7U0FDekY7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNqQixDQUFDO0NBQ0gsQ0FBQTtBQUNELE1BQU0sUUFBUSxHQUFZO0lBQ3ZCLEVBQUUsRUFBRSxXQUFXO0lBQ2YsSUFBSSxFQUFFLFdBQVc7SUFDakIsV0FBVyxFQUFFLG9EQUFvRDtJQUNqRSxLQUFLLEVBQUUsV0FBVztJQUNsQixPQUFPLEVBQUUsZUFBZTtJQUN4QixNQUFNLEVBQUUsQ0FBQyxPQUFnQixFQUFFLEVBQUU7UUFDMUIsTUFBTSxNQUFNLEdBQWtCLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxhQUFhLEVBQUUsb0JBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNqRixNQUFNLEtBQUssR0FBYSxrQkFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZELElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDckIsTUFBTSxDQUFDLE9BQU8sR0FBRyxDQUFDLHNDQUFzQyxDQUFDLENBQUM7U0FDNUQ7YUFBTTtZQUNKLE1BQU0sQ0FBQyxPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDdEM7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNqQixDQUFDO0NBQ0gsQ0FBQTtBQUNELE1BQU0sUUFBUSxHQUFZO0lBQ3ZCLEVBQUUsRUFBRSxXQUFXO0lBQ2YsSUFBSSxFQUFFLFdBQVc7SUFDakIsV0FBVyxFQUFFLGlCQUFpQjtJQUM5QixLQUFLLEVBQUUsV0FBVztJQUNsQixPQUFPLEVBQUUsZUFBZTtJQUN4QixTQUFTLEVBQUUsSUFBSTtJQUNmLE1BQU0sRUFBRSxHQUFHLEVBQUU7UUFDVixNQUFNLE1BQU0sR0FBa0IsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLGFBQWEsRUFBRSxvQkFBYSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2pGLE1BQU0sV0FBVyxHQUFvQixrQkFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2pELE1BQU0sQ0FBQyxPQUFPLEdBQUcsQ0FBQyxXQUFXLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsbURBQW1ELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQzlILE9BQU8sTUFBTSxDQUFDO0lBQ2pCLENBQUM7Q0FDSCxDQUFBO0FBRUQsTUFBTSxRQUFRLEdBQUcsQ0FBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxVQUFVLENBQUUsQ0FBQztBQUNwRCw0QkFBUSJ9