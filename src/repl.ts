import "tsconfig-paths/register";
import "source-map-support/register";
import "dotenv/config";

import process from "node:process";
import readline from "node:readline";
import type {
   PlatformAdapter,
   StandardChannel,
   StandardCommandInteraction,
   StandardMessage,
   StandardOutgoingMessage
} from "@/contracts";
import { Brain } from "@/core/brain";
import { handleCoreCommand, handleCoreMessage, isCoreInitialized, registerProcessHandlers, startCoreInitialization } from "@/core/runtime";
import { escapeRegExp } from "@/utils";

interface ReplOutgoingMessage {
   contents: string;
   embeds?: StandardOutgoingMessage["embeds"];
   attachments?: Array<{
      name: string;
      size: number;
      contentType?: string;
   }>;
   tts?: boolean;
   error?: StandardOutgoingMessage["error"];
}

type MentionMode = "auto" | "on" | "off";

interface ReplState {
   userId: string;
   authorName: string;
   channelId: string;
   channelName: string;
   guildId?: string;
   guildName?: string;
   scope: "dm" | "server";
   isGroupDm: boolean;
   memberCount?: number;
   mentionMode: MentionMode;
   isAdmin: boolean;
   isBotOwner: boolean;
}

const serializeOutgoing = (message: StandardOutgoingMessage): ReplOutgoingMessage => ({
   contents: message.contents,
   embeds: message.embeds,
   attachments: message.attachments?.map((attachment) => ({
      name: attachment.name,
      size: attachment.data.length,
      contentType: attachment.contentType
   })),
   tts: message.tts,
   error: message.error
});

