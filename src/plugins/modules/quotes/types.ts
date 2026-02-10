import type { StandardMessage } from "@/contracts";
import type { ModificationType, InteractionResult } from "@/core/interactionTypes";
import type { PluginCommand } from "@/plugins/types";

export interface QuoteStyle {
   prefix?: string;
   suffix?: string;
   wrap?: string;
}

export interface QuoteHelpers {
   getQuotes: (fileName: string) => string[];
   randomQuote: (quotes: string[]) => string;
   applyStyle: (quote: string, style?: QuoteStyle) => string;
   defaultModifications: ModificationType;
}

export interface QuoteSource {
   id: string;
   name: string;
   description: string;
   matcher?: RegExp;
   fileName?: string;
   icon?: string;
   style?: QuoteStyle;
   modifications?: ModificationType;
   command?: PluginCommand;
   resolveQuote?: (context: StandardMessage, match: RegExpMatchArray | undefined, helpers: QuoteHelpers) => Promise<InteractionResult> | InteractionResult;
}
