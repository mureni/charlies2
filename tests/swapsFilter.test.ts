import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Filters } from "@/filters";
import { Swaps } from "@/filters/swaps/manager";
import { registerSwapFilters, unregisterSwapFilters } from "@/filters/swaps";
import { createMessage } from "./pluginHarness";

const resetSwapStore = () => {
   (Swaps as unknown as { rules: { clear: () => void } }).rules.clear();
   (Swaps as unknown as { groups: { clear: () => void } }).groups.clear();
   (Swaps as unknown as { legacy: { clear: () => void } }).legacy.clear();
};

describe("swaps filter", () => {
   beforeEach(() => {
      Filters.clear();
      resetSwapStore();
      registerSwapFilters();
   });

   afterEach(() => {
      unregisterSwapFilters();
      Filters.clear();
      resetSwapStore();
   });

   it("registers two swap filters", () => {
      const list = Filters.list();
      const swaps = list.filter(filter => filter.id === "swaps");
      expect(swaps).toHaveLength(2);
   });

   it("applies swaps only in the correct phase", () => {
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
      const preLearn = Filters.apply("preBrain", "fudge", context, "learn");
      const preRespond = Filters.apply("preBrain", "fudge", context, "respond");
      const postRespond = Filters.apply("postBrain", "fudge", context, "respond");

      expect(preLearn).toBe("frick");
      expect(preRespond).toBe("fudge");
      expect(postRespond).toBe("frick");
   });
});
