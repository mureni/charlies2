import type {
   APIEmbed,
   ApplicationCommandDataResolvable,
   ColorResolvable,
   Message,
   PartialMessage,
   User,
   PartialUser,
   ChatInputCommandInteraction,
   GuildTextBasedChannel,
   GuildMember,
   PartialGuildMember,
   GuildMemberManager,
   Role,
   Presence,
   Typing,
   MessageReaction,
   PartialMessageReaction,
   ThreadChannel,
   VoiceState,
   StageInstance,
   Invite,
   Sticker,
   GuildScheduledEvent,
   PartialGuildScheduledEvent,
   SoundboardSound,
   PartialSoundboardSound,
   Entitlement,
   Subscription,
   Channel,
   PartialDMChannel } from "discord.js";
import {
   AttachmentBuilder,
   ApplicationCommandOptionType,
   ChannelType,
   PermissionFlagsBits,
   PermissionsBitField,
   resolveColor
} from "discord.js";
import { log } from "@/core/log";
import { env, envFlag } from "@/utils";
import type {
   StandardMessage,
   StandardOutgoingAttachment,
   StandardOutgoingEmbed,
   StandardOutgoingMessage as PlatformOutgoingMessage,
   StandardOutgoingMessage,
   StandardCommand,
   PlatformAdapter,
   StandardCommandInteraction,
   StandardMember,
   StandardMemberQuery,
   StandardChannel,
   StandardChannelType,
   StandardChannelScope,
   StandardUserProfile,
   StandardRole,
   StandardEmoji,
   StandardSticker,
   StandardPresence,
   StandardTyping,
   StandardReaction,
   StandardMessageChange,
   StandardThread,
   StandardVoiceState,
   StandardStageInstance,
   StandardInvite,
   StandardSoundboardSound,
   StandardEntitlement,
   StandardSubscription,
   StandardScheduledEvent
} from "./types";

type DiscordChannel = Channel | PartialDMChannel | ThreadChannel;
const traceFlow = envFlag("TRACE_FLOW");
const trace = (message: string, data?: unknown): void => {
   if (traceFlow) log(data ? { message: `Discord adapter: ${message}`, data } : `Discord adapter: ${message}`, "trace");
};

const getDisplayName = async (member: User, memberManager?: GuildMemberManager): Promise<string> => {
   let displayName: string = member.username;
   try {
      if (memberManager) {
         const resolvedUser = await memberManager.resolve(member);
         if (resolvedUser) displayName = resolvedUser.displayName;
      }
   } catch {
      displayName = member.username;
   }
   if (displayName === "") displayName = "<UNKNOWN USER>";
   return displayName;
};

const toDiscordColor = (color: string | number): number | undefined => {
   try {
      return resolveColor(color as ColorResolvable);
   } catch {
      return undefined;
   }
};

const mapChannelType = (channel: DiscordChannel): StandardChannelType => {
   const channelType = (channel as { type?: ChannelType }).type;
   switch (channelType) {
      case ChannelType.DM:
      case ChannelType.GroupDM:
         return "dm";
      case ChannelType.GuildText:
      case ChannelType.GuildAnnouncement:
         return "text";
      case ChannelType.GuildForum:
         return "forum";
      case ChannelType.GuildMedia:
         return "media";
      case ChannelType.AnnouncementThread:
      case ChannelType.PublicThread:
      case ChannelType.PrivateThread:
         return "thread";
      case ChannelType.GuildVoice:
         return "voice";
      case ChannelType.GuildStageVoice:
         return "stage";
      case ChannelType.GuildCategory:
         return "category";
      default:
         return "unknown";
   }
};

