export type PlatformPermission = "ADMINISTRATOR" | "MANAGE_GUILD" | "READ_MESSAGE_HISTORY";

export type CoreChannelType =
   | "text"
   | "dm"
   | "thread"
   | "voice"
   | "stage"
   | "category"
   | "forum"
   | "media"
   | "unknown";

export type CoreChannelScope = "server" | "dm";

export interface CoreGuild {
   id: string;
   name: string;
}

export interface CoreChannel {
   id: string;
   name: string;
   type: CoreChannelType;
   scope: CoreChannelScope;
   guildId?: string;
   supportsText: boolean;
   supportsVoice: boolean;
   supportsTyping: boolean;
   supportsHistory: boolean;
   isGroupDm?: boolean;
   memberCount?: number;
}

export interface CoreMember {
   id: string;
   userId: string;
   displayName: string;
}

export interface PlatformMemberQuery {
   userId?: string;
   query?: string;
   limit?: number;
}

export interface PlatformHistoryQuery {
   beforeId?: string;
   limit?: number;
}

export interface PlatformAdapter {
   reply(messageId: string, content: string): Promise<void>;
   sendMessage(channelId: string, message: OutgoingMessage): Promise<void>;
   sendTyping(channelId: string): Promise<void>;
   fetchGuilds(): Promise<CoreGuild[]>;
   fetchGuild(guildId: string): Promise<CoreGuild | undefined>;
   fetchChannels(guildId: string): Promise<CoreChannel[]>;
   fetchChannel(guildId: string | undefined, channelId: string): Promise<CoreChannel | undefined>;
   fetchMember(guildId: string, query: PlatformMemberQuery): Promise<CoreMember | undefined>;
   fetchHistory(channelId: string, options: PlatformHistoryQuery): Promise<CoreMessage[]>;
   canSend?(channelId: string, guildId?: string): Promise<boolean>;
   hasPermission?(channelId: string, permission: PlatformPermission, guildId?: string): Promise<boolean>;
   supportsCommands?: boolean;
   registerCommands?(commands: PlatformCommand[]): Promise<void>;
   onCommand?(handler: (interaction: PlatformCommandInteraction) => Promise<void>): Promise<void> | void;
}

export interface OutgoingEmbedField {
   name: string;
   value: string;
   inline?: boolean;
}

export interface OutgoingEmbed {
   title?: string;
   description?: string;
   fields?: OutgoingEmbedField[];
   color?: string | number;
   footer?: string;
   thumbnailAttachmentName?: string;
   imageAttachmentName?: string;
}

export interface OutgoingAttachment {
   name: string;
   data: Buffer;
   contentType?: string;
}

export interface OutgoingMessage {
   contents: string;
   embeds?: OutgoingEmbed[];
   attachments?: OutgoingAttachment[];
   tts?: boolean;
   error?: {
      message: string;
   };
}

export type PlatformCommandOptionType = "string" | "number" | "boolean" | "user" | "channel";

export interface PlatformCommandOption {
   name: string;
   description: string;
   type: PlatformCommandOptionType;
   required?: boolean;
}

export interface PlatformCommandFormField {
   name: string;
   label: string;
   type: PlatformCommandOptionType;
   required?: boolean;
   placeholder?: string;
   multiline?: boolean;
}

export interface PlatformCommandForm {
   title: string;
   submitLabel?: string;
   fields: PlatformCommandFormField[];
}

export interface PlatformCommand {
   name: string;
   description: string;
   options?: PlatformCommandOption[];
   permissions?: PlatformPermission[];
   form?: PlatformCommandForm;
}

export interface PlatformCommandInteraction {
   command: string;
   options: Record<string, unknown>;
   userId: string;
   channelId: string;
   guildId?: string;
   reply: (message: OutgoingMessage) => Promise<void>;
}

export interface CoreMessage {
   id: string;
   content: string;
   authorId: string;
   authorName: string;
   isBot: boolean;
   channelId: string;
   channelName?: string;
   channel?: CoreChannel;
   guildId?: string;
   guildName?: string;
   mentionsBot?: boolean;
   referencedContent?: string;
   referencedMentionsBot?: boolean;
   isAdmin?: boolean;
   isBotOwner?: boolean;
   isSelf?: boolean;
   tts?: boolean;
   platform?: PlatformAdapter;
   memberContext?: unknown;
}
