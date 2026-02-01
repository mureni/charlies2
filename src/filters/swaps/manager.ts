import { SQLiteMap } from "@/core/SQLiteCollections";
import type { CoreMessage } from "@/platform";
import { checkFilePath, env, escapeRegExp } from "@/utils";
import type { SwapGroup, SwapMode, SwapRule, SwapScope, SwapScopeRecord } from "./types";

const swapDbPath = checkFilePath("data", `${env("BOT_NAME")}-swaps.sqlite`);
const GROUP_DM_PREFIX = "dm:";

const createRuleId = (): string =>
   `swap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const normalizeScope = (scope: string): SwapScope | null => {
   const normalized = scope.trim().toLowerCase();
   if (normalized === "user") return "user";
   if (normalized === "group") return "group";
   if (normalized === "guild" || normalized === "server") return "guild";
   if (normalized === "channel") return "channel";
   return null;
};

const buildScopeKey = (scope: SwapScope, scopeId: string): string => `${scope}:${scopeId}`;

const buildWordRegex = (pattern: string, flags: string): RegExp | null => {
   const escaped = escapeRegExp(pattern);
   const source = `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`;
   try {
      return new RegExp(source, flags);
   } catch {
      try {
         return new RegExp(`\\b${escaped}\\b`, flags);
      } catch {
         return null;
      }
   }
};

const buildRuleRegex = (rule: SwapRule): RegExp | null => {
   if (!rule.pattern) return null;
   const flags = rule.caseSensitive ? "gu" : "giu";
   if (rule.mode === "regex") {
      try {
         return new RegExp(rule.pattern, flags);
      } catch {
         return null;
      }
   }
   return buildWordRegex(rule.pattern, flags);
};

class Swaps {
   private static rules = new SQLiteMap<string, SwapScopeRecord>({
      filename: swapDbPath,
      table: "swap_rules"
   });
   private static groups = new SQLiteMap<string, SwapGroup>({
      filename: swapDbPath,
      table: "swap_groups"
   });
   private static legacy = new SQLiteMap<string, Map<string, string>>({
      filename: swapDbPath,
      table: "swaps"
   });

   public static groupIdForDm(channelId: string): string {
      return `${GROUP_DM_PREFIX}${channelId}`;
   }

   public static listRules(options?: { scope?: SwapScope; scopeId?: string; query?: string }): SwapRule[] {
      const rules: SwapRule[] = [];
      for (const entry of Swaps.rules.values()) {
         if (options?.scope && entry.scope !== options.scope) continue;
         if (options?.scopeId && entry.scopeId !== options.scopeId) continue;
         rules.push(...entry.rules);
      }
      if (options?.query) {
         const query = options.query.toLowerCase();
         return rules.filter(rule =>
            rule.pattern.toLowerCase().includes(query)
            || rule.replacement.toLowerCase().includes(query)
            || rule.scopeId.toLowerCase().includes(query)
         );
      }
      return rules;
   }

   public static listGroups(): SwapGroup[] {
      return Array.from(Swaps.groups.values()).sort((a, b) => a.name.localeCompare(b.name));
   }

   public static saveGroup(payload: { id: string; name: string; members?: string[]; notes?: string }): SwapGroup {
      const id = payload.id.trim();
      const name = payload.name.trim();
      const existing = Swaps.groups.get(id);
      const group: SwapGroup = {
         id,
         name,
         members: payload.members ?? existing?.members ?? [],
         notes: payload.notes ?? existing?.notes
      };
      Swaps.groups.set(id, group);
      return group;
   }

   public static deleteGroup(id: string): boolean {
      return Swaps.groups.delete(id);
   }

   public static addGroupMember(id: string, memberId: string): boolean {
      const group = Swaps.groups.get(id);
      if (!group) return false;
      const trimmed = memberId.trim();
      if (!trimmed) return false;
      if (!group.members.includes(trimmed)) group.members.push(trimmed);
      Swaps.groups.set(id, group);
      return true;
   }

   public static removeGroupMember(id: string, memberId: string): boolean {
      const group = Swaps.groups.get(id);
      if (!group) return false;
      const trimmed = memberId.trim();
      const nextMembers = group.members.filter(member => member !== trimmed);
      group.members = nextMembers;
      Swaps.groups.set(id, group);
      return true;
   }

   public static saveRule(payload: {
      id?: string;
      scope: SwapScope;
      scopeId: string;
      pattern: string;
      replacement: string;
      mode?: SwapMode;
      caseSensitive?: boolean;
      applyLearn?: boolean;
      applyRespond?: boolean;
      enabled?: boolean;
   }): SwapRule | Error {
      const scopeId = payload.scopeId.trim();
      const pattern = payload.pattern.trim();
      if (!scopeId || !pattern) return new Error("scopeId and pattern are required");
      const scopeKey = buildScopeKey(payload.scope, scopeId);
      const record: SwapScopeRecord = Swaps.rules.get(scopeKey) ?? { scope: payload.scope, scopeId, rules: [] };
      const now = new Date().toISOString();
      const existingIndex = payload.id ? record.rules.findIndex(rule => rule.id === payload.id) : -1;
      const base: SwapRule = existingIndex >= 0 ? record.rules[existingIndex] : {
         id: payload.id ?? createRuleId(),
         scope: payload.scope,
         scopeId,
         pattern,
         replacement: payload.replacement,
         mode: payload.mode ?? "word",
         caseSensitive: payload.caseSensitive ?? false,
         applyLearn: payload.applyLearn ?? true,
         applyRespond: payload.applyRespond ?? true,
         enabled: payload.enabled ?? true,
         createdAt: now,
         updatedAt: now
      };
      const rule: SwapRule = {
         ...base,
         scope: payload.scope,
         scopeId,
         pattern,
         replacement: payload.replacement,
         mode: payload.mode ?? base.mode,
         caseSensitive: payload.caseSensitive ?? base.caseSensitive,
         applyLearn: payload.applyLearn ?? base.applyLearn,
         applyRespond: payload.applyRespond ?? base.applyRespond,
         enabled: payload.enabled ?? base.enabled,
         updatedAt: now
      };
      if (existingIndex >= 0) {
         record.rules[existingIndex] = rule;
      } else {
         record.rules.push(rule);
      }
      Swaps.rules.set(scopeKey, record);
      return rule;
   }

   public static deleteRule(scope: SwapScope, scopeId: string, ruleId: string): boolean {
      const scopeKey = buildScopeKey(scope, scopeId);
      const record = Swaps.rules.get(scopeKey);
      if (!record) return false;
      const nextRules = record.rules.filter(rule => rule.id !== ruleId);
      record.rules = nextRules;
      Swaps.rules.set(scopeKey, record);
      return true;
   }

   public static clearScope(scope: SwapScope, scopeId: string): void {
      const scopeKey = buildScopeKey(scope, scopeId);
      Swaps.rules.set(scopeKey, { scope, scopeId, rules: [] });
   }

   public static removeRulesByPattern(scope: SwapScope, scopeId: string, pattern: string): number {
      const scopeKey = buildScopeKey(scope, scopeId);
      const record = Swaps.rules.get(scopeKey);
      if (!record) return 0;
      const normalized = pattern.trim();
      const nextRules = record.rules.filter(rule => rule.pattern !== normalized);
      const removed = record.rules.length - nextRules.length;
      record.rules = nextRules;
      Swaps.rules.set(scopeKey, record);
      return removed;
   }

   private static collectLegacyRules(scope: SwapScope, scopeId: string): SwapRule[] {
      const legacyMap = Swaps.legacy.get(scopeId);
      if (!legacyMap || legacyMap.size === 0) return [];
      const now = new Date().toISOString();
      return Array.from(legacyMap.entries()).map(([pattern, replacement]) => ({
         id: createRuleId(),
         scope,
         scopeId,
         pattern,
         replacement: replacement === "<blank>" ? "" : replacement,
         mode: "word",
         caseSensitive: false,
         applyLearn: true,
         applyRespond: true,
         enabled: true,
         createdAt: now,
         updatedAt: now
      }));
   }

   private static getScopeRules(scope: SwapScope, scopeId: string): SwapRule[] {
      const record = Swaps.rules.get(buildScopeKey(scope, scopeId));
      if (!record) return [];
      return record.rules;
   }

   private static getApplicableGroupIds(context: CoreMessage): string[] {
      const groupIds = new Set<string>();
      if (context.channel?.isGroupDm) {
         groupIds.add(Swaps.groupIdForDm(context.channelId));
      }
      const authorId = context.authorId;
      if (authorId) {
         for (const group of Swaps.groups.values()) {
            if (group.members.includes(authorId)) groupIds.add(group.id);
         }
      }
      return Array.from(groupIds.values()).sort();
   }

   private static getApplicableRules(context: CoreMessage): SwapRule[] {
      const rules: SwapRule[] = [];
      const channelId = context.channelId;
      const guildId = context.guildId;
      const userId = context.authorId;

      // Highest precedence first: user -> group -> guild -> channel.
      if (userId) {
         rules.push(...Swaps.getScopeRules("user", userId));
         rules.push(...Swaps.collectLegacyRules("user", userId));
      }
      for (const groupId of Swaps.getApplicableGroupIds(context)) {
         rules.push(...Swaps.getScopeRules("group", groupId));
      }
      if (guildId) {
         rules.push(...Swaps.getScopeRules("guild", guildId));
         rules.push(...Swaps.collectLegacyRules("guild", guildId));
      }
      if (channelId) rules.push(...Swaps.getScopeRules("channel", channelId));

      return rules;
   }

   public static apply(text: string, context: CoreMessage, phase: "learn" | "respond"): string {
      if (!text) return text;
      const rules = Swaps.getApplicableRules(context);
      if (rules.length === 0) return text;
      let output = text;
      let collapseSpaces = false;
      for (const rule of rules) {
         if (!rule.enabled) continue;
         if (phase === "learn" && !rule.applyLearn) continue;
         if (phase === "respond" && !rule.applyRespond) continue;
         const rx = buildRuleRegex(rule);
         if (!rx) continue;
         if (rule.mode === "regex") {
            output = output.replace(rx, rule.replacement);
         } else {
            output = output.replace(rx, () => rule.replacement);
         }
         if (rule.replacement === "") collapseSpaces = true;
      }
      if (collapseSpaces) {
         output = output.replace(/ {2,}/g, " ");
      }
      return output;
   }

   public static getDefaultScope(context: CoreMessage): { scope: SwapScope; scopeId: string } {
      if (context.channel?.isGroupDm) {
         return { scope: "group", scopeId: Swaps.groupIdForDm(context.channelId) };
      }
      if (context.guildId) {
         return { scope: "guild", scopeId: context.guildId };
      }
      return { scope: "user", scopeId: context.authorId };
   }

   public static normalizeScope(scope: string): SwapScope | null {
      return normalizeScope(scope);
   }
}

export type SwapsManager = typeof Swaps;
export { Swaps };