const toStandardChannel = (channel: DiscordChannel): StandardChannel => {
   const channelType = (channel as { type?: ChannelType }).type;
   const type = mapChannelType(channel);
   const scope: StandardChannelScope = type === "dm" ? "dm" : "server";
   const supportsText = type === "text" || type === "dm" || type === "thread" || type === "forum" || type === "media";
   const supportsVoice = type === "voice" || type === "stage";
   const supportsTyping = supportsText;
   const supportsHistory = supportsText;
   const isGroupDm = channelType === ChannelType.GroupDM;
   let memberCount: number | undefined;
   if (isGroupDm && "recipients" in channel) {
      const recipients = (channel as { recipients?: { size?: number; length?: number } | unknown[] }).recipients;
      if (Array.isArray(recipients)) {
         memberCount = recipients.length;
      } else if (typeof recipients?.size === "number") {
         memberCount = recipients.size;
      }
   } else if (type === "dm") {
      memberCount = 1;
   }
   return {
      id: channel.id,
      name: "name" in channel ? String(channel.name) : channel.id,
      type,
      scope,
      guildId: "guildId" in channel ? (channel as { guildId?: string }).guildId : undefined,
      supportsText,
      supportsVoice,
      supportsTyping,
      supportsHistory,
      isGroupDm,
      memberCount
   };
};

interface DiscordEmojiSource {
   id?: string | null;
   name?: string | null;
   animated?: boolean | null;
}

const toStandardUserProfile = (user: User, displayName?: string): StandardUserProfile => ({
   id: user.id,
   username: user.username || "<UNKNOWN USER>",
   displayName,
   isBot: user.bot
});

const toStandardMember = (member: GuildMember | PartialGuildMember): StandardMember => ({
   id: member.id,
   userId: member.user?.id ?? member.id,
   displayName: member.displayName ?? member.user?.username ?? "<UNKNOWN USER>",
   username: member.user?.username ?? undefined
});

const toStandardRole = (role: Role): StandardRole => ({
   id: role.id,
   name: role.name,
   color: role.color,
   permissions: role.permissions?.toArray ? role.permissions.toArray() : undefined,
   position: role.position,
   mentionable: role.mentionable,
   managed: role.managed
});

const toStandardEmoji = (emoji: DiscordEmojiSource): StandardEmoji => ({
   id: emoji.id ?? undefined,
   name: emoji.name ?? "<UNKNOWN EMOJI>",
   animated: emoji.animated ?? undefined
});

const toStandardSticker = (sticker: Sticker): StandardSticker => ({
   id: sticker.id,
   name: sticker.name,
   description: sticker.description ?? undefined,
   format: sticker.format ? String(sticker.format) : undefined
});

const toStandardPresence = (presence: Presence): StandardPresence => ({
   userId: presence.userId,
   status: presence.status,
   activities: presence.activities && presence.activities.length > 0
      ? presence.activities.map(activity => ({
         name: activity.name,
         type: String(activity.type),
         state: activity.state ?? undefined
      }))
      : undefined,
   clientStatus: presence.clientStatus
      ? Object.fromEntries(Object.entries(presence.clientStatus).map(([key, value]) => [key, String(value)]))
      : undefined
});

const toStandardTyping = (typing: Typing): StandardTyping => ({
   channelId: typing.channel.id,
   userId: typing.user.id,
   startedAt: typeof typing.startedTimestamp === "number" ? typing.startedTimestamp : undefined
});

const toStandardReaction = (reaction: MessageReaction | PartialMessageReaction, user?: User | PartialUser | null): StandardReaction => ({
   messageId: reaction.message.id,
   channelId: reaction.message.channelId,
   guildId: reaction.message.guildId ?? undefined,
   emoji: toStandardEmoji(reaction.emoji),
   userId: user?.id ?? undefined,
   count: reaction.count ?? undefined
});

const toStandardMessageChange = (message: Message | PartialMessage): StandardMessageChange => ({
   messageId: message.id,
   channelId: message.channelId ?? message.channel?.id ?? "unknown",
   guildId: message.guildId ?? undefined,
   authorId: message.author?.id ?? undefined,
   content: message.content ?? undefined
});

