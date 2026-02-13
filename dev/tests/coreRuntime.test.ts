import { beforeEach, describe, expect, it, vi } from "vitest";
import { initEnvConfig } from "@/utils";

const syncKnownUserProfile = vi.fn();
const upsertKnownUser = vi.fn();
const KnownUsers = new Map<string, unknown>();

vi.mock("@/core/knownUsers", () => ({
   KnownUsers,
   upsertKnownUser,
   syncKnownUserProfile,
   saveKnownUser: vi.fn(),
   touchKnownUser: vi.fn(),
   getKnownUsersSnapshot: vi.fn()
}));

const setCoreEnv = (botName: string): void => {
   process.env.BOT_NAME = botName;
   process.env.NODE_ENV = "test";
   initEnvConfig();
};

describe("core runtime", () => {
   beforeEach(() => {
      vi.restoreAllMocks();
      KnownUsers.clear();
      delete process.env.BOT_NAME;
      delete process.env.NODE_ENV;
      initEnvConfig();
   });

   it("preflightCoreEnv throws when required env vars are missing", async () => {
      const { preflightCoreEnv } = await import("@/core/runtime");
      process.env.NODE_ENV = "";
      initEnvConfig();
      expect(() => preflightCoreEnv()).toThrow(/NODE_ENV/i);
   });

   it("handleCoreMessage returns null before initialization", async () => {
      const { handleCoreMessage } = await import("@/core/runtime");
      const result = await handleCoreMessage({
         id: "msg-1",
         content: "hello",
         authorId: "user-1",
         authorName: "User",
         isBot: false,
         channelId: "chan-1",
         isSelf: false
      });
      expect(result).toBeNull();
   });

   it("syncs known user profiles on user.updated events after init", async () => {
      const botName = "unit-test";
      setCoreEnv(botName);
      const { Brain } = await import("@/core/brain");
      const { InteractionRouter } = await import("@/core/interactionRouter");
      const { startCoreInitialization, isCoreInitialized, handlePlatformEvent } = await import("@/core/runtime");

      vi.spyOn(Brain, "loadSettings").mockReturnValue(true);
      vi.spyOn(Brain, "trainFromFile").mockResolvedValue(true);
      vi.spyOn(InteractionRouter, "initialize").mockResolvedValue([]);
      Brain.botName = botName;
      Brain.lexicon = new Map([["x", new Set()]]) as unknown as typeof Brain.lexicon;
      Brain.nGrams = new Map([["x", {} as unknown as object]]) as unknown as typeof Brain.nGrams;

      await startCoreInitialization();
      expect(isCoreInitialized()).toBe(true);

      await handlePlatformEvent({
         type: "user.updated",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { id: "u1", username: "neo" }
      });

      expect(syncKnownUserProfile).toHaveBeenCalledWith({ id: "u1", username: "neo", displayName: undefined });
   });

   it("ignores user updates that lack a username", async () => {
      const botName = "unit-test";
      setCoreEnv(botName);
      const { Brain } = await import("@/core/brain");
      const { InteractionRouter } = await import("@/core/interactionRouter");
      const { startCoreInitialization, handlePlatformEvent } = await import("@/core/runtime");

      vi.spyOn(Brain, "loadSettings").mockReturnValue(true);
      vi.spyOn(Brain, "trainFromFile").mockResolvedValue(true);
      vi.spyOn(InteractionRouter, "initialize").mockResolvedValue([]);
      Brain.botName = botName;
      Brain.lexicon = new Map([["x", new Set()]]) as unknown as typeof Brain.lexicon;
      Brain.nGrams = new Map([["x", {} as unknown as object]]) as unknown as typeof Brain.nGrams;

      await startCoreInitialization();
      syncKnownUserProfile.mockClear();

      await handlePlatformEvent({
         type: "user.updated",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { id: "u1" }
      });

      expect(syncKnownUserProfile).not.toHaveBeenCalled();
   });

   it("ignores member updates without userId or username", async () => {
      const botName = "unit-test";
      setCoreEnv(botName);
      const { Brain } = await import("@/core/brain");
      const { InteractionRouter } = await import("@/core/interactionRouter");
      const { startCoreInitialization, handlePlatformEvent } = await import("@/core/runtime");

      vi.spyOn(Brain, "loadSettings").mockReturnValue(true);
      vi.spyOn(Brain, "trainFromFile").mockResolvedValue(true);
      vi.spyOn(InteractionRouter, "initialize").mockResolvedValue([]);
      Brain.botName = botName;
      Brain.lexicon = new Map([["x", new Set()]]) as unknown as typeof Brain.lexicon;
      Brain.nGrams = new Map([["x", {} as unknown as object]]) as unknown as typeof Brain.nGrams;

      await startCoreInitialization();
      syncKnownUserProfile.mockClear();

      await handlePlatformEvent({
         type: "member.added",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { id: "m1", displayName: "Member" }
      });

      expect(syncKnownUserProfile).not.toHaveBeenCalled();
   });

   it("handles reaction events without message ids", async () => {
      const botName = "unit-test";
      setCoreEnv(botName);
      const { Brain } = await import("@/core/brain");
      const { InteractionRouter } = await import("@/core/interactionRouter");
      const { startCoreInitialization, handlePlatformEvent } = await import("@/core/runtime");

      vi.spyOn(Brain, "loadSettings").mockReturnValue(true);
      vi.spyOn(Brain, "trainFromFile").mockResolvedValue(true);
      vi.spyOn(InteractionRouter, "initialize").mockResolvedValue([]);
      Brain.botName = botName;
      Brain.lexicon = new Map([["x", new Set()]]) as unknown as typeof Brain.lexicon;
      Brain.nGrams = new Map([["x", {} as unknown as object]]) as unknown as typeof Brain.nGrams;

      await startCoreInitialization();

      await expect(handlePlatformEvent({
         type: "reaction.added",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { emoji: { name: "fire" } }
      })).resolves.toBeUndefined();
   });

   it("handles message delete events with missing ids", async () => {
      const botName = "unit-test";
      setCoreEnv(botName);
      const { Brain } = await import("@/core/brain");
      const { InteractionRouter } = await import("@/core/interactionRouter");
      const { startCoreInitialization, handlePlatformEvent } = await import("@/core/runtime");

      vi.spyOn(Brain, "loadSettings").mockReturnValue(true);
      vi.spyOn(Brain, "trainFromFile").mockResolvedValue(true);
      vi.spyOn(InteractionRouter, "initialize").mockResolvedValue([]);
      Brain.botName = botName;
      Brain.lexicon = new Map([["x", new Set()]]) as unknown as typeof Brain.lexicon;
      Brain.nGrams = new Map([["x", {} as unknown as object]]) as unknown as typeof Brain.nGrams;

      await startCoreInitialization();

      await expect(handlePlatformEvent({
         type: "message.deleted",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { content: "missing id" }
      })).resolves.toBeUndefined();
   });

   it("handles typing events with missing channel/user ids", async () => {
      const botName = "unit-test";
      setCoreEnv(botName);
      const { Brain } = await import("@/core/brain");
      const { InteractionRouter } = await import("@/core/interactionRouter");
      const { startCoreInitialization, handlePlatformEvent } = await import("@/core/runtime");

      vi.spyOn(Brain, "loadSettings").mockReturnValue(true);
      vi.spyOn(Brain, "trainFromFile").mockResolvedValue(true);
      vi.spyOn(InteractionRouter, "initialize").mockResolvedValue([]);
      Brain.botName = botName;
      Brain.lexicon = new Map([["x", new Set()]]) as unknown as typeof Brain.lexicon;
      Brain.nGrams = new Map([["x", {} as unknown as object]]) as unknown as typeof Brain.nGrams;

      await startCoreInitialization();

      await expect(handlePlatformEvent({
         type: "typing.started",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { channelId: "c1" }
      })).resolves.toBeUndefined();
   });

   it("handles bulk message deletes with missing ids", async () => {
      const botName = "unit-test";
      setCoreEnv(botName);
      const { Brain } = await import("@/core/brain");
      const { InteractionRouter } = await import("@/core/interactionRouter");
      const { startCoreInitialization, handlePlatformEvent } = await import("@/core/runtime");

      vi.spyOn(Brain, "loadSettings").mockReturnValue(true);
      vi.spyOn(Brain, "trainFromFile").mockResolvedValue(true);
      vi.spyOn(InteractionRouter, "initialize").mockResolvedValue([]);
      Brain.botName = botName;
      Brain.lexicon = new Map([["x", new Set()]]) as unknown as typeof Brain.lexicon;
      Brain.nGrams = new Map([["x", {} as unknown as object]]) as unknown as typeof Brain.nGrams;

      await startCoreInitialization();

      await expect(handlePlatformEvent({
         type: "message.deletedBulk",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { messages: [{ content: "missing id" }] }
      })).resolves.toBeUndefined();
   });

   it("handles thread delete events with missing ids", async () => {
      const botName = "unit-test";
      setCoreEnv(botName);
      const { Brain } = await import("@/core/brain");
      const { InteractionRouter } = await import("@/core/interactionRouter");
      const { startCoreInitialization, handlePlatformEvent } = await import("@/core/runtime");

      vi.spyOn(Brain, "loadSettings").mockReturnValue(true);
      vi.spyOn(Brain, "trainFromFile").mockResolvedValue(true);
      vi.spyOn(InteractionRouter, "initialize").mockResolvedValue([]);
      Brain.botName = botName;
      Brain.lexicon = new Map([["x", new Set()]]) as unknown as typeof Brain.lexicon;
      Brain.nGrams = new Map([["x", {} as unknown as object]]) as unknown as typeof Brain.nGrams;

      await startCoreInitialization();

      await expect(handlePlatformEvent({
         type: "thread.deleted",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { name: "missing id" }
      })).resolves.toBeUndefined();
   });
});
