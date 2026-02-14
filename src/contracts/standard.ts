export type StandardPermission = "ADMINISTRATOR" | "MANAGE_GUILD" | "READ_MESSAGE_HISTORY";

export type StandardChannelType =
   | "text"
   | "dm"
   | "thread"
   | "voice"
   | "stage"
   | "category"
   | "forum"
   | "media"
   | "unknown";

export type StandardChannelScope = "server" | "dm";

export interface StandardGuild {
   id: string;
   name: string;
}

export interface StandardChannel {
   id: string;
   name: string;
   type: StandardChannelType;
   scope: StandardChannelScope;
   guildId?: string;
   supportsText: boolean;
   supportsVoice: boolean;
   supportsTyping: boolean;
   supportsHistory: boolean;
   isGroupDm?: boolean;
   memberCount?: number;
}

export interface StandardMember {
   id: string;
   userId: string;
   displayName: string;
   username?: string;
}

export interface StandardMemberQuery {
   userId?: string;
   query?: string;
   limit?: number;
}

export interface StandardHistoryQuery {
   beforeId?: string;
   limit?: number;
}

export interface PlatformAdapter {
   reply(messageId: string, content: string): Promise<void>;
   sendMessage(channelId: string, message: StandardOutgoingMessage): Promise<void>;
   sendTyping(channelId: string): Promise<void>;
   fetchGuilds(): Promise<StandardGuild[]>;
   fetchGuild(guildId: string): Promise<StandardGuild | undefined>;
   fetchChannels(guildId: string): Promise<StandardChannel[]>;
   fetchChannel(guildId: string | undefined, channelId: string): Promise<StandardChannel | undefined>;
   fetchMember(guildId: string, query: StandardMemberQuery): Promise<StandardMember | undefined>;
   fetchHistory(channelId: string, options: StandardHistoryQuery): Promise<StandardMessage[]>;
   canSend?(channelId: string, guildId?: string): Promise<boolean>;
   hasPermission?(channelId: string, permission: StandardPermission, guildId?: string): Promise<boolean>;
   supportsCommands?: boolean;
   registerCommands?(commands: StandardCommand[]): Promise<void>;
   onCommand?(handler: (interaction: StandardCommandInteraction) => Promise<void>): Promise<void> | void;
}

export interface StandardOutgoingEmbedField {
   name: string;
   value: string;
   inline?: boolean;
}

export interface StandardOutgoingEmbed {
   title?: string;
   description?: string;
   fields?: StandardOutgoingEmbedField[];
   color?: string | number;
   footer?: string;
   thumbnailAttachmentName?: string;
   imageAttachmentName?: string;
}

export interface StandardOutgoingAttachment {
   name: string;
   data: Buffer;
   contentType?: string;
}

export interface StandardOutgoingMessage {
   contents: string;
   embeds?: StandardOutgoingEmbed[];
   attachments?: StandardOutgoingAttachment[];
   tts?: boolean;
   error?: {
      message: string;
   };
}

export type StandardCommandOptionType = "string" | "number" | "boolean" | "user" | "channel";

export interface StandardCommandOption {
   name: string;
   description: string;
   type: StandardCommandOptionType;
   required?: boolean;
}

export interface StandardCommandFormField {
   name: string;
   label: string;
   type: StandardCommandOptionType;
   required?: boolean;
   placeholder?: string;
   multiline?: boolean;
}

export interface StandardCommandForm {
   title: string;
   submitLabel?: string;
   fields: StandardCommandFormField[];
}

export interface StandardCommand {
   name: string;
   description: string;
   options?: StandardCommandOption[];
   permissions?: StandardPermission[];
   form?: StandardCommandForm;
}

export interface StandardCommandInteraction {
   command: string;
   options: Record<string, unknown>;
   userId: string;
   channelId: string;
   guildId?: string;
   isAdmin?: boolean;
   isBotOwner?: boolean;
   reply: (message: StandardOutgoingMessage) => Promise<void>;
}

export interface PlatformMediatorHandle {
   stop?: () => Promise<void> | void;
}

export type PlatformMediator = () => PlatformMediatorHandle;