const toStandardThread = (thread: ThreadChannel): StandardThread => ({
   id: thread.id,
   name: thread.name,
   parentId: thread.parentId ?? undefined,
   guildId: thread.guildId,
   ownerId: thread.ownerId ?? undefined,
   archived: thread.archived ?? undefined,
   locked: thread.locked ?? undefined,
   channel: toStandardChannel(thread)
});

const toStandardVoiceState = (state: VoiceState): StandardVoiceState => ({
   userId: state.id,
   channelId: state.channelId ?? undefined,
   guildId: state.guild?.id ?? undefined,
   muted: state.mute ?? undefined,
   deafened: state.deaf ?? undefined,
   serverMuted: state.serverMute ?? undefined,
   serverDeafened: state.serverDeaf ?? undefined,
   selfMuted: state.selfMute ?? undefined,
   selfDeafened: state.selfDeaf ?? undefined,
   streaming: state.streaming ?? undefined,
   suppress: state.suppress ?? undefined
});

const toStandardStageInstance = (stage: StageInstance): StandardStageInstance => ({
   id: stage.id,
   channelId: stage.channelId,
   guildId: stage.guildId ?? undefined,
   topic: stage.topic ?? undefined,
   privacyLevel: stage.privacyLevel
});

const toStandardInvite = (invite: Invite): StandardInvite => ({
   code: invite.code,
   channelId: invite.channelId ?? invite.channel?.id ?? undefined,
   guildId: invite.guild?.id ?? undefined,
   inviterId: invite.inviter?.id ?? invite.inviterId ?? undefined
});

const toStandardSoundboardSound = (sound: SoundboardSound | PartialSoundboardSound): StandardSoundboardSound => {
   const emoji = sound.emoji ? toStandardEmoji(sound.emoji as DiscordEmojiSource) : undefined;
   return {
      id: String(sound.soundId),
      name: sound.name ?? "<UNKNOWN SOUND>",
      emoji
   };
};

const toStandardEntitlement = (entitlement: Entitlement): StandardEntitlement => ({
   id: entitlement.id,
   userId: entitlement.userId ?? undefined,
   guildId: entitlement.guildId ?? undefined,
   skuId: entitlement.skuId
});

const toStandardSubscription = (subscription: Subscription): StandardSubscription => ({
   id: subscription.id,
   userId: subscription.userId ?? undefined
});

const toStandardScheduledEvent = (event: GuildScheduledEvent | PartialGuildScheduledEvent): StandardScheduledEvent => ({
   id: event.id,
   name: event.name ?? undefined,
   guildId: event.guildId ?? event.guild?.id ?? undefined
});

const toDiscordEmbed = (embed: StandardOutgoingEmbed): APIEmbed => {
   const result: APIEmbed = {};
   if (embed.color !== undefined) {
      const resolved = toDiscordColor(embed.color);
      if (resolved !== undefined) result.color = resolved;
   }
   if (embed.title) result.title = embed.title;
   if (embed.description) result.description = embed.description;
   if (embed.footer) result.footer = { text: embed.footer };
   if (embed.fields && embed.fields.length > 0) {
      result.fields = embed.fields.map(field => ({ name: field.name, value: field.value, inline: field.inline }));
   }
   if (embed.thumbnailAttachmentName) {
      result.thumbnail = { url: `attachment://${embed.thumbnailAttachmentName}` };
   }
   if (embed.imageAttachmentName) {
      result.image = { url: `attachment://${embed.imageAttachmentName}` };
   }
   return result;
};

const toDiscordAttachment = (attachment: StandardOutgoingAttachment): AttachmentBuilder =>
   new AttachmentBuilder(attachment.data, { name: attachment.name });

const permissionMap = {
   ADMINISTRATOR: PermissionFlagsBits.Administrator,
   MANAGE_GUILD: PermissionFlagsBits.ManageGuild,
   READ_MESSAGE_HISTORY: PermissionFlagsBits.ReadMessageHistory
} as const;

