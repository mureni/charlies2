export type SwapScope = "user" | "group" | "guild" | "channel";
export type SwapMode = "word" | "regex";

export interface SwapRule {
   id: string;
   scope: SwapScope;
   scopeId: string;
   pattern: string;
   replacement: string;
   mode: SwapMode;
   caseSensitive: boolean;
   applyLearn: boolean;
   applyRespond: boolean;
   enabled: boolean;
   createdAt: string;
   updatedAt: string;
}

export interface SwapScopeRecord {
   scope: SwapScope;
   scopeId: string;
   rules: SwapRule[];
}

export interface SwapGroup {
   id: string;
   name: string;
   members: string[];
   notes?: string;
}
