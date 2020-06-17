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
        throw new Error(`Unable to locate path ${fullPath} (Original path: ${ORIGINAL_PATH})`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2NvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwrQkFBK0I7QUFDL0IsMkJBQXVEO0FBQ3ZELE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUVwQyxNQUFNLGFBQWEsR0FBRyxDQUFDLE9BQWlDLE1BQU0sRUFBRSxPQUFlLEVBQUUsRUFBRSxhQUFzQixJQUFJLEVBQUUsRUFBRTtJQUM5RyxNQUFNLFFBQVEsR0FBVyxJQUFJLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUV6RCxxREFBcUQ7SUFDckQsT0FBTyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUM3Qix5SEFBeUg7SUFFekgsSUFBSSxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ3hCLE9BQU8sR0FBRyxLQUFLLEdBQUcsRUFBRTtRQUNqQixJQUFJLGVBQVUsQ0FBQyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQUUsTUFBTTtRQUN2QyxJQUFJO1lBQ0QsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUN0QjtRQUFDLE9BQU8sS0FBSyxFQUFFO1lBQ2IsTUFBTSxJQUFJLEtBQUssQ0FBQyx3Q0FBd0MsR0FBRyxLQUFLLEtBQUssb0JBQW9CLGFBQWEsR0FBRyxDQUFDLENBQUM7U0FDN0c7UUFDRCxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO0tBQ3RCO0lBQ0QsTUFBTSxRQUFRLEdBQUcsY0FBTyxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUN4QyxJQUFJLENBQUMsZUFBVSxDQUFDLFFBQVEsQ0FBQztRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLFFBQVEsb0JBQW9CLGFBQWEsR0FBRyxDQUFDLENBQUM7SUFFbEgsd0RBQXdEO0lBQ3hELE1BQU0sV0FBVyxHQUFHLENBQUMsUUFBUSxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxjQUFTLENBQUMsSUFBSSxHQUFHLGNBQVMsQ0FBQyxJQUFJLENBQUM7SUFDN0YsSUFBSTtRQUNELGVBQVUsQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUM7S0FDcEM7SUFBQyxPQUFPLEtBQUssRUFBRTtRQUNiLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLFFBQVEsS0FBSyxLQUFLLG9CQUFvQixhQUFhLEdBQUcsQ0FBQyxDQUFDO0tBQ25HO0lBRUQsSUFBSSxJQUFJLEtBQUssRUFBRTtRQUFFLE9BQU8sUUFBUSxDQUFDO0lBRWpDLE1BQU0sUUFBUSxHQUFHLGNBQU8sQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDekMsSUFBSSxDQUFDLFVBQVUsSUFBSSxDQUFDLGVBQVUsQ0FBQyxRQUFRLENBQUM7UUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixRQUFRLG9CQUFvQixhQUFhLEdBQUcsQ0FBQyxDQUFDO0lBRWpJLE9BQU8sUUFBUSxDQUFDO0FBQ25CLENBQUMsQ0FBQTtBQWtCZ0Isc0NBQWE7QUFmOUIsTUFBTSxNQUFNLEdBQUc7SUFDWixPQUFPLEVBQUUsb0JBQW9CO0lBQzdCLElBQUksRUFBRSxVQUFVO0lBQ2hCLGVBQWUsRUFBRTtRQUNkLGlCQUFpQixFQUFFLEtBQUs7UUFDeEIsYUFBYSxFQUFFLENBQUM7UUFDaEIsVUFBVSxFQUFFLEdBQUc7UUFDZixhQUFhLEVBQUUsSUFBSTtRQUNuQixhQUFhLEVBQUUsRUFBRTtRQUNqQixTQUFTLEVBQUUsQ0FBQztRQUNaLHFCQUFxQixFQUFFLENBQUM7UUFDeEIsd0JBQXdCLEVBQUUsR0FBRztRQUM3QixhQUFhLEVBQUUsS0FBSyxDQUFXLHNDQUFzQztLQUN2RTtDQUNILENBQUE7QUFDUSx3QkFBTSJ9