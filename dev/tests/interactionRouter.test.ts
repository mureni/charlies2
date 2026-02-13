import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InteractionPlugin, PluginCommand } from "@/plugins";
import type { InteractionResult } from "@/core/interactionTypes";
import { InteractionRouter } from "@/core/interactionRouter";

interface MockPluginManager {
   getPlugins: () => InteractionPlugin[];
   getCommands: () => PluginCommand[];
   handleCommand: ReturnType<typeof vi.fn>;
   clear: ReturnType<typeof vi.fn>;
   loadFromDist: ReturnType<typeof vi.fn>;
   startWatching: ReturnType<typeof vi.fn>;
   unloadAll: ReturnType<typeof vi.fn>;
}

const configurePlugins = (plugins: InteractionPlugin[]): MockPluginManager => {
   const pluginManager: MockPluginManager = {
      getPlugins: () => plugins,
      getCommands: () => plugins.flatMap(plugin => plugin.commands ?? []),
      handleCommand: vi.fn(async () => ({ results: [], modifications: { Case: "unchanged" } })),
      clear: vi.fn(),
      loadFromDist: vi.fn(),
      startWatching: vi.fn(),
      unloadAll: vi.fn()
   };
   (InteractionRouter as unknown as { pluginManager: unknown }).pluginManager = pluginManager;
   (InteractionRouter as unknown as { commandsRegistered: boolean }).commandsRegistered = false;
   (InteractionRouter as unknown as { commandsRegistering: boolean }).commandsRegistering = false;
   (InteractionRouter as unknown as { commandHandlerRegistered: boolean }).commandHandlerRegistered = false;
   (InteractionRouter as unknown as { watching: boolean }).watching = false;
   return pluginManager;
};

