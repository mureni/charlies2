import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMessage } from "./pluginHarness";
import type { CoreChannel } from "@/platform";
import type { FilterRegistry } from "@/filters";
import type { TriggerPlugin } from "@/plugins/types";
import type { RegisterSwapFilters, UnregisterSwapFilters } from "@/filters/swaps";
import type { SwapsManager } from "@/filters/swaps/manager";

let Swaps: SwapsManager;
let plugins: TriggerPlugin[];
let Filters: FilterRegistry;
let registerSwapFilters: RegisterSwapFilters;
let unregisterSwapFilters: UnregisterSwapFilters;
let loadPromise: Promise<void> | undefined;

const createChannel = (overrides: Partial<CoreChannel>): CoreChannel => ({
   id: overrides.id ?? "channel-1",
   name: overrides.name ?? "channel",
   type: overrides.type ?? "text",
   scope: overrides.scope ?? "server",
   supportsText: true,
   supportsVoice: false,
   supportsTyping: true,
   supportsHistory: true,
   ...overrides
});

const ensureLoaded = async () => {
   if (loadPromise) {
      await loadPromise;
      return;
   }
   loadPromise = (async () => {
      process.env.BOT_NAME = "test-swaps";
      ({ Swaps } = await import("@/filters/swaps/manager"));
      ({ plugins } = await import("@/plugins/modules/swaps"));
      ({ Filters } = await import("@/filters"));
      ({ registerSwapFilters, unregisterSwapFilters } = await import("@/filters/swaps"));
   })();
   await loadPromise;
};

const resetSwapStore = () => {
   (Swaps as unknown as { rules: { clear: () => void } }).rules.clear();
   (Swaps as unknown as { groups: { clear: () => void } }).groups.clear();
   (Swaps as unknown as { legacy: { clear: () => void } }).legacy.clear();
};

beforeAll(async () => {
   await ensureLoaded();
});

beforeEach(async () => {
   await ensureLoaded();
   resetSwapStore();
});

afterEach(async () => {
   await ensureLoaded();
   unregisterSwapFilters();
});

afterAll(async () => {
   await ensureLoaded();
   resetSwapStore();
});

