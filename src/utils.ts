import * as AppRootPath from "app-root-path";
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

export { env, checkFilePath };