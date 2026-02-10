import { describe, expect, it, vi } from "vitest";
import type { InteractionPlugin } from "@/plugins/types";
import type { StandardMessage } from "@/platform";
import type { InteractionResult } from "@/core/interactionTypes";
import { createMessage } from "./pluginHarness";
import { plugins } from "@/plugins/modules/random";
import { initEnvConfig } from "@/utils";

type ExecutablePlugin = InteractionPlugin & {
   matcher: RegExp;
   execute: (context: StandardMessage, matches?: RegExpMatchArray) => Promise<InteractionResult> | InteractionResult;
};

const isExecutablePlugin = (plugin?: InteractionPlugin): plugin is ExecutablePlugin =>
   Boolean(plugin?.execute && plugin.matcher);

const getPlugin = (id: string): ExecutablePlugin => {
   const plugin = plugins.find(entry => entry.id === id);
   if (!isExecutablePlugin(plugin)) {
      throw new Error(`random plugin '${id}' not available`);
   }
   return plugin;
};

const makeSeededRandom = (seed: number) => {
   let value = seed;
   return () => {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
   };
};

const withSeededRandom = async (seed: number, fn: () => Promise<void> | void): Promise<void> => {
   const random = makeSeededRandom(seed);
   const spy = vi.spyOn(Math, "random").mockImplementation(() => random());
   try {
      await fn();
   } finally {
      spy.mockRestore();
   }
};

describe("random plugin", () => {
   it("roll responds with dice results", async () => {
      await withSeededRandom(42, async () => {
         const roll = getPlugin("roll");
         const content = "!roll 2d6";
         const message = createMessage({ content });
         const matches = content.match(roll.matcher) ?? undefined;
         const result = await roll.execute(message, matches);
         expect(result.results.length).toBe(2);
         expect(result.results[0].contents).toMatch(/Result/);
         expect(result.results[1].contents).toMatch(/Total/);
         const numbers = result.results[0].contents.match(/\(([^)]+)\)/)?.[1]
            ?.split(",")
            .map(value => Number.parseInt(value.trim(), 10)) ?? [];
         expect(numbers.length).toBe(2);
         for (const value of numbers) {
            expect(value).toBeGreaterThanOrEqual(1);
            expect(value).toBeLessThanOrEqual(6);
         }
      });
   });

   it("clamps roll bounds to the allowed limits", async () => {
      await withSeededRandom(7, async () => {
         const roll = getPlugin("roll");
         const content = "!roll 999d999";
         const message = createMessage({ content });
         const matches = content.match(roll.matcher) ?? undefined;
         const result = await roll.execute(message, matches);
         expect(result.results[0].contents).toMatch(/100d120/);
      });
   });

   it("lotto responds with numbers in range", async () => {
      await withSeededRandom(1337, async () => {
         const lotto = getPlugin("lotto");
         const content = "give me 5 lotto numbers between 1 and 9";
         const message = createMessage({ content });
         const matches = content.match(lotto.matcher) ?? undefined;
         const result = await lotto.execute(message, matches);
         expect(result.results.length).toBe(2);
         const numbers = result.results[1].contents.split(",").map(value => Number.parseInt(value.trim(), 10));
         expect(numbers.length).toBe(5);
         for (const value of numbers) {
            expect(value).toBeGreaterThanOrEqual(1);
            expect(value).toBeLessThanOrEqual(9);
         }
      });
   });

   it("lotto respects unique flag", async () => {
      await withSeededRandom(2024, async () => {
         const lotto = getPlugin("lotto");
         const content = "give me 6 unique lotto numbers between 1 and 6";
         const message = createMessage({ content });
         const matches = content.match(lotto.matcher) ?? undefined;
         const result = await lotto.execute(message, matches);
         const numbers = result.results[1].contents.split(",").map(value => Number.parseInt(value.trim(), 10));
         const unique = new Set(numbers);
         expect(numbers.length).toBe(6);
         expect(unique.size).toBe(6);
      });
   });

   it("checkem responds with a number", async () => {
      await withSeededRandom(1, async () => {
         const checkem = getPlugin("checkem");
         const content = "checkem";
         const message = createMessage({ content, authorId: "user-1" });
         const matches = content.match(checkem.matcher) ?? undefined;
         const result = await checkem.execute(message, matches);
         expect(result.results.length).toBe(1);
         expect(result.results[0].contents).toMatch(/\d/);
      });
   });

   it("checkem highlights quads for the bot owner", async () => {
      process.env.BOT_OWNER_DISCORD_ID = "owner-1";
      initEnvConfig();
      const checkem = getPlugin("checkem");
      const content = "checkem";
      const message = createMessage({ content, authorId: "owner-1" });
      const matches = content.match(checkem.matcher) ?? undefined;
      const sequence = [0.1111, 0.95, 0.0, 0.0];
      const spy = vi.spyOn(Math, "random").mockImplementation(() => sequence.shift() ?? 0.1111);
      try {
         const result = await checkem.execute(message, matches);
         expect(result.results[0].contents).toBe("***1111***");
      } finally {
         spy.mockRestore();
         delete process.env.BOT_OWNER_DISCORD_ID;
         initEnvConfig();
      }
   });

   it("returns no results when roll input is invalid", async () => {
      const roll = getPlugin("roll");
      const content = "!roll";
      const message = createMessage({ content });
      const matches = content.match(roll.matcher) ?? undefined;
      const result = await roll.execute(message, matches);
      expect(result.results).toHaveLength(0);
   });

   it("returns no results when lotto count is zero", async () => {
      const lotto = getPlugin("lotto");
      const content = "give me 0 lotto numbers between 1 and 9";
      const message = createMessage({ content });
      const matches = content.match(lotto.matcher) ?? undefined;
      const result = await lotto.execute(message, matches);
      expect(result.results).toHaveLength(0);
   });
});
