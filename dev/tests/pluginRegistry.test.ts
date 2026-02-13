import { describe, expect, it, vi } from "vitest";
import { PluginRegistry } from "@/plugins";
import type { InteractionPlugin } from "@/plugins/types";
import type { StandardCommandInteraction } from "@/platform";

const createInteraction = (command: string, options: Record<string, unknown> = {}): StandardCommandInteraction => ({
   command,
   options,
   userId: "user-1",
   channelId: "channel-1",
   reply: vi.fn(async () => {})
});

describe("plugin registry", () => {
   it("registers plugins and exposes plugins", () => {
      const registry = new PluginRegistry();
      const plugin: InteractionPlugin = {
         id: "test",
         name: "Test",
         description: "test",
         usage: "test",
         matcher: /^test$/u,
         execute: async () => ({ results: [{ contents: "ok" }], modifications: { Case: "unchanged" } })
      };
      registry.register(plugin);
      const plugins = registry.getPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].id).toBe("test");
   });

   it("skips duplicate plugin ids", () => {
      const registry = new PluginRegistry();
      registry.register({ id: "dup", name: "First", description: "first", usage: "first" });
      registry.register({ id: "dup", name: "Second", description: "second", usage: "second" });

      const plugins = registry.getPlugins();

      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe("First");
   });

   it("returns visible commands only", () => {
      const registry = new PluginRegistry();
      const plugin: InteractionPlugin = {
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
      const plugin: InteractionPlugin = {
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
      const plugin: InteractionPlugin = {
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

   it("returns null when command is not registered", async () => {
      const registry = new PluginRegistry();
      const interaction = createInteraction("missing");
      const result = await registry.handleCommand(interaction);
      expect(result).toBeNull();
   });

   it("returns null when no fallback matcher is defined", async () => {
      const registry = new PluginRegistry();
      const plugin: InteractionPlugin = {
         id: "cmd",
         name: "Cmd",
         description: "cmd",
         usage: "cmd",
         commands: [{ name: "echo", description: "echo" }],
         execute: vi.fn<NonNullable<InteractionPlugin["execute"]>>(async () => ({
            results: [{ contents: "ok" }],
            modifications: { Case: "unchanged" }
         }))
      };
      registry.register(plugin);

      const interaction = createInteraction("echo", { text: "hi" });
      const result = await registry.handleCommand(interaction);

      expect(result).toBeNull();
      expect(plugin.execute).not.toHaveBeenCalled();
   });
});
