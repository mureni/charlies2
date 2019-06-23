import { resolve } from "path";
import { existsSync } from "fs";

const rootPath = (type: "code" | "data" | "logs" = "code", path: string = "./") => {
   
   let typePath: string = type === "code" ? "dist" : type;   
   const fullPath = resolve(process.cwd(), typePath, path);
   if (!existsSync(fullPath)) throw new Error(`Unable to locate path ${fullPath}`);
   return fullPath;
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
   }
}
export { CONFIG, rootPath };