const toDiscordCommands = (commands: StandardCommand[]): ApplicationCommandDataResolvable[] =>
   commands.map(command => {
      const options = command.options?.map(option => ({
         name: option.name,
         description: option.description,
         type: {
            string: ApplicationCommandOptionType.String,
            number: ApplicationCommandOptionType.Number,
            boolean: ApplicationCommandOptionType.Boolean,
            user: ApplicationCommandOptionType.User,
            channel: ApplicationCommandOptionType.Channel
         }[option.type],
         required: Boolean(option.required)
      }));
      const permissions = command.permissions && command.permissions.length > 0
         ? new PermissionsBitField(command.permissions.map(permission => permissionMap[permission])).bitfield.toString()
         : undefined;
      return {
         name: command.name,
         description: command.description,
         options,
         default_member_permissions: permissions
      } as ApplicationCommandDataResolvable;
   });

interface SendableChannel {
   send: (options: {
      content?: string;
      embeds?: APIEmbed[];
      files?: AttachmentBuilder[];
      tts?: boolean;
   }) => Promise<unknown>;
   sendTyping?: () => Promise<unknown>;
}

const isSendableChannel = (channel: unknown): channel is SendableChannel =>
   Boolean(channel && typeof (channel as { send?: unknown }).send === "function");

const resolveTextChannel = async (client: Message["client"], channelId: string): Promise<SendableChannel | undefined> => {
   const cached = client.channels.cache.get(channelId);
   if (isSendableChannel(cached)) return cached;
   try {
      const fetched = await client.channels.fetch(channelId);
      if (isSendableChannel(fetched)) return fetched;
   } catch {
      trace(`resolveTextChannel failed`, { channelId });
      return undefined;
   }
   trace(`resolveTextChannel unsupported`, { channelId });
   return undefined;
};

