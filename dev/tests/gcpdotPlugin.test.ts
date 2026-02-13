import { afterEach, describe, expect, it, vi } from "vitest";
import { plugins } from "@/plugins/modules/gcpdot";
import { GCPDot } from "@/plugins/modules/gcpdot/controller";
import { createMessage } from "./pluginHarness";

const gcpPlugin = plugins.find(plugin => plugin.id === "gcp");

describe("gcpdot plugin", () => {
   afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
   });

   it("returns an embed and attachment on success", async () => {
      if (!gcpPlugin?.execute || !gcpPlugin.matcher) throw new Error("gcp plugin not available");
      vi.spyOn(GCPDot, "getDotData").mockResolvedValue({
         image: Buffer.from("fake"),
         data: { color: "#fff", explanation: "All is well", index: 0.42 }
      });
      const message = createMessage({ content: "gcp" });
      const matches = message.content.match(gcpPlugin.matcher) ?? undefined;
      const result = await gcpPlugin.execute(message, matches);

      expect(result.results.length).toBe(1);
      const payload = result.results[0];
      expect(payload.attachments?.length).toBe(1);
      expect(payload.embeds?.[0]?.title).toMatch(/GCP Dot/i);
      expect(payload.embeds?.[0]?.description).toBe("All is well");
   });

   it("returns a friendly error on failure", async () => {
      if (!gcpPlugin?.execute || !gcpPlugin.matcher) throw new Error("gcp plugin not available");
      vi.spyOn(GCPDot, "getDotData").mockRejectedValue(new Error("boom"));
      const message = createMessage({ content: "gcp" });
      const matches = message.content.match(gcpPlugin.matcher) ?? undefined;
      const result = await gcpPlugin.execute(message, matches);

      expect(result.results[0].contents).toMatch(/error occurred/i);
      expect(result.results[0].contents).toMatch(/boom/i);
   });

   it("parses dot thresholds from raw data", () => {
      const result = GCPDot.parseDotResults("0.12 0.96 0.55");
      expect(result.index).toBe(0.96);
      expect(result.color).toBe("#2457fd");
      expect(result.explanation).toMatch(/index is above 95%/i);
   });

   it("fetches dot data when the request succeeds", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => "0.42" })) as unknown as typeof fetch);
      const result = await GCPDot.fetchGCPDotData();
      expect(result).toBe("0.42");
   });

   it("returns empty dot data when the request fails", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("nope"); }) as unknown as typeof fetch);
      const result = await GCPDot.fetchGCPDotData();
      expect(result).toBe("");
   });
});
