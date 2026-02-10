import http from "node:http";
import type { AddressInfo } from "node:net";
import { log } from "@/core/log";
import { env, envFlag } from "@/utils";
import { handleCoreCommand, handleCoreMessage, isCoreInitialized, startCoreInitialization } from "@/core/runtime";
import type { PlatformAdapter, StandardChannel, StandardCommandInteraction, StandardMessage, StandardOutgoingMessage } from "@/contracts";

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
   process?: unknown;
   outgoing?: HarnessOutgoingMessage[];
   typingCount?: number;
   replies?: HarnessOutgoingMessage[];
}

const DEFAULT_PROXY_PORT = Number(env("HARNESS_PROXY_PORT", "3141"));
const DEFAULT_PROXY_HOST = env("HARNESS_PROXY_HOST", "127.0.0.1");

const isLocalAddress = (address: string | undefined): boolean => {
   if (!address) return false;
   if (address === "127.0.0.1" || address === "::1") return true;
   return address.startsWith("::ffff:127.0.0.1");
};

const getBearerToken = (req: http.IncomingMessage): string => {
   const raw = req.headers.authorization ?? "";
   if (raw.toLowerCase().startsWith("bearer ")) {
      return raw.slice(7).trim();
   }
   const alt = req.headers["x-harness-token"];
   return typeof alt === "string" ? alt.trim() : "";
};

const readBody = async (req: http.IncomingMessage): Promise<string> =>
   new Promise((resolveBody) => {
      let data = "";
      req.on("data", chunk => {
         data += chunk;
      });
      req.on("end", () => resolveBody(data));
   });

const sendJson = (res: http.ServerResponse, status: number, payload: unknown): void => {
   const body = JSON.stringify(payload, null, 2);
   res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
   res.end(body);
};

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

const handleMessage = async (payload: HarnessMessagePayload): Promise<HarnessResponse> => {
   await ensureCoreReady();
   const outgoing: HarnessOutgoingMessage[] = [];
   let typingCount = 0;
   const adapter = createHarnessAdapter(outgoing, () => {
      typingCount += 1;
   });
   const message = buildMessage(payload, adapter);
   const process = await handleCoreMessage(message);
   return { process, outgoing, typingCount };
};

const handleCommand = async (payload: HarnessCommandPayload): Promise<HarnessResponse> => {
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

const handleStatus = (): { mode: "proxy"; initialized: boolean; botName: string; nodeEnv: string } => ({
   mode: "proxy",
   initialized: isCoreInitialized(),
   botName: env("BOT_NAME", "default") ?? "default",
   nodeEnv: env("NODE_ENV", "development") ?? "development"
});

const createProxyServer = (token: string): http.Server =>
   http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const pathname = url.pathname;
      const allowRemote = envFlag("HARNESS_PROXY_ALLOW_REMOTE");
      const isLocal = isLocalAddress(req.socket.remoteAddress ?? undefined);

      if (!allowRemote && !isLocal) {
         sendJson(res, 403, { error: "harness proxy is restricted to localhost" });
         return;
      }
      if (getBearerToken(req) !== token) {
         sendJson(res, 401, { error: "unauthorized" });
         return;
      }

      try {
         if (pathname === "/api/harness/status" && req.method === "GET") {
            sendJson(res, 200, handleStatus());
            return;
         }
         if (pathname === "/api/harness/message" && req.method === "POST") {
            const raw = await readBody(req);
            const parsed = JSON.parse(raw || "{}") as { message?: HarnessMessagePayload };
            if (!parsed.message) {
               sendJson(res, 400, { error: "missing message payload" });
               return;
            }
            const result = await handleMessage(parsed.message);
            sendJson(res, 200, { result });
            return;
         }
         if (pathname === "/api/harness/command" && req.method === "POST") {
            const raw = await readBody(req);
            const parsed = JSON.parse(raw || "{}") as { command?: HarnessCommandPayload };
            if (!parsed.command) {
               sendJson(res, 400, { error: "missing command payload" });
               return;
            }
            const result = await handleCommand(parsed.command);
            sendJson(res, 200, { result });
            return;
         }
         sendJson(res, 404, { error: "not found" });
      } catch (error: unknown) {
         const message = error instanceof Error ? error.message : String(error);
         log(`Harness proxy error: ${message}`, "error");
         sendJson(res, 500, { error: message });
      }
   });

const startHarnessProxyServer = (): { stop: () => Promise<void> } | null => {
   // TODO: Add IP allowlist support for proxy requests.
   // TODO: Add rate limiting for proxy requests.
   // TODO: Add read-only vs mutating proxy mode switch.
   if (!envFlag("HARNESS_PROXY_ENABLED")) return null;
   const isProd = env("NODE_ENV", "development") === "production";
   if (isProd && !envFlag("HARNESS_PROXY_ALLOW_PROD")) {
      log(`Harness proxy disabled in production. Set HARNESS_PROXY_ALLOW_PROD=1 to override.`, "warn");
      return null;
   }
   const token = (env("HARNESS_PROXY_TOKEN") ?? "").trim();
   if (!token) {
      log(`Harness proxy disabled: HARNESS_PROXY_TOKEN is required.`, "warn");
      return null;
   }

   const server = createProxyServer(token);
   const host = DEFAULT_PROXY_HOST;
   const port = DEFAULT_PROXY_PORT;
   server.listen(port, host, () => {
      const address = server.address() as AddressInfo | null;
      const resolvedPort = address?.port ?? port;
      log(`Harness proxy listening on http://${host}:${resolvedPort}`, "debug");
   });

   const stop = (): Promise<void> =>
      new Promise((resolveStop) => {
         server.close(() => resolveStop());
      });

   return { stop };
};

export { startHarnessProxyServer };
