import type { Message } from "discord.js";
import { GatewayIntentBits, Partials, Client, MessageType } from "discord.js";
import { log } from "@/core/log";
import type { PlatformMediatorHandle, StandardEvent, StandardEventType } from "./types";
import {
   preflightCoreEnv,
   startCoreInitialization,
   isCoreInitialized,
   handleCoreMessage,
   handleCoreCommand,
   handlePlatformEvent
} from "@/core/runtime";
import {
   toStandardCommandInteraction,
   toStandardMessage,
   toStandardChannel,
   toStandardUserProfile,
   toStandardMember,
   toStandardRole,
   toStandardEmoji,
   toStandardSticker,
   toStandardPresence,
   toStandardTyping,
   toStandardReaction,
   toStandardMessageChange,
   toStandardThread,
   toStandardVoiceState,
   toStandardStageInstance,
   toStandardInvite,
   toStandardSoundboardSound,
   toStandardEntitlement,
   toStandardSubscription,
   toStandardScheduledEvent
} from "./discordAdapter";
import { envFlag, requireEnv } from "@/utils";

const startDiscordMediator = (): PlatformMediatorHandle => {
   const traceFlow = envFlag("TRACE_FLOW");
   const trace = (message: string, data?: unknown): void => {
      if (traceFlow) log(data ? { message: `Flow: ${message}`, data } : `Flow: ${message}`, "trace");
   };
   const emitPlatformEvent = <TPayload>(type: StandardEventType, payload?: TPayload, context?: {
      guildId?: string;
      channelId?: string;
      userId?: string;
   }): void => {
      const event: StandardEvent<TPayload> = {
         type,
         platform: "discord",
         occurredAt: Date.now(),
         guildId: context?.guildId,
         channelId: context?.channelId,
         userId: context?.userId,
         payload
      };
      void handlePlatformEvent(event);
   };

   /* ACTIVATE */
   const mandatoryDiscordEnvVars = ["DISCORD_AUTH", "BOT_OWNER_DISCORD_ID"];

   const preflightDiscordEnv = (): void => {
      for (const envVar of mandatoryDiscordEnvVars) {
         requireEnv(envVar);
      }
      preflightCoreEnv();
   };

   /* Initialize discord client */
   const client = new Client({
      intents: [
         GatewayIntentBits.Guilds,
         GatewayIntentBits.GuildMembers,
         GatewayIntentBits.GuildModeration,
         GatewayIntentBits.GuildEmojisAndStickers,
         GatewayIntentBits.GuildIntegrations,
         GatewayIntentBits.GuildInvites,
         GatewayIntentBits.GuildVoiceStates,
         GatewayIntentBits.GuildPresences,
         GatewayIntentBits.GuildMessages,
         GatewayIntentBits.GuildMessageReactions,
         GatewayIntentBits.GuildMessageTyping,
         GatewayIntentBits.GuildMessagePolls,
         GatewayIntentBits.GuildScheduledEvents,
         GatewayIntentBits.AutoModerationConfiguration,
         GatewayIntentBits.AutoModerationExecution,
         GatewayIntentBits.MessageContent,
         GatewayIntentBits.DirectMessages,
         GatewayIntentBits.DirectMessageReactions,
         GatewayIntentBits.DirectMessageTyping
      ],
      partials: [Partials.Channel]
   });
   /* Attempt login */
   const login = (): Promise<any> => client.login(requireEnv("DISCORD_AUTH"))
      .then(_token => log(`Logged in to Discord server.`))
      .catch(reason => {
         log(`Problem logging in to Discord server: ${reason}`, "error");
         if (reason && /AbortError/gui.test(reason)) {
            // Connection aborted (probably due to an initialization timeout) -- try again in 30 seconds
            log(`Waiting 30 seconds then trying to log in again`);
            setTimeout(login, 1000 * 30);
         };
      });

   /* Discord client events */

   /* General client events */
   client.on("error", error => {
      log(`Error occurred: ${error.message}`, "error");
   });
   if (envFlag("DISCORD_DEBUG")) {
      client.on("debug", info => {
         log(`Discord debug: ${info}`, "debug");
      });
      client.on("shardDisconnect", (event, shardId) => {
         log(`Discord shard disconnect: shard=${shardId} code=${event.code} reason=${event.reason ?? "none"}`, "warn");
      });
      client.on("shardError", (error, shardId) => {
         log(`Discord shard error: shard=${shardId} error=${error.message}`, "error");
      });
      client.on("shardResume", (shardId, replayedEvents) => {
         log(`Discord shard resume: shard=${shardId} replayed=${replayedEvents}`, "debug");
      });
   }
   client.once("clientReady", async () => {
      log(`Connected to Discord server.`);
      setImmediate(() => {
         void startCoreInitialization();
      });

      // List the guilds connected to
      /* const guilds = await client.guilds.fetch();
      guilds.map(async guild => {
         const guildData = await guild.fetch();
         const channels = await guildData.channels.fetch();
         const channelData = `Channels: ${channels.map(channel => channel.name).join(", ")}`;
         log(`Guild: ${guildData.name} / ${channelData}`);
      }); */

   });
   client.on("shardReconnecting", (shardId) => {
      log(`Discord shard reconnecting: shard=${shardId}`, "warn");
   });
   client.on("warn", info => {
      log(`Warning information received: ${info}`, "warn");
   });

   /* Client user (bot user) event handling */
   client.on("userUpdate", (_oldUser, newUser) => {
      emitPlatformEvent("user.updated", toStandardUserProfile(newUser), { userId: newUser.id });
   });

   /* Emoji + sticker handling */
   client.on("emojiCreate", emoji => {
      emitPlatformEvent("emoji.created", toStandardEmoji(emoji), { guildId: emoji.guild?.id });
   });
   client.on("emojiDelete", emoji => {
      emitPlatformEvent("emoji.deleted", toStandardEmoji(emoji), { guildId: emoji.guild?.id });
   });
   client.on("emojiUpdate", (_oldEmoji, newEmoji) => {
      emitPlatformEvent("emoji.updated", toStandardEmoji(newEmoji), { guildId: newEmoji.guild?.id });
   });
   client.on("stickerCreate", sticker => {
      emitPlatformEvent("sticker.created", toStandardSticker(sticker), { guildId: sticker.guild?.id });
   });
   client.on("stickerDelete", sticker => {
      emitPlatformEvent("sticker.deleted", toStandardSticker(sticker), { guildId: sticker.guild?.id });
   });
   client.on("stickerUpdate", (_oldSticker, newSticker) => {
      emitPlatformEvent("sticker.updated", toStandardSticker(newSticker), { guildId: newSticker.guild?.id });
   });

   /* Guild handling */
   client.on("guildAvailable", guild => {
      emitPlatformEvent("guild.available", { id: guild.id, name: guild.name }, { guildId: guild.id });
   });
   client.on("guildUnavailable", guild => {
      log(`Guild ${guild.name} is unavailable.`);
      emitPlatformEvent("guild.unavailable", { id: guild.id, name: guild.name }, { guildId: guild.id });
   });
   client.on("guildCreate", guild => {
      log(`Guild ${guild.name} has been created or connected to.`);
      emitPlatformEvent("guild.created", { id: guild.id, name: guild.name }, { guildId: guild.id });
   });
   client.on("guildDelete", guild => {
      emitPlatformEvent("guild.deleted", { id: guild.id, name: guild.name }, { guildId: guild.id });
   });
   client.on("guildUpdate", (_oldGuild, newGuild) => {
      emitPlatformEvent("guild.updated", { id: newGuild.id, name: newGuild.name }, { guildId: newGuild.id });
   });
   client.on("guildIntegrationsUpdate", guild => {
      emitPlatformEvent("guild.integrationsUpdated", { guildId: guild.id }, { guildId: guild.id });
   });
   client.on("guildAuditLogEntryCreate", (auditLogEntry, guild) => {
      emitPlatformEvent("guild.auditLogEntryCreated", {
         id: auditLogEntry.id,
         action: String(auditLogEntry.action),
         userId: auditLogEntry.executorId ?? undefined
      }, { guildId: guild.id, userId: auditLogEntry.executorId ?? undefined });
   });
   client.on("guildBanAdd", guildBan => {
      emitPlatformEvent("guild.banAdded", { guildId: guildBan.guild.id, userId: guildBan.user.id }, { guildId: guildBan.guild.id, userId: guildBan.user.id });
   });
   client.on("guildBanRemove", guildBan => {
      emitPlatformEvent("guild.banRemoved", { guildId: guildBan.guild.id, userId: guildBan.user.id }, { guildId: guildBan.guild.id, userId: guildBan.user.id });
   });
   client.on("guildScheduledEventCreate", event => {
      emitPlatformEvent("guild.scheduledEventCreated", toStandardScheduledEvent(event), { guildId: event.guildId });
   });
   client.on("guildScheduledEventUpdate", (_oldEvent, newEvent) => {
      emitPlatformEvent("guild.scheduledEventUpdated", toStandardScheduledEvent(newEvent), { guildId: newEvent.guildId });
   });
   client.on("guildScheduledEventDelete", event => {
      emitPlatformEvent("guild.scheduledEventDeleted", toStandardScheduledEvent(event), { guildId: event.guildId });
   });
   client.on("guildScheduledEventUserAdd", (event, user) => {
      emitPlatformEvent("guild.scheduledEventUserAdded", {
         event: toStandardScheduledEvent(event),
         userId: user.id
      }, { guildId: event.guildId, userId: user.id });
   });
   client.on("guildScheduledEventUserRemove", (event, user) => {
      emitPlatformEvent("guild.scheduledEventUserRemoved", {
         event: toStandardScheduledEvent(event),
         userId: user.id
      }, { guildId: event.guildId, userId: user.id });
   });

   /* Guild member handling */
   client.on("guildMemberAdd", member => {
      emitPlatformEvent("member.added", toStandardMember(member), { guildId: member.guild.id, userId: member.user.id });
   });
   client.on("guildMemberRemove", member => {
      emitPlatformEvent("member.removed", toStandardMember(member), { guildId: member.guild.id, userId: member.user.id });
   });
   client.on("guildMemberUpdate", (_oldMember, newMember) => {
      emitPlatformEvent("member.updated", toStandardMember(newMember), { guildId: newMember.guild.id, userId: newMember.user.id });
   });
   client.on("guildMembersChunk", (members, guild) => {
      members.forEach(member => {
         emitPlatformEvent("member.chunked", toStandardMember(member), { guildId: guild.id, userId: member.user.id });
      });
   });
   client.on("guildMemberAvailable", member => {
      emitPlatformEvent("member.available", toStandardMember(member), { guildId: member.guild.id, userId: member.user.id });
   });
   client.on("presenceUpdate", (_oldPresence, newPresence) => {
      if (!newPresence) return;
      emitPlatformEvent("presence.updated", toStandardPresence(newPresence), {
         guildId: newPresence.guild?.id ?? undefined,
         userId: newPresence.userId
      });
   });
   client.on("voiceStateUpdate", (_oldState, newState) => {
      // Not Yet Implemented: voice features are shelled for parity with other platforms.
      emitPlatformEvent("voice.stateUpdated", toStandardVoiceState(newState), {
         guildId: newState.guild?.id ?? undefined,
         channelId: newState.channelId ?? undefined,
         userId: newState.id
      });
   });
   client.on("voiceChannelEffectSend", effect => {
      emitPlatformEvent("voice.channelEffect", {
         channelId: effect.channelId,
         userId: effect.userId,
         soundId: effect.soundId ?? undefined,
         animationType: effect.animationType ?? undefined
      }, { guildId: effect.guild?.id ?? undefined, channelId: effect.channelId, userId: effect.userId });
   });

   /* Guild role handling */
   client.on("roleCreate", role => {
      emitPlatformEvent("role.created", toStandardRole(role), { guildId: role.guild.id });
   });
   client.on("roleDelete", role => {
      emitPlatformEvent("role.deleted", toStandardRole(role), { guildId: role.guild.id });
   });
   client.on("roleUpdate", (_oldRole, newRole) => {
      emitPlatformEvent("role.updated", toStandardRole(newRole), { guildId: newRole.guild.id });
   });

   /* Guild channel handling */
   client.on("channelCreate", channel => {
      const standardChannel = toStandardChannel(channel);
      emitPlatformEvent("channel.created", standardChannel, {
         guildId: standardChannel.guildId,
         channelId: standardChannel.id
      });
   });
   client.on("channelDelete", channel => {
      const standardChannel = toStandardChannel(channel);
      emitPlatformEvent("channel.deleted", standardChannel, {
         guildId: standardChannel.guildId,
         channelId: standardChannel.id
      });
   });
   client.on("channelUpdate", (_oldChannel, newChannel) => {
      const standardChannel = toStandardChannel(newChannel);
      emitPlatformEvent("channel.updated", standardChannel, {
         guildId: standardChannel.guildId,
         channelId: standardChannel.id
      });
   });
   client.on("channelPinsUpdate", (channel, time) => {
      const standardChannel = toStandardChannel(channel);
      emitPlatformEvent("channel.pinsUpdated", {
         channel: standardChannel,
         pinnedAt: time ? time.getTime() : undefined
      }, { guildId: standardChannel.guildId, channelId: standardChannel.id });
   });
   client.on("typingStart", typing => {
      emitPlatformEvent("typing.started", toStandardTyping(typing), {
         guildId: typing.guild?.id ?? undefined,
         channelId: typing.channel.id,
         userId: typing.user.id
      });
   });

   /* Thread handling */
   client.on("threadCreate", (thread, newlyCreated) => {
      emitPlatformEvent("thread.created", { thread: toStandardThread(thread), newlyCreated }, { guildId: thread.guildId, channelId: thread.id });
   });
   client.on("threadUpdate", (_oldThread, newThread) => {
      emitPlatformEvent("thread.updated", toStandardThread(newThread), { guildId: newThread.guildId, channelId: newThread.id });
   });
   client.on("threadDelete", thread => {
      emitPlatformEvent("thread.deleted", toStandardThread(thread), { guildId: thread.guildId, channelId: thread.id });
   });
   client.on("threadListSync", (threads, guild) => {
      const mapped = threads.map(thread => toStandardThread(thread));
      emitPlatformEvent("thread.listSync", { threads: mapped }, { guildId: guild.id });
   });
   client.on("threadMemberUpdate", (_oldMember, newMember) => {
      emitPlatformEvent("thread.memberUpdated", {
         threadId: newMember.thread?.id ?? undefined,
         userId: newMember.id
      }, {
         guildId: newMember.thread?.guildId ?? undefined,
         channelId: newMember.thread?.id ?? undefined,
         userId: newMember.id
      });
   });
   client.on("threadMembersUpdate", (addedMembers, removedMembers, thread) => {
      const added = Array.from(addedMembers.values()).map(member => member.id);
      const removed = Array.from(removedMembers.values()).map(member => member.id);
      emitPlatformEvent("thread.membersUpdated", {
         thread: toStandardThread(thread),
         addedMemberIds: added,
         removedMemberIds: removed
      }, { guildId: thread.guildId, channelId: thread.id });
   });

   /* Message handling */
   client.on("messageUpdate", (_oldMessage, newMessage) => {
      const change = toStandardMessageChange(newMessage);
      emitPlatformEvent("message.updated", change, { channelId: change.channelId, guildId: change.guildId, userId: change.authorId });
   });
   client.on("messageDelete", message => {
      const change = toStandardMessageChange(message);
      emitPlatformEvent("message.deleted", change, { channelId: change.channelId, guildId: change.guildId, userId: change.authorId });
   });
   client.on("messageDeleteBulk", messages => {
      const changes = Array.from(messages.values()).map(message => toStandardMessageChange(message));
      const sample = changes[0];
      emitPlatformEvent("message.deletedBulk", { messages: changes }, {
         channelId: sample?.channelId,
         guildId: sample?.guildId
      });
   });
   client.on("messageReactionAdd", (reaction, user) => {
      const payload = toStandardReaction(reaction, user);
      emitPlatformEvent("reaction.added", payload, { channelId: payload.channelId, guildId: payload.guildId, userId: user.id });
   });
   client.on("messageReactionRemove", (reaction, user) => {
      const payload = toStandardReaction(reaction, user);
      emitPlatformEvent("reaction.removed", payload, { channelId: payload.channelId, guildId: payload.guildId, userId: user.id });
   });
   client.on("messageReactionRemoveAll", (message, reactions) => {
      const change = toStandardMessageChange(message);
      const payload = {
         message: change,
         reactions: reactions.map(reaction => toStandardReaction(reaction))
      };
      emitPlatformEvent("reaction.removedAll", payload, { channelId: change.channelId, guildId: change.guildId });
   });
   client.on("messageReactionRemoveEmoji", reaction => {
      const payload = toStandardReaction(reaction);
      emitPlatformEvent("reaction.removedEmoji", payload, { channelId: payload.channelId, guildId: payload.guildId });
   });
   client.on("messagePollVoteAdd", (pollAnswer, userId) => {
      const messageId = pollAnswer.poll?.messageId ?? pollAnswer.poll?.message?.id;
      const channelId = pollAnswer.poll?.channelId ?? pollAnswer.poll?.message?.channelId;
      if (!messageId) return;
      emitPlatformEvent("message.pollVoteAdded", {
         messageId,
         userId,
         answerId: String(pollAnswer.id)
      }, { channelId, userId });
   });
   client.on("messagePollVoteRemove", (pollAnswer, userId) => {
      const messageId = pollAnswer.poll?.messageId ?? pollAnswer.poll?.message?.id;
      const channelId = pollAnswer.poll?.channelId ?? pollAnswer.poll?.message?.channelId;
      if (!messageId) return;
      emitPlatformEvent("message.pollVoteRemoved", {
         messageId,
         userId,
         answerId: String(pollAnswer.id)
      }, { channelId, userId });
   });

   /* Invites + webhooks + commands */
   client.on("inviteCreate", invite => {
      emitPlatformEvent("invite.created", toStandardInvite(invite), { guildId: invite.guild?.id ?? undefined, channelId: invite.channelId ?? invite.channel?.id ?? undefined, userId: invite.inviter?.id ?? invite.inviterId ?? undefined });
   });
   client.on("inviteDelete", invite => {
      emitPlatformEvent("invite.deleted", toStandardInvite(invite), { guildId: invite.guild?.id ?? undefined, channelId: invite.channelId ?? invite.channel?.id ?? undefined, userId: invite.inviter?.id ?? invite.inviterId ?? undefined });
   });
   client.on("webhooksUpdate", channel => {
      emitPlatformEvent("webhook.updated", { channelId: channel.id, guildId: "guildId" in channel ? channel.guildId : undefined }, { channelId: channel.id, guildId: "guildId" in channel ? channel.guildId : undefined });
   });
   client.on("applicationCommandPermissionsUpdate", data => {
      emitPlatformEvent("command.permissionsUpdated", data, { guildId: data.guildId });
   });

   /* Auto-moderation handling */
   client.on("autoModerationRuleCreate", rule => {
      emitPlatformEvent("autoModeration.ruleCreated", {
         id: rule.id,
         name: rule.name,
         enabled: rule.enabled,
         eventType: String(rule.eventType),
         triggerType: String(rule.triggerType)
      }, { guildId: rule.guild?.id ?? undefined });
   });
   client.on("autoModerationRuleUpdate", (_oldRule, newRule) => {
      emitPlatformEvent("autoModeration.ruleUpdated", {
         id: newRule.id,
         name: newRule.name,
         enabled: newRule.enabled,
         eventType: String(newRule.eventType),
         triggerType: String(newRule.triggerType)
      }, { guildId: newRule.guild?.id ?? undefined });
   });
   client.on("autoModerationRuleDelete", rule => {
      emitPlatformEvent("autoModeration.ruleDeleted", {
         id: rule.id,
         name: rule.name,
         enabled: rule.enabled,
         eventType: String(rule.eventType),
         triggerType: String(rule.triggerType)
      }, { guildId: rule.guild?.id ?? undefined });
   });
   client.on("autoModerationActionExecution", execution => {
      emitPlatformEvent("autoModeration.actionExecuted", {
         ruleId: execution.ruleId,
         actionType: String(execution.action?.type),
         channelId: execution.channelId ?? undefined,
         userId: execution.userId ?? undefined
      }, { guildId: execution.guild?.id ?? undefined, channelId: execution.channelId ?? undefined, userId: execution.userId ?? undefined });
   });

   /* Soundboard handling */
   client.on("soundboardSounds", (sounds, guild) => {
      const mapped = sounds.map(sound => toStandardSoundboardSound(sound));
      emitPlatformEvent("soundboard.soundsUpdated", { sounds: mapped }, { guildId: guild.id });
   });
   client.on("guildSoundboardSoundsUpdate", (sounds, guild) => {
      const mapped = sounds.map(sound => toStandardSoundboardSound(sound));
      emitPlatformEvent("soundboard.soundsUpdated", { sounds: mapped }, { guildId: guild.id });
   });
   client.on("guildSoundboardSoundCreate", sound => {
      emitPlatformEvent("soundboard.soundCreated", toStandardSoundboardSound(sound), { guildId: sound.guildId ?? undefined });
   });
   client.on("guildSoundboardSoundUpdate", (_oldSound, newSound) => {
      emitPlatformEvent("soundboard.soundUpdated", toStandardSoundboardSound(newSound), { guildId: newSound.guildId ?? undefined });
   });
   client.on("guildSoundboardSoundDelete", sound => {
      emitPlatformEvent("soundboard.soundDeleted", toStandardSoundboardSound(sound), { guildId: sound.guildId ?? undefined });
   });

   /* Entitlements + subscriptions */
   client.on("entitlementCreate", entitlement => {
      if (!entitlement) return;
      emitPlatformEvent("entitlement.created", toStandardEntitlement(entitlement), { guildId: entitlement.guildId ?? undefined, userId: entitlement.userId ?? undefined });
   });
   client.on("entitlementUpdate", entitlement => {
      if (!entitlement) return;
      emitPlatformEvent("entitlement.updated", toStandardEntitlement(entitlement), { guildId: entitlement.guildId ?? undefined, userId: entitlement.userId ?? undefined });
   });
   client.on("entitlementDelete", entitlement => {
      if (!entitlement) return;
      emitPlatformEvent("entitlement.deleted", toStandardEntitlement(entitlement), { guildId: entitlement.guildId ?? undefined, userId: entitlement.userId ?? undefined });
   });
   client.on("subscriptionCreate", subscription => {
      if (!subscription) return;
      emitPlatformEvent("subscription.created", toStandardSubscription(subscription), { userId: subscription.userId ?? undefined });
   });
   client.on("subscriptionUpdate", subscription => {
      if (!subscription) return;
      emitPlatformEvent("subscription.updated", toStandardSubscription(subscription), { userId: subscription.userId ?? undefined });
   });
   client.on("subscriptionDelete", subscription => {
      if (!subscription) return;
      emitPlatformEvent("subscription.deleted", toStandardSubscription(subscription), { userId: subscription.userId ?? undefined });
   });

   /* Stage instance handling */
   client.on("stageInstanceCreate", stage => {
      emitPlatformEvent("stage.created", toStandardStageInstance(stage), { guildId: stage.guildId ?? undefined, channelId: stage.channelId });
   });
   client.on("stageInstanceUpdate", (_oldStage, newStage) => {
      emitPlatformEvent("stage.updated", toStandardStageInstance(newStage), { guildId: newStage.guildId ?? undefined, channelId: newStage.channelId });
   });
   client.on("stageInstanceDelete", stage => {
      emitPlatformEvent("stage.deleted", toStandardStageInstance(stage), { guildId: stage.guildId ?? undefined, channelId: stage.channelId });
   });

   client.on("interactionCreate", async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (!isCoreInitialized()) {
         log(`Bot not yet initialized, cannot process command`, "warn");
         return;
      }
      try {
         const commandInteraction = toStandardCommandInteraction(interaction);
         await handleCoreCommand(commandInteraction);
      } catch (error: unknown) {
         const message = error instanceof Error ? error.message : String(error);
         log(`Command handling error: ${message}`, "error");
      }
   });

   client.on("messageCreate", async (message: Message): Promise<void> => {
      if (!isCoreInitialized()) {
         log(`Bot not yet initialized, cannot process incoming message`, "warn");
         return;
      }
      if (!client.user) {
         log(`No client user found, cannot process incoming message`, "warn");
         return;
      }
      if ((message.author.id === client.user.id)
         || !(message.type === MessageType.Default || message.type === MessageType.Reply)
      ) {
         trace(`skip messageCreate`, {
            type: message.type,
            author: message.author.id,
            self: client.user.id,
            bot: message.author.bot
         });
         return;
      }
      const coreMessage = await toStandardMessage(message);

      if (envFlag("DISCORD_DEBUG")) {
         // Logging
         let content: string = message.content;
         log(`Message content (raw): "${content}" (len=${content.length})`, "debug");
         if (message.embeds) {
            for (const embed of message.embeds) {
               const url = embed.url ?? `no URL`;
               if (!content.includes(url)) content += `[Embedded content: ${url}]\n`;
            }
         }
         log(`Message content (after embeds): "${content}" (len=${content.length})`, "debug");
         if (message.attachments) {
            for (const [_attachmentSnowflake, attachmentData] of message.attachments) {
               const url = attachmentData.url ?? "no URL";
               content += `[Attached content: ${url}]\n`;
            }
         }
         log(`Message content (after attachments): "${content}" (len=${content.length})`, "debug");
      }

      await handleCoreMessage(coreMessage);
   });

   const stop = async (): Promise<void> => {
      try {
         await client.destroy();
      } catch (error: unknown) {
         const message = error instanceof Error ? error.message : String(error);
         log(`Error during shutdown: ${message}`, "error");
      }
   };

   try {
      preflightDiscordEnv();
      log(`Environment variables OK. Attempting Discord login...`);
      log(`Discord Developer Portal: enable the Message Content Intent for this bot to access message.content.`, "warn");
      void login();
   } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Startup failed before login: ${message}`, "error");
      process.exitCode = 1;
   }

   return { stop };
};

export { startDiscordMediator };