describe("swaps plugin", () => {
   it("chooses default scope based on context", () => {
      const dmChannel = createChannel({ id: "dm-1", scope: "dm", type: "dm" });
      const dmMessage = createMessage({ authorId: "user-1", channelId: "dm-1", channel: dmChannel });
      expect(Swaps.getDefaultScope(dmMessage)).toEqual({ scope: "user", scopeId: "user-1" });

      const groupChannel = createChannel({
         id: "dm-group-1",
         scope: "dm",
         type: "dm",
         isGroupDm: true,
         memberCount: 3
      });
      const groupMessage = createMessage({ authorId: "user-2", channelId: "dm-group-1", channel: groupChannel });
      expect(Swaps.getDefaultScope(groupMessage)).toEqual({
         scope: "group",
         scopeId: Swaps.groupIdForDm("dm-group-1")
      });

      const guildChannel = createChannel({
         id: "guild-channel-1",
         scope: "server",
         type: "text",
         guildId: "guild-1"
      });
      const guildMessage = createMessage({
         authorId: "user-3",
         channelId: "guild-channel-1",
         channel: guildChannel,
         guildId: "guild-1"
      });
      expect(Swaps.getDefaultScope(guildMessage)).toEqual({ scope: "guild", scopeId: "guild-1" });
   });

   it("applies whole word swaps without touching partial matches", () => {
      Swaps.saveRule({
         scope: "user",
         scopeId: "user-1",
         pattern: "fudge",
         replacement: "frick",
         mode: "word",
         caseSensitive: false,
         applyLearn: true,
         applyRespond: true
      });
      const context = createMessage({ authorId: "user-1" });
      expect(Swaps.apply("fudge fudgey", context, "respond")).toBe("frick fudgey");
   });

   it("respects case sensitivity flags", () => {
      Swaps.saveRule({
         scope: "user",
         scopeId: "user-1",
         pattern: "Fudge",
         replacement: "Frick",
         mode: "word",
         caseSensitive: true,
         applyLearn: true,
         applyRespond: true
      });
      const context = createMessage({ authorId: "user-1" });
      expect(Swaps.apply("fudge Fudge", context, "respond")).toBe("fudge Frick");
   });

   it("supports regex matching when enabled", () => {
      Swaps.saveRule({
         scope: "user",
         scopeId: "user-1",
         pattern: "f.+e",
         replacement: "match",
         mode: "regex",
         caseSensitive: false,
         applyLearn: true,
         applyRespond: true
      });
      const context = createMessage({ authorId: "user-1" });
      expect(Swaps.apply("fudge", context, "respond")).toBe("match");
   });

   it("applies rules only in their enabled phases", () => {
      Swaps.saveRule({
         scope: "user",
         scopeId: "user-1",
         pattern: "fudge",
         replacement: "frick",
         mode: "word",
         caseSensitive: false,
         applyLearn: true,
         applyRespond: false
      });
      const context = createMessage({ authorId: "user-1" });
      expect(Swaps.apply("fudge", context, "learn")).toBe("frick");
      expect(Swaps.apply("fudge", context, "respond")).toBe("fudge");
   });

   it("skips disabled rules", () => {
      Swaps.saveRule({
         scope: "user",
         scopeId: "user-1",
         pattern: "fudge",
         replacement: "frick",
         mode: "word",
         caseSensitive: false,
         applyLearn: true,
         applyRespond: true,
         enabled: false
      });
      const context = createMessage({ authorId: "user-1" });
      expect(Swaps.apply("fudge", context, "respond")).toBe("fudge");
   });

   it("prefers higher scope rules over lower ones", () => {
      Swaps.saveGroup({ id: "clique-1", name: "Clique", members: ["user-1"] });
      Swaps.saveRule({
         scope: "channel",
         scopeId: "channel-1",
         pattern: "fudge",
         replacement: "channel",
         mode: "word",
         caseSensitive: false,
         applyLearn: true,
         applyRespond: true
      });
      Swaps.saveRule({
         scope: "guild",
         scopeId: "guild-1",
         pattern: "fudge",
         replacement: "guild",
         mode: "word",
         caseSensitive: false,
         applyLearn: true,
         applyRespond: true
      });
      Swaps.saveRule({
         scope: "group",
         scopeId: "clique-1",
         pattern: "fudge",
         replacement: "group",
         mode: "word",
         caseSensitive: false,
         applyLearn: true,
         applyRespond: true
      });
      Swaps.saveRule({
         scope: "user",
         scopeId: "user-1",
         pattern: "fudge",
         replacement: "user",
         mode: "word",
         caseSensitive: false,
         applyLearn: true,
         applyRespond: true
      });
      const context = createMessage({
         authorId: "user-1",
         channelId: "channel-1",
         guildId: "guild-1",
         channel: createChannel({ id: "channel-1", scope: "server", guildId: "guild-1" })
      });
      expect(Swaps.apply("fudge", context, "respond")).toBe("user");
   });

   it("allows group rules to override server rules", () => {
      Swaps.saveGroup({ id: "clique-2", name: "Another Clique", members: ["user-9"] });
      Swaps.saveRule({
         scope: "guild",
         scopeId: "guild-2",
         pattern: "fudge",
         replacement: "server",
         mode: "word",
         caseSensitive: false,
         applyLearn: true,
         applyRespond: true
      });
      Swaps.saveRule({
         scope: "group",
         scopeId: "clique-2",
         pattern: "fudge",
         replacement: "group",
         mode: "word",
         caseSensitive: false,
         applyLearn: true,
         applyRespond: true
      });
      const context = createMessage({
         authorId: "user-9",
         channelId: "channel-2",
         guildId: "guild-2",
         channel: createChannel({ id: "channel-2", scope: "server", guildId: "guild-2" })
      });
      expect(Swaps.apply("fudge", context, "respond")).toBe("group");
   });

   it("applies group rules for group DMs", () => {
      const channelId = "dm-group-9";
      Swaps.saveRule({
         scope: "group",
         scopeId: Swaps.groupIdForDm(channelId),
         pattern: "fudge",
         replacement: "groupdm",
         mode: "word",
         caseSensitive: false,
         applyLearn: true,
         applyRespond: true
      });
      const context = createMessage({
         authorId: "user-4",
         channelId,
         channel: createChannel({
            id: channelId,
            scope: "dm",
            type: "dm",
            isGroupDm: true,
            memberCount: 4
         })
      });
      expect(Swaps.apply("fudge", context, "respond")).toBe("groupdm");
   });

   it("registers swap filters for learn/respond phases", () => {
      Swaps.saveRule({
         scope: "user",
         scopeId: "user-1",
         pattern: "fudge",
         replacement: "frick",
         mode: "word",
         caseSensitive: false,
         applyLearn: true,
         applyRespond: false
      });
      registerSwapFilters();
      const context = createMessage({ authorId: "user-1" });
      expect(Filters.apply("preBrain", "fudge", context, "learn")).toBe("frick");
      expect(Filters.apply("postBrain", "fudge", context, "respond")).toBe("fudge");
   });

   it("stores and removes rules via swap commands", async () => {
      const swapPlugin = plugins.find(plugin => plugin.id === "swap");
      const unswapPlugin = plugins.find(plugin => plugin.id === "unswap");
      const swapListPlugin = plugins.find(plugin => plugin.id === "swap-list");
      if (!swapPlugin?.execute || !swapPlugin.matcher) throw new Error("swap plugin not available");
      if (!unswapPlugin?.execute || !unswapPlugin.matcher) throw new Error("unswap plugin not available");
      if (!swapListPlugin?.execute || !swapListPlugin.matcher) throw new Error("swap-list plugin not available");

      const context = createMessage({
         authorId: "user-5",
         channelId: "guild-channel-9",
         guildId: "guild-9",
         content: "swap fudge with frick",
         channel: createChannel({ id: "guild-channel-9", scope: "server", guildId: "guild-9" })
      });
      const swapMatches = context.content.match(swapPlugin.matcher) ?? undefined;
      await swapPlugin.execute(context, swapMatches);
      const rules = Swaps.listRules({ scope: "guild", scopeId: "guild-9" });
      expect(rules.length).toBe(1);
      expect(rules[0].pattern).toBe("fudge");
      expect(rules[0].replacement).toBe("frick");

      const listContext = { ...context, content: "swap-list" };
      const listMatches = listContext.content.match(swapListPlugin.matcher) ?? undefined;
      const listResult = await swapListPlugin.execute(listContext, listMatches);
      expect(listResult.results[0].contents).toMatch(/fudge/i);

      const unswapContext = { ...context, content: "unswap fudge" };
      const unswapMatches = unswapContext.content.match(unswapPlugin.matcher) ?? undefined;
      await unswapPlugin.execute(unswapContext, unswapMatches);
      expect(Swaps.listRules({ scope: "guild", scopeId: "guild-9" }).length).toBe(0);
   });
});
