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

// Note: the second .replace() is necessary to handle the dash/hyphen (-) in unicode strings 
const escapeRegExp = (rxString: string) => rxString.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');

const memoizedRX: Map<string, RegExp> = new Map<string, RegExp>();

const newRX = (expr: string, flags?: string) => {
   if (!memoizedRX.has(expr)) {
      const rx = flags ? new RegExp(expr, flags) : new RegExp(expr);
      memoizedRX.set(expr, rx);
      return rx;
   } else {
      return memoizedRX.get(expr) as RegExp;
   }   
}

export { env, checkFilePath, escapeRegExp, newRX, clamp, randFrom };