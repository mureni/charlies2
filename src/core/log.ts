import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { checkFilePath } from "../utils";
const { combine, colorize, timestamp, printf } = format;

const DEBUG = process.env.NODE_ENV === "development";
const outputFormat = combine(   
   timestamp(),
   printf(info => `[${info.timestamp} - ${info.level}] ${info.message}`)
)   
type LogType = 'debug' | 'error' | 'warn' | 'general';

class Logger {
   public static output = createLogger({
      format: outputFormat,
      transports: [
         new (DailyRotateFile)({
            dirname: checkFilePath("logs"),
            filename: "general-%DATE%.log",
            datePattern: "YYYY-MM-DD-HH",
            zippedArchive: true,
            maxSize: '5m',
            maxFiles: '30d'
         }),
         new (DailyRotateFile)({
            level: 'error',
            dirname: checkFilePath("logs"),
            filename: "error-%DATE%.log",
            datePattern: "YYYY-MM-DD-HH",
            zippedArchive: true,
            maxSize: '5m',
            maxFiles: '30d'
         })

      ]
   });
   public static log(message: string = '', type: LogType = (DEBUG ? 'debug' : 'general')) {
      if (message === '') return;   
      message = message.normalize();
      switch (type) {      
         case 'error': 
            Logger.output.error(message);            
            break;
         case 'warn': 
            Logger.output.warn(message);
            break;
         case 'general': 
            Logger.output.info(message);
            break;
         case 'debug':
         default:
            if (DEBUG) Logger.output.info(message);
            break;                
      }     
      return;
   } 
}

if (DEBUG) Logger.output.add(new transports.Console({format: combine(colorize(), outputFormat)}));
const log = Logger.log;

export { log };