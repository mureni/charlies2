import { beforeEach, describe, expect, it, vi } from "vitest";
import { initEnvConfig } from "@/utils";

const KnownUsers = new Map<string, unknown>();
const upsertKnownUser = vi.fn();
const syncKnownUserProfile = vi.fn();

vi.mock("@/core/knownUsers", () => ({
   KnownUsers,
   upsertKnownUser,
   syncKnownUserProfile,
   saveKnownUser: vi.fn(),
   touchKnownUser: vi.fn(),
   getKnownUsersSnapshot: vi.fn()
}));

const processMessage = vi.fn(async (): Promise<{
   learned: boolean;
   processedText: string;
   response?: string;
   directedTo?: string;
   triggeredBy?: string;
}> => ({
   learned: false,
   processedText: "",
   response: undefined,
   directedTo: undefined,
   triggeredBy: undefined
}));

vi.mock("@/core/messageProcessor", () => ({
   processMessage,
   cleanMessage: vi.fn()
}));

const InteractionRouter = {
   initialize: vi.fn(async () => []),
   handleCommand: vi.fn(async () => undefined)
};

vi.mock("@/core/interactionRouter", () => ({
   InteractionRouter
}));

const baseSettings = {
   outburstThreshold: 0,
   numberOfLines: 1,
   angerLevel: 0,
   surprise: 0,
   angerIncrease: 1,
   angerDecrease: 1,
   recursion: 1,
   conversationTimeLimit: 10,
   learnFromBots: false
};

const setupCore = async (): Promise<{ runtime: any; Brain: any }> => {
   const runtime = await import("@/core/runtime");
   const { Brain } = await import("@/core/brain");
   vi.spyOn(Brain, "loadSettings").mockReturnValue(true);
   vi.spyOn(Brain, "trainFromFile").mockResolvedValue(true);
   vi.spyOn(Brain, "saveSettings").mockReturnValue(true);
   Brain.botName = "unit-test";
   Brain.settings = { ...baseSettings };
   Brain.lexicon = new Map([["x", new Set()]]) as unknown as typeof Brain.lexicon;
   Brain.nGrams = new Map([["x", {} as unknown as object]]) as unknown as typeof Brain.nGrams;
   await runtime.startCoreInitialization();
   return { runtime, Brain };
};

beforeEach(() => {
   vi.resetModules();
   KnownUsers.clear();
   upsertKnownUser.mockClear();
   syncKnownUserProfile.mockClear();
   processMessage.mockClear();
   InteractionRouter.initialize.mockClear();
   InteractionRouter.handleCommand.mockClear();
   process.env.BOT_NAME = "unit-test";
   process.env.NODE_ENV = "test";
   initEnvConfig();
});

describe("core runtime extended coverage", () => {
   it("processes messages and persists dirty brain settings", async () => {
      processMessage.mockResolvedValueOnce({
         learned: true,
         processedText: "clean",
         response: "hello",
         directedTo: "User",
         triggeredBy: "ping"
      });
      const { runtime, Brain } = await setupCore();
      const result = await runtime.handleCoreMessage({
         id: "msg-1",
         content: "hello",
         authorId: "user-1",
         authorName: "User",
         isBot: false,
         channelId: "chan-1",
         isSelf: false
      });

      expect(result?.learned).toBe(true);
      expect(processMessage).toHaveBeenCalled();
      expect(upsertKnownUser).toHaveBeenCalledWith("user-1", "User", ["User"]);

      await runtime.shutdownCore();
      expect(Brain.saveSettings).toHaveBeenCalledWith(Brain.botName);
   });

   it("routes core commands when initialized", async () => {
      const { runtime } = await setupCore();
      await runtime.handleCoreCommand({
         command: "ping",
         options: {},
         userId: "user-1",
         channelId: "chan-1",
         reply: vi.fn(async () => {})
      });
      expect(InteractionRouter.handleCommand).toHaveBeenCalledWith(expect.objectContaining({ command: "ping" }));
   });

   it("syncs member updates when payload includes a username", async () => {
      const { runtime } = await setupCore();
      await runtime.handlePlatformEvent({
         type: "member.updated",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { userId: "u1", username: "Neo", displayName: "Neo" }
      });
      expect(syncKnownUserProfile).toHaveBeenCalledWith({
         id: "u1",
         username: "Neo",
         displayName: "Neo"
      });
   });

   it("skips bot messages when learnFromBots is disabled", async () => {
      const { runtime } = await setupCore();
      const result = await runtime.handleCoreMessage({
         id: "msg-2",
         content: "bot hello",
         authorId: "bot-1",
         authorName: "Bot",
         isBot: true,
         channelId: "chan-1",
         isSelf: false
      });
      expect(result).toBeNull();
      expect(processMessage).not.toHaveBeenCalled();
   });

   it("skips self messages", async () => {
      const { runtime } = await setupCore();
      const result = await runtime.handleCoreMessage({
         id: "msg-3",
         content: "self hello",
         authorId: "bot-1",
         authorName: "Self",
         isBot: false,
         channelId: "chan-1",
         isSelf: true
      });
      expect(result).toBeNull();
      expect(processMessage).not.toHaveBeenCalled();
   });

   it("handles diverse platform event types without throwing", async () => {
      const { runtime } = await setupCore();

      await expect(runtime.handlePlatformEvent({
         type: "channel.deleted",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { id: "c1" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "channel.pinsUpdated",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { channel: { id: "c2" } }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "role.deleted",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { id: "r1" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "emoji.deleted",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { id: "e1", name: "smile" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "sticker.deleted",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { id: "s1" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "guild.deleted",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { id: "g1" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "invite.deleted",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { code: "abc" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "message.pollVoteAdded",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { messageId: "m1", userId: "u1" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "message.pollVoteRemoved",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { messageId: "m1", userId: "u1" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "reaction.removedAll",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { message: { messageId: "m2" } }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "message.updated",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { messageId: "m3" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "message.deletedBulk",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { messages: [{ messageId: "m4" }] }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "thread.created",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { thread: { id: "t1" } }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "thread.updated",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { id: "t2" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "thread.listSync",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { threads: [{ id: "t3" }] }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "soundboard.soundDeleted",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { id: "sb1" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "soundboard.soundsUpdated",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { sounds: [{ id: "sb2" }] }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "entitlement.deleted",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { id: "ent1" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "entitlement.updated",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { id: "ent2" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "subscription.deleted",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { id: "sub1" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "subscription.updated",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { id: "sub2" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "guild.scheduledEventCreated",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { id: "e1" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "guild.scheduledEventUserAdded",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { event: { id: "e1" } }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "webhook.updated",
         platform: "discord",
         occurredAt: Date.now(),
         channelId: "c3",
         payload: { channelId: "c3" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "command.permissionsUpdated",
         platform: "discord",
         occurredAt: Date.now(),
         guildId: "g1",
         payload: { guildId: "g1" }
      })).resolves.toBeUndefined();

      await expect(runtime.handlePlatformEvent({
         type: "stage.deleted",
         platform: "discord",
         occurredAt: Date.now(),
         payload: { id: "stage1" }
      })).resolves.toBeUndefined();
   });
});
