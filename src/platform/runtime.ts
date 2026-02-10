import { log } from "@/core/log";
import { env } from "@/utils";
import { startDiscordMediator } from "./discordMediator";
import type { PlatformMediatorHandle } from "./types";

const startPlatform = (): PlatformMediatorHandle => {
   const platform = (env("PLATFORM", "discord") ?? "discord").trim().toLowerCase();
   switch (platform) {
      case "discord":
         return startDiscordMediator();
      default:
         log(`Unknown platform '${platform}'. Set PLATFORM=discord.`, "error");
         process.exitCode = 1;
         return {};
   }
};

export { startPlatform };
