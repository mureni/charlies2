import { beforeEach, describe, expect, it, vi } from "vitest";
import { initEnvConfig } from "@/utils";

let lastClient: any;

vi.mock("discord.js", () => {
   class MockClient {
      public handlers = new Map<string, (...args: any[]) => any>();
      public onceHandlers = new Map<string, (...args: any[]) => any>();
      public user = { id: "bot-1" };
      public login = vi.fn(async () => "token");
      public destroy = vi.fn(async () => undefined);
      public options: unknown;

      constructor(options: unknown) {
         this.options = options;
         lastClient = this;
      }

      on(event: string, handler: (...args: any[]) => any): this {
         this.handlers.set(event, handler);
         return this;
      }

      once(event: string, handler: (...args: any[]) => any): this {
         this.onceHandlers.set(event, handler);
         return this;
      }

      emit(event: string, ...args: any[]): unknown {
         const handler = this.handlers.get(event) ?? this.onceHandlers.get(event);
         if (handler) return handler(...args);
         return undefined;
      }
   }

   return {
      Client: MockClient,
      GatewayIntentBits: {
         Guilds: 1,
         GuildMembers: 2,
         GuildModeration: 3,
         GuildEmojisAndStickers: 4,
         GuildIntegrations: 5,
         GuildInvites: 6,
         GuildVoiceStates: 7,
         GuildPresences: 8,
         GuildMessages: 9,
         GuildMessageReactions: 10,
         GuildMessageTyping: 11,
         GuildMessagePolls: 12,
         GuildScheduledEvents: 13,
         AutoModerationConfiguration: 14,
         AutoModerationExecution: 15,
         MessageContent: 16,
         DirectMessages: 17,
         DirectMessageReactions: 18,
         DirectMessageTyping: 19
      },
      Partials: { Channel: "Channel" },
      MessageType: { Default: 0, Reply: 1 },
      __getMockClient: () => lastClient
   };
});

const handlePlatformEvent = vi.fn();
const handleCoreMessage = vi.fn();
const handleCoreCommand = vi.fn();
const isCoreInitialized = vi.fn(() => true);

vi.mock("@/core/runtime", () => ({
   preflightCoreEnv: vi.fn(),
   startCoreInitialization: vi.fn(),
   isCoreInitialized,
   handleCoreMessage,
   handleCoreCommand,
   handlePlatformEvent
}));

const toStandardUserProfile = vi.fn(() => ({ id: "u1", username: "neo" }));
const toStandardMessage = vi.fn(async () => ({
   id: "msg-1",
   content: "hi",
   authorId: "u2",
   authorName: "User",
   isBot: false,
   channelId: "chan-1",
   isSelf: false
}));
const toStandardCommandInteraction = vi.fn(() => ({
   command: "ping",
   options: {},
   userId: "u2",
   channelId: "chan-1",
   reply: vi.fn(async () => {})
}));
const toStandardEmoji = vi.fn(() => ({}));
const toStandardChannel = vi.fn(() => ({}));
const toStandardReaction = vi.fn(() => ({}));
const toStandardMessageChange = vi.fn(() => ({ messageId: "m1", channelId: "c1", guildId: "g1", authorId: "u1" }));
const toStandardInvite = vi.fn(() => ({ code: "invite-1" }));
const toStandardSoundboardSound = vi.fn(() => ({ id: "sound-1" }));
const toStandardEntitlement = vi.fn(() => ({ id: "ent-1" }));
const toStandardSubscription = vi.fn(() => ({ id: "sub-1" }));
const toStandardStageInstance = vi.fn(() => ({ id: "stage-1" }));

