import { describe, expect, it } from "vitest";
import { createMessage } from "./pluginHarness";
import { plugins } from "../src/plugins/modules/quotes";

const quotesPlugin = plugins.find(plugin => plugin.id === "quotes");

describe("quotes plugin", () => {
   it("returns a quote for a0l", async () => {
      if (!quotesPlugin?.execute) throw new Error("quotes plugin not available");
      const message = createMessage({ content: "a0l" });
      const result = await quotesPlugin.execute(message);
      expect(result.results.length).toBe(1);
      expect(result.results[0].contents.length).toBeGreaterThan(0);
   });

   it("returns a quote for quote source", async () => {
      if (!quotesPlugin?.execute) throw new Error("quotes plugin not available");
      const message = createMessage({ content: "quote a0l" });
      const result = await quotesPlugin.execute(message);
      expect(result.results.length).toBe(1);
      expect(result.results[0].contents.length).toBeGreaterThan(0);
   });

   it("rejects unknown sources", async () => {
      if (!quotesPlugin?.execute) throw new Error("quotes plugin not available");
      const message = createMessage({ content: "quote unknown" });
      const result = await quotesPlugin.execute(message);
      expect(result.results[0].contents).toMatch(/unknown quote source/i);
   });
});
