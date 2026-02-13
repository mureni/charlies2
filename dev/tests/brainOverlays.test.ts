import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/SQLiteCollections", () => ({
   SQLiteMap: class<K, V> extends Map<K, V> {
      constructor() {
         super();
      }
   }
}));

vi.mock("@/utils", () => ({
   checkFilePath: () => "memory.sqlite",
   env: () => "",
   envFlag: () => false,
   getBotName: () => "anonymous"
}));

beforeEach(() => {
   vi.resetModules();
});

describe("brain overlays", () => {
   it("stores and retrieves overlays by context", async () => {
      const { BrainOverlays } = await import("@/core/brainOverlays");
      const weights = new Map<string, number>([["focus", 0.8]]);
      BrainOverlays.setOverlay({ scope: "global" }, weights);

      const overlay = BrainOverlays.getOverlay({ scope: "global" });
      expect(overlay?.weights.get("focus")).toBe(0.8);
      expect(overlay?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
   });

   it("uses an unknown key when context ids are missing", async () => {
      const { BrainOverlays } = await import("@/core/brainOverlays");
      const weights = new Map<string, number>([["theme", 0.2]]);
      BrainOverlays.setOverlay({ scope: "community" }, weights);

      const overlay = BrainOverlays.getOverlay({ scope: "community" });
      expect(overlay?.context.scope).toBe("community");
      expect(overlay?.weights.get("theme")).toBe(0.2);
   });

   it("lists stored overlay contexts", async () => {
      const { BrainOverlays } = await import("@/core/brainOverlays");
      BrainOverlays.setOverlay({ scope: "global" }, new Map());
      BrainOverlays.setOverlay({ scope: "conversation", id: "thread-1" }, new Map());

      const contexts = BrainOverlays.listContexts();
      expect(contexts).toEqual(expect.arrayContaining([
         { scope: "global" },
         { scope: "conversation", id: "thread-1" }
      ]));
   });
});
