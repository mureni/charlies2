import { describe, expect, it, vi } from "vitest";
import { PluginRegistry } from "@/plugins";
import type { TriggerPlugin } from "@/plugins/types";
import type { PlatformCommandInteraction } from "@/platform";

const createInteraction = (command: string, options: Record<string, unknown> = {}): PlatformCommandInteraction => ({
   command,
   options,
   userId: "user-1",
   channelId: "channel-1",
   reply: vi.fn(async () => {})
});

describe("plugin registry", () => {
   it("registers plugins and exposes legacy triggers", () => {
      const registry = new PluginRegistry();
      const plugin: TriggerPlugin = {
         id: "test",
         name: "Test",
         description: "test",
         usage: "test",
         matcher: /^test$/u,
         execute: async () => ({ results: [{ contents: "ok" }], modifications: { Case: "unchanged" } })
      };
      registry.register(plugin);
      const triggers = registry.getLegacyTriggers();
      expect(triggers).toHaveLength(1);
      expect(triggers[0].id).toBe("test");
   });

   it("returns visible commands only", () => {
      const registry = new PluginRegistry();
      const plugin: TriggerPlugin = {
         id: "cmds",
         name: "Cmds",
         description: "cmds",
         usage: "cmds",
         commands: [
            { name: "visible", description: "visible" },
            { name: "hidden", description: "hidden", hidden: true }
         ]
      };
      registry.register(plugin);
      const commands = registry.getCommands();
      expect(commands.map(command => command.name)).toEqual(["visible"]);
   });

   it("routes commands to onCommand when available", async () => {
      const registry = new PluginRegistry();
      const onCommand = vi.fn(async () => {});
      const plugin: TriggerPlugin = {
         id: "cmd",
         name: "Cmd",
         description: "cmd",
         usage: "cmd",
         commands: [{ name: "ping", description: "ping" }],
         onCommand
      };
      registry.register(plugin);
      const interaction = createInteraction("ping");
      const result = await registry.handleCommand(interaction);
      expect(result).toBeNull();
      expect(onCommand).toHaveBeenCalledWith(interaction);
   });

   it("uses fallback matcher when no onCommand exists", async () => {
      const registry = new PluginRegistry();
      const plugin: TriggerPlugin = {
         id: "fallback",
         name: "fallback",
         description: "fallback",
         usage: "fallback",
         commands: [{
            name: "echo",
            description: "echo",
            options: [{ name: "text", description: "text", type: "string" }],
            fallbackMatcher: /^echo\s+(?<text>.+)$/u
         }],
         execute: async (_context, matches) => ({
            results: [{ contents: `echo:${matches?.groups?.text}` }],
            modifications: { Case: "unchanged" }
         })
      };
      registry.register(plugin);
      const interaction = createInteraction("echo", { text: "hi" });
      const result = await registry.handleCommand(interaction);
      expect(result?.results[0].contents).toBe("echo:hi");
   });
});
