import "tsconfig-paths/register";
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { resolve } from "path";
import { afterAll } from "vitest";
import { initEnvConfig } from "@/utils";

let tempDataDir: string | undefined;

if (!process.env.CHARLIES_DATA_DIR) {
   const base = resolve(process.cwd(), ".tmp");
   const workerId = process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? String(process.pid);
   mkdirSync(base, { recursive: true });
   tempDataDir = mkdtempSync(resolve(base, `test-data-${workerId}-`));
   process.env.CHARLIES_DATA_DIR = tempDataDir;
}

if (!process.env.BOT_NAME) {
   process.env.BOT_NAME = "anonymous";
}

initEnvConfig();

afterAll(() => {
   if (!tempDataDir) return;
   rmSync(tempDataDir, { recursive: true, force: true });
});
