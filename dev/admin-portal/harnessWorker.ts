import "tsconfig-paths/register";
import { startCoreInitialization, isCoreInitialized, handleCoreMessage, handleCoreCommand } from "@/core/runtime";
import { Brain } from "@/core/brain";
import { initEnvConfig } from "@/utils";
import type {
   PlatformAdapter,
   StandardChannel,
   StandardCommandInteraction,
   StandardMessage,
   StandardOutgoingMessage
} from "@/contracts";

initEnvConfig();

type HarnessMode = "sandbox" | "live";

interface HarnessMessagePayload {
   id?: string;
   content: string;
   authorId?: string;
   authorName?: string;
   channelId?: string;
   channelName?: string;
   guildId?: string;
   guildName?: string;
   scope?: "dm" | "server";
   isGroupDm?: boolean;
   memberCount?: number;
   isBot?: boolean;
   isSelf?: boolean;
   mentionsBot?: boolean;
   isAdmin?: boolean;
   isBotOwner?: boolean;
}

interface HarnessCommandPayload {
   command: string;
   options?: Record<string, unknown>;
   userId?: string;
   channelId?: string;
   guildId?: string;
}

interface HarnessOutgoingAttachment {
   name: string;
   size: number;
   contentType?: string;
}

interface HarnessOutgoingMessage {
   contents: string;
   embeds?: StandardOutgoingMessage["embeds"];
   attachments?: HarnessOutgoingAttachment[];
   tts?: boolean;
   error?: StandardOutgoingMessage["error"];
}

interface HarnessResponse {
   id: number;
   ok: boolean;
   result?: unknown;
   error?: string;
}

type CoreMessageResult = Awaited<ReturnType<typeof handleCoreMessage>>;

interface HarnessMessageResult {
   process: CoreMessageResult;
   outgoing: HarnessOutgoingMessage[];
   typingCount: number;
}

interface HarnessCommandResult {
   replies: HarnessOutgoingMessage[];
}

interface HarnessStatus {
   mode: HarnessMode;
   initialized: boolean;
   botName: string;
   dataDir: string;
   nodeEnv: string;
}

const serializeOutgoing = (message: StandardOutgoingMessage): HarnessOutgoingMessage => ({
   contents: message.contents,
   embeds: message.embeds,
   attachments: message.attachments?.map((attachment) => ({
      name: attachment.name,
      size: attachment.data?.length ?? 0,
      contentType: attachment.contentType
   })),
   tts: message.tts,
   error: message.error
});

const createHarnessAdapter = (outbound: HarnessOutgoingMessage[], onTyping?: () => void): PlatformAdapter => ({
   reply: async () => undefined,
   sendMessage: async (_channelId, message) => {
      outbound.push(serializeOutgoing(message));
   },
   sendTyping: async (_channelId) => {
      if (onTyping) onTyping();
   },
   fetchGuilds: async () => [],
   fetchGuild: async () => undefined,
   fetchChannels: async () => [],
   fetchChannel: async () => undefined,
   fetchMember: async () => undefined,
   fetchHistory: async () => [],
   canSend: async () => true
});

const buildChannel = (payload: HarnessMessagePayload): StandardChannel => {
   const scope = payload.scope ?? "server";
   return {
      id: payload.channelId ?? "channel-1",
      name: payload.channelName ?? (scope === "dm" ? "direct" : "general"),
      type: scope === "dm" ? "dm" : "text",
      scope,
      guildId: payload.guildId,
      supportsText: true,
      supportsVoice: false,
      supportsTyping: true,
      supportsHistory: true,
      isGroupDm: payload.isGroupDm,
      memberCount: payload.memberCount
   };
};

const buildMessage = (payload: HarnessMessagePayload, adapter: PlatformAdapter): StandardMessage => {
   const channel = buildChannel(payload);
   return {
      id: payload.id ?? `harness-${Date.now()}`,
      content: payload.content,
      authorId: payload.authorId ?? "user-1",
      authorName: payload.authorName ?? payload.authorId ?? "User",
      isBot: Boolean(payload.isBot),
      isSelf: Boolean(payload.isSelf),
      channelId: channel.id,
      channelName: channel.name,
      channel,
      guildId: payload.guildId,
      guildName: payload.guildName,
      mentionsBot: Boolean(payload.mentionsBot),
      isAdmin: payload.isAdmin,
      isBotOwner: payload.isBotOwner,
      platform: adapter
   };
};

const ensureCoreReady = async (): Promise<void> => {
   if (!isCoreInitialized()) {
      await startCoreInitialization();
   }
};

const handleMessage = async (payload: HarnessMessagePayload): Promise<HarnessMessageResult> => {
   await ensureCoreReady();
   const outbound: HarnessOutgoingMessage[] = [];
   let typingCount = 0;
   const adapter = createHarnessAdapter(outbound, () => {
      typingCount += 1;
   });
   const message = buildMessage(payload, adapter);
   const results = await handleCoreMessage(message);
   return { process: results, outgoing: outbound, typingCount };
};

const handleCommand = async (payload: HarnessCommandPayload): Promise<HarnessCommandResult> => {
   await ensureCoreReady();
   const replies: HarnessOutgoingMessage[] = [];
   const interaction: StandardCommandInteraction = {
      command: payload.command,
      options: payload.options ?? {},
      userId: payload.userId ?? "user-1",
      channelId: payload.channelId ?? "channel-1",
      guildId: payload.guildId,
      reply: async (message) => {
         replies.push(serializeOutgoing(message));
      }
   };
   await handleCoreCommand(interaction);
   return { replies };
};

const handleStatus = (): HarnessStatus => ({
   mode: "sandbox" as HarnessMode,
   initialized: isCoreInitialized(),
   botName: Brain.botName,
   dataDir: process.env.CHARLIES_DATA_DIR ?? "",
   nodeEnv: process.env.NODE_ENV ?? ""
});

process.on("message", async (request: { id: number; type: string; payload?: unknown }) => {
   const { id, type, payload } = request;
   const respond = (response: HarnessResponse): void => {
      if (process.send) process.send(response);
   };
   try {
      if (type === "status") {
         respond({ id, ok: true, result: handleStatus() });
         return;
      }
      if (type === "message") {
         const result = await handleMessage(payload as HarnessMessagePayload);
         respond({ id, ok: true, result });
         return;
      }
      if (type === "command") {
         const result = await handleCommand(payload as HarnessCommandPayload);
         respond({ id, ok: true, result });
         return;
      }
      respond({ id, ok: false, error: "unknown request type" });
   } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respond({ id, ok: false, error: message });
   }
});
