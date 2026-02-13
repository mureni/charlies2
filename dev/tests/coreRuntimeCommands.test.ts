import { beforeEach, describe, expect, it, vi } from "vitest";
import { KnownUsers, upsertKnownUser } from "@/core/knownUsers";
import { initEnvConfig } from "@/utils";

const handleCommand = vi.fn();
const initialize = vi.fn(async () => []);
const processMessage = vi.fn();

const Brain = {
   botName: "unit-test",
   settings: { learnFromBots: false },
   lexicon: new Map<string, Set<string>>([["x", new Set()]]),
   nGrams: new Map<string, object>([["x", {}]]),
   loadSettings: vi.fn(() => true),
   trainFromFile: vi.fn(async () => true),
   saveSettings: vi.fn(() => true)
};

vi.mock("@/core/interactionRouter", () => ({
   InteractionRouter: {
      handleCommand,
      initialize
   }
}));

vi.mock("@/core/messageProcessor", () => ({
   processMessage: (...args: unknown[]) => processMessage(...args)
}));

vi.mock("@/core/brain", () => ({
   Brain
}));

vi.mock("@/core/knownUsers", () => ({
   KnownUsers: new Map<string, unknown>(),
   upsertKnownUser: vi.fn(),
   syncKnownUserProfile: vi.fn()
}));

describe("core runtime command handling", () => {
   beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
      handleCommand.mockClear();
      initialize.mockClear();
      processMessage.mockClear();
      Brain.botName = "unit-test";
      Brain.settings = { learnFromBots: false };
      Brain.lexicon = new Map([["x", new Set()]]) as unknown as typeof Brain.lexicon;
      Brain.nGrams = new Map([["x", {}]]) as unknown as typeof Brain.nGrams;
      Brain.loadSettings.mockReturnValue(true);
      Brain.trainFromFile.mockResolvedValue(true);
      process.env.BOT_NAME = Brain.botName;
      process.env.NODE_ENV = "test";
      initEnvConfig();
   });

   it("skips commands before initialization", async () => {
      const { handleCoreCommand } = await import("@/core/runtime");
      await handleCoreCommand({
         command: "help",
         options: {},
         userId: "u1",
         channelId: "c1",
         reply: async () => undefined
      });

      expect(handleCommand).not.toHaveBeenCalled();
   });

   it("delegates commands after initialization", async () => {
      const { startCoreInitialization, isCoreInitialized, handleCoreCommand } = await import("@/core/runtime");
      await startCoreInitialization();

      expect(isCoreInitialized()).toBe(true);

      const interaction = {
         command: "help",
         options: {},
         userId: "u1",
         channelId: "c1",
         reply: async () => undefined
      };
      await handleCoreCommand(interaction);

      expect(handleCommand).toHaveBeenCalledWith(interaction);
   });

   it("skips bot messages when learnFromBots is disabled", async () => {
      const { startCoreInitialization, handleCoreMessage } = await import("@/core/runtime");
      await startCoreInitialization();
      processMessage.mockResolvedValue({ learned: false, processedText: "" });

      const result = await handleCoreMessage({
         id: "msg-1",
         content: "hello",
         authorId: "bot-2",
         authorName: "OtherBot",
         isBot: true,
         channelId: "c1",
         isSelf: false
      });

      expect(result).toBeNull();
      expect(processMessage).not.toHaveBeenCalled();
   });

   it("persists dirty brain settings after learning", async () => {
      const { startCoreInitialization, handleCoreMessage, shutdownCore } = await import("@/core/runtime");
      await startCoreInitialization();
      processMessage.mockResolvedValue({
         learned: true,
         processedText: "seed text",
         response: "reply"
      });

      await handleCoreMessage({
         id: "msg-2",
         content: "hello",
         authorId: "u2",
         authorName: "User",
         isBot: false,
         channelId: "c1",
         isSelf: false
      });

      await shutdownCore();

      expect(Brain.saveSettings).toHaveBeenCalledWith(Brain.botName);
   });

   it("processes bot messages when learnFromBots is enabled", async () => {
      const { startCoreInitialization, handleCoreMessage } = await import("@/core/runtime");
      Brain.settings = { learnFromBots: true };
      await startCoreInitialization();
      processMessage.mockResolvedValue({ learned: false, processedText: "" });

      await handleCoreMessage({
         id: "msg-3",
         content: "bot hello",
         authorId: "bot-2",
         authorName: "OtherBot",
         isBot: true,
         channelId: "c1",
         isSelf: false
      });

      expect(processMessage).toHaveBeenCalled();
   });

   it("does not upsert known users that already exist", async () => {
      const { startCoreInitialization, handleCoreMessage } = await import("@/core/runtime");
      await startCoreInitialization();
      processMessage.mockResolvedValue({ learned: false, processedText: "" });
      (KnownUsers as Map<string, unknown>).set("user-1", { name: "User" });

      await handleCoreMessage({
         id: "msg-4",
         content: "hello",
         authorId: "user-1",
         authorName: "User",
         isBot: false,
         channelId: "c1",
         isSelf: false
      });

      expect(upsertKnownUser).not.toHaveBeenCalled();
   });

   it("skips known user sync when authorId is missing", async () => {
      const { startCoreInitialization, handleCoreMessage } = await import("@/core/runtime");
      await startCoreInitialization();
      processMessage.mockResolvedValue({ learned: false, processedText: "" });

      await handleCoreMessage({
         id: "msg-5",
         content: "hello",
         authorId: "",
         authorName: "User",
         isBot: false,
         channelId: "c1",
         isSelf: false
      });

      expect(upsertKnownUser).not.toHaveBeenCalled();
   });

   it("skips self messages", async () => {
      const { startCoreInitialization, handleCoreMessage } = await import("@/core/runtime");
      await startCoreInitialization();
      processMessage.mockResolvedValue({ learned: false, processedText: "" });

      const result = await handleCoreMessage({
         id: "msg-6",
         content: "hello",
         authorId: "user-2",
         authorName: "User",
         isBot: false,
         channelId: "c1",
         isSelf: true
      });

      expect(result).toBeNull();
      expect(processMessage).not.toHaveBeenCalled();
   });
});
