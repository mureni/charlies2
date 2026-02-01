import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterRegistry } from "@/filters";
import { createMessage } from "./pluginHarness";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";
import { checkFilePath } from "@/utils";

const createRegistry = () => new FilterRegistry();

const context = createMessage({ content: "hello" });

describe("filter registry", () => {
   afterEach(() => {
      vi.restoreAllMocks();
   });

   it("registers filters and applies them in order", () => {
      const registry = createRegistry();
      registry.register({
         id: "first",
         stage: "preBrain",
         apply: (text) => `${text}-a`
      });
      registry.register({
         id: "second",
         stage: "preBrain",
         apply: (text) => `${text}-b`
      });

      const result = registry.apply("preBrain", "start", context, "learn");
      expect(result).toBe("start-a-b");
   });

   it("can skip filters by id", () => {
      const registry = createRegistry();
      registry.register({
         id: "skip-me",
         stage: "preBrain",
         apply: (text) => `${text}-skip`
      });
      registry.register({
         id: "keep-me",
         stage: "preBrain",
         apply: (text) => `${text}-keep`
      });

      const result = registry.apply("preBrain", "start", context, "learn", { skipIds: ["skip-me"] });
      expect(result).toBe("start-keep");
   });

   it("unregister removes filters across stages", () => {
      const registry = createRegistry();
      registry.register({ id: "dup", stage: "preBrain", apply: (text) => text });
      registry.register({ id: "dup", stage: "postBrain", apply: (text) => `${text}!` });
      registry.unregister("dup");
      expect(registry.list()).toHaveLength(0);
   });

   it("loads filters from dist when present", async () => {
      const registry = createRegistry();
      const distRoot = resolve(checkFilePath("code"), "filters");
      mkdirSync(distRoot, { recursive: true });
      const filename = `test-filter-${Date.now()}.js`;
      const filePath = resolve(distRoot, filename);
      writeFileSync(
         filePath,
         "module.exports = { filters: [{ id: 'dist-test', stage: 'preBrain', apply: (text) => text + '!'}] };",
         "utf8"
      );

      await registry.loadFromDist();
      const list = registry.list("preBrain");
      expect(list.some(filter => filter.id === "dist-test")).toBe(true);

      rmSync(filePath, { force: true });
   });
});
