import "tsconfig-paths/register";
import "source-map-support/register";
import "dotenv/config";

import { initEnvConfig } from "@/utils";

const ENV = initEnvConfig();

const bootstrap = async (): Promise<void> => {
   const { registerProcessHandlers } = await import("./core/runtime.js");
   const { startPlatform } = await import("./platform/runtime.js");
   const { startHarnessProxyServer } = await import("./core/harnessProxy.js");
   const runtime = startPlatform();
   const harnessProxy = startHarnessProxyServer();
   registerProcessHandlers(async () => {
      if (harnessProxy?.stop) await harnessProxy.stop();
      if (runtime.stop) await runtime.stop();
   });
};

void bootstrap();

export { ENV };
