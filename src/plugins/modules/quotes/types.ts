import type { CoreMessage } from "../../../platform";
import type { ModificationType, TriggerResult } from "../../../core/triggerTypes";
import type { PluginCommand } from "../../types";

export type QuoteStyle = {
   prefix?: string;
   suffix?: string;
   wrap?: string;
};

export type QuoteHelpers = {
   getQuotes: (fileName: string) => string[];
   randomQuote: (quotes: string[]) => string;
   applyStyle: (quote: string, style?: QuoteStyle) => string;
   defaultModifications: ModificationType;
};

export type QuoteSource = {
   id: string;
   name: string;
   description: string;
   matcher?: RegExp;
   fileName?: string;
   icon?: string;
   style?: QuoteStyle;
   modifications?: ModificationType;
   command?: PluginCommand;
   resolveQuote?: (context: CoreMessage, match: RegExpMatchArray | undefined, helpers: QuoteHelpers) => Promise<TriggerResult> | TriggerResult;
};
