import { createLogger, format, transports } from "winston";
const { combine, colorize, timestamp, printf } = format;
const DEBUG = process.env.NODE_ENV === "development";

const outputFormat = combine(
   colorize(),
   timestamp(),
   printf(info => `[${info.timestamp} - ${info.level}] ${info.message}`)
)

const logger = createLogger({
   format: outputFormat,
   transports: [      
      new transports.File({
         filename: "../logs/general.log",
         level: "info"
      })
   ]
});

if (DEBUG) logger.add(new transports.Console({format: outputFormat}));

type LogType = 'debug' | 'error' | 'warn' | 'general';
const log = (message: string = '', type: LogType = (DEBUG ? 'debug' : 'general')) => {
   if (message === '') return;   
   message = message.normalize();
   switch (type) {      
      case 'error': 
         logger.error(message);
         throw new Error(message);
      case 'warn': 
         logger.warn(message);
         break;
      case 'general': 
         logger.info(message);
         break;
      case 'debug':
      default:
         if (DEBUG) logger.info(message);
         break;                
   }     
   return;
}

export default log;