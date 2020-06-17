"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveBigJSON = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/*
   Simple hack, not very flexible. Writes:
   {
      [key]: { [value] }[,]
   }
   One key at a time.
*/
const saveBigJSON = (file, object) => {
    // Ensure path is ok to write to
    if (!path.resolve(path.dirname(file)))
        throw new Error(`Unable to resolve path for ${file}`);
    try {
        // Create writeable stream 
        const ws = fs.createWriteStream(file);
        ws.write("{");
        // Analyze object
        if (typeof object !== "object")
            throw new Error(`Cannot save object of type ${typeof object}`);
        const objectSize = Object.keys(object).length;
        let currentPosition = 1;
        let dataSize = 1;
        for (const [key, value] of Object.entries(object)) {
            const isLastElement = (currentPosition >= objectSize);
            const data = JSON.stringify(value);
            ws.write(`"${key}":${data}`);
            if (!isLastElement)
                ws.write(",");
            currentPosition++;
            dataSize += (key.length + 3 + data.length + 1);
        }
        console.log(`Saved ${dataSize} bytes to ${file}`);
        ws.write("}");
        // Close stream
        ws.close();
    }
    catch (e) {
        throw new Error(`Error saving to ${file}: ${e}`);
    }
};
exports.saveBigJSON = saveBigJSON;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2F2ZUJpZ0pTT04uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29yZS9zYXZlQmlnSlNPTi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUU3Qjs7Ozs7O0VBTUU7QUFFRixNQUFNLFdBQVcsR0FBRyxDQUFDLElBQVksRUFBRSxNQUFXLEVBQUUsRUFBRTtJQUUvQyxnQ0FBZ0M7SUFDaEMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsOEJBQThCLElBQUksRUFBRSxDQUFDLENBQUM7SUFFN0YsSUFBSTtRQUNELDJCQUEyQjtRQUMzQixNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdEMsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUVkLGlCQUFpQjtRQUNqQixJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVE7WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLDhCQUE4QixPQUFPLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFFL0YsTUFBTSxVQUFVLEdBQVcsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFDdEQsSUFBSSxlQUFlLEdBQVcsQ0FBQyxDQUFDO1FBQ2hDLElBQUksUUFBUSxHQUFXLENBQUMsQ0FBQztRQUV6QixLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUNoRCxNQUFNLGFBQWEsR0FBWSxDQUFDLGVBQWUsSUFBSSxVQUFVLENBQUMsQ0FBQztZQUMvRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25DLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEtBQUssSUFBSSxFQUFFLENBQUMsQ0FBQztZQUM3QixJQUFJLENBQUMsYUFBYTtnQkFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2xDLGVBQWUsRUFBRSxDQUFDO1lBQ2xCLFFBQVEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7U0FDakQ7UUFFRCxPQUFPLENBQUMsR0FBRyxDQUFDLFNBQVMsUUFBUSxhQUFhLElBQUksRUFBRSxDQUFDLENBQUM7UUFFbEQsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNkLGVBQWU7UUFDZixFQUFFLENBQUMsS0FBSyxFQUFFLENBQUM7S0FFYjtJQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQ1QsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7S0FDbkQ7QUFDSixDQUFDLENBQUE7QUFFUSxrQ0FBVyJ9