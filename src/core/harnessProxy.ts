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
   isAdmin?: boolean;
   isBotOwner?: boolean;
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
const DEFAULT_PROXY_MAX_BODY_BYTES = Number(env("HARNESS_PROXY_MAX_BODY_BYTES", "1048576"));
const DEFAULT_PROXY_RATE_LIMIT_WINDOW_MS = Number(env("HARNESS_PROXY_RATE_LIMIT_WINDOW_MS", "60000"));
const DEFAULT_PROXY_RATE_LIMIT_MAX_REQUESTS = Number(env("HARNESS_PROXY_RATE_LIMIT_MAX_REQUESTS", "120"));
const MAX_PROXY_BODY_BYTES = Number.isFinite(DEFAULT_PROXY_MAX_BODY_BYTES) && DEFAULT_PROXY_MAX_BODY_BYTES > 0
   ? DEFAULT_PROXY_MAX_BODY_BYTES
   : 1048576;
const PROXY_RATE_LIMIT_WINDOW_MS = Number.isFinite(DEFAULT_PROXY_RATE_LIMIT_WINDOW_MS) && DEFAULT_PROXY_RATE_LIMIT_WINDOW_MS > 0
   ? Math.floor(DEFAULT_PROXY_RATE_LIMIT_WINDOW_MS)
   : 60000;
const PROXY_RATE_LIMIT_MAX_REQUESTS = Number.isFinite(DEFAULT_PROXY_RATE_LIMIT_MAX_REQUESTS) && DEFAULT_PROXY_RATE_LIMIT_MAX_REQUESTS > 0
   ? Math.floor(DEFAULT_PROXY_RATE_LIMIT_MAX_REQUESTS)
   : 120;
const TRUST_CALLER_ROLE_FLAGS = envFlag("HARNESS_PROXY_TRUST_CALLER_ROLES", false);
const DEFAULT_PROXY_IP_ALLOWLIST = (env("HARNESS_PROXY_IP_ALLOWLIST", "") ?? "")
   .split(",")
   .map(value => value.trim())
   .filter(value => value.length > 0);

class HarnessHttpError extends Error {
   public readonly status: number;
   public readonly clientMessage: string;

   public constructor(status: number, clientMessage: string, internalMessage?: string) {
      super(internalMessage ?? clientMessage);
      this.status = status;
      this.clientMessage = clientMessage;
   }
}

interface RateLimitBucket {
   windowStart: number;
   count: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();

const normalizeAddress = (address: string | undefined): string => {
   if (!address) return "";
   if (address.startsWith("::ffff:")) return address.slice(7);
   return address;
};

const isLocalAddress = (address: string | undefined): boolean => {
   const normalized = normalizeAddress(address);
   if (!normalized) return false;
   return normalized === "127.0.0.1" || normalized === "::1";
};

const isAddressAllowed = (address: string | undefined, allowRemote: boolean, ipAllowlist: string[]): boolean => {
   const normalized = normalizeAddress(address);
   if (!allowRemote) return isLocalAddress(normalized);
   if (!normalized) return false;
   if (ipAllowlist.length === 0) return true;
   return ipAllowlist.includes(normalized);
};

const isRateLimited = (address: string | undefined): boolean => {
   if (PROXY_RATE_LIMIT_MAX_REQUESTS <= 0) return false;
   const normalized = normalizeAddress(address) || "unknown";
   const now = Date.now();
   const current = rateLimitBuckets.get(normalized);
   if (!current || now - current.windowStart >= PROXY_RATE_LIMIT_WINDOW_MS) {
      rateLimitBuckets.set(normalized, { windowStart: now, count: 1 });
      return false;
   }
   current.count += 1;
   if (current.count > PROXY_RATE_LIMIT_MAX_REQUESTS) return true;
   if (rateLimitBuckets.size > 10000) {
      for (const [key, bucket] of rateLimitBuckets) {
         if (now - bucket.windowStart >= PROXY_RATE_LIMIT_WINDOW_MS) {
            rateLimitBuckets.delete(key);
         }
      }
   }
   return false;
};

const getBearerToken = (req: http.IncomingMessage): string => {
   const raw = req.headers.authorization ?? "";
   if (raw.toLowerCase().startsWith("bearer ")) {
      return raw.slice(7).trim();
   }
   const alt = req.headers["x-harness-token"];
   return typeof alt === "string" ? alt.trim() : "";
};

const readBody = async (req: http.IncomingMessage, maxBytes: number = MAX_PROXY_BODY_BYTES): Promise<string> =>
   new Promise((resolveBody, rejectBody) => {
      let data = "";
      let size = 0;
      let done = false;
      const fail = (error: Error): void => {
         if (done) return;
         done = true;
         rejectBody(error);
      };
      req.on("data", chunk => {
         if (done) return;
         const bytes = typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
         size += bytes;
         if (size > maxBytes) {
            fail(new HarnessHttpError(413, "payload too large"));
            req.destroy();
            return;
         }
         data += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      });
      req.on("error", error => {
         const message = error instanceof Error ? error.message : String(error);
         fail(new HarnessHttpError(400, "invalid request body", message));
      });
      req.on("aborted", () => {
         fail(new HarnessHttpError(400, "request aborted"));
      });
      req.on("end", () => {
         if (done) return;
         done = true;
         resolveBody(data);
      });
   });

const parseJsonBody = <T>(raw: string): T => {
   try {
      return JSON.parse(raw || "{}") as T;
   } catch {
      throw new HarnessHttpError(400, "invalid JSON payload");
   }
};

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
      isAdmin: TRUST_CALLER_ROLE_FLAGS ? Boolean(payload.isAdmin) : false,
      isBotOwner: TRUST_CALLER_ROLE_FLAGS ? Boolean(payload.isBotOwner) : false,
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
      isAdmin: TRUST_CALLER_ROLE_FLAGS ? Boolean(payload.isAdmin) : false,
      isBotOwner: TRUST_CALLER_ROLE_FLAGS ? Boolean(payload.isBotOwner) : false,
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
      const ipAllowlist = DEFAULT_PROXY_IP_ALLOWLIST;
      const remoteAddress = normalizeAddress(req.socket.remoteAddress ?? undefined);

