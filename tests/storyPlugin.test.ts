import { afterEach, describe, expect, it, vi } from "vitest";
import { Brain } from "../src/core";
import { plugins } from "../src/plugins/modules/story";
import { createMessage } from "./pluginHarness";

const storyPlugin = plugins.find(plugin => plugin.id === "story");

describe("story plugin", () => {
   afterEach(() => {
      vi.restoreAllMocks();
   });

   it("returns a story without looping forever on duplicates", async () => {
      if (!storyPlugin?.execute || !storyPlugin.matcher) throw new Error("story plugin not available");
      vi.spyOn(Math, "random").mockReturnValue(0);
      vi.spyOn(Brain, "getSeed").mockResolvedValue("seed");
      vi.spyOn(Brain, "getResponse").mockResolvedValue("same line");
      const message = createMessage({ content: "tell me a story", authorName: "Tester" });
      const matches = message.content.match(storyPlugin.matcher);
      const result = await storyPlugin.execute(message, matches ?? undefined);
      expect(result.results[0].contents).toBe("same line");
   });

   it("directs the story to the author when asked for me", async () => {
      if (!storyPlugin?.execute || !storyPlugin.matcher) throw new Error("story plugin not available");
      vi.spyOn(Math, "random").mockReturnValue(0);
      vi.spyOn(Brain, "getSeed").mockResolvedValue("seed");
      vi.spyOn(Brain, "getResponse").mockResolvedValue("a line");
      const message = createMessage({ content: "tell me a story", authorName: "Alex" });
      const matches = message.content.match(storyPlugin.matcher);
      const result = await storyPlugin.execute(message, matches ?? undefined);
      expect(result.directedTo).toBe("Alex");
      expect(result.results[0].contents).toBe("a line");
   });

   it("italicizes the story when told to yourself", async () => {
      if (!storyPlugin?.execute || !storyPlugin.matcher) throw new Error("story plugin not available");
      vi.spyOn(Math, "random").mockReturnValue(0);
      vi.spyOn(Brain, "getSeed").mockResolvedValue("seed");
      vi.spyOn(Brain, "getResponse").mockResolvedValue("whisper");
      const message = createMessage({ content: "tell yourself a story", authorName: "Alex" });
      const matches = message.content.match(storyPlugin.matcher);
      const result = await storyPlugin.execute(message, matches ?? undefined);
      expect(result.directedTo).toBeUndefined();
      expect(result.results[0].contents).toBe("*whisper*");
   });
});
