import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { TriggerPlugin } from "@/plugins/types";

const testBible = JSON.stringify([
   {
      book: "Test",
      verses: [
         { ref: "1:1", text: "alpha beta gamma" }
      ]
   }
]);

interface FsModule {
   readFileSync: (path: unknown, options?: unknown) => unknown;
   [key: string]: unknown;
}

vi.mock("fs", async (importOriginal) => {
   const actual = await importOriginal<FsModule>();
   return {
      ...actual,
      readFileSync: (path: unknown, options?: unknown) => {
         const target = typeof path === "string" ? path : String(path);
         if (target.endsWith("kjv.json")) {
            return testBible;
         }
         return actual.readFileSync(path as Parameters<typeof actual.readFileSync>[0], options as Parameters<typeof actual.readFileSync>[1]);
      }
   };
});

let prayPlugin: TriggerPlugin | undefined;

beforeAll(async () => {
   const module = await import("@/plugins/modules/pray");
   prayPlugin = module.plugins.find(plugin => plugin.id === "pray");
});

afterAll(() => {
   vi.restoreAllMocks();
});

describe("pray plugin", () => {
   it("returns a prayer with expected structure", async () => {
      if (!prayPlugin?.execute) throw new Error("pray plugin not available");
      vi.spyOn(Math, "random").mockReturnValue(0);
      const result = await prayPlugin.execute({
         id: "msg-1",
         content: "pray",
         authorId: "user-1",
         authorName: "User",
         isBot: false,
         channelId: "channel-1",
         isSelf: false
      });

      const contents = result.results[0].contents;
      expect(contents.startsWith("God says...")).toBe(true);
      const wordCount = contents.split(/\s+/u).filter(Boolean).length;
      expect(wordCount).toBe(23);
      expect(result.modifications.ProcessSwaps).toBe(true);
   });
});