vi.mock("@/platform/discordAdapter", () => ({
   toStandardCommandInteraction,
   toStandardMessage,
   toStandardChannel,
   toStandardUserProfile,
   toStandardMember: vi.fn(() => ({})),
   toStandardRole: vi.fn(() => ({})),
   toStandardEmoji,
   toStandardSticker: vi.fn(() => ({})),
   toStandardPresence: vi.fn(() => ({})),
   toStandardTyping: vi.fn(() => ({})),
   toStandardReaction,
   toStandardMessageChange,
   toStandardThread: vi.fn(() => ({})),
   toStandardVoiceState: vi.fn(() => ({})),
   toStandardStageInstance,
   toStandardInvite,
   toStandardSoundboardSound,
   toStandardEntitlement,
   toStandardSubscription,
   toStandardScheduledEvent: vi.fn(() => ({}))
}));

describe("discord mediator", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      process.env.DISCORD_AUTH = "token";
      process.env.BOT_OWNER_DISCORD_ID = "owner";
      process.env.BOT_NAME = "unit-test";
      process.env.NODE_ENV = "test";
      initEnvConfig();
   });

   it("emits platform events for user updates", async () => {
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      startDiscordMediator();
      const client = __getMockClient();
      client.emit("userUpdate", {}, { id: "u1", username: "neo" });

      expect(toStandardUserProfile).toHaveBeenCalled();
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({
         type: "user.updated",
         platform: "discord",
         payload: { id: "u1", username: "neo" },
         userId: "u1"
      }));
   });

   it("skips messageCreate before core initialization", async () => {
      isCoreInitialized.mockReturnValue(false);
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { MessageType } = await import("discord.js");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      startDiscordMediator();
      const client = __getMockClient();
      await client.emit("messageCreate", {
         author: { id: "u2", bot: false },
         type: MessageType.Default,
         content: "hello"
      });

      expect(handleCoreMessage).not.toHaveBeenCalled();
   });

   it("skips messageCreate for self messages", async () => {
      isCoreInitialized.mockReturnValue(true);
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { MessageType } = await import("discord.js");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      startDiscordMediator();
      const client = __getMockClient();
      await client.emit("messageCreate", {
         author: { id: "bot-1", bot: true },
         type: MessageType.Default,
         content: "hello"
      });

      expect(handleCoreMessage).not.toHaveBeenCalled();
   });

   it("processes messageCreate when initialized and not self", async () => {
      isCoreInitialized.mockReturnValue(true);
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { MessageType } = await import("discord.js");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      startDiscordMediator();
      const client = __getMockClient();
      await client.emit("messageCreate", {
         author: { id: "u2", bot: false },
         type: MessageType.Default,
         content: "hello"
      });

      expect(toStandardMessage).toHaveBeenCalled();
      expect(handleCoreMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "msg-1" }));
   });

   it("handles interaction errors without crashing", async () => {
      isCoreInitialized.mockReturnValue(true);
      toStandardCommandInteraction.mockImplementationOnce(() => { throw new Error("boom"); });
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      startDiscordMediator();
      const client = __getMockClient();
      await client.emit("interactionCreate", { isChatInputCommand: () => true });

      expect(handleCoreCommand).not.toHaveBeenCalled();
   });

   it("emits emoji and channel pin events", async () => {
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };
      toStandardEmoji.mockReturnValueOnce({ id: "e1", name: "smile" });
      toStandardChannel.mockReturnValueOnce({ id: "c1", guildId: "g1" });

      startDiscordMediator();
      const client = __getMockClient();
      client.emit("emojiCreate", { guild: { id: "g1" } });
      client.emit("channelPinsUpdate", { id: "c1" }, new Date(0));

      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "emoji.created" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "channel.pinsUpdated" }));
   });

   it("emits reaction events with mapped payloads", async () => {
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };
      toStandardReaction.mockReturnValueOnce({ messageId: "m1", channelId: "c1", guildId: "g1", emoji: { name: "fire" } });

      startDiscordMediator();
      const client = __getMockClient();
      client.emit("messageReactionAdd", { message: { id: "m1", channelId: "c1" }, emoji: {} }, { id: "u1" });

      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "reaction.added" }));
   });

   it("skips poll vote events without message ids", async () => {
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      startDiscordMediator();
      const client = __getMockClient();
      client.emit("messagePollVoteAdd", { poll: {} }, "u1");

      expect(handlePlatformEvent).not.toHaveBeenCalled();
   });

   it("skips messageCreate when client user is missing", async () => {
      isCoreInitialized.mockReturnValue(true);
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { MessageType } = await import("discord.js");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      startDiscordMediator();
      const client = __getMockClient();
      client.user = undefined;
      await client.emit("messageCreate", {
         author: { id: "u2", bot: false },
         type: MessageType.Default,
         content: "hello"
      });

      expect(handleCoreMessage).not.toHaveBeenCalled();
   });

   it("ignores non-chat command interactions", async () => {
      isCoreInitialized.mockReturnValue(true);
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      startDiscordMediator();
      const client = __getMockClient();
      await client.emit("interactionCreate", { isChatInputCommand: () => false });

      expect(handleCoreCommand).not.toHaveBeenCalled();
   });

   it("ignores null presence updates", async () => {
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      startDiscordMediator();
      const client = __getMockClient();
      client.emit("presenceUpdate", {}, null);

      expect(handlePlatformEvent).not.toHaveBeenCalled();
   });

   it("skips messageCreate for unsupported message types", async () => {
      isCoreInitialized.mockReturnValue(true);
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      startDiscordMediator();
      const client = __getMockClient();
      await client.emit("messageCreate", {
         author: { id: "u2", bot: false },
         type: 99,
         content: "system"
      });

      expect(handleCoreMessage).not.toHaveBeenCalled();
   });

   it("skips command handling before core initialization", async () => {
      isCoreInitialized.mockReturnValue(false);
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      startDiscordMediator();
      const client = __getMockClient();
      await client.emit("interactionCreate", { isChatInputCommand: () => true });

      expect(handleCoreCommand).not.toHaveBeenCalled();
   });

   it("skips poll vote remove events without message ids", async () => {
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      startDiscordMediator();
      const client = __getMockClient();
      client.emit("messagePollVoteRemove", { poll: {} }, "u1");

      expect(handlePlatformEvent).not.toHaveBeenCalled();
   });

   it("handles chat command interactions when initialized", async () => {
      isCoreInitialized.mockReturnValue(true);
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      startDiscordMediator();
      const client = __getMockClient();
      await client.emit("interactionCreate", { isChatInputCommand: () => true });

      expect(toStandardCommandInteraction).toHaveBeenCalled();
      expect(handleCoreCommand).toHaveBeenCalledWith(expect.objectContaining({ command: "ping" }));
   });

   it("emits poll vote events when message ids exist", async () => {
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      startDiscordMediator();
      const client = __getMockClient();
      client.emit("messagePollVoteAdd", { id: "1", poll: { messageId: "m1", channelId: "c1" } }, "u1");
      client.emit("messagePollVoteRemove", { id: "2", poll: { messageId: "m1", channelId: "c1" } }, "u1");

      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "message.pollVoteAdded" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "message.pollVoteRemoved" }));
   });

   it("emits assorted platform events for voice, threads, and moderation", async () => {
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      startDiscordMediator();
      const client = __getMockClient();
      client.emit("voiceStateUpdate", {}, { id: "u1", guild: { id: "g1" }, channelId: "c1" });
      client.emit("voiceChannelEffectSend", { channelId: "c1", userId: "u1", guild: { id: "g1" } });
      client.emit("threadMemberUpdate", {}, { id: "u2", thread: { id: "t1", guildId: "g1" } });
      client.emit("threadMembersUpdate", new Map([["u3", { id: "u3" }]]), new Map(), { id: "t2", guildId: "g1" });
      client.emit("autoModerationRuleCreate", { id: "r1", name: "rule", enabled: true, eventType: 1, triggerType: 2, guild: { id: "g1" } });
      client.emit("autoModerationActionExecution", { ruleId: "r1", action: { type: 4 }, guild: { id: "g1" } });

      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "voice.stateUpdated" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "voice.channelEffect" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "thread.memberUpdated" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "thread.membersUpdated" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "autoModeration.ruleCreated" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "autoModeration.actionExecuted" }));
   });

   it("destroys the client on stop", async () => {
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      const handle = startDiscordMediator();
      const client = __getMockClient();
      await handle.stop?.();

      expect(client.destroy).toHaveBeenCalled();
   });

   it("sets exitCode when required env vars are missing", async () => {
      delete process.env.DISCORD_AUTH;
      delete process.env.BOT_OWNER_DISCORD_ID;
      initEnvConfig();
      const { startDiscordMediator } = await import("@/platform/discordMediator");

      startDiscordMediator();

      expect(process.exitCode).toBe(1);
      process.exitCode = undefined;
   });

   it("emits channel, message, invite, and webhook events", async () => {
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };
      toStandardChannel.mockReturnValue({ id: "c1", guildId: "g1" });

      startDiscordMediator();
      const client = __getMockClient();

      client.emit("channelCreate", { id: "c1", guildId: "g1" });
      client.emit("channelUpdate", {}, { id: "c1", guildId: "g1" });
      client.emit("channelDelete", { id: "c1", guildId: "g1" });
      client.emit("messageUpdate", {}, { id: "m1" });
      client.emit("messageDelete", { id: "m1" });
      client.emit("messageDeleteBulk", new Map([["m1", { id: "m1" }]]));
      client.emit("messageReactionRemoveAll", { id: "m1" }, [{ message: { id: "m1" } }]);
      client.emit("messageReactionRemoveEmoji", { message: { id: "m1" } });
      client.emit("inviteCreate", { guild: { id: "g1" }, channelId: "c1", inviterId: "u1" });
      client.emit("inviteDelete", { guild: { id: "g1" }, channelId: "c1", inviterId: "u1" });
      client.emit("webhooksUpdate", { id: "c1", guildId: "g1" });

      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "channel.created" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "channel.updated" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "channel.deleted" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "message.updated" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "message.deleted" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "message.deletedBulk" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "reaction.removedAll" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "reaction.removedEmoji" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "invite.created" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "invite.deleted" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "webhook.updated" }));
   });

   it("emits soundboard, entitlement, subscription, and stage events", async () => {
      const { startDiscordMediator } = await import("@/platform/discordMediator");
      const { __getMockClient } = await import("discord.js") as unknown as { __getMockClient: () => any };

      startDiscordMediator();
      const client = __getMockClient();

      client.emit("soundboardSounds", [{ id: "sb1" }], { id: "g1" });
      client.emit("guildSoundboardSoundsUpdate", [{ id: "sb2" }], { id: "g1" });
      client.emit("guildSoundboardSoundCreate", { guildId: "g1" });
      client.emit("guildSoundboardSoundUpdate", {}, { guildId: "g1" });
      client.emit("guildSoundboardSoundDelete", { guildId: "g1" });

      client.emit("entitlementCreate", { guildId: "g1", userId: "u1" });
      client.emit("entitlementUpdate", { guildId: "g1", userId: "u1" });
      client.emit("entitlementDelete", { guildId: "g1", userId: "u1" });

      client.emit("subscriptionCreate", { userId: "u2" });
      client.emit("subscriptionUpdate", { userId: "u2" });
      client.emit("subscriptionDelete", { userId: "u2" });

      client.emit("stageInstanceCreate", { guildId: "g1", channelId: "c1" });
      client.emit("stageInstanceUpdate", {}, { guildId: "g1", channelId: "c1" });
      client.emit("stageInstanceDelete", { guildId: "g1", channelId: "c1" });

      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "soundboard.soundsUpdated" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "soundboard.soundCreated" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "soundboard.soundUpdated" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "soundboard.soundDeleted" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "entitlement.created" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "entitlement.updated" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "entitlement.deleted" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "subscription.created" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "subscription.updated" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "subscription.deleted" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "stage.created" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "stage.updated" }));
      expect(handlePlatformEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "stage.deleted" }));
   });
});