const createDiscordAdapter = (message: Message): PlatformAdapter => ({
   reply: async (messageId: string, content: string): Promise<void> => {
      if (message.id === messageId) {
         await message.reply(content);
      } else {
         const channel = message.channel;
         if ("send" in channel) {
            await channel.send(content);
         }
      }
   },
   sendMessage: async (channelId: string, outgoing: PlatformOutgoingMessage): Promise<void> => {
      const channel = await resolveTextChannel(message.client, channelId);
      if (!channel) {
         trace(`sendMessage skipped`, { channelId });
         return;
      }
      const embeds = outgoing.embeds ? outgoing.embeds.map(toDiscordEmbed) : undefined;
      const files = outgoing.attachments ? outgoing.attachments.map(toDiscordAttachment) : undefined;
      let content = outgoing.contents;
      if ((embeds?.length || files?.length) && content === "") content = " ";
      try {
         await channel.send({
            content,
            embeds,
            files,
            tts: Boolean(outgoing.tts)
         });
      } catch (error: unknown) {
         const messageText = error instanceof Error ? error.message : String(error);
         log(`Discord sendMessage error: channel=${channelId} error=${messageText}`, "error");
      }
   },
   sendTyping: async (channelId: string): Promise<void> => {
      const channel = await resolveTextChannel(message.client, channelId);
      if (!channel || typeof channel.sendTyping !== "function") {
         trace(`sendTyping skipped`, { channelId });
         return;
      }
      try {
         await channel.sendTyping();
      } catch (error: unknown) {
         const messageText = error instanceof Error ? error.message : String(error);
         log(`Discord sendTyping error: channel=${channelId} error=${messageText}`, "error");
      }
   },
   fetchGuilds: async (): Promise<Array<{ id: string; name: string }>> =>
      message.client.guilds.cache.map(guild => ({ id: guild.id, name: guild.name })),
   fetchGuild: async (guildId: string): Promise<{ id: string; name: string } | undefined> => {
      const guild = message.client.guilds.cache.get(guildId);
      return guild ? { id: guild.id, name: guild.name } : undefined;
   },
   fetchChannels: async (guildId: string): Promise<StandardChannel[]> => {
      const guild = message.client.guilds.cache.get(guildId);
      if (!guild) return [];
      return guild.channels.cache.map(channel => toStandardChannel(channel));
   },
   fetchChannel: async (guildId: string | undefined, channelId: string): Promise<StandardChannel | undefined> => {
      const guild = guildId ? message.client.guilds.cache.get(guildId) : undefined;
      const channel = guild
         ? guild.channels.cache.get(channelId)
         : message.client.channels.cache.get(channelId);
      return channel ? toStandardChannel(channel) : undefined;
   },
   fetchMember: async (guildId: string, query: StandardMemberQuery) => {
      const guild = message.client.guilds.cache.get(guildId);
      if (!guild) return undefined;
      try {
         if (query.userId) {
            const member = await guild.members.fetch(query.userId);
            return member ? { id: member.id, userId: member.user.id, displayName: member.displayName, username: member.user.username } : undefined;
         }
         if (query.query) {
            const members = await guild.members.fetch({ query: query.query, limit: query.limit ?? 1 });
            const member = members.first();
            return member ? { id: member.id, userId: member.user.id, displayName: member.displayName, username: member.user.username } : undefined;
         }
      } catch {
         return undefined;
      }
      return undefined;
   },
   fetchHistory: async (channelId: string, options): Promise<StandardMessage[]> => {
      const channel = message.client.channels.cache.get(channelId);
      if (!channel) {
         trace(`fetchHistory skipped`, { channelId });
         return [];
      }
      const messageManager = (channel as { messages?: { fetch?: (opts: { limit?: number; before?: string }) => Promise<unknown> } }).messages;
      if (!messageManager || typeof messageManager.fetch !== "function") {
         trace(`fetchHistory unsupported`, { channelId });
         return [];
      }
      const fetched = await messageManager.fetch({
         limit: options.limit ?? 100,
         before: options.beforeId
      });
      if (!fetched || typeof (fetched as { map?: unknown }).map !== "function") {
         trace(`fetchHistory invalid payload`, { channelId });
         return [];
      }
      return (fetched as { map: (fn: (msg: Message) => StandardMessage) => StandardMessage[] }).map(msg => ({
         id: msg.id,
         content: msg.content,
         authorId: msg.author.id,
         authorName: msg.member?.displayName ?? msg.author.username,
         isBot: msg.author.bot,
         channelId: msg.channelId,
         channelName: "name" in msg.channel ? String(msg.channel.name) : msg.channelId,
         guildId: msg.guild?.id,
         guildName: msg.guild?.name,
         channel: toStandardChannel(msg.channel as DiscordChannel)
      }));
   },
   canSend: async (channelId: string, guildId?: string): Promise<boolean> => {
      const guild = guildId ? message.client.guilds.cache.get(guildId) : undefined;
      const channel = guild
         ? guild.channels.cache.get(channelId)
         : message.client.channels.cache.get(channelId);
      if (!channel) return false;
      const coreChannel = toStandardChannel(channel as DiscordChannel);
      if (!coreChannel.supportsText) return false;
      if (!("permissionsFor" in channel) || !message.client.user) return true;
      const perms = (channel as GuildTextBasedChannel).permissionsFor(message.client.user);
      return Boolean(perms && perms.has(PermissionFlagsBits.SendMessages));
   },
   hasPermission: async (channelId: string, permission, guildId?: string): Promise<boolean> => {
      const guild = guildId ? message.client.guilds.cache.get(guildId) : undefined;
      const channel = guild
         ? guild.channels.cache.get(channelId)
         : message.client.channels.cache.get(channelId);
      if (!channel || !message.client.user || !("permissionsFor" in channel) || !("guild" in channel)) return false;
      const perms = (channel as GuildTextBasedChannel).permissionsFor(message.client.user);
      return Boolean(perms && perms.has(permissionMap[permission]));
   },
   supportsCommands: true,
   registerCommands: async (commands: StandardCommand[]): Promise<void> => {
      if (commands.length === 0) return;
      const application = message.client.application;
      if (!application) {
         log(`Discord registerCommands skipped: application unavailable`, "warn");
         return;
      }
      try {
         await application.commands.set(toDiscordCommands(commands));
      } catch (error: unknown) {
         const messageText = error instanceof Error ? error.message : String(error);
         log(`Discord registerCommands error: ${messageText}`, "error");
      }
   }
});

