import winston from "winston";
const { createLogger, format, transports } = winston;
import { env } from "../utils";
const { combine, colorize, timestamp, printf } = format;

const DEBUG = env("NODE_ENV", "development") === "development";

const outputFormat = combine(   
   timestamp(),
   printf(info => `[${info.timestamp} - ${info.level}] ${info.message}`)
)   

export type LogType = 'debug' | 'error' | 'warn' | 'general';

class Logger {
   public static output = createLogger({
      levels: winston.config.npm.levels,  
      format: outputFormat,
      transports: [
         new transports.Console({
            format: combine(colorize(), outputFormat)
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
         case 'debug':
            Logger.output.info(message);
            break;
         case 'general':                  
         default:            
            Logger.output.info(message);
            break;                
      }     
      return;
   } 
}

const log = Logger.log;

export { log };