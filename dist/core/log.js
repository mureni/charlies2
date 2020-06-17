"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = void 0;
const winston_1 = require("winston");
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const config_1 = require("../config");
const { combine, colorize, timestamp, printf } = winston_1.format;
const DEBUG = process.env.NODE_ENV === "development";
const outputFormat = combine(timestamp(), printf(info => `[${info.timestamp} - ${info.level}] ${info.message}`));
class Logger {
    static log(message = '', type = (DEBUG ? 'debug' : 'general')) {
        if (message === '')
            return;
        message = message.normalize();
        switch (type) {
            case 'error':
                Logger.output.error(message);
                if (DEBUG)
                    throw new Error(message);
                break;
            case 'warn':
                Logger.output.warn(message);
                break;
            case 'general':
                Logger.output.info(message);
                break;
            case 'debug':
            default:
                if (DEBUG)
                    Logger.output.info(message);
                break;
        }
        return;
    }
}
Logger.output = winston_1.createLogger({
    format: outputFormat,
    transports: [
        new (winston_daily_rotate_file_1.default)({
            dirname: config_1.checkFilePath("logs"),
            filename: "general-%DATE%.log",
            datePattern: "YYYY-MM-DD-HH",
            zippedArchive: true,
            maxSize: '5m',
            maxFiles: '30d'
        }),
        new (winston_daily_rotate_file_1.default)({
            level: 'error',
            dirname: config_1.checkFilePath("logs"),
            filename: "error-%DATE%.log",
            datePattern: "YYYY-MM-DD-HH",
            zippedArchive: true,
            maxSize: '5m',
            maxFiles: '30d'
        })
    ]
});
if (DEBUG)
    Logger.output.add(new winston_1.transports.Console({ format: combine(colorize(), outputFormat) }));
const log = Logger.log;
exports.log = log;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvcmUvbG9nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLHFDQUEyRDtBQUMzRCwwRkFBd0Q7QUFDeEQsc0NBQTBDO0FBQzFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsR0FBRyxnQkFBTSxDQUFDO0FBRXhELE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxLQUFLLGFBQWEsQ0FBQztBQUNyRCxNQUFNLFlBQVksR0FBRyxPQUFPLENBQ3pCLFNBQVMsRUFBRSxFQUNYLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsTUFBTSxJQUFJLENBQUMsS0FBSyxLQUFLLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUN2RSxDQUFBO0FBR0QsTUFBTSxNQUFNO0lBd0JGLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBa0IsRUFBRSxFQUFFLE9BQWdCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUNsRixJQUFJLE9BQU8sS0FBSyxFQUFFO1lBQUUsT0FBTztRQUMzQixPQUFPLEdBQUcsT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQzlCLFFBQVEsSUFBSSxFQUFFO1lBQ1gsS0FBSyxPQUFPO2dCQUNULE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUM3QixJQUFJLEtBQUs7b0JBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDcEMsTUFBTTtZQUNULEtBQUssTUFBTTtnQkFDUixNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDNUIsTUFBTTtZQUNULEtBQUssU0FBUztnQkFDWCxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDNUIsTUFBTTtZQUNULEtBQUssT0FBTyxDQUFDO1lBQ2I7Z0JBQ0csSUFBSSxLQUFLO29CQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUN2QyxNQUFNO1NBQ1g7UUFDRCxPQUFPO0lBQ1YsQ0FBQzs7QUEzQ2EsYUFBTSxHQUFHLHNCQUFZLENBQUM7SUFDakMsTUFBTSxFQUFFLFlBQVk7SUFDcEIsVUFBVSxFQUFFO1FBQ1QsSUFBSSxDQUFDLG1DQUFlLENBQUMsQ0FBQztZQUNuQixPQUFPLEVBQUUsc0JBQWEsQ0FBQyxNQUFNLENBQUM7WUFDOUIsUUFBUSxFQUFFLG9CQUFvQjtZQUM5QixXQUFXLEVBQUUsZUFBZTtZQUM1QixhQUFhLEVBQUUsSUFBSTtZQUNuQixPQUFPLEVBQUUsSUFBSTtZQUNiLFFBQVEsRUFBRSxLQUFLO1NBQ2pCLENBQUM7UUFDRixJQUFJLENBQUMsbUNBQWUsQ0FBQyxDQUFDO1lBQ25CLEtBQUssRUFBRSxPQUFPO1lBQ2QsT0FBTyxFQUFFLHNCQUFhLENBQUMsTUFBTSxDQUFDO1lBQzlCLFFBQVEsRUFBRSxrQkFBa0I7WUFDNUIsV0FBVyxFQUFFLGVBQWU7WUFDNUIsYUFBYSxFQUFFLElBQUk7WUFDbkIsT0FBTyxFQUFFLElBQUk7WUFDYixRQUFRLEVBQUUsS0FBSztTQUNqQixDQUFDO0tBRUo7Q0FDSCxDQUFDLENBQUM7QUF3Qk4sSUFBSSxLQUFLO0lBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxvQkFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsUUFBUSxFQUFFLEVBQUUsWUFBWSxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEcsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQztBQUVkLGtCQUFHIn0=