import { Brain } from "./brain";
import { InteractionRouter } from "./interactionRouter";
import { log } from "./log";
import { processMessage, type ProcessResults } from "./messageProcessor";
import { KnownUsers, upsertKnownUser, syncKnownUserProfile } from "@/core/knownUsers";
import type {
   StandardMessage,
   StandardCommandInteraction,
   StandardEvent,
   StandardUserProfile,
   StandardMember,
   StandardPresence,
   StandardTyping,
   StandardReaction,
   StandardMessageChange,
   StandardThread,
   StandardChannel,
   StandardRole,
   StandardEmoji,
   StandardSticker,
   StandardVoiceState,
   StandardStageInstance,
   StandardSoundboardSound,
   StandardInvite,
   StandardModerationRule,
   StandardModerationAction,
   StandardEntitlement,
   StandardSubscription,
   StandardScheduledEvent,
   StandardPollVote
} from "@/contracts";
import { envFlag, requireEnv } from "@/utils";

const mandatoryCoreEnvVars = ["NODE_ENV"];
const traceFlow = envFlag("TRACE_FLOW");
const logMessageContent = envFlag("LOG_MESSAGE_CONTENT");

const tracePlatformEvent = (event: StandardEvent, note?: string): void => {
   if (!traceFlow) return;
   log({ message: note ? `Platform event: ${note}` : "Platform event", data: event }, "trace");
};

const PLATFORM_CACHE_LIMIT = 1000;
const TYPING_TTL_MS = 15_000;

const platformState = {
   lastEventAt: new Map<string, number>(),
   userProfilesById: new Map<string, StandardUserProfile>(),
   membersByUserId: new Map<string, StandardMember>(),
   presenceByUserId: new Map<string, StandardPresence>(),
   typingByKey: new Map<string, StandardTyping>(),
   reactionsByKey: new Map<string, StandardReaction>(),
   messageChangesById: new Map<string, StandardMessageChange>(),
   threadsById: new Map<string, StandardThread>(),
   channelsById: new Map<string, StandardChannel>(),
   rolesById: new Map<string, StandardRole>(),
   emojisByKey: new Map<string, StandardEmoji>(),
   stickersById: new Map<string, StandardSticker>(),
   guildsById: new Map<string, { id: string; name?: string }>(),
   auditLogEntryByGuild: new Map<string, { id: string; action: string; userId?: string }>(),
   webhookUpdatedAtByChannel: new Map<string, number>(),
   commandPermissionsUpdatedAtByGuild: new Map<string, number>(),
   invitesByCode: new Map<string, StandardInvite>(),
   scheduledEventsById: new Map<string, StandardScheduledEvent>(),
   stageInstancesById: new Map<string, StandardStageInstance>(),
   voiceStatesByUserId: new Map<string, StandardVoiceState>(),
   soundboardSoundsById: new Map<string, StandardSoundboardSound>(),
   entitlementsById: new Map<string, StandardEntitlement>(),
   subscriptionsById: new Map<string, StandardSubscription>(),
   moderationRulesById: new Map<string, StandardModerationRule>(),
   lastModerationActionByRule: new Map<string, StandardModerationAction>(),
   pollVotesByKey: new Map<string, StandardPollVote>(),
   userActivityAt: new Map<string, number>(),
   channelActivityAt: new Map<string, number>(),
   guildActivityAt: new Map<string, number>()
};

const setCapped = <T>(map: Map<string, T>, key: string, value: T): void => {
   if (map.has(key)) map.delete(key);
   map.set(key, value);
   if (map.size > PLATFORM_CACHE_LIMIT) {
      const oldestKey = map.keys().next().value as string | undefined;
      if (oldestKey !== undefined) map.delete(oldestKey);
   }
};

const recordActivity = (event: StandardEvent): void => {
   if (event.userId) setCapped(platformState.userActivityAt, event.userId, event.occurredAt);
   if (event.channelId) setCapped(platformState.channelActivityAt, event.channelId, event.occurredAt);
   if (event.guildId) setCapped(platformState.guildActivityAt, event.guildId, event.occurredAt);
};

const pruneTyping = (now: number): void => {
   for (const [key, typing] of platformState.typingByKey) {
      const startedAt = typing.startedAt ?? now;
      if (startedAt + TYPING_TTL_MS < now) platformState.typingByKey.delete(key);
   }
};

const preflightCoreEnv = (): void => {
   for (const envVar of mandatoryCoreEnvVars) {
      requireEnv(envVar);
   }
};

