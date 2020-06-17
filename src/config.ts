import { resolve } from "path";
import { constants, existsSync, accessSync } from "fs";
const ORIGINAL_PATH = process.cwd();

const checkFilePath = (path: "code" | "data" | "logs" = "code", file: string = "", createFile: boolean = true) => {
   const typePath: string = path === "code" ? "dist" : path;   
  
   /* Reset path to original path determined at start */
   process.chdir(ORIGINAL_PATH);
   /* In case code is being called from a 'tools' or other directory, move up until either root, error, or found the file */

   let cwd = process.cwd();
   while (cwd !== "/") {
      if (existsSync(`./${typePath}`)) break;
      try {
         process.chdir("..");
      } catch (error) {
         throw new Error(`Unable to navigate to parent of path ${cwd}: ${error} (Original path: ${ORIGINAL_PATH})`);         
      }
      cwd = process.cwd();
   }
   const fullPath = resolve(cwd, typePath);
   if (!existsSync(fullPath)) throw new Error(`Unable to locate path ${fullPath} (Original path: ${ORIGINAL_PATH})`);

   /* Determine appropriate access for the selected path */
   const accessFlags = (typePath === "dist") ? constants.R_OK : constants.R_OK | constants.W_OK;
   try {
      accessSync(fullPath, accessFlags);
   } catch (error) {
      throw new Error(`Unable to access path ${fullPath}: ${error} (Original path: ${ORIGINAL_PATH})`);
   }
   
   if (file === "") return fullPath;

   const filePath = resolve(fullPath, file);
   if (!createFile && !existsSync(filePath)) throw new Error(`Unable to locate file ${filePath} (Original path: ${ORIGINAL_PATH})`);
   
   return filePath;
}


const CONFIG = {   
   ownerID: "459555796506771456",
   name: "charlies",
   initialSettings: {            
      outburstThreshold: 0.005,      /* 0..1 chance of speaking without being spoken to */
      numberOfLines: 1,              /* # of lines to speak at once */
      angerLevel: 0.5,               /* 0..1 chance of yelling (initially) */
      angerIncrease: 1.75,           /* multiplier to increase anger if yelled at */
      angerDecrease: .8,             /* multiplier to decrease anger if not yelled at */
      recursion: 1,                  /* # of times to think about a line before responding */
      conversationTimeLimit: 3,      /* number of seconds to wait for a response */
      conversationMemoryLength: 600, /* number of seconds before forgetting a topic */
      learnFromBots: false           /* Whether to learn from other bots */
   }
}
export { CONFIG, checkFilePath };