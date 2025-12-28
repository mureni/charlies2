import winston from "winston";
const { createLogger, format, transports } = winston;
import { DEBUG, env } from "../utils";
import util from "util";
const { combine, colorize, timestamp, printf } = format;



winston.addColors({
   debug: "magenta",
   trace: "cyan"
});

const outputFormat = combine(   
   timestamp(),
   printf(info => `[${info.timestamp} - ${info.level}] ${info.message}`)
)   

export type LogType = 'trace' | 'debug' | 'error' | 'warn' | 'general';
const TRACE_FLOW = /^(1|true|yes|on)$/i.test(env("TRACE_FLOW") ?? "");
const TRACE_CALLSITE = /^(1|true|yes|on)$/i.test(env("TRACE_CALLSITE") ?? "");
const LOG_LEVEL = env("LOG_LEVEL", (TRACE_FLOW ? "trace" : (DEBUG ? "debug" : "info")));
const RESOLVED_LOG_LEVEL = LOG_LEVEL === "general" ? "info" : LOG_LEVEL;

const formatMessage = (message: unknown): string => {
   if (message instanceof Error) return message.stack ?? message.message;
   if (typeof message === "string") return message;
   return util.inspect(message, { depth: 4, breakLength: 120, compact: false });
};

const getCallsite = (): string | undefined => {
   const stack = new Error().stack;
   if (!stack) return undefined;
   const lines = stack.split("\n").slice(2);
   for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("at ")) continue;
      if (trimmed.includes("core/log") || trimmed.includes("node:internal") || trimmed.includes("node_modules")) continue;
      if (/\btrace\b/.test(trimmed)) continue;
      const match = trimmed.match(/\(([^)]+)\)/) ?? trimmed.match(/^at (.+)$/);
      if (match && match[1]) return match[1];
   }
   return undefined;
};

class Logger {
   public static output = createLogger({
      levels: {
         error: 0,
         warn: 1,
         info: 2,
         debug: 3,
         trace: 4
      },
      level: RESOLVED_LOG_LEVEL,
      format: outputFormat,
      transports: [
         new transports.Console({
            format: combine(colorize(), outputFormat)
         })
      ]
   });
   public static log(message: unknown = '', type: LogType = (DEBUG ? 'debug' : 'general')) {
      if (message === '') return;   
      let outputMessage = formatMessage(message).normalize();
      switch (type) {      
         case 'error': 
            Logger.output.error(outputMessage);            
            break;
         case 'warn': 
            Logger.output.warn(outputMessage);
            break;
         case 'debug':
            if (TRACE_CALLSITE) {
               const callsite = getCallsite();
               if (callsite) outputMessage = `${outputMessage} [${callsite}]`;
            }
            Logger.output.debug(outputMessage);
            break;
         case 'trace':
            if (TRACE_CALLSITE) {
               const callsite = getCallsite();
               if (callsite) outputMessage = `${outputMessage} [${callsite}]`;
            }
            Logger.output.log("trace", outputMessage);
            break;
         case 'general':                  
         default:            
            Logger.output.info(outputMessage);
            break;                
      }     
      return;
   } 
}

const log = Logger.log;

export { log };
