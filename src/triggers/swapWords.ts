import { Message, TriggerResult, Trigger } from "../core";
import { Swap } from "../controllers";

const addSwap: Trigger = {
   id: "swap",
   name: "Swap words",
   description: "Adds words to server-specific swap list",
   usage: "swap [this] with [that]",
   command: /^swap\s+(?:(?<this>.+)\s+with\s+(?<that>.+))?/ui,
   action: (context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" } };
      if (matches.length === 0 || !matches.groups) return output;
      const these = (matches.groups.this || "").toLowerCase().trim();
      const those = (matches.groups.that || "").toLowerCase().trim();
      if (!these || !those) return output;
      
      Swap.add(context.guild?.id ?? context.author.id, these, those);
      output.results = [{ contents: `swapping \`${these}\` with \`${those}\` for ${context.guild?.name ?? 'DMs with you'}` }];
      return output;
   }
}
const removeSwap: Trigger = {
   id: "unswap",
   name: "Unswap word",
   description: "Remove a word from the server-specific swap list. Use <all> to remove everything.",
   usage: "unswap [this]/<all>",
   command: /^unswap\s+(?<this>.+)/ui,
   action: (context: Message, matches: RegExpMatchArray = []) => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" } };
      if (matches.length === 0 || !matches.groups) return output;
      const these = matches.groups.this || "";
      if (!these) return output;
      if (these.match(/<all>/ui)) {
         Swap.clear(context.guild?.id ?? context.author.id);
         output.results = [{ contents: `removed all words from the swap list for ${context.guild?.name ?? 'DMs with you'}` }];
      } else {
         Swap.remove(context.guild?.id ?? context.author.id, these);
         output.results = [{ contents: `removed \`${these}\` from the swap list for ${context.guild?.name ?? 'DMs with you'}` }];
      }
      return output;
   }
}
const swapList: Trigger = {
   id: "swap-list",
   name: "Swap list",
   description: "Displays the list of swapped words for this server",
   usage: "swap-list",
   command: /^swap-list$/ui,
   action: (context: Message) => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" } };
      const swaps: string[] = Swap.getList(context.guild?.id ?? context.author.id);
      if (swaps.length === 0) {
         output.results = [ { contents: "no swaps defined for this server yet" }];
      } else {
         output.results = [ { contents: swaps.join(', ') }];
      }
      
      return output;
   }
}
const swapSave: Trigger = {
   id: "save-swap",
   name: "Save swap",
   description: "Saves swap data",
   usage: "save-swap",
   command: /^save-swap$/ui,
   ownerOnly: true,
   action: () => {
      const output: TriggerResult = { results: [], modifications: { Case: "unchanged" } };
      const saveResults: boolean | Error = Swap.save();
      output.results = [ { contents: (saveResults instanceof Error) ? "can't save swap data, check error log for details" : "swap data saved" } ];
      return output;
   }
}

const triggers = [ swapSave, swapList, addSwap, removeSwap ];
export { triggers };