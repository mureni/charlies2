import { mkdirSync } from "fs";
import { resolve } from "path";
import { checkFilePath } from "@/utils";

interface PluginPaths {
   resourcesDir: string;
   dataDir: string;
   sharedResourcesDir: string;
   sharedDataDir: string;
}

const resolvePluginPaths = (pluginId: string): PluginPaths => {
   const resourcesRoot = checkFilePath("resources");
   const dataRoot = checkFilePath("data");
   const sharedResourcesDir = resolve(resourcesRoot, "shared");
   const sharedDataDir = resolve(dataRoot, "shared");
   const resourcesDir = resolve(resourcesRoot, "plugins", pluginId);
   const dataDir = resolve(dataRoot, "plugins", pluginId);

   mkdirSync(sharedResourcesDir, { recursive: true });
   mkdirSync(sharedDataDir, { recursive: true });
   mkdirSync(resourcesDir, { recursive: true });
   mkdirSync(dataDir, { recursive: true });

   return { resourcesDir, dataDir, sharedResourcesDir, sharedDataDir };
};

export type { PluginPaths };
export { resolvePluginPaths };