const toStandardCommandInteraction = (interaction: ChatInputCommandInteraction): StandardCommandInteraction => {
   const options: Record<string, unknown> = {};
   for (const option of interaction.options.data) {
      if (option.options && option.options.length > 0) {
         for (const nested of option.options) {
            options[nested.name] = nested.value;
         }
         continue;
      }
      options[option.name] = option.value;
   }

   const reply = async (message: StandardOutgoingMessage): Promise<void> => {
      const embeds = message.embeds ? message.embeds.map(toDiscordEmbed) : undefined;
      const files = message.attachments ? message.attachments.map(toDiscordAttachment) : undefined;
      let content = message.contents;
      if ((embeds?.length || files?.length) && content === "") content = " ";
      const payload = {
         content,
         embeds,
         files,
         tts: Boolean(message.tts)
      };
      if (interaction.replied || interaction.deferred) {
         await interaction.followUp(payload);
      } else {
         await interaction.reply(payload);
      }
   };
   const memberPermissions = interaction.memberPermissions;
   const isAdmin = Boolean(memberPermissions && (
      memberPermissions.has(PermissionFlagsBits.Administrator)
      || memberPermissions.has(PermissionFlagsBits.ManageGuild)
   ));

   return {
      command: interaction.commandName,
      options,
      userId: interaction.user.id,
      channelId: interaction.channelId,
      guildId: interaction.guildId ?? undefined,
      isAdmin,
      isBotOwner: interaction.user.id === env("BOT_OWNER_DISCORD_ID"),
      reply
   };
};

const toStandardMessage = async (message: Message): Promise<StandardMessage> => {
   const botUser = message.client.user ?? undefined;
   const authorName = await getDisplayName(message.member?.user ?? message.author, message.guild?.members);
   const mentionsBot = botUser ? message.mentions.has(botUser) : false;
   let referencedContent: string | undefined;
   let referencedMentionsBot: boolean | undefined;
   if (message.reference) {
      try {
         const referencedMessage = await message.fetchReference();
         referencedContent = referencedMessage.content;
         referencedMentionsBot = botUser ? referencedMessage.mentions.has(botUser) : false;
      } catch {
         referencedContent = undefined;
      }
   }
   const isAdmin = Boolean(message.member && (
      message.member.permissions.has(PermissionFlagsBits.Administrator)
      || message.member.permissions.has(PermissionFlagsBits.ManageGuild)
   ));
   return {
      id: message.id,
      content: message.content,
      authorId: message.author.id,
      authorName,
      isBot: message.author.bot,
      channelId: message.channelId,
      channelName: "name" in message.channel ? String(message.channel.name) : message.channelId,
      channel: toStandardChannel(message.channel as DiscordChannel),
      guildId: message.guild?.id,
      guildName: message.guild?.name,
      mentionsBot,
      referencedContent,
      referencedMentionsBot,
      isAdmin,
      isBotOwner: message.author.id === env("BOT_OWNER_DISCORD_ID"),
      isSelf: botUser ? message.author.id === botUser.id : false,
      tts: message.tts,
      platform: createDiscordAdapter(message),
      memberContext: undefined
   };
};

export {
   createDiscordAdapter,
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
   toStandardScheduledEvent,
   toDiscordAttachment,
   toDiscordEmbed
};
