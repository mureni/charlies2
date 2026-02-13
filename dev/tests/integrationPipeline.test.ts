import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolve } from "path";
import { Brain } from "@/core";
import { processMessage } from "@/core/messageProcessor";
import { InteractionRouter } from "@/core/interactionRouter";
import { Filters } from "@/filters";
import { Swaps } from "@/filters/swaps/manager";
import { registerSwapFilters, unregisterSwapFilters } from "@/filters/swaps";
import { createMessage, createMockAdapter } from "./pluginHarness";
import { createRequire } from "module";
import { existsSync } from "fs";

const baseSettings = {
   outburstThreshold: 0,
   numberOfLines: 1,
   angerLevel: 0.1,
   surprise: 0,
   angerIncrease: 1,
   angerDecrease: 1,
   recursion: 1,
   conversationTimeLimit: 10,
   learnFromBots: false,
   secretPlaces: []
};

describe("integration pipeline", () => {
   beforeEach(async () => {
      Brain.botName = "unit-test";
      Brain.settings = { ...baseSettings };
      const distBrainPath = resolve(process.cwd(), "dist", "core", "brain.js");
      if (existsSync(distBrainPath)) {
         const require = createRequire(import.meta.url);
         const distBrain = (require(distBrainPath) as { Brain?: typeof Brain }).Brain;
         if (distBrain) {
            distBrain.botName = "unit-test";
            distBrain.settings = { ...baseSettings };
         }
      }
      await InteractionRouter.reload();
   });

   afterEach(() => {
      vi.restoreAllMocks();
   });

   it("routes a choose command through processor and sends a platform message", async () => {
      const { adapter, sent, typings } = createMockAdapter();
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const message = createMessage({
         content: "choose apples or bananas",
         authorName: "Alex",
         platform: adapter,
         channel: {
            id: "channel-1",
            name: "DM",
            type: "dm",
            scope: "dm",
            supportsText: true,
            supportsVoice: false,
            supportsTyping: true,
            supportsHistory: false
         }
      });

      const result = await processMessage(message);

      expect(result.triggeredBy).toBe("choose");
      expect(typings).toEqual(["channel-1"]);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.contents).toMatch(/^bananas, because: .+/u);
   });

   it("routes a roll command and prefixes the response in server channels", async () => {
      const { adapter, sent, typings } = createMockAdapter();
      const sequence = [0, 0, 0.99];
      const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => sequence.shift() ?? 0.99);

      const message = createMessage({
         content: "!roll 2d6",
         authorName: "Alex",
         channelId: "channel-2",
         platform: adapter,
         channel: {
            id: "channel-2",
            name: "general",
            type: "text",
            scope: "server",
            supportsText: true,
            supportsVoice: false,
            supportsTyping: true,
            supportsHistory: true
         }
      });

      const result = await processMessage(message);

      expect(result.triggeredBy).toBe("roll");
      expect(typings).toEqual(["channel-2"]);
      expect(sent).toHaveLength(2);
      expect(sent[0].message.contents).toContain("Alex: **Result**: 2d6");
      expect(sent[1].message.contents).toContain("**Total**:");

      randomSpy.mockRestore();
   });

   it("applies swap filters to the preBrain text inside the full pipeline", async () => {
      Filters.clear();
      registerSwapFilters();
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

      try {
         const { adapter } = createMockAdapter();
         const message = createMessage({
            content: "choose fudge or bananas",
            authorName: "Alex",
            platform: adapter,
            channel: {
               id: "channel-1",
               name: "DM",
               type: "dm",
               scope: "dm",
               supportsText: true,
               supportsVoice: false,
               supportsTyping: true,
               supportsHistory: false
            }
         });

         const result = await processMessage(message);

         expect(result.triggeredBy).toBe("choose");
         expect(result.processedText).toBe("choose frick or bananas");
      } finally {
         Swaps.clearScope("user", "user-1");
         unregisterSwapFilters();
         Filters.clear();
      }
   });

   it("handles slash command help interactions through the router", async () => {
      const replies: Array<{ contents: string; embeds?: Array<{ title?: string }> }> = [];
      await InteractionRouter.handleCommand({
         command: "help",
         options: {},
         userId: "user-1",
         channelId: "channel-1",
         reply: async (message) => {
            replies.push({
               contents: message.contents,
               embeds: message.embeds?.map(embed => ({ title: embed.title }))
            });
         }
      });

      expect(replies.length).toBeGreaterThan(0);
      expect(replies[0]?.embeds?.[0]?.title).toBe("Available commands");
   });
});
