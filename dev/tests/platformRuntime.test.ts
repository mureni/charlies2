import { beforeEach, describe, expect, it, vi } from "vitest";
import { initEnvConfig } from "@/utils";

vi.mock("@/platform/discordMediator", () => ({
   startDiscordMediator: vi.fn(() => ({ stop: vi.fn() }))
}));

describe("platform runtime", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      delete process.env.PLATFORM;
      process.exitCode = undefined;
      initEnvConfig();
   });

   it("starts the discord mediator by default", async () => {
      const { startPlatform } = await import("@/platform/runtime");
      const { startDiscordMediator } = await import("@/platform/discordMediator");

      const result = startPlatform();

      expect(startDiscordMediator).toHaveBeenCalledTimes(1);
      expect(result).toBeTruthy();
   });

   it("starts the discord mediator when PLATFORM is set", async () => {
      process.env.PLATFORM = "discord";
      initEnvConfig();
      const { startPlatform } = await import("@/platform/runtime");
      const { startDiscordMediator } = await import("@/platform/discordMediator");

      const result = startPlatform();

      expect(startDiscordMediator).toHaveBeenCalledTimes(1);
      expect(process.exitCode).toBeUndefined();
      expect(result).toBeTruthy();
   });

   it("sets exitCode on unknown platform", async () => {
      process.env.PLATFORM = "unknown";
      initEnvConfig();
      const { startPlatform } = await import("@/platform/runtime");
      const { startDiscordMediator } = await import("@/platform/discordMediator");

      const result = startPlatform();

      expect(startDiscordMediator).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
      expect(result).toEqual({});
   });
});
