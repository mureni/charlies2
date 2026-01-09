import { afterEach, describe, expect, it, vi } from "vitest";
import { Madlibs } from "../src/plugins/modules/madlibs/manager";
import { plugins } from "../src/plugins/modules/madlibs";
import { createMessage } from "./pluginHarness";

const madlibsPlugin = plugins.find(plugin => plugin.id === "madlibs");

describe("madlibs plugin", () => {
   afterEach(() => {
      vi.restoreAllMocks();
      Madlibs.saveAccessConfig({});
   });

   it("generates hippy output", async () => {
      if (!madlibsPlugin?.execute) throw new Error("madlibs plugin not available");
      vi.spyOn(Math, "random").mockReturnValue(0);
      const message = createMessage({ content: "hippy" });
      const result = await madlibsPlugin.execute(message);
      expect(result.results[0].contents.length).toBeGreaterThan(0);
   });

   it("reuses vocab when placeholders exceed unique words", async () => {
      if (!madlibsPlugin?.execute) throw new Error("madlibs plugin not available");
      const category = `test-madlib-${Date.now()}`;
      Madlibs.addPattern(category, "[noun] [noun]");
      Madlibs.addVocab(category, "[noun]", "banana");
      vi.spyOn(Math, "random").mockReturnValue(0);
      const message = createMessage({ content: `madlib ${category}` });
      const result = await madlibsPlugin.execute(message);
      expect(result.results[0].contents).toBe("banana banana.");
      expect(result.results[0].contents).not.toMatch(/\[noun\]|undefined/iu);
      Madlibs.clearOverlay(category);
   });

   it("rejects edits to built-in categories", async () => {
      if (!madlibsPlugin?.execute) throw new Error("madlibs plugin not available");
      const message = createMessage({ content: "madlib-add-word hippy noun sunshine" });
      const result = await madlibsPlugin.execute(message);
      expect(result.results[0].contents).toMatch(/read-only/iu);
   });

   it("applies tombstones to base patterns", () => {
      const snapshot = Madlibs.getCategorySnapshot("general");
      const pattern = snapshot?.base?.patterns?.[0];
      if (!pattern) throw new Error("missing base pattern for general");
      Madlibs.removePattern("general", pattern);
      const updated = Madlibs.getCategorySnapshot("general");
      expect(updated?.merged?.patterns).not.toContain(pattern);
      Madlibs.clearOverlay("general");
   });

   it("applies tombstones to base vocab", () => {
      const snapshot = Madlibs.getCategorySnapshot("general");
      const vocab = snapshot?.base?.vocab ?? {};
      const vocabType = Object.keys(vocab)[0];
      const word = vocabType ? vocab[vocabType]?.[0] : undefined;
      if (!vocabType || !word) throw new Error("missing base vocab for general");
      Madlibs.removeVocab("general", vocabType, word);
      const updated = Madlibs.getCategorySnapshot("general");
      expect(updated?.merged?.vocab?.[vocabType]).not.toContain(word);
      Madlibs.clearOverlay("general");
   });

   it("expands format tokens inside vocab entries", async () => {
      if (!madlibsPlugin?.execute) throw new Error("madlibs plugin not available");
      const category = `test-format-${Date.now()}`;
      Madlibs.addPattern(category, "[ticket]");
      Madlibs.addVocab(category, "[ticket]", "JIRA-[A-Z]{2,4}-[####]-[a-z]{3}-#{2}");
      vi.spyOn(Math, "random").mockReturnValue(0);
      const message = createMessage({ content: `madlib ${category}` });
      const result = await madlibsPlugin.execute(message);
      expect(result.results[0].contents).toBe("JIRA-AA-0000-aaa-00.");
      Madlibs.clearOverlay(category);
   });

   it("blocks disallowed categories per guild", async () => {
      if (!madlibsPlugin?.execute) throw new Error("madlibs plugin not available");
      Madlibs.saveAccessConfig({
         guilds: {
            "guild-1": {
               deny: ["hippy"]
            }
         }
      });
      const message = createMessage({
         content: "hippy",
         guildId: "guild-1",
         channelId: "channel-1",
         channel: {
            id: "channel-1",
            name: "general",
            type: "text",
            scope: "server",
            guildId: "guild-1",
            supportsText: true,
            supportsVoice: false,
            supportsTyping: true,
            supportsHistory: true
         }
      });
      const result = await madlibsPlugin.execute(message);
      expect(result.results[0].contents).toMatch(/disabled in this context/i);
   });
});
