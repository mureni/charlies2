import { afterEach, describe, expect, it, vi } from "vitest";
import { Madlibs } from "@/plugins/modules/madlibs/manager";
import { plugins } from "@/plugins/modules/madlibs";
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

   it("runs edit sessions inside direct messages", async () => {
      if (!madlibsPlugin?.execute) throw new Error("madlibs plugin not available");
      const category = `session-${Date.now()}`;
      const dmMessage = createMessage({
         content: `madlib edit ${category}`,
         channelId: "dm-1",
         channel: {
            id: "dm-1",
            name: "DM",
            type: "dm",
            scope: "dm",
            supportsText: true,
            supportsVoice: false,
            supportsTyping: true,
            supportsHistory: false
         }
      });

      const start = await madlibsPlugin.execute(dmMessage);
      expect(start.results[0].contents).toMatch(/Editing/);

      const enterType = await madlibsPlugin.execute({ ...dmMessage, content: "1" });
      expect(enterType.results[0].contents).toMatch(/Enter vocab type/);

      const enterWord = await madlibsPlugin.execute({ ...dmMessage, content: "noun" });
      expect(enterWord.results[0].contents).toMatch(/Enter word/);

      const added = await madlibsPlugin.execute({ ...dmMessage, content: "lantern" });
      expect(added.results[0].contents).toMatch(/Added `lantern`/i);

      const list = await madlibsPlugin.execute({ ...dmMessage, content: "5" });
      expect(list.results[0].contents).toMatch(/Vocab:/i);

      const saved = await madlibsPlugin.execute({ ...dmMessage, content: "8" });
      expect(saved.results[0].contents).toMatch(/Session saved/i);

      Madlibs.clearOverlay(category);
   });

   it("supports session menu actions including export and cancel", async () => {
      if (!madlibsPlugin?.execute) throw new Error("madlibs plugin not available");
      const category = `session-menu-${Date.now()}`;
      const dmMessage = createMessage({
         content: `madlib edit ${category}`,
         channelId: "dm-2",
         channel: {
            id: "dm-2",
            name: "DM",
            type: "dm",
            scope: "dm",
            supportsText: true,
            supportsVoice: false,
            supportsTyping: true,
            supportsHistory: false
         }
      });

      await madlibsPlugin.execute(dmMessage);
      await madlibsPlugin.execute({ ...dmMessage, content: "1" });
      await madlibsPlugin.execute({ ...dmMessage, content: "noun" });
      const addWord = await madlibsPlugin.execute({ ...dmMessage, content: "lantern" });
      expect(addWord.results[0].contents).toMatch(/Added `lantern`/i);

      await madlibsPlugin.execute({ ...dmMessage, content: "3" });
      const addPattern = await madlibsPlugin.execute({ ...dmMessage, content: "the [noun] jumps" });
      expect(addPattern.results[0].contents).toMatch(/Pattern added/i);

      const listPatterns = await madlibsPlugin.execute({ ...dmMessage, content: "6" });
      expect(listPatterns.results[0].contents).toMatch(/the \[noun\] jumps/i);

      const exportResult = await madlibsPlugin.execute({ ...dmMessage, content: "7" });
      expect(exportResult.results[0].contents).toMatch(/```json/);
      expect(exportResult.results[0].contents).toMatch(new RegExp(category));

      await madlibsPlugin.execute({ ...dmMessage, content: "4" });
      const removePattern = await madlibsPlugin.execute({ ...dmMessage, content: "the [noun] jumps" });
      expect(removePattern.results[0].contents).toMatch(/Pattern removed/i);

      await madlibsPlugin.execute({ ...dmMessage, content: "2" });
      await madlibsPlugin.execute({ ...dmMessage, content: "noun" });
      const removeWord = await madlibsPlugin.execute({ ...dmMessage, content: "lantern" });
      expect(removeWord.results[0].contents).toMatch(/Removed `lantern`/i);

      const cancelled = await madlibsPlugin.execute({ ...dmMessage, content: "9" });
      expect(cancelled.results[0].contents).toMatch(/Session cancelled/i);

      Madlibs.clearOverlay(category);
   });

   it("falls back to a safe matcher when category meta is invalid", async () => {
      if (!madlibsPlugin?.execute || !madlibsPlugin.onLoad || !madlibsPlugin.onUnload) {
         throw new Error("madlibs plugin not available");
      }
      const builtin = "hippy";
      Madlibs.setCategoryMeta(builtin, { matcher: "[" });
      madlibsPlugin.onLoad();

      vi.spyOn(Math, "random").mockReturnValue(0);
      const result = await madlibsPlugin.execute(createMessage({ content: builtin }));
      expect(result.results[0].contents.length).toBeGreaterThan(0);

      madlibsPlugin.onUnload();
      Madlibs.clearCategoryMeta(builtin);
   });

   it("ignores session input when no session exists", async () => {
      if (!madlibsPlugin?.execute) throw new Error("madlibs plugin not available");
      const message = createMessage({ content: "totally unrelated" });
      const result = await madlibsPlugin.execute(message);
      expect(result.results.length).toBe(0);
   });

   it("rejects edit sessions outside DMs", async () => {
      if (!madlibsPlugin?.execute) throw new Error("madlibs plugin not available");
      const message = createMessage({
         content: "madlib edit custom",
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
      expect(result.results[0].contents).toMatch(/direct messages/i);
   });

   it("adds and removes patterns via command syntax", async () => {
      if (!madlibsPlugin?.execute) throw new Error("madlibs plugin not available");
      const category = `custom-${Date.now()}`;
      const addMessage = createMessage({ content: `madlib-add-pattern ${category} the [noun] sleeps` });
      const addResult = await madlibsPlugin.execute(addMessage);
      expect(addResult.results[0].contents).toMatch(/added `the \[noun\] sleeps`/i);

      const removeMessage = createMessage({ content: `madlib-remove-pattern ${category} the [noun] sleeps` });
      const removeResult = await madlibsPlugin.execute(removeMessage);
      expect(removeResult.results[0].contents).toMatch(/removed `the \[noun\] sleeps`/i);

      Madlibs.clearOverlay(category);
   });
});