export interface StandardMessage {
   id: string;
   content: string;
   authorId: string;
   authorName: string;
   isBot: boolean;
   channelId: string;
   channelName?: string;
   channel?: StandardChannel;
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

export interface StandardUserProfile {
   id: string;
   username: string;
   displayName?: string;
   isBot?: boolean;
}

export interface StandardRole {
   id: string;
   name: string;
   color?: number | string;
   permissions?: string[];
   position?: number;
   mentionable?: boolean;
   managed?: boolean;
}

export interface StandardEmoji {
   id?: string;
   name: string;
   animated?: boolean;
}

export interface StandardSticker {
   id: string;
   name: string;
   description?: string;
   format?: string;
}

export interface StandardPresenceActivity {
   name: string;
   type?: string;
   state?: string;
}

export interface StandardPresence {
   userId: string;
   status?: string;
   activities?: StandardPresenceActivity[];
   clientStatus?: Record<string, string>;
}

export interface StandardTyping {
   channelId: string;
   userId: string;
   startedAt?: number;
}

export interface StandardReaction {
   messageId: string;
   channelId?: string;
   guildId?: string;
   emoji: StandardEmoji;
   userId?: string;
   count?: number;
}

export interface StandardMessageChange {
   messageId: string;
   channelId: string;
   guildId?: string;
   authorId?: string;
   content?: string;
}

export interface StandardThread {
   id: string;
   name: string;
   parentId?: string;
   guildId?: string;
   ownerId?: string;
   archived?: boolean;
   locked?: boolean;
   channel?: StandardChannel;
}

export interface StandardVoiceState {
   userId: string;
   channelId?: string;
   guildId?: string;
   muted?: boolean;
   deafened?: boolean;
   serverMuted?: boolean;
   serverDeafened?: boolean;
   selfMuted?: boolean;
   selfDeafened?: boolean;
   streaming?: boolean;
   suppress?: boolean;
}

export interface StandardStageInstance {
   id: string;
   channelId: string;
   guildId?: string;
   topic?: string;
   privacyLevel?: string | number;
}

export interface StandardSoundboardSound {
   id: string;
   name: string;
   emoji?: StandardEmoji;
}

export interface StandardInvite {
   code: string;
   channelId?: string;
   guildId?: string;
   inviterId?: string;
}

export interface StandardWebhook {
   channelId: string;
   guildId?: string;
}

export interface StandardModerationRule {
   id: string;
   name?: string;
   enabled?: boolean;
   eventType?: string;
   triggerType?: string | number;
}

export interface StandardModerationAction {
   ruleId?: string;
   actionType?: string | number;
   channelId?: string;
   userId?: string;
}

export interface StandardEntitlement {
   id: string;
   userId?: string;
   guildId?: string;
   skuId?: string;
}

export interface StandardSubscription {
   id: string;
   userId?: string;
   guildId?: string;
}

export interface StandardPollVote {
   messageId: string;
   userId: string;
   answerId?: string;
}

export interface StandardScheduledEvent {
   id: string;
   name?: string;
   guildId?: string;
}

export type StandardEventType =
   | "user.updated"
   | "member.added"
   | "member.updated"
   | "member.removed"
   | "member.available"
   | "member.chunked"
   | "presence.updated"
   | "typing.started"
   | "reaction.added"
   | "reaction.removed"
   | "reaction.removedAll"
   | "reaction.removedEmoji"
   | "message.updated"
   | "message.deleted"
   | "message.deletedBulk"
   | "message.pollVoteAdded"
   | "message.pollVoteRemoved"
   | "channel.created"
   | "channel.updated"
   | "channel.deleted"
   | "channel.pinsUpdated"
   | "thread.created"
   | "thread.updated"
   | "thread.deleted"
   | "thread.listSync"
   | "thread.memberUpdated"
   | "thread.membersUpdated"
   | "role.created"
   | "role.updated"
   | "role.deleted"
   | "emoji.created"
   | "emoji.updated"
   | "emoji.deleted"
   | "sticker.created"
   | "sticker.updated"
   | "sticker.deleted"
   | "guild.created"
   | "guild.updated"
   | "guild.deleted"
   | "guild.available"
   | "guild.unavailable"
   | "guild.integrationsUpdated"
   | "guild.auditLogEntryCreated"
   | "guild.scheduledEventCreated"
   | "guild.scheduledEventUpdated"
   | "guild.scheduledEventDeleted"
   | "guild.scheduledEventUserAdded"
   | "guild.scheduledEventUserRemoved"
   | "guild.banAdded"
   | "guild.banRemoved"
   | "invite.created"
   | "invite.deleted"
   | "webhook.updated"
   | "command.permissionsUpdated"
   | "autoModeration.ruleCreated"
   | "autoModeration.ruleUpdated"
   | "autoModeration.ruleDeleted"
   | "autoModeration.actionExecuted"
   | "soundboard.soundsUpdated"
   | "soundboard.soundCreated"
   | "soundboard.soundUpdated"
   | "soundboard.soundDeleted"
   | "entitlement.created"
   | "entitlement.updated"
   | "entitlement.deleted"
   | "subscription.created"
   | "subscription.updated"
   | "subscription.deleted"
   | "voice.stateUpdated"
   | "voice.channelEffect"
   | "stage.created"
   | "stage.updated"
   | "stage.deleted";

export interface StandardEvent<TPayload = unknown> {
   type: StandardEventType;
   platform: string;
   occurredAt: number;
   guildId?: string;
   channelId?: string;
   userId?: string;
   payload?: TPayload;
}