      if (!isAddressAllowed(remoteAddress, allowRemote, ipAllowlist)) {
         sendJson(res, 403, { error: "harness proxy is restricted to localhost" });
         return;
      }
      if (isRateLimited(remoteAddress)) {
         sendJson(res, 429, { error: "rate limit exceeded" });
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
            const parsed = parseJsonBody<{ message?: HarnessMessagePayload }>(raw);
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
            const parsed = parseJsonBody<{ command?: HarnessCommandPayload }>(raw);
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
         if (error instanceof HarnessHttpError) {
            sendJson(res, error.status, { error: error.clientMessage });
            return;
         }
         const message = error instanceof Error ? error.message : String(error);
         log(`Harness proxy error: ${message}`, "error");
         sendJson(res, 500, { error: "internal server error" });
      }
   });

const startHarnessProxyServer = async (): Promise<{ stop: () => Promise<void> } | null> => {
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
   const allowRemote = envFlag("HARNESS_PROXY_ALLOW_REMOTE");
   if (allowRemote && DEFAULT_PROXY_IP_ALLOWLIST.length === 0) {
      log(`Harness proxy remote mode enabled without HARNESS_PROXY_IP_ALLOWLIST; all remote IPs are allowed.`, "warn");
   }
   if (TRUST_CALLER_ROLE_FLAGS) {
      log(`Harness proxy is trusting caller-supplied role flags (HARNESS_PROXY_TRUST_CALLER_ROLES=1).`, "warn");
   }

   const server = createProxyServer(token);
   const host = DEFAULT_PROXY_HOST;
   const port = DEFAULT_PROXY_PORT;
   const listenUrl = `http://${host}:${port}`;
   await new Promise<void>((resolve, reject) => {
      const handleListening = (): void => {
         server.off("error", handleError);
         const address = server.address() as AddressInfo | null;
         const resolvedPort = address?.port ?? port;
         log(`Harness proxy listening on http://${host}:${resolvedPort}`, "debug");
         resolve();
      };
      const handleError = (error: NodeJS.ErrnoException): void => {
         server.off("listening", handleListening);
         const detail = error.code === "EADDRINUSE"
            ? `${listenUrl} is already in use. Stop the other process using that port or set HARNESS_PROXY_PORT to a different value.`
            : error.message;
         reject(new Error(`Harness proxy failed to listen on ${listenUrl}: ${detail}`, { cause: error }));
      };
      server.once("listening", handleListening);
      server.once("error", handleError);
      server.listen(port, host);
   });

   server.on("error", (error: Error) => {
      log(`Harness proxy server error: ${error.message}`, "error");
   });

   const stop = (): Promise<void> =>
      new Promise((resolveStop) => {
         server.close(() => resolveStop());
      });

   return { stop };
};

export { startHarnessProxyServer };
