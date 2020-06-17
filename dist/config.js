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
    if (process.env.NODE_ENV === "development") {
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
    }
    const fullPath = path_1.resolve(cwd, typePath);
    if (!fs_1.existsSync(fullPath)) {
        if (!createFile)
            throw new Error(`Unable to locate path ${fullPath} (CWD: ${cwd} | Original path: ${ORIGINAL_PATH})`);
        fs_1.mkdirSync(fullPath, { recursive: true });
    }
    /* Determine appropriate access for the selected path */
    const accessFlags = (typePath === "dist") ? fs_1.constants.R_OK : fs_1.constants.R_OK | fs_1.constants.W_OK;
    try {
        fs_1.accessSync(fullPath, accessFlags);
    }
    catch (error) {
        throw new Error(`Unable to access path ${fullPath}: ${error} (CWD: ${cwd} | Original path: ${ORIGINAL_PATH})`);
    }
    if (file === "")
        return fullPath;
    const filePath = path_1.resolve(fullPath, file);
    if (!createFile && !fs_1.existsSync(filePath))
        throw new Error(`Unable to locate file ${filePath} (CWD: ${cwd} | Original path: ${ORIGINAL_PATH})`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2NvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwrQkFBK0I7QUFDL0IsMkJBQWtFO0FBQ2xFLE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUVwQyxNQUFNLGFBQWEsR0FBRyxDQUFDLE9BQWlDLE1BQU0sRUFBRSxPQUFlLEVBQUUsRUFBRSxhQUFzQixJQUFJLEVBQUUsRUFBRTtJQUM5RyxNQUFNLFFBQVEsR0FBVyxJQUFJLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUV6RCxxREFBcUQ7SUFDckQsT0FBTyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUM3Qix5SEFBeUg7SUFFekgsSUFBSSxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ3hCLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssYUFBYSxFQUFFO1FBQ3pDLE9BQU8sR0FBRyxLQUFLLEdBQUcsRUFBRTtZQUNqQixJQUFJLGVBQVUsQ0FBQyxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUFFLE1BQU07WUFDdkMsSUFBSTtnQkFDRCxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ3RCO1lBQUMsT0FBTyxLQUFLLEVBQUU7Z0JBQ2IsTUFBTSxJQUFJLEtBQUssQ0FBQyx3Q0FBd0MsR0FBRyxLQUFLLEtBQUssb0JBQW9CLGFBQWEsR0FBRyxDQUFDLENBQUM7YUFDN0c7WUFDRCxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO1NBQ3RCO0tBQ0g7SUFDRCxNQUFNLFFBQVEsR0FBRyxjQUFPLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ3hDLElBQUksQ0FBQyxlQUFVLENBQUMsUUFBUSxDQUFDLEVBQUU7UUFDeEIsSUFBSSxDQUFDLFVBQVU7WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixRQUFRLFVBQVUsR0FBRyxxQkFBcUIsYUFBYSxHQUFHLENBQUMsQ0FBQztRQUN0SCxjQUFTLENBQUMsUUFBUSxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7S0FDM0M7SUFFRCx3REFBd0Q7SUFDeEQsTUFBTSxXQUFXLEdBQUcsQ0FBQyxRQUFRLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLGNBQVMsQ0FBQyxJQUFJLEdBQUcsY0FBUyxDQUFDLElBQUksQ0FBQztJQUM3RixJQUFJO1FBQ0QsZUFBVSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQztLQUNwQztJQUFDLE9BQU8sS0FBSyxFQUFFO1FBQ2IsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsUUFBUSxLQUFLLEtBQUssVUFBVSxHQUFHLHFCQUFxQixhQUFhLEdBQUcsQ0FBQyxDQUFDO0tBQ2pIO0lBRUQsSUFBSSxJQUFJLEtBQUssRUFBRTtRQUFFLE9BQU8sUUFBUSxDQUFDO0lBRWpDLE1BQU0sUUFBUSxHQUFHLGNBQU8sQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDekMsSUFBSSxDQUFDLFVBQVUsSUFBSSxDQUFDLGVBQVUsQ0FBQyxRQUFRLENBQUM7UUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixRQUFRLFVBQVUsR0FBRyxxQkFBcUIsYUFBYSxHQUFHLENBQUMsQ0FBQztJQUUvSSxPQUFPLFFBQVEsQ0FBQztBQUNuQixDQUFDLENBQUE7QUFrQmdCLHNDQUFhO0FBZjlCLE1BQU0sTUFBTSxHQUFHO0lBQ1osT0FBTyxFQUFFLG9CQUFvQjtJQUM3QixJQUFJLEVBQUUsVUFBVTtJQUNoQixlQUFlLEVBQUU7UUFDZCxpQkFBaUIsRUFBRSxLQUFLO1FBQ3hCLGFBQWEsRUFBRSxDQUFDO1FBQ2hCLFVBQVUsRUFBRSxHQUFHO1FBQ2YsYUFBYSxFQUFFLElBQUk7UUFDbkIsYUFBYSxFQUFFLEVBQUU7UUFDakIsU0FBUyxFQUFFLENBQUM7UUFDWixxQkFBcUIsRUFBRSxDQUFDO1FBQ3hCLHdCQUF3QixFQUFFLEdBQUc7UUFDN0IsYUFBYSxFQUFFLEtBQUssQ0FBVyxzQ0FBc0M7S0FDdkU7Q0FDSCxDQUFBO0FBQ1Esd0JBQU0ifQ==