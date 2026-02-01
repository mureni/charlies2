import { afterEach, describe, expect, it, vi } from "vitest";
import { Brain } from "@/core";
import { plugins } from "@/plugins/modules/choose";
import { createMessage } from "./pluginHarness";

const choosePlugin = plugins.find(plugin => plugin.id === "choose");

describe("choose plugin", () => {
   afterEach(() => {
      vi.restoreAllMocks();
   });

   it("selects an option and uses the selected option as the seed", async () => {
      if (!choosePlugin?.execute || !choosePlugin.matcher) throw new Error("choose plugin not available");
      vi.spyOn(Math, "random").mockReturnValue(0);
      vi.spyOn(Brain, "getSeed").mockResolvedValue("seed:apple");
      vi.spyOn(Brain, "getResponse").mockResolvedValue("because apples are great");

      const message = createMessage({ content: "choose apples or bananas", authorName: "Alex" });
      const matches = message.content.match(choosePlugin.matcher) ?? undefined;
      const result = await choosePlugin.execute(message, matches);

      expect(result.directedTo).toBe("Alex");
      expect(result.results[0].contents).toBe("apples, because: because apples are great");
      expect(Brain.getSeed).toHaveBeenCalledWith("apples");
   });

   it("ignores extra whitespace between options", async () => {
      if (!choosePlugin?.execute || !choosePlugin.matcher) throw new Error("choose plugin not available");
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      vi.spyOn(Brain, "getSeed").mockResolvedValue("seed:banana");
      vi.spyOn(Brain, "getResponse").mockResolvedValue("because bananas");

      const message = createMessage({ content: "choose   apples   or    bananas   " });
      const matches = message.content.match(choosePlugin.matcher) ?? undefined;
      const result = await choosePlugin.execute(message, matches);

      expect(result.results[0].contents).toBe("bananas, because: because bananas");
   });
});
