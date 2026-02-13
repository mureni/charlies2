import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { buildBrainStats, getBrainDbPath, getDefaultPlugins, getLexiconPage, getWordDetail, getNgramDetail, getNgramPage, getTopTokens } from "../admin-portal/server";

describe("admin portal api helpers", () => {
   it("includes the brain panel in plugin list", () => {
      const plugins = getDefaultPlugins();
      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins.some((plugin) => plugin.id === "brain")).toBe(true);
      for (const plugin of plugins) {
         expect(typeof plugin.id).toBe("string");
         expect(plugin.id.length).toBeGreaterThan(0);
         expect(typeof plugin.name).toBe("string");
         expect(plugin.name.length).toBeGreaterThan(0);
         expect(plugin.script).toBe(`/plugins/${plugin.id}/index.js`);
      }
   });

   it("returns an empty plugin list when public dir is missing", () => {
      const plugins = getDefaultPlugins("/missing-admin-portal");
      expect(plugins).toEqual([]);
   });

   it("reads manifest names and sorts plugins by name", () => {
      const baseDir = mkdtempSync(join(os.tmpdir(), "admin-portal-"));
      const pluginsDir = join(baseDir, "plugins");
      const alphaDir = join(pluginsDir, "alpha-plugin");
      const betaDir = join(pluginsDir, "beta");
      mkdirSync(alphaDir, { recursive: true });
      mkdirSync(betaDir, { recursive: true });
      writeFileSync(join(alphaDir, "index.js"), "// alpha", "utf8");
      writeFileSync(join(alphaDir, "manifest.json"), JSON.stringify({ name: "Zeta" }), "utf8");
      writeFileSync(join(betaDir, "index.js"), "// beta", "utf8");

      const plugins = getDefaultPlugins(baseDir);

      expect(plugins.map(plugin => plugin.id)).toEqual(["beta", "alpha-plugin"]);
      expect(plugins.map(plugin => plugin.name)).toEqual(["Beta", "Zeta"]);
      expect(plugins[0]?.script).toBe("/plugins/beta/index.js");
      expect(plugins[1]?.script).toBe("/plugins/alpha-plugin/index.js");

      rmSync(baseDir, { recursive: true, force: true });
   });

   it("builds brain stats payload", () => {
      const stats = buildBrainStats();
      expect(typeof stats.lexiconCount).toBe("number");
      expect(typeof stats.ngramCount).toBe("number");
      expect(stats.overlays).toBeTruthy();
      expect(Array.isArray(stats.overlays.contexts)).toBe(true);
      expect(stats.overlays.total).toBe(stats.overlays.contexts.length);
   });

   it("resolves brain snapshot path", () => {
      const path = getBrainDbPath();
      expect(path.endsWith(".sqlite")).toBe(true);
   });

   it("returns a lexicon page shape", () => {
      const page = getLexiconPage("", 0, 5);
      expect(page.items).toBeTruthy();
      expect(page.offset).toBe(0);
      expect(page.limit).toBe(5);
      expect(page.items.length).toBeLessThanOrEqual(5);
      expect(page.total).toBeGreaterThanOrEqual(page.items.length);
   });

   it("clamps lexicon paging input", () => {
      const page = getLexiconPage("", -10, 0);
      expect(page.offset).toBe(0);
      expect(page.limit).toBeGreaterThanOrEqual(1);
      expect(page.items.length).toBeLessThanOrEqual(page.limit);
   });

   it("handles missing word detail", () => {
      const detail = getWordDetail("not-a-real-word", 5);
      expect(detail).toBeUndefined();
   });

   it("handles empty word queries", () => {
      const detail = getWordDetail("   ", 5);
      expect(detail).toBeUndefined();
   });

   it("handles missing ngram detail", () => {
      const detail = getNgramDetail("not-a-real-hash", 5);
      expect(detail).toBeUndefined();
   });

   it("handles empty ngram queries", () => {
      const detail = getNgramDetail("", 5);
      expect(detail).toBeUndefined();
   });

   it("returns an ngram page shape", () => {
      const page = getNgramPage({ offset: 0, limit: 5 });
      expect(page.items).toBeTruthy();
      expect(page.offset).toBe(0);
      expect(page.limit).toBe(5);
      expect(page.index).toBeTruthy();
      expect(["idle", "building", "ready"]).toContain(page.index.state);
   });

   it("clamps ngram paging input", () => {
      const page = getNgramPage({ offset: -5, limit: 0 });
      expect(page.offset).toBe(0);
      expect(page.limit).toBeGreaterThanOrEqual(1);
      expect(page.items.length).toBeLessThanOrEqual(page.limit);
   });

   it("returns top tokens list", () => {
      const top = getTopTokens(5);
      expect(Array.isArray(top)).toBe(true);
      expect(top.length).toBeLessThanOrEqual(5);
      for (const entry of top) {
         expect(typeof entry.token).toBe("string");
         expect(typeof entry.count).toBe("number");
      }
   });

   it("clamps token list limit", () => {
      const top = getTopTokens(-5);
      expect(Array.isArray(top)).toBe(true);
      expect(top.length).toBeLessThanOrEqual(1);
   });
});