const initBrainSettings = (): void => {
   log(`Loading brain settings for "${Brain.botName}" ...`);
   let loadResults: boolean | Error = Brain.loadSettings(Brain.botName);
   if (loadResults instanceof Error) {
      log(`Unable to load brain settings: ${loadResults.message}. Trying with default settings.`, "warn");
      loadResults = Brain.loadSettings();
      if (loadResults instanceof Error) {
         log(`Error loading default brain settings: ${loadResults.message}. Unable to continue.`, "error");
         process.exit();
      }
   }
   log(`Brain settings: ${JSON.stringify(Brain.settings, null, 2)}`, "debug");
};

const initBrainData = async (): Promise<void> => {
   if (Brain.lexicon.size === 0 || Brain.nGrams.size === 0) {
      log(`Brain is apparently empty. Loading from trainer file '../resources/${Brain.botName}-trainer.txt'. This may take a very long time, be patient.`);
      if (!brainTrainingPromise) {
         brainTrainingPromise = (async (): Promise<void> => {
            let loadResults: boolean | Error = await Brain.trainFromFile(Brain.botName, "txt");
            if (loadResults instanceof Error) {
               log(`Unable to load trainer file: ${loadResults.message}. Attempting to load default trainer file '../resources/default-trainer.txt'.`, "warn");
               loadResults = await Brain.trainFromFile("default", "txt");
               if (loadResults instanceof Error) {
                  log(`Error loading trainer file: ${loadResults.message}. Going to have a broken brain.`, "error");
               }
            }
         })()
            .catch((error: unknown) => {
               const message = error instanceof Error ? error.message : String(error);
               log(`Error loading trainer file: ${message}. Going to have a broken brain.`, "error");
            })
            .finally(() => {
               brainTrainingPromise = null;
            });
      }
   }
   if (Brain.lexicon.size === 0 || Brain.nGrams.size === 0) {
      if (brainTrainingPromise) {
         log(`Brain training in progress; responses will be limited until data is available.`, "warn");
      } else {
         log(`Error initializing brain: no data was found.`, "error");
      }
   }
};

const initInteractionRouter = async (): Promise<void> => {
   await InteractionRouter.initialize();
};

let coreInitialized = false;
let coreInitializing = false;
let shuttingDown = false;
let processHandlersRegistered = false;
let brainTrainingPromise: Promise<void> | null = null;

const dirty = {
   brain: false
};

const initializeCore = async (): Promise<void> => {
   log(`Initializing...`);
   log(`Loading environment variables...`);
   preflightCoreEnv();
   initBrainSettings();
   await initBrainData();
   await initInteractionRouter();
   coreInitialized = true;
};