const createLocalAdapter = (outbound: ReplOutgoingMessage[], onTyping?: () => void): PlatformAdapter => ({
   reply: async (_messageId, content) => {
      outbound.push({ contents: content });
   },
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

const buildChannel = (state: ReplState): StandardChannel => ({
   id: state.channelId,
   name: state.channelName,
   type: state.scope === "dm" ? "dm" : "text",
   scope: state.scope,
   guildId: state.guildId,
   supportsText: true,
   supportsVoice: false,
   supportsTyping: true,
   supportsHistory: true,
   isGroupDm: state.isGroupDm,
   memberCount: state.memberCount
});

const buildPrompt = (state: ReplState): string => {
   if (state.scope === "dm") {
      const dmType = state.isGroupDm ? `groupdm:${state.memberCount ?? 0}` : "dm";
      return `${Brain.botName}(${dmType})> `;
   }
   return `${Brain.botName}(#${state.channelName}@${state.guildName ?? state.guildId ?? "server"})> `;
};

const createDefaultState = (): ReplState => ({
   userId: "repl-user",
   authorName: "REPL User",
   channelId: "repl-dm",
   channelName: "direct",
   scope: "dm",
   isGroupDm: false,
   mentionMode: "auto",
   isAdmin: false,
   isBotOwner: false
});

const formatState = (state: ReplState): string =>
   JSON.stringify({
      userId: state.userId,
      authorName: state.authorName,
      channelId: state.channelId,
      channelName: state.channelName,
      guildId: state.guildId,
      guildName: state.guildName,
      scope: state.scope,
      isGroupDm: state.isGroupDm,
      memberCount: state.memberCount,
      mentionMode: state.mentionMode,
      isAdmin: state.isAdmin,
      isBotOwner: state.isBotOwner
   }, null, 2);

const printHelp = (): void => {
   console.log(`Headless REPL ready. Normal lines go through handleCoreMessage().`);
   console.log(`Commands:`);
   console.log(`  :help                         Show this help`);
   console.log(`  :show                         Show current REPL context`);
   console.log(`  :dm                           Switch to 1:1 DM mode`);
   console.log(`  :groupdm [count]              Switch to group DM mode`);
   console.log(`  :server [guildId] [channelId] Switch to server text-channel mode`);
   console.log(`  :mention auto|on|off          Control mentionsBot in server/group contexts`);
   console.log(`  :user <id> [display name]     Change the sending user`);
   console.log(`  :admin on|off                 Toggle isAdmin`);
   console.log(`  :owner on|off                 Toggle isBotOwner`);
   console.log(`  :cmd <name> [json]            Invoke handleCoreCommand() directly`);
   console.log(`  :reset                        Restore default REPL context`);
   console.log(`  :exit                         Save and quit`);
};

const parseToggle = (value: string | undefined, label: string): boolean => {
   const normalized = value?.trim().toLowerCase();
   if (normalized === "on" || normalized === "true" || normalized === "1") return true;
   if (normalized === "off" || normalized === "false" || normalized === "0") return false;
   throw new Error(`${label} expects on|off.`);
};

const determineMentionsBot = (content: string, state: ReplState): boolean => {
   switch (state.mentionMode) {
      case "on":
         return true;
      case "off":
         return false;
      case "auto":
      default:
         if (!Brain.botName) return false;
         return new RegExp(escapeRegExp(Brain.botName), "iu").test(content);
   }
};

const printOutgoingMessages = (prefix: string, messages: ReplOutgoingMessage[]): void => {
   for (const message of messages) {
      const content = message.contents.trim();
      console.log(`${prefix}${content || "[empty message]"}`);
      for (const embed of message.embeds ?? []) {
         const summary = [embed.title, embed.description].filter(Boolean).join(" | ").trim();
         console.log(`${prefix}[embed] ${summary || "embed"}`);
      }
      for (const attachment of message.attachments ?? []) {
         console.log(`${prefix}[attachment] ${attachment.name} (${attachment.size} bytes)`);
      }
      if (message.error?.message) {
         console.log(`${prefix}[error] ${message.error.message}`);
      }
   }
};

const dispatchMessage = async (content: string, state: ReplState, messageCounter: number): Promise<void> => {
   const outgoing: ReplOutgoingMessage[] = [];
   let typingCount = 0;
   const adapter = createLocalAdapter(outgoing, () => {
      typingCount += 1;
   });
   const channel = buildChannel(state);
   const message: StandardMessage = {
      id: `repl-${messageCounter}`,
      content,
      authorId: state.userId,
      authorName: state.authorName,
      isBot: false,
      isSelf: false,
      channelId: channel.id,
      channelName: channel.name,
      channel,
      guildId: state.guildId,
      guildName: state.guildName,
      mentionsBot: state.scope === "dm" && !state.isGroupDm ? false : determineMentionsBot(content, state),
      isAdmin: state.isAdmin,
      isBotOwner: state.isBotOwner,
      platform: adapter
   };

   const results = await handleCoreMessage(message);
   if (typingCount > 0) {
      console.log(`typing> ${typingCount}`);
   }
   if (outgoing.length > 0) {
      printOutgoingMessages(`bot> `, outgoing);
      return;
   }
   if (results?.response) {
      console.log(`bot> ${results.response}`);
      return;
   }
   console.log(`bot> [no response]`);
};

const parseCommandInvocation = (input: string): { command: string; options: Record<string, unknown> } => {
   const trimmed = input.trim();
   const firstSpace = trimmed.indexOf(" ");
   if (firstSpace < 0) {
      return { command: trimmed, options: {} };
   }
   const command = trimmed.slice(0, firstSpace).trim();
   const rawOptions = trimmed.slice(firstSpace + 1).trim();
   if (!rawOptions) return { command, options: {} };
   const parsed = JSON.parse(rawOptions) as unknown;
   if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error(`Command options must be a JSON object.`);
   }
   return { command, options: parsed as Record<string, unknown> };
};

const dispatchCommand = async (input: string, state: ReplState): Promise<void> => {
   const { command, options } = parseCommandInvocation(input);
   if (!command) throw new Error(`Command name is required.`);
   const replies: ReplOutgoingMessage[] = [];
   const interaction: StandardCommandInteraction = {
      command,
      options,
      userId: state.userId,
      channelId: state.channelId,
      guildId: state.guildId,
      isAdmin: state.isAdmin,
      isBotOwner: state.isBotOwner,
      reply: async (message) => {
         replies.push(serializeOutgoing(message));
      }
   };
   await handleCoreCommand(interaction);
   if (replies.length === 0) {
      console.log(`bot> [command completed with no reply]`);
      return;
   }
   printOutgoingMessages(`bot> `, replies);
};

const handleControlCommand = async (input: string, state: ReplState): Promise<"continue" | "exit"> => {
   const trimmed = input.trim();
   const [command = "", ...rest] = trimmed.split(/\s+/u);
   const argString = trimmed.slice(command.length).trim();

   switch (command.toLowerCase()) {
      case "help":
         printHelp();
         return "continue";
      case "show":
         console.log(formatState(state));
         return "continue";
      case "reset": {
         const next = createDefaultState();
         Object.assign(state, next);
         console.log(`state> reset to defaults`);
         return "continue";
      }
      case "dm":
         state.scope = "dm";
         state.isGroupDm = false;
         state.memberCount = undefined;
         state.channelId = "repl-dm";
         state.channelName = "direct";
         state.guildId = undefined;
         state.guildName = undefined;
         console.log(`state> switched to DM mode`);
         return "continue";
      case "groupdm": {
         const count = Number(rest[0] ?? 3);
         state.scope = "dm";
         state.isGroupDm = true;
         state.memberCount = Number.isFinite(count) && count >= 2 ? Math.floor(count) : 3;
         state.channelId = "repl-group-dm";
         state.channelName = "group-direct";
         state.guildId = undefined;
         state.guildName = undefined;
         console.log(`state> switched to group DM mode (${state.memberCount} members)`);
         return "continue";
      }
      case "server": {
         const guildId = rest[0] ?? "repl-guild";
         const channelId = rest[1] ?? "repl-channel";
         state.scope = "server";
         state.isGroupDm = false;
         state.memberCount = undefined;
         state.guildId = guildId;
         state.guildName = guildId;
         state.channelId = channelId;
         state.channelName = channelId;
         console.log(`state> switched to server mode (${guildId} / ${channelId})`);
         return "continue";
      }
      case "mention": {
         const mode = rest[0]?.toLowerCase();
         if (mode !== "auto" && mode !== "on" && mode !== "off") {
            throw new Error(`mention expects auto|on|off.`);
         }
         state.mentionMode = mode;
         console.log(`state> mention mode = ${mode}`);
         return "continue";
      }
      case "user": {
         const userId = rest[0];
         if (!userId) throw new Error(`user expects <id> [display name].`);
         state.userId = userId;
         state.authorName = rest.slice(1).join(" ").trim() || userId;
         console.log(`state> user = ${state.userId} (${state.authorName})`);
         return "continue";
      }
      case "admin":
         state.isAdmin = parseToggle(rest[0], "admin");
         console.log(`state> isAdmin = ${state.isAdmin}`);
         return "continue";
      case "owner":
         state.isBotOwner = parseToggle(rest[0], "owner");
         console.log(`state> isBotOwner = ${state.isBotOwner}`);
         return "continue";
      case "cmd":
         await dispatchCommand(argString, state);
         return "continue";
      case "exit":
      case "quit":
         return "exit";
      default:
         throw new Error(`Unknown control command ':${command}'. Use :help.`);
   }
};

const main = async (): Promise<void> => {
   await startCoreInitialization();
   if (!isCoreInitialized()) {
      throw new Error(`Core initialization did not complete.`);
   }
   registerProcessHandlers();

   const state = createDefaultState();
   let messageCounter = 0;
   let shutdownSignal: NodeJS.Signals = "SIGTERM";
   const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
   });

   rl.on("SIGINT", () => {
      shutdownSignal = "SIGINT";
      rl.close();
   });

   console.log(`Headless REPL started for '${Brain.botName}'.`);
   printHelp();
   rl.setPrompt(buildPrompt(state));
   rl.prompt();

   for await (const rawLine of rl) {
      const line = rawLine.trim();
      if (!line) {
         rl.setPrompt(buildPrompt(state));
         rl.prompt();
         continue;
      }

      try {
         if (line.startsWith(":")) {
            const result = await handleControlCommand(line.slice(1), state);
            if (result === "exit") {
               rl.close();
               break;
            }
         } else {
            messageCounter += 1;
            await dispatchMessage(line, state, messageCounter);
         }
      } catch (error: unknown) {
         const message = error instanceof Error ? error.message : String(error);
         console.error(`repl error> ${message}`);
      }

      rl.setPrompt(buildPrompt(state));
      rl.prompt();
   }

   process.kill(process.pid, shutdownSignal);
};

void main().catch((error) => {
   const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
   console.error(message);
   process.exit(1);
});
