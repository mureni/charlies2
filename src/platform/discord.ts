import {
   AttachmentBuilder,
   APIEmbed,
   ColorResolvable,
   Message,
   GuildTextBasedChannel,
   Channel,
   ChannelType,
   PartialDMChannel,
   PermissionFlagsBits,
   resolveColor
} from "discord.js";
import { getDisplayName } from "../core/user";
import { log } from "../core/log";
import { env } from "../utils";
import {
   CoreMessage,
   OutgoingAttachment,
   OutgoingEmbed,
   OutgoingMessage as PlatformOutgoingMessage,
   PlatformAdapter,
   PlatformMemberQuery,
   CoreChannel,
   CoreChannelType,
   CoreChannelScope
} from "./types";

type DiscordChannel = Channel | PartialDMChannel;
const traceFlow = env("TRACE_FLOW") === "true";
const trace = (message: string, data?: unknown): void => {
   if (traceFlow) log(data ? { message: `Discord adapter: ${message}`, data } : `Discord adapter: ${message}`, "trace");
};

const toDiscordColor = (color: string | number): number | undefined => {
   try {
      return resolveColor(color as ColorResolvable);
   } catch {
      return undefined;
   }
};

const mapChannelType = (channel: DiscordChannel): CoreChannelType => {
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

const toCoreChannel = (channel: DiscordChannel): CoreChannel => {
   const type = mapChannelType(channel);
   const scope: CoreChannelScope = type === "dm" ? "dm" : "server";
   const supportsText = type === "text" || type === "dm" || type === "thread" || type === "forum" || type === "media";
   const supportsVoice = type === "voice" || type === "stage";
   const supportsTyping = supportsText;
   const supportsHistory = supportsText;
   return {
      id: channel.id,
      name: "name" in channel ? String(channel.name) : channel.id,
      type,
      scope,
      guildId: "guildId" in channel ? (channel as { guildId?: string }).guildId : undefined,
      supportsText,
      supportsVoice,
      supportsTyping,
      supportsHistory
   };
};

const toDiscordEmbed = (embed: OutgoingEmbed): APIEmbed => {
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

const toDiscordAttachment = (attachment: OutgoingAttachment): AttachmentBuilder =>
   new AttachmentBuilder(attachment.data, { name: attachment.name });

type SendableChannel = {
   send: (options: {
      content?: string;
      embeds?: APIEmbed[];
      files?: AttachmentBuilder[];
      tts?: boolean;
   }) => Promise<unknown>;
   sendTyping?: () => Promise<unknown>;
};

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
   fetchChannels: async (guildId: string): Promise<CoreChannel[]> => {
      const guild = message.client.guilds.cache.get(guildId);
      if (!guild) return [];
      return guild.channels.cache.map(channel => toCoreChannel(channel));
   },
   fetchChannel: async (guildId: string | undefined, channelId: string): Promise<CoreChannel | undefined> => {
      const guild = guildId ? message.client.guilds.cache.get(guildId) : undefined;
      const channel = guild
         ? guild.channels.cache.get(channelId)
         : message.client.channels.cache.get(channelId);
      return channel ? toCoreChannel(channel) : undefined;
   },
   fetchMember: async (guildId: string, query: PlatformMemberQuery) => {
      const guild = message.client.guilds.cache.get(guildId);
      if (!guild) return undefined;
      try {
         if (query.userId) {
            const member = await guild.members.fetch(query.userId);
            return member ? { id: member.id, userId: member.user.id, displayName: member.displayName } : undefined;
         }
         if (query.query) {
            const members = await guild.members.fetch({ query: query.query, limit: query.limit ?? 1 });
            const member = members.first();
            return member ? { id: member.id, userId: member.user.id, displayName: member.displayName } : undefined;
         }
      } catch {
         return undefined;
      }
      return undefined;
   },
   fetchHistory: async (channelId: string, options): Promise<CoreMessage[]> => {
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
      return (fetched as { map: (fn: (msg: Message) => CoreMessage) => CoreMessage[] }).map(msg => ({
         id: msg.id,
         content: msg.content,
         authorId: msg.author.id,
         authorName: msg.member?.displayName ?? msg.author.username,
         isBot: msg.author.bot,
         channelId: msg.channelId,
         channelName: "name" in msg.channel ? String(msg.channel.name) : msg.channelId,
         guildId: msg.guild?.id,
         guildName: msg.guild?.name,
         channel: toCoreChannel(msg.channel as DiscordChannel)
      }));
   },
   canSend: async (channelId: string, guildId?: string): Promise<boolean> => {
      const guild = guildId ? message.client.guilds.cache.get(guildId) : undefined;
      const channel = guild
         ? guild.channels.cache.get(channelId)
         : message.client.channels.cache.get(channelId);
      if (!channel) return false;
      const coreChannel = toCoreChannel(channel as DiscordChannel);
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
      const permissionMap = {
         ADMINISTRATOR: PermissionFlagsBits.Administrator,
         MANAGE_GUILD: PermissionFlagsBits.ManageGuild,
         READ_MESSAGE_HISTORY: PermissionFlagsBits.ReadMessageHistory
      } as const;
      return Boolean(perms && perms.has(permissionMap[permission]));
   }
});

const toCoreMessage = async (message: Message): Promise<CoreMessage> => {
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
      channel: toCoreChannel(message.channel as DiscordChannel),
      guildId: message.guild?.id,
      guildName: message.guild?.name,
      mentionsBot,
      referencedContent,
      referencedMentionsBot,
      isAdmin,
      isBotOwner: message.author.id === process.env.BOT_OWNER_DISCORD_ID,
      isSelf: botUser ? message.author.id === botUser.id : false,
      tts: message.tts,
      platform: createDiscordAdapter(message),
      memberContext: message.guild?.members
   };
};

export {
   createDiscordAdapter,
   toCoreMessage,
   toDiscordAttachment,
   toDiscordEmbed
};