const startCoreInitialization = async (): Promise<void> => {
   if (coreInitialized || coreInitializing) return;
   coreInitializing = true;
   try {
      await initializeCore();
   } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Initialization failed: ${message}`, "error");
   } finally {
      coreInitializing = false;
   }
};

const isCoreInitialized = (): boolean => coreInitialized;

const saveCoreData = (): void => {
   const saveResults: boolean | Error = dirty.brain ? Brain.saveSettings(Brain.botName) : false;
   if (saveResults instanceof Error) {
      log(`Error saving brain settings: ${saveResults.message}`, "error");
   } else if (saveResults) {
      log(`Brain settings saved.`);
      dirty.brain = false;
   }
};

const shutdownCore = async (): Promise<void> => {
   saveCoreData();
};

const registerProcessHandlers = (onShutdown?: () => Promise<void> | void): void => {
   if (processHandlersRegistered) return;
   processHandlersRegistered = true;
   const exitHandler = async (signal?: NodeJS.Signals): Promise<void> => {
      if (shuttingDown) return;
      shuttingDown = true;
      log(`Saving data, shutting down client${signal ? ` (signal: ${signal})` : ""}.`);
      if (onShutdown) {
         try {
            await onShutdown();
         } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            log(`Shutdown handler error: ${message}`, "error");
         }
      }
      await shutdownCore();
   };

   const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGUSR1", "SIGUSR2"];
   for (const signal of signals) {
      process.once(signal, () => {
         void exitHandler(signal).finally(() => {
            const exitCode = signal === "SIGINT" ? 130 : 0;
            process.exit(exitCode);
         });
      });
   }
};

const syncKnownUserFromMessage = (message: StandardMessage): void => {
   if (!message.authorId) return;
   if (KnownUsers.has(message.authorId)) return;
   const name = message.authorName || "<UNKNOWN USER>";
   const aliases = message.authorName ? [message.authorName] : [];
   upsertKnownUser(message.authorId, name, aliases);
};

const handleCoreCommand = async (interaction: StandardCommandInteraction): Promise<void> => {
   if (!coreInitialized) {
      log(`Core not initialized, cannot process command`, "warn");
      return;
   }
   await InteractionRouter.handleCommand(interaction);
};

const handlePlatformEvent = async (event: StandardEvent): Promise<void> => {
   if (!coreInitialized) {
      tracePlatformEvent(event, "skipped (core not initialized)");
      return;
   }
   platformState.lastEventAt.set(event.type, event.occurredAt);
   recordActivity(event);
   switch (event.type) {
      case "user.updated": {
         const payload = event.payload as StandardUserProfile | undefined;
         if (payload?.id && payload.username) {
            syncKnownUserProfile({ id: payload.id, username: payload.username, displayName: payload.displayName });
         }
         if (payload?.id) setCapped(platformState.userProfilesById, payload.id, payload);
         return;
      }
      case "member.added":
      case "member.updated":
      case "member.available":
      case "member.chunked":
      case "member.removed": {
         const payload = event.payload as StandardMember | undefined;
         if (payload?.userId && payload.username) {
            syncKnownUserProfile({ id: payload.userId, username: payload.username, displayName: payload.displayName });
         }
         if (payload?.userId) setCapped(platformState.membersByUserId, payload.userId, payload);
         return;
      }
      case "presence.updated": {
         const payload = event.payload as StandardPresence | undefined;
         if (payload?.userId) setCapped(platformState.presenceByUserId, payload.userId, payload);
         return;
      }
      case "typing.started": {
         const payload = event.payload as StandardTyping | undefined;
         if (payload?.channelId && payload.userId) {
            const key = `${payload.channelId}:${payload.userId}`;
            const startedAt = payload.startedAt ?? event.occurredAt;
            setCapped(platformState.typingByKey, key, { ...payload, startedAt });
            pruneTyping(event.occurredAt);
         }
         return;
      }
      case "reaction.added":
      case "reaction.removed":
      case "reaction.removedEmoji": {
         const payload = event.payload as StandardReaction | undefined;
         if (payload?.messageId) {
            const emojiKey = payload.emoji.id ?? payload.emoji.name;
            const key = `${payload.messageId}:${emojiKey}:${payload.userId ?? "unknown"}`;
            setCapped(platformState.reactionsByKey, key, payload);
         }
         return;
      }
      case "reaction.removedAll": {
         const payload = event.payload as { message?: StandardMessageChange; reactions?: StandardReaction[] } | undefined;
         if (payload?.message?.messageId) {
            setCapped(platformState.messageChangesById, payload.message.messageId, payload.message);
         }
         return;
      }
      case "message.updated":
      case "message.deleted": {
         const payload = event.payload as StandardMessageChange | undefined;
         if (payload?.messageId) setCapped(platformState.messageChangesById, payload.messageId, payload);
         return;
      }
      case "message.deletedBulk": {
         const payload = event.payload as { messages?: StandardMessageChange[] } | undefined;
         payload?.messages?.forEach(message => {
            if (message.messageId) setCapped(platformState.messageChangesById, message.messageId, message);
         });
         return;
      }
      case "message.pollVoteAdded":
      case "message.pollVoteRemoved": {
         const payload = event.payload as StandardPollVote | undefined;
         if (payload?.messageId && payload.userId) {
            const key = `${payload.messageId}:${payload.userId}`;
            setCapped(platformState.pollVotesByKey, key, payload);
         }
         return;
      }
      case "thread.created": {
         const wrapper = event.payload as { thread?: StandardThread } | undefined;
         const thread = wrapper?.thread ?? (event.payload as StandardThread | undefined);
         if (thread?.id) setCapped(platformState.threadsById, thread.id, thread);
         return;
      }
      case "thread.updated": {
         const payload = event.payload as StandardThread | undefined;
         if (payload?.id) setCapped(platformState.threadsById, payload.id, payload);
         return;
      }
      case "thread.deleted": {
         const payload = event.payload as StandardThread | undefined;
         if (payload?.id) platformState.threadsById.delete(payload.id);
         return;
      }
      case "thread.listSync": {
         const payload = event.payload as { threads?: StandardThread[] } | undefined;
         payload?.threads?.forEach(thread => {
            if (thread.id) setCapped(platformState.threadsById, thread.id, thread);
         });
         return;
      }
      case "thread.memberUpdated":
      case "thread.membersUpdated": {
         return;
      }
      case "channel.created":
      case "channel.updated": {
         const payload = event.payload as StandardChannel | undefined;
         if (payload?.id) setCapped(platformState.channelsById, payload.id, payload);
         return;
      }
      case "channel.deleted": {
         const payload = event.payload as StandardChannel | undefined;
         if (payload?.id) platformState.channelsById.delete(payload.id);
         return;
      }
      case "channel.pinsUpdated": {
         const payload = event.payload as { channel?: StandardChannel } | undefined;
         if (payload?.channel?.id) setCapped(platformState.channelsById, payload.channel.id, payload.channel);
         return;
      }
      case "role.created":
      case "role.updated": {
         const payload = event.payload as StandardRole | undefined;
         if (payload?.id) setCapped(platformState.rolesById, payload.id, payload);
         return;
      }
      case "role.deleted": {
         const payload = event.payload as StandardRole | undefined;
         if (payload?.id) platformState.rolesById.delete(payload.id);
         return;
      }
      case "emoji.created":
      case "emoji.updated": {
         const payload = event.payload as StandardEmoji | undefined;
         if (payload) {
            const key = payload.id ?? payload.name;
            setCapped(platformState.emojisByKey, key, payload);
         }
         return;
      }
      case "emoji.deleted": {
         const payload = event.payload as StandardEmoji | undefined;
         if (payload) {
            const key = payload.id ?? payload.name;
            platformState.emojisByKey.delete(key);
         }
         return;
      }
      case "sticker.created":
      case "sticker.updated": {
         const payload = event.payload as StandardSticker | undefined;
         if (payload?.id) setCapped(platformState.stickersById, payload.id, payload);
         return;
      }
      case "sticker.deleted": {
         const payload = event.payload as StandardSticker | undefined;
         if (payload?.id) platformState.stickersById.delete(payload.id);
         return;
      }
      case "guild.created":
      case "guild.updated":
      case "guild.available":
      case "guild.unavailable": {
         const payload = event.payload as { id: string; name?: string } | undefined;
         if (payload?.id) setCapped(platformState.guildsById, payload.id, payload);
         return;
      }
      case "guild.deleted": {
         const payload = event.payload as { id: string } | undefined;
         if (payload?.id) platformState.guildsById.delete(payload.id);
         return;
      }
      case "guild.integrationsUpdated": {
         return;
      }
      case "guild.auditLogEntryCreated": {
         const payload = event.payload as { id: string; action: string; userId?: string } | undefined;
         if (payload?.id && event.guildId) setCapped(platformState.auditLogEntryByGuild, event.guildId, payload);
         return;
      }
      case "guild.scheduledEventCreated":
      case "guild.scheduledEventUpdated": {
         const payload = event.payload as StandardScheduledEvent | undefined;
         if (payload?.id) setCapped(platformState.scheduledEventsById, payload.id, payload);
         return;
      }
      case "guild.scheduledEventDeleted": {
         const payload = event.payload as StandardScheduledEvent | undefined;
         if (payload?.id) platformState.scheduledEventsById.delete(payload.id);
         return;
      }
      case "guild.scheduledEventUserAdded":
      case "guild.scheduledEventUserRemoved": {
         const payload = event.payload as { event?: StandardScheduledEvent } | undefined;
         if (payload?.event?.id) setCapped(platformState.scheduledEventsById, payload.event.id, payload.event);
         return;
      }
      case "invite.created": {
         const payload = event.payload as StandardInvite | undefined;
         if (payload?.code) setCapped(platformState.invitesByCode, payload.code, payload);
         return;
      }
      case "invite.deleted": {
         const payload = event.payload as StandardInvite | undefined;
         if (payload?.code) platformState.invitesByCode.delete(payload.code);
         return;
      }
      case "webhook.updated": {
         if (event.channelId) setCapped(platformState.webhookUpdatedAtByChannel, event.channelId, event.occurredAt);
         return;
      }
      case "command.permissionsUpdated": {
         if (event.guildId) setCapped(platformState.commandPermissionsUpdatedAtByGuild, event.guildId, event.occurredAt);
         return;
      }
      case "autoModeration.ruleCreated":
      case "autoModeration.ruleUpdated": {
         const payload = event.payload as StandardModerationRule | undefined;
         if (payload?.id) setCapped(platformState.moderationRulesById, payload.id, payload);
         return;
      }
      case "autoModeration.ruleDeleted": {
         const payload = event.payload as StandardModerationRule | undefined;
         if (payload?.id) platformState.moderationRulesById.delete(payload.id);
         return;
      }
      case "autoModeration.actionExecuted": {
         const payload = event.payload as StandardModerationAction | undefined;
         if (payload?.ruleId) setCapped(platformState.lastModerationActionByRule, payload.ruleId, payload);
         return;
      }
      case "soundboard.soundsUpdated": {
         const payload = event.payload as { sounds?: StandardSoundboardSound[] } | undefined;
         payload?.sounds?.forEach(sound => {
            if (sound.id) setCapped(platformState.soundboardSoundsById, sound.id, sound);
         });
         return;
      }
      case "soundboard.soundCreated":
      case "soundboard.soundUpdated": {
         const payload = event.payload as StandardSoundboardSound | undefined;
         if (payload?.id) setCapped(platformState.soundboardSoundsById, payload.id, payload);
         return;
      }
      case "soundboard.soundDeleted": {
         const payload = event.payload as StandardSoundboardSound | undefined;
         if (payload?.id) platformState.soundboardSoundsById.delete(payload.id);
         return;
      }
      case "entitlement.created":
      case "entitlement.updated": {
         const payload = event.payload as StandardEntitlement | undefined;
         if (payload?.id) setCapped(platformState.entitlementsById, payload.id, payload);
         return;
      }
      case "entitlement.deleted": {
         const payload = event.payload as StandardEntitlement | undefined;
         if (payload?.id) platformState.entitlementsById.delete(payload.id);
         return;
      }
      case "subscription.created":
      case "subscription.updated": {
         const payload = event.payload as StandardSubscription | undefined;
         if (payload?.id) setCapped(platformState.subscriptionsById, payload.id, payload);
         return;
      }
      case "subscription.deleted": {
         const payload = event.payload as StandardSubscription | undefined;
         if (payload?.id) platformState.subscriptionsById.delete(payload.id);
         return;
      }
      case "voice.stateUpdated": {
         const payload = event.payload as StandardVoiceState | undefined;
         if (payload?.userId) setCapped(platformState.voiceStatesByUserId, payload.userId, payload);
         return;
      }
      case "voice.channelEffect": {
         return;
      }
      case "stage.created":
      case "stage.updated": {
         const payload = event.payload as StandardStageInstance | undefined;
         if (payload?.id) setCapped(platformState.stageInstancesById, payload.id, payload);
         return;
      }
      case "stage.deleted": {
         const payload = event.payload as StandardStageInstance | undefined;
         if (payload?.id) platformState.stageInstancesById.delete(payload.id);
         return;
      }
      default:
         tracePlatformEvent(event);
   }
};

const handleCoreMessage = async (message: StandardMessage): Promise<ProcessResults | null> => {
   if (!coreInitialized) {
      log(`Core not initialized, cannot process incoming message`, "warn");
      return null;
   }
   if (message.isBot && !Brain.settings.learnFromBots) return null;
   if (message.isSelf) return null;
   syncKnownUserFromMessage(message);

   const channelLabel = message.channelName ?? message.channel?.name ?? message.channelId;
   const messageSource = `${message.guildName ?? "Private"}:#${channelLabel}:${message.authorName}`;
   if (logMessageContent) {
      log(`<${messageSource}> ${message.content}`);
   } else {
      log(`Message received from ${messageSource} (len=${message.content.length})`, "debug");
   }

   const results = await processMessage(message);
   if (results.learned) {
      log(`Learned: ${results.processedText}`, "debug");
      dirty.brain = true;
   }
   if (results.triggeredBy) {
      log(`Processing trigger: ${results.triggeredBy}`, "debug");
   }

   const botResponse = results.response ? (results.directedTo ? `${results.directedTo}: ${results.response}` : results.response) : undefined;
   if (botResponse) {
      const botSource = `${message.guildName ?? "Private"}:#${channelLabel}:${Brain.botName}`;
      if (logMessageContent) {
         log(`<${botSource}> ${botResponse}`);
      } else {
         log(`Message sent by ${botSource} (len=${botResponse.length})`, "debug");
      }
   }

   return results;
};

export {
   preflightCoreEnv,
   startCoreInitialization,
   isCoreInitialized,
   registerProcessHandlers,
   handleCoreMessage,
   handleCoreCommand,
   handlePlatformEvent,
   shutdownCore
};
