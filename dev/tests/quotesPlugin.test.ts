import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createMessage } from "./pluginHarness";
import type { InteractionPlugin } from "@/plugins/types";

const testBible = JSON.stringify([
   {
      book: "Genesis",
      verses: [
         { ref: "1:1", text: "one" },
         { ref: "1:2", text: "two" },
         { ref: "1:3", text: "three" },
         { ref: "1:4", text: "four" },
         { ref: "1:5", text: "five" },
         { ref: "1:6", text: "six" },
         { ref: "1:7", text: "seven" }
      ]
   }
]);
const testA0L = "Alpha\nBeta";

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
         if (target.endsWith("a0l.txt")) {
            return testA0L;
         }
         if (target.endsWith("jokes.txt")) {
            return "Knock knock";
         }
         return actual.readFileSync(path as Parameters<typeof actual.readFileSync>[0], options as Parameters<typeof actual.readFileSync>[1]);
      }
   };
});

let quotesPlugin: InteractionPlugin | undefined;

beforeAll(async () => {
   const module = await import("@/plugins/modules/quotes");
   quotesPlugin = module.plugins.find(plugin => plugin.id === "quotes");
});

afterEach(() => {
   vi.unstubAllGlobals();
   vi.restoreAllMocks();
});

describe("quotes plugin", () => {
   it("returns a quote for a0l", async () => {
      if (!quotesPlugin?.execute) throw new Error("quotes plugin not available");
      vi.spyOn(Math, "random").mockReturnValue(0);
      const message = createMessage({ content: "a0l" });
      const result = await quotesPlugin.execute(message);
      expect(result.results.length).toBe(1);
      expect(result.results[0].contents).toBe("Alpha");
   });

   it("returns a quote for quote source", async () => {
      if (!quotesPlugin?.execute) throw new Error("quotes plugin not available");
      vi.spyOn(Math, "random").mockReturnValue(0);
      const message = createMessage({ content: "quote a0l" });
      const result = await quotesPlugin.execute(message);
      expect(result.results.length).toBe(1);
      expect(result.results[0].contents).toBe("Alpha");
   });

   it("rejects unknown sources", async () => {
      if (!quotesPlugin?.execute) throw new Error("quotes plugin not available");
      const message = createMessage({ content: "quote unknown" });
      const result = await quotesPlugin.execute(message);
      expect(result.results[0].contents).toMatch(/unknown quote source/i);
   });

   it("returns a bible verse range capped to five entries", async () => {
      if (!quotesPlugin?.execute) throw new Error("quotes plugin not available");
      const message = createMessage({ content: "bible genesis 1:1-7" });
      const result = await quotesPlugin.execute(message);
      expect(result.results[0].contents).toMatch(/only showing 5 verses/i);
      expect(result.results.length).toBe(6);
      expect(result.results[1].contents).toMatch(/^Genesis 1:1 - /u);
      expect(result.results[5].contents).toMatch(/^Genesis 1:5 - /u);
   });

   it("returns a verse when chapter is provided without verse", async () => {
      if (!quotesPlugin?.execute) throw new Error("quotes plugin not available");
      vi.spyOn(Math, "random").mockReturnValue(0);
      const message = createMessage({ content: "bible genesis 1" });
      const result = await quotesPlugin.execute(message);
      expect(result.results[0].contents).toMatch(/^Genesis 1:1 - /u);
   });

   it("returns a clear error when the book is unknown", async () => {
      if (!quotesPlugin?.execute) throw new Error("quotes plugin not available");
      const message = createMessage({ content: "bible necronomicon 1:1" });
      const result = await quotesPlugin.execute(message);
      expect(result.results[0].contents).toBe("no such book was found");
   });

   it("returns a clear error when the chapter is missing", async () => {
      if (!quotesPlugin?.execute) throw new Error("quotes plugin not available");
      const message = createMessage({ content: "bible genesis 999" });
      const result = await quotesPlugin.execute(message);
      expect(result.results[0].contents).toBe("no such chapter found in that book");
   });

   it("returns a clear error when no quote source matches", async () => {
      if (!quotesPlugin?.execute) throw new Error("quotes plugin not available");
      const message = createMessage({ content: "totally unrelated" });
      const result = await quotesPlugin.execute(message);
      expect(result.results[0].contents).toMatch(/no quote source matched/i);
   });

   it("uses API jokes when available", async () => {
      if (!quotesPlugin?.execute) throw new Error("quotes plugin not available");
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => "A funny joke" })) as unknown as typeof fetch);
      const message = createMessage({ content: "joke cats" });
      const result = await quotesPlugin.execute(message);
      expect(result.results[0].contents).toBe("A funny joke");
   });

   it("falls back to local jokes when API fails", async () => {
      if (!quotesPlugin?.execute) throw new Error("quotes plugin not available");
      vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("nope"); }) as unknown as typeof fetch);
      vi.spyOn(Math, "random").mockReturnValue(0);
      const message = createMessage({ content: "joke" });
      const result = await quotesPlugin.execute(message);
      expect(result.results[0].contents).toBe("Knock knock");
   });
});
