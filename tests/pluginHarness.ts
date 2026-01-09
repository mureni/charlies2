import type {
   CoreMessage,
   OutgoingMessage,
   PlatformAdapter
} from "../src/platform";

type SentMessage = {
   channelId: string;
   message: OutgoingMessage;
};

type MockAdapterResult = {
   adapter: PlatformAdapter;
   sent: SentMessage[];
   replies: Array<{ messageId: string; content: string }>;
   typings: string[];
};

const createMockAdapter = (overrides: Partial<PlatformAdapter> = {}): MockAdapterResult => {
   const sent: SentMessage[] = [];
   const replies: Array<{ messageId: string; content: string }> = [];
   const typings: string[] = [];

   const adapter: PlatformAdapter = {
      reply: async (messageId: string, content: string): Promise<void> => {
         replies.push({ messageId, content });
      },
      sendMessage: async (channelId: string, message: OutgoingMessage): Promise<void> => {
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

const createMessage = (overrides: Partial<CoreMessage> = {}): CoreMessage => ({
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
