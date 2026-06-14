import "tsconfig-paths/register";
import "source-map-support/register";
import "dotenv/config";

import { log } from "@/core/log";
import { initEnvConfig } from "@/utils";

const ENV = initEnvConfig();

type StoppableHandle = { stop?: () => Promise<void> | void } | null | undefined;

const stopHandle = async (handle: StoppableHandle): Promise<void> => {
   if (!handle?.stop) return;
   await handle.stop();
};

const reportBootstrapFailure = async (error: unknown, runtime?: StoppableHandle, harnessProxy?: StoppableHandle): Promise<never> => {
   const message = error instanceof Error ? error.message : String(error);
   const stack = error instanceof Error ? (error.stack ?? error.message) : undefined;
   const sqliteBusy = /SQLITE_BUSY|database is locked/iu.test(message);

   try {
      log(`Bootstrap failed: ${message}`, "error");
      if (sqliteBusy) {
         log(
            `Startup blocked by a locked SQLite database. Another bot instance or SQLite client is using the same data files; stop the other process or point this bot at a separate DATA_DIR before retrying.`,
            "error"
         );
      }
      if (stack && stack !== message) log(stack, "error");
   } catch {
      console.error(`Bootstrap failed: ${message}`);
      if (sqliteBusy) {
         console.error(
            "Startup blocked by a locked SQLite database. Another bot instance or SQLite client is using the same data files; stop the other process or point this bot at a separate DATA_DIR before retrying."
         );
      }
      if (stack && stack !== message) console.error(stack);
   }

   try {
      await stopHandle(harnessProxy);
   } catch (stopError: unknown) {
      const stopMessage = stopError instanceof Error ? stopError.message : String(stopError);
      log(`Error while stopping harness proxy after bootstrap failure: ${stopMessage}`, "error");
   }
   try {
      await stopHandle(runtime);
   } catch (stopError: unknown) {
      const stopMessage = stopError instanceof Error ? stopError.message : String(stopError);
      log(`Error while stopping platform runtime after bootstrap failure: ${stopMessage}`, "error");
   }

   process.exit(1);
};

const bootstrap = async (): Promise<void> => {
   let runtime: StoppableHandle;
   let harnessProxy: StoppableHandle;
   try {
      log("Bootstrap starting...", "general");
      const { registerProcessHandlers } = await import("./core/runtime.js");
      log("Core runtime module loaded.", "debug");
      const { startPlatform } = await import("./platform/runtime.js");
      log("Platform runtime module loaded.", "debug");
      const { startHarnessProxyServer } = await import("./core/harnessProxy.js");
      log("Harness proxy module loaded.", "debug");
      log("Starting harness proxy...", "general");
      harnessProxy = await startHarnessProxyServer();
      log("Starting platform runtime...", "general");
      runtime = startPlatform();
      registerProcessHandlers(async () => {
         await stopHandle(harnessProxy);
         await stopHandle(runtime);
      });
      log("Bootstrap complete. Waiting for platform events.", "general");
   } catch (error: unknown) {
      await reportBootstrapFailure(error, runtime, harnessProxy);
   }
};

void bootstrap().catch((error) => {
   void reportBootstrapFailure(error);
});

export { ENV };
