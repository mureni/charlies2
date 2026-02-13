import type {
   StandardMessage,
   StandardOutgoingMessage,
   PlatformAdapter
} from "@/platform";

interface SentMessage {
   channelId: string;
   message: StandardOutgoingMessage;
}

interface MockAdapterResult {
   adapter: PlatformAdapter;
   sent: SentMessage[];
   replies: Array<{ messageId: string; content: string }>;
   typings: string[];
}

const createMockAdapter = (overrides: Partial<PlatformAdapter> = {}): MockAdapterResult => {
   const sent: SentMessage[] = [];
   const replies: Array<{ messageId: string; content: string }> = [];
   const typings: string[] = [];

   const adapter: PlatformAdapter = {
      reply: async (messageId: string, content: string): Promise<void> => {
         replies.push({ messageId, content });
      },
      sendMessage: async (channelId: string, message: StandardOutgoingMessage): Promise<void> => {
         sent.push({ channelId, message });
      },
      sendTyping: async (channelId: string): Promise<void> => {
         typings.push(channelId);
      },
      fetchGuilds: async () => [],
      fetchGuild: async () => undefined,
      fetchChannels: async () => [],
      fetchChannel: async () => undefined,
      fetchMember: async () => undefined,
      fetchHistory: async () => [],
      ...overrides
   };

   return { adapter, sent, replies, typings };
};

const createMessage = (overrides: Partial<StandardMessage> = {}): StandardMessage => ({
   id: "msg-1",
   content: "",
   authorId: "user-1",
   authorName: "User",
   isBot: false,
   channelId: "channel-1",
   isSelf: false,
   ...overrides
});

export { createMessage, createMockAdapter };