describe("interactionRouter", () => {
   beforeEach(() => {
      vi.restoreAllMocks();
   });

   const buildResult = (contents: string): InteractionResult => ({
      results: [{ contents }],
      modifications: { Case: "unchanged" }
   });

   it("respects permission gates and triggers admin-only plugins", async () => {
      const ownerPlugin: InteractionPlugin = {
         id: "owner",
         name: "Owner",
         description: "Owner only",
         usage: "owner",
         permissions: { ownerOnly: true },
         matcher: /ping/i,
         execute: vi.fn<NonNullable<InteractionPlugin["execute"]>>(async () => buildResult("owner ok"))
      };
      const adminPlugin: InteractionPlugin = {
         id: "admin",
         name: "Admin",
         description: "Admin only",
         usage: "admin",
         permissions: { adminOnly: true },
         matcher: /ping/i,
         execute: vi.fn<NonNullable<InteractionPlugin["execute"]>>(async () => buildResult("admin ok"))
      };
      configurePlugins([ownerPlugin, adminPlugin]);

      const result = await InteractionRouter.process({
         id: "m1",
         content: "ping",
         authorId: "u1",
         authorName: "User",
         isBot: false,
         channelId: "c1",
         isAdmin: true,
         isBotOwner: false
      });

      expect(ownerPlugin.execute).not.toHaveBeenCalled();
      expect(adminPlugin.execute).toHaveBeenCalled();
      expect(result.triggeredBy).toBe("admin");
   });

   it("skips admin-only plugins for non-admin users", async () => {
      const adminPlugin: InteractionPlugin = {
         id: "admin",
         name: "Admin",
         description: "Admin only",
         usage: "admin",
         permissions: { adminOnly: true },
         matcher: /ping/i,
         execute: vi.fn<NonNullable<InteractionPlugin["execute"]>>(async () => buildResult("admin ok"))
      };
      configurePlugins([adminPlugin]);

      const result = await InteractionRouter.process({
         id: "m0",
         content: "ping",
         authorId: "u1",
         authorName: "User",
         isBot: false,
         channelId: "c1",
         isAdmin: false,
         isBotOwner: false
      });

      expect(adminPlugin.execute).not.toHaveBeenCalled();
      expect(result.triggered).toBe(false);
   });

   it("uses command fallback matchers when defined", async () => {
      const fallbackPlugin: InteractionPlugin = {
         id: "fallback",
         name: "Fallback",
         description: "Fallback matchers",
         usage: "fallback",
         commands: [
            {
               name: "do",
               description: "Do the thing",
               options: [],
               fallbackMatcher: /do thing/i
            }
         ],
         execute: vi.fn<NonNullable<InteractionPlugin["execute"]>>(async () => buildResult("done"))
      };
      configurePlugins([fallbackPlugin]);

      const result = await InteractionRouter.process({
         id: "m2",
         content: "do thing",
         authorId: "u1",
         authorName: "User",
         isBot: false,
         channelId: "c1"
      });

      expect(fallbackPlugin.execute).toHaveBeenCalled();
      expect(result.triggeredBy).toBe("do");
   });

   it("builds help lists and handles unknown help requests", async () => {
      const helpPlugin: InteractionPlugin = {
         id: "alpha",
         name: "Alpha",
         description: "Alpha plugin",
         usage: "alpha",
         commands: [
            {
               name: "do",
               description: "Do it",
               options: [{ name: "target", description: "target", type: "string", required: true }]
            },
            {
               name: "secret",
               description: "Hidden",
               options: [],
               hidden: true
            }
         ]
      };
      configurePlugins([helpPlugin]);

      const listResult = await InteractionRouter.process({
         id: "m3",
         content: "!help",
         authorId: "u1",
         authorName: "User",
         isBot: false,
         channelId: "c1"
      });

      const description = listResult.results[0]?.embeds?.[0]?.description ?? "";
      expect(listResult.triggered).toBe(true);
      expect(description).toContain("alpha");
      expect(description).toContain("do");
      expect(description).not.toContain("secret");

      const unknownResult = await InteractionRouter.process({
         id: "m4",
         content: "!help missing",
         authorId: "u1",
         authorName: "User",
         isBot: false,
         channelId: "c1"
      });

      expect(unknownResult.results[0]?.contents).toBe("no such command exists");
   });

   it("handles slash help interactions", async () => {
      const helpPlugin: InteractionPlugin = {
         id: "alpha",
         name: "Alpha",
         description: "Alpha plugin",
         usage: "alpha",
         commands: [
            {
               name: "do",
               description: "Do it",
               options: [{ name: "target", description: "target", type: "string", required: true }]
            }
         ]
      };
      configurePlugins([helpPlugin]);

      const replies: Array<{ contents: string }> = [];
      await InteractionRouter.handleCommand({
         command: "help",
         options: { command: "alpha" },
         userId: "u1",
         channelId: "c1",
         reply: async (message) => {
            replies.push({ contents: message.contents });
         }
      });

      expect(replies.length).toBeGreaterThan(0);
   });

   it("skips processing bot messages", async () => {
      const plugin: InteractionPlugin = {
         id: "ping",
         name: "Ping",
         description: "Ping",
         usage: "ping",
         matcher: /ping/i,
         execute: vi.fn(async () => buildResult("pong"))
      };
      configurePlugins([plugin]);

      const result = await InteractionRouter.process({
         id: "m5",
         content: "ping",
         authorId: "u1",
         authorName: "Bot",
         isBot: true,
         channelId: "c1"
      });

      expect(plugin.execute).not.toHaveBeenCalled();
      expect(result.triggered).toBe(false);
   });

   it("does not trigger help when no commands exist", async () => {
      configurePlugins([]);

      const result = await InteractionRouter.process({
         id: "m6",
         content: "!help",
         authorId: "u1",
         authorName: "User",
         isBot: false,
         channelId: "c1"
      });

      expect(result.triggered).toBe(false);
      expect(result.results).toHaveLength(0);
   });
});
