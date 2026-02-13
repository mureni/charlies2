import { describe, expect, it } from "vitest";
import { ChannelType } from "discord.js";
import type {
   Entitlement,
   GuildScheduledEvent,
   Invite,
   MessageReaction,
   Presence,
   SoundboardSound,
   StageInstance,
   Subscription,
   ThreadChannel,
   Typing,
   User,
   VoiceState
} from "discord.js";
import {
   toStandardEmoji,
   toStandardPresence,
   toStandardTyping,
   toStandardReaction,
   toStandardMessageChange,
   toStandardThread,
   toStandardInvite,
   toStandardVoiceState,
   toStandardStageInstance,
   toStandardSoundboardSound,
   toStandardEntitlement,
   toStandardSubscription,
   toStandardScheduledEvent
} from "@/platform";

describe("discord adapter event mappers", () => {
   it("maps emoji basics", () => {
      const result = toStandardEmoji({ id: "e1", name: "smile", animated: true });

      expect(result).toEqual({ id: "e1", name: "smile", animated: true });
   });

   it("falls back to placeholder emoji names", () => {
      const result = toStandardEmoji({ id: "e2", name: null, animated: null });

      expect(result).toEqual({ id: "e2", name: "<UNKNOWN EMOJI>", animated: undefined });
   });

   it("maps presence activities and status", () => {
      const presence = {
         userId: "u1",
         status: "online",
         activities: [{ name: "Game", type: 0, state: "Busy" }],
         clientStatus: { desktop: "online" }
      } as unknown as Presence;

      const result = toStandardPresence(presence);

      expect(result.userId).toBe("u1");
      expect(result.status).toBe("online");
      expect(result.activities?.[0]).toMatchObject({ name: "Game", type: "0", state: "Busy" });
      expect(result.clientStatus?.desktop).toBe("online");
   });

   it("maps typing events with channel id", () => {
      const typing = {
         channel: { id: "c1" },
         user: { id: "u1" },
         startedTimestamp: 123
      } as unknown as Typing;

      const result = toStandardTyping(typing);

      expect(result).toEqual({ channelId: "c1", userId: "u1", startedAt: 123 });
   });

   it("maps reactions with message context", () => {
      const reaction = {
         message: { id: "m1", channelId: "c1", guildId: "g1" },
         emoji: { id: "e1", name: "fire" },
         count: 2
      } as unknown as MessageReaction;
      const user = { id: "u1" } as unknown as User;

      const result = toStandardReaction(reaction, user);

      expect(result.messageId).toBe("m1");
      expect(result.channelId).toBe("c1");
      expect(result.guildId).toBe("g1");
      expect(result.userId).toBe("u1");
      expect(result.emoji).toEqual({ id: "e1", name: "fire", animated: undefined });
      expect(result.count).toBe(2);
   });

   it("maps threads with channel metadata", () => {
      const thread = {
         id: "t1",
         name: "Thread",
         parentId: "c1",
         guildId: "g1",
         ownerId: "u1",
         archived: false,
         locked: true,
         type: ChannelType.PublicThread
      } as unknown as ThreadChannel;

      const result = toStandardThread(thread);

      expect(result.id).toBe("t1");
      expect(result.channel?.type).toBe("thread");
      expect(result.parentId).toBe("c1");
   });

   it("maps invites with channel and guild fallback", () => {
      const invite = {
         code: "abc",
         channelId: null,
         channel: { id: "c1" },
         guild: { id: "g1" },
         inviterId: "u1"
      } as unknown as Invite;

      const result = toStandardInvite(invite);

      expect(result).toEqual({ code: "abc", channelId: "c1", guildId: "g1", inviterId: "u1" });
   });

   it("maps voice state events with optional fields", () => {
      const state = {
         id: "u1",
         channelId: "c1",
         guild: { id: "g1" },
         mute: true,
         selfMute: false,
         streaming: true
      } as unknown as VoiceState;

      const result = toStandardVoiceState(state);

      expect(result.userId).toBe("u1");
      expect(result.channelId).toBe("c1");
      expect(result.guildId).toBe("g1");
      expect(result.muted).toBe(true);
      expect(result.selfMuted).toBe(false);
      expect(result.streaming).toBe(true);
   });

   it("maps stage instances", () => {
      const stage = {
         id: "stage-1",
         channelId: "c1",
         guildId: "g1",
         topic: "Topic",
         privacyLevel: 2
      } as unknown as StageInstance;

      const result = toStandardStageInstance(stage);

      expect(result).toEqual({
         id: "stage-1",
         channelId: "c1",
         guildId: "g1",
         topic: "Topic",
         privacyLevel: 2
      });
   });

   it("maps soundboard sounds with emoji metadata", () => {
      const sound = {
         soundId: 99,
         name: "Cheer",
         emoji: { id: "e9", name: "sparkles", animated: false }
      } as unknown as SoundboardSound;

      const result = toStandardSoundboardSound(sound);

      expect(result).toEqual({
         id: "99",
         name: "Cheer",
         emoji: { id: "e9", name: "sparkles", animated: false }
      });
   });

   it("maps entitlements and subscriptions", () => {
      const entitlement = {
         id: "ent-1",
         userId: "u1",
         guildId: "g1",
         skuId: "sku-1"
      } as unknown as Entitlement;
      const subscription = {
         id: "sub-1",
         userId: "u2"
      } as unknown as Subscription;

      const entitlementResult = toStandardEntitlement(entitlement);
      const subscriptionResult = toStandardSubscription(subscription);

      expect(entitlementResult).toEqual({
         id: "ent-1",
         userId: "u1",
         guildId: "g1",
         skuId: "sku-1"
      });
      expect(subscriptionResult).toEqual({ id: "sub-1", userId: "u2" });
   });

   it("maps scheduled events with guild fallbacks", () => {
      const event = {
         id: "event-1",
         name: "Party",
         guildId: "g1"
      } as unknown as GuildScheduledEvent;

      const result = toStandardScheduledEvent(event);

      expect(result).toEqual({ id: "event-1", name: "Party", guildId: "g1" });
   });

   it("maps message changes with fallback channel id", () => {
      const message = { id: "m1", content: "Hi" };

      const result = toStandardMessageChange(message as never);

      expect(result).toEqual({
         messageId: "m1",
         channelId: "unknown",
         guildId: undefined,
         authorId: undefined,
         content: "Hi"
      });
   });
});
