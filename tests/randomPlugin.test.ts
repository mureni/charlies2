import { describe, expect, it, vi } from "vitest";
import type { TriggerPlugin } from "@/plugins/types";
import type { CoreMessage } from "@/platform";
import type { TriggerResult } from "@/core/triggerTypes";
import { createMessage } from "./pluginHarness";
import { plugins } from "@/plugins/modules/random";

type ExecutablePlugin = TriggerPlugin & {
   matcher: RegExp;
   execute: (context: CoreMessage, matches?: RegExpMatchArray) => Promise<TriggerResult> | TriggerResult;
};

const isExecutablePlugin = (plugin?: TriggerPlugin): plugin is ExecutablePlugin =>
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

const withSeededRandom = async (seed: number, fn: () => Promise<void> | void) => {
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
});
