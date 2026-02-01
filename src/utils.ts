import AppRootPath from "app-root-path";
import { resolve } from "path";
import { mkdirSync, existsSync, accessSync, constants } from "fs";

const rootPath = AppRootPath.toString();
const distPath = resolve(rootPath, "dist");


const checkFilePath = (path: "code" | "resources" | "data" | "logs" = "code", file: string = "", createFile: boolean = true) => {
   const typePath: string = path === "code" ? distPath : path;
  
   /* Reset path to original path determined at start */
   process.chdir(rootPath);

   const fullPath = resolve(rootPath, typePath);
   if (!existsSync(fullPath)) {
      if (!createFile) throw new Error(`Unable to locate path ${fullPath} (Original path: ${rootPath})`);
      mkdirSync(fullPath, { recursive: true });
   }

   /* Determine appropriate access for the selected path -- only look for read access for ./dist */
   const accessFlags = (typePath === distPath) ? constants.R_OK : constants.R_OK | constants.W_OK;
   try {
      accessSync(fullPath, accessFlags);
   } catch (error) {
      throw new Error(`Unable to access path ${fullPath}: ${error} (Original path: ${rootPath})`);
   }
   
   if (file === "") return fullPath;

   const filePath = resolve(fullPath, file);
   if (!createFile && !existsSync(filePath)) throw new Error(`Unable to locate file ${filePath} (Original path: ${rootPath})`);
   
   return filePath;
}

const env = (envVar: string, defaultValue: string = "") => {
   if (envVar in process.env) return process.env[envVar];
   return defaultValue;
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
function randFrom<T>(array: T[]): T { return array[Math.floor(Math.random() * array.length)] };
interface WeightedValue<T> { value: T; weight: number }
const weightedRandFrom = <T>(weights: Map<T, number> | WeightedValue<T>[], rng: () => number = Math.random): T | undefined => {
   if (weights instanceof Map) {
      let total = 0;
      for (const weight of weights.values()) {
         if (weight > 0) total += weight;
      }
      if (total <= 0) return undefined;
      let target = rng() * total;
      for (const [value, weight] of weights.entries()) {
         if (weight <= 0) continue;
         target -= weight;
         if (target <= 0) return value;
      }
      return Array.from(weights.keys())[0];
   }
   let total = 0;
   for (const entry of weights) {
      if (entry.weight > 0) total += entry.weight;
   }
   if (total <= 0) return weights[0]?.value;
   let target = rng() * total;
   for (const entry of weights) {
      if (entry.weight <= 0) continue;
      target -= entry.weight;
      if (target <= 0) return entry.value;
   }
   return weights[0]?.value;
};

const escapeRegExp = (rxString: string): string => RegExp.escape(rxString);

const memoizedRX: Map<string, RegExp> = new Map<string, RegExp>();

const newRX = (expr: string, flags?: string) => {
   const key = `${flags ?? ""}::${expr}`;
   if (!memoizedRX.has(key)) {
      const rx = flags ? new RegExp(expr, flags) : new RegExp(expr);
      memoizedRX.set(key, rx);
      return rx;
   }
   return memoizedRX.get(key) as RegExp;
}

const isTruthyEnv = (value: string | undefined) => Boolean(value && /^(1|true|yes|on)$/i.test(value));
const DEBUG =
   env("NODE_ENV", "development") === "development"
   || isTruthyEnv(env("DEBUG"))
   || isTruthyEnv(env("TRACE_FLOW"))
   || isTruthyEnv(env("DISCORD_DEBUG"))
   || isTruthyEnv(env("TRACE_CALLSITE"));

export { env, checkFilePath, escapeRegExp, newRX, clamp, randFrom, weightedRandFrom, DEBUG };
