import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMessage, createMockAdapter } from "./pluginHarness";

const mockProcess = vi.fn();
const mockRegister = vi.fn();
const mockShouldRespond = vi.fn();
const mockShouldYell = vi.fn();
const mockTouchKnownUser = vi.fn();
const mockSaveKnownUser = vi.fn();

const brainSettings = {
   outburstThreshold: 0.2,
   conversationTimeLimit: 60_000,
   secretPlaces: [],
   angerLevel: 0.1,
   angerIncrease: 1,
   angerDecrease: 1,
   learnFromBots: false
};

vi.mock("@/core/interactionRouter", () => ({
   InteractionRouter: {
      process: (...args: unknown[]) => mockProcess(...args),
      registerCommands: (...args: unknown[]) => mockRegister(...args)
   }
}));

vi.mock("@/core/responseDecision", () => ({
   shouldRespond: (...args: unknown[]) => mockShouldRespond(...args),
   shouldYell: (...args: unknown[]) => mockShouldYell(...args)
}));

vi.mock("@/filters", () => ({
   Filters: {
      apply: (_stage: string, text: string) => text
   }
}));

vi.mock("@/core/knownUsers", () => ({
   touchKnownUser: (...args: unknown[]) => mockTouchKnownUser(...args),
   saveKnownUser: (...args: unknown[]) => mockSaveKnownUser(...args)
}));

vi.mock("@/core/user", () => ({
   getEndearment: () => "buddy",
   interpolateUsers: async (text: string) => text
}));

vi.mock("@/core/brain", () => ({
   Brain: {
      botName: "unit-test",
      settings: brainSettings,
      lexicon: new Map([["seed", new Set(["hash"])]]) as unknown as Map<string, Set<string>>,
      nGrams: new Map([["hash", { tokens: ["seed"], canStart: true, canEnd: true, nextTokens: new Map(), previousTokens: new Map() }]]) as unknown as Map<string, unknown>,
      getSeed: vi.fn(async () => "seed"),
      getRandomSeed: vi.fn(async () => "random-seed"),
      getResponse: vi.fn(async () => "hello"),
      learn: vi.fn(async () => true)
   }
}));

