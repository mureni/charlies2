"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFilePath = exports.CONFIG = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
const ORIGINAL_PATH = process.cwd();
const checkFilePath = (path = "code", file = "", createFile = true) => {
    const typePath = path === "code" ? "dist" : path;
    /* Reset path to original path determined at start */
    process.chdir(ORIGINAL_PATH);
    /* In case code is being called from a 'tools' or other directory, move up until either root, error, or found the file */
    let cwd = process.cwd();
    while (cwd !== "/") {
        if (fs_1.existsSync(`./${typePath}`))
            break;
        try {
            process.chdir("..");
        }
        catch (error) {
            throw new Error(`Unable to navigate to parent of path ${cwd}: ${error} (Original path: ${ORIGINAL_PATH})`);
        }
        cwd = process.cwd();
    }
    const fullPath = path_1.resolve(cwd, typePath);
    if (!fs_1.existsSync(fullPath))
        throw new Error(`Unable to locate path ${fullPath} (CWD: ${cwd} | Original path: ${ORIGINAL_PATH})`);
    /* Determine appropriate access for the selected path */
    const accessFlags = (typePath === "dist") ? fs_1.constants.R_OK : fs_1.constants.R_OK | fs_1.constants.W_OK;
    try {
        fs_1.accessSync(fullPath, accessFlags);
    }
    catch (error) {
        throw new Error(`Unable to access path ${fullPath}: ${error} (Original path: ${ORIGINAL_PATH})`);
    }
    if (file === "")
        return fullPath;
    const filePath = path_1.resolve(fullPath, file);
    if (!createFile && !fs_1.existsSync(filePath))
        throw new Error(`Unable to locate file ${filePath} (Original path: ${ORIGINAL_PATH})`);
    return filePath;
};
exports.checkFilePath = checkFilePath;
const CONFIG = {
    ownerID: "459555796506771456",
    name: "charlies",
    initialSettings: {
        outburstThreshold: 0.005,
        numberOfLines: 1,
        angerLevel: 0.5,
        angerIncrease: 1.75,
        angerDecrease: .8,
        recursion: 1,
        conversationTimeLimit: 3,
        conversationMemoryLength: 600,
        learnFromBots: false /* Whether to learn from other bots */
    }
};
exports.CONFIG = CONFIG;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2NvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwrQkFBK0I7QUFDL0IsMkJBQXVEO0FBQ3ZELE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUVwQyxNQUFNLGFBQWEsR0FBRyxDQUFDLE9BQWlDLE1BQU0sRUFBRSxPQUFlLEVBQUUsRUFBRSxhQUFzQixJQUFJLEVBQUUsRUFBRTtJQUM5RyxNQUFNLFFBQVEsR0FBVyxJQUFJLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUV6RCxxREFBcUQ7SUFDckQsT0FBTyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUM3Qix5SEFBeUg7SUFFekgsSUFBSSxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ3hCLE9BQU8sR0FBRyxLQUFLLEdBQUcsRUFBRTtRQUNqQixJQUFJLGVBQVUsQ0FBQyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQUUsTUFBTTtRQUN2QyxJQUFJO1lBQ0QsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUN0QjtRQUFDLE9BQU8sS0FBSyxFQUFFO1lBQ2IsTUFBTSxJQUFJLEtBQUssQ0FBQyx3Q0FBd0MsR0FBRyxLQUFLLEtBQUssb0JBQW9CLGFBQWEsR0FBRyxDQUFDLENBQUM7U0FDN0c7UUFDRCxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO0tBQ3RCO0lBQ0QsTUFBTSxRQUFRLEdBQUcsY0FBTyxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUN4QyxJQUFJLENBQUMsZUFBVSxDQUFDLFFBQVEsQ0FBQztRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLFFBQVEsVUFBVSxHQUFHLHFCQUFxQixhQUFhLEdBQUcsQ0FBQyxDQUFDO0lBRWhJLHdEQUF3RDtJQUN4RCxNQUFNLFdBQVcsR0FBRyxDQUFDLFFBQVEsS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsY0FBUyxDQUFDLElBQUksR0FBRyxjQUFTLENBQUMsSUFBSSxDQUFDO0lBQzdGLElBQUk7UUFDRCxlQUFVLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0tBQ3BDO0lBQUMsT0FBTyxLQUFLLEVBQUU7UUFDYixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixRQUFRLEtBQUssS0FBSyxvQkFBb0IsYUFBYSxHQUFHLENBQUMsQ0FBQztLQUNuRztJQUVELElBQUksSUFBSSxLQUFLLEVBQUU7UUFBRSxPQUFPLFFBQVEsQ0FBQztJQUVqQyxNQUFNLFFBQVEsR0FBRyxjQUFPLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3pDLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxlQUFVLENBQUMsUUFBUSxDQUFDO1FBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsUUFBUSxvQkFBb0IsYUFBYSxHQUFHLENBQUMsQ0FBQztJQUVqSSxPQUFPLFFBQVEsQ0FBQztBQUNuQixDQUFDLENBQUE7QUFrQmdCLHNDQUFhO0FBZjlCLE1BQU0sTUFBTSxHQUFHO0lBQ1osT0FBTyxFQUFFLG9CQUFvQjtJQUM3QixJQUFJLEVBQUUsVUFBVTtJQUNoQixlQUFlLEVBQUU7UUFDZCxpQkFBaUIsRUFBRSxLQUFLO1FBQ3hCLGFBQWEsRUFBRSxDQUFDO1FBQ2hCLFVBQVUsRUFBRSxHQUFHO1FBQ2YsYUFBYSxFQUFFLElBQUk7UUFDbkIsYUFBYSxFQUFFLEVBQUU7UUFDakIsU0FBUyxFQUFFLENBQUM7UUFDWixxQkFBcUIsRUFBRSxDQUFDO1FBQ3hCLHdCQUF3QixFQUFFLEdBQUc7UUFDN0IsYUFBYSxFQUFFLEtBQUssQ0FBVyxzQ0FBc0M7S0FDdkU7Q0FDSCxDQUFBO0FBQ1Esd0JBQU0ifQ==