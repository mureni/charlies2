import AppRootPath from "app-root-path";
import { isAbsolute, resolve, relative } from "path";
import { mkdirSync, existsSync, accessSync, constants } from "fs";

const rootPath = AppRootPath.toString();
const distPath = resolve(rootPath, "dist");

type EnvConfig = Record<string, string | undefined>;
let envConfig: EnvConfig | null = null;

const initEnvConfig = (raw: NodeJS.ProcessEnv = process.env): EnvConfig => {
   envConfig = { ...raw };
   return envConfig;
};

const getEnvConfig = (): EnvConfig => envConfig ?? initEnvConfig();

const checkFilePath = (path: "code" | "resources" | "data" | "logs" = "code", file: string = "", createFile: boolean = true): string => {
   const dataOverride = path === "data" ? getEnvConfig().CHARLIES_DATA_DIR : undefined;
   const typePath: string = path === "code" ? distPath : path;
   const basePath = dataOverride
      ? (isAbsolute(dataOverride) ? dataOverride : resolve(rootPath, dataOverride))
      : resolve(rootPath, typePath);
   if (!existsSync(basePath)) {
      if (!createFile) throw new Error(`Unable to locate path ${basePath} (Original path: ${rootPath})`);
      mkdirSync(basePath, { recursive: true });
   }

   /* Determine appropriate access for the selected path -- only look for read access for ./dist */
   const accessFlags = (typePath === distPath) ? constants.R_OK : constants.R_OK | constants.W_OK;
   try {
      accessSync(basePath, accessFlags);
   } catch (error) {
      throw new Error(`Unable to access path ${basePath}: ${error} (Original path: ${rootPath})`);
   }
   
   if (file === "") return basePath;

   const filePath = resolve(basePath, file);
   const relativePath = relative(basePath, filePath);
   if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error(`Resolved path ${filePath} escapes base path ${basePath}. Check configuration or input.`);
   }
   if (!createFile && !existsSync(filePath)) throw new Error(`Unable to locate file ${filePath} (Original path: ${rootPath})`);
   
   return filePath;
}

const env = (envVar: string, defaultValue: string = ""): string | undefined => {
   const config = getEnvConfig();
   if (envVar in config) return config[envVar];
   return defaultValue;
}

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
function randFrom<T>(array: T[]): T { return array[Math.floor(Math.random() * array.length)] };
interface WeightedValue<T> { value: T; weight: number }
interface WeightedRandOptions {
   rng?: () => number;
   surprise?: number;
}
const weightedRandFrom = <T>(
   weights: Map<T, number> | WeightedValue<T>[],
   rngOrOptions: (() => number) | WeightedRandOptions = Math.random
): T | undefined => {
   const options: WeightedRandOptions = typeof rngOrOptions === "function" ? { rng: rngOrOptions } : rngOrOptions;
   const rng = options.rng ?? Math.random;
   const surprise = clamp(options.surprise ?? 0, 0, 1);
   const scale = 1 - surprise;
   const safeRandom = (): number => {
      const value = rng();
      if (value <= 0) return Number.EPSILON;
      if (value >= 1) return 1 - Number.EPSILON;
      return value;
   };
   const gumbel = (): number => -Math.log(-Math.log(safeRandom()));
   const scoreWeight = (weight: number): number => (scale === 0 ? 0 : Math.log(weight) * scale) + gumbel();

   if (weights instanceof Map) {
      let bestValue: T | undefined;
      let bestScore = -Infinity;
      let found = false;
      for (const [value, weight] of weights.entries()) {
         if (weight <= 0) continue;
         const score = scoreWeight(weight);
         if (!found || score > bestScore) {
            bestScore = score;
            bestValue = value;
            found = true;
         }
      }
      return found ? bestValue : undefined;
   }

   let bestValue: T | undefined = weights[0]?.value;
   let bestScore = -Infinity;
   let found = false;
   for (const entry of weights) {
      if (entry.weight <= 0) continue;
      const score = scoreWeight(entry.weight);
      if (!found || score > bestScore) {
         bestScore = score;
         bestValue = entry.value;
         found = true;
      }
   }
   return found ? bestValue : weights[0]?.value;
};

const escapeRegExp = (rxString: string): string => RegExp.escape(rxString);

const memoizedRX: Map<string, RegExp> = new Map<string, RegExp>();

const newRX = (expr: string, flags?: string): RegExp => {
   const key = `${flags ?? ""}::${expr}`;
   if (!memoizedRX.has(key)) {
      const rx = flags ? new RegExp(expr, flags) : new RegExp(expr);
      memoizedRX.set(key, rx);
      return rx;
   }
   return memoizedRX.get(key) as RegExp;
}

const isTruthyEnv = (value: string | undefined): boolean => Boolean(value && /^(1|true|yes|on)$/i.test(value));
const envFlag = (envVar: string, defaultValue: boolean = false): boolean => {
   const fallback = defaultValue ? "true" : "";
   return isTruthyEnv(env(envVar, fallback));
};

const requireEnv = (envVar: string): string => {
   const value = env(envVar);
   if (!value) throw new Error(`Missing env var: ${envVar}`);
   return value;
};

const getBotName = (fallback: string = "anonymous"): string => {
   const configured = (env("BOT_NAME") ?? "").trim();
   return configured || fallback;
};

const DEBUG =
   env("NODE_ENV", "development") === "development"
   || envFlag("DEBUG")
   || envFlag("TRACE_FLOW")
   || envFlag("DISCORD_DEBUG")
   || envFlag("TRACE_CALLSITE");

export { initEnvConfig, env, envFlag, requireEnv, getBotName, checkFilePath, escapeRegExp, newRX, clamp, randFrom, weightedRandFrom, DEBUG };