describe("messageProcessor", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      mockProcess.mockResolvedValue({
         results: [],
         modifications: { Case: "unchanged" },
         triggered: false
      });
      mockRegister.mockResolvedValue(undefined);
      mockShouldRespond.mockReturnValue(false);
      mockShouldYell.mockReturnValue(false);
      mockTouchKnownUser.mockImplementation((_id: string, name: string) => ({
         name,
         aliases: new Set<string>(),
         conversations: new Map()
      }));
   });

   it("responds in group DMs and prefixes with author name", async () => {
      const { Brain } = await import("@/core/brain");
      const { processMessage } = await import("@/core/messageProcessor");
      vi.mocked(Brain.getResponse).mockResolvedValue("Hello there");

      const { adapter, sent, typings } = createMockAdapter({
         canSend: async () => true
      });

      const message = createMessage({
         content: "hello",
         authorName: "Casey",
         mentionsBot: true,
         channel: {
            id: "channel-1",
            name: "group-dm",
            type: "dm",
            scope: "dm",
            supportsText: true,
            supportsVoice: false,
            supportsTyping: true,
            supportsHistory: false,
            isGroupDm: true,
            memberCount: 3
         },
         platform: adapter
      });

      const results = await processMessage(message);

      expect(typings).toEqual(["channel-1"]);
      expect(sent).toHaveLength(1);
      expect(sent[0]?.message.contents).toBe("Casey: Hello there");
      expect(results.directedTo).toBe("Casey");
      expect(results.learned).toBe(true);
      expect(mockSaveKnownUser).toHaveBeenCalled();
   });

   it("uses triggered interactions, prefixes directed responses, and yells when needed", async () => {
      const { Brain } = await import("@/core/brain");
      const { processMessage } = await import("@/core/messageProcessor");
      vi.mocked(Brain.getResponse).mockResolvedValue("unused");
      mockShouldYell.mockReturnValue(true);
      mockProcess.mockResolvedValue({
         results: [{ contents: "hi there", embeds: [], attachments: [] }],
         modifications: { Case: "lower" },
         triggered: true,
         triggeredBy: "unit-test",
         directedTo: "Friend"
      });

      const { adapter, sent, typings } = createMockAdapter({
         canSend: async () => true
      });

      const message = createMessage({
         content: "trigger",
         authorName: "Casey",
         channel: {
            id: "channel-1",
            name: "general",
            type: "text",
            scope: "server",
            supportsText: true,
            supportsVoice: false,
            supportsTyping: true,
            supportsHistory: true
         },
         platform: adapter
      });

      const results = await processMessage(message);

      expect(typings).toEqual(["channel-1"]);
      expect(sent).toHaveLength(1);
      expect(sent[0]?.message.contents).toBe("FRIEND: HI THERE");
      expect(results.triggeredBy).toBe("unit-test");
      expect(results.directedTo).toBe("Friend");
   });

   it("skips sending when platform cannot send but still learns", async () => {
      const { Brain } = await import("@/core/brain");
      const { processMessage } = await import("@/core/messageProcessor");
      vi.mocked(Brain.learn).mockResolvedValue(true);

      const { adapter, sent, typings } = createMockAdapter({
         canSend: async () => false
      });

      const message = createMessage({
         content: "hello",
         authorName: "Casey",
         channel: {
            id: "channel-1",
            name: "dm",
            type: "dm",
            scope: "dm",
            supportsText: true,
            supportsVoice: false,
            supportsTyping: true,
            supportsHistory: false,
            isGroupDm: false,
            memberCount: 1
         },
         platform: adapter
      });

      const results = await processMessage(message);

      expect(typings).toHaveLength(0);
      expect(sent).toHaveLength(0);
      expect(results.learned).toBe(true);
      expect(Brain.learn).toHaveBeenCalled();
   });

   it("skips processing when message is from self", async () => {
      const { processMessage } = await import("@/core/messageProcessor");
      const { adapter, sent } = createMockAdapter();
      const result = await processMessage(createMessage({
         content: "hello",
         isSelf: true,
         platform: adapter
      }));

      expect(result.learned).toBe(false);
      expect(mockProcess).not.toHaveBeenCalled();
      expect(sent).toHaveLength(0);
   });

   it("does not send when triggered output is empty", async () => {
      mockProcess.mockResolvedValue({
         results: [{ contents: "" }],
         modifications: { Case: "unchanged" },
         triggered: true,
         triggeredBy: "empty"
      });

      const { processMessage } = await import("@/core/messageProcessor");
      const { adapter, sent, typings } = createMockAdapter({
         canSend: async () => true
      });
      const message = createMessage({
         content: "trigger",
         platform: adapter,
         channel: {
            id: "channel-1",
            name: "general",
            type: "text",
            scope: "server",
            supportsText: true,
            supportsVoice: false,
            supportsTyping: true,
            supportsHistory: true
         }
      });

      const result = await processMessage(message);

      expect(result.triggeredBy).toBe("empty");
      expect(typings).toEqual(["channel-1"]);
      expect(sent).toHaveLength(0);
   });

   it("does not prefix responses in direct DMs", async () => {
      const { Brain } = await import("@/core/brain");
      const { processMessage } = await import("@/core/messageProcessor");
      vi.mocked(Brain.getResponse).mockResolvedValue("Hello there");

      const { adapter, sent } = createMockAdapter({
         canSend: async () => true
      });

      const message = createMessage({
         content: "hello",
         authorName: "Casey",
         channel: {
            id: "channel-2",
            name: "dm",
            type: "dm",
            scope: "dm",
            supportsText: true,
            supportsVoice: false,
            supportsTyping: true,
            supportsHistory: false,
            isGroupDm: false,
            memberCount: 1
         },
         platform: adapter
      });

      const results = await processMessage(message);

      expect(results.directedTo).toBeUndefined();
      expect(sent[0]?.message.contents).toBe("Hello there");
   });

   it("continues recent conversations even without mentions", async () => {
      const { Brain } = await import("@/core/brain");
      const { processMessage } = await import("@/core/messageProcessor");
      vi.mocked(Brain.getResponse).mockResolvedValue("Follow up");
      const now = Date.now();
      const user = {
         name: "Casey",
         aliases: new Set<string>(),
         conversations: new Map([
            ["channel-1", { lastSpokeAt: now, lastTopic: "previous topic" }]
         ])
      };
      mockTouchKnownUser.mockReturnValue(user);

      const { adapter, sent } = createMockAdapter({
         canSend: async () => true
      });

      const message = createMessage({
         content: "new topic",
         authorName: "Casey",
         channel: {
            id: "channel-1",
            name: "general",
            type: "text",
            scope: "server",
            supportsText: true,
            supportsVoice: false,
            supportsTyping: true,
            supportsHistory: true
         },
         platform: adapter
      });

      const results = await processMessage(message);

      expect(Brain.getResponse).toHaveBeenCalledWith("new topic previous topic");
      expect(sent[0]?.message.contents).toBe("Casey: Follow up");
      expect(results.directedTo).toBe("Casey");
   });
});
