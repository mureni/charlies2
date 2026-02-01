import { describe, expect, it } from "vitest";
import { buildBrainStats, getBrainDbPath, getDefaultPlugins, getLexiconPage, getWordDetail, getNgramDetail, getNgramPage, getTopTokens } from "@/admin-portal/server";

describe("admin portal api helpers", () => {
   it("includes the brain panel in plugin list", () => {
      const plugins = getDefaultPlugins();
      expect(plugins.some((plugin) => plugin.id === "brain")).toBe(true);
   });

   it("builds brain stats payload", () => {
      const stats = buildBrainStats();
      expect(typeof stats.lexiconCount).toBe("number");
      expect(typeof stats.ngramCount).toBe("number");
      expect(stats.overlays).toBeTruthy();
      expect(Array.isArray(stats.overlays.contexts)).toBe(true);
   });

   it("resolves brain snapshot path", () => {
      const path = getBrainDbPath();
      expect(path.endsWith(".sqlite")).toBe(true);
   });

   it("returns a lexicon page shape", () => {
      const page = getLexiconPage("", 0, 5);
      expect(page.items).toBeTruthy();
      expect(page.limit).toBeGreaterThan(0);
   });

   it("handles missing word detail", () => {
      const detail = getWordDetail("not-a-real-word", 5);
      expect(detail).toBeUndefined();
   });

   it("handles missing ngram detail", () => {
      const detail = getNgramDetail("not-a-real-hash", 5);
      expect(detail).toBeUndefined();
   });

   it("returns an ngram page shape", () => {
      const page = getNgramPage({ offset: 0, limit: 5 });
      expect(page.items).toBeTruthy();
      expect(page.limit).toBeGreaterThan(0);
      expect(page.index).toBeTruthy();
   });

   it("returns top tokens list", () => {
      const top = getTopTokens(5);
      expect(Array.isArray(top)).toBe(true);
      expect(top.length).toBeLessThanOrEqual(5);
   });
});
