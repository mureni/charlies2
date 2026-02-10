import { newRX, escapeRegExp } from "@/utils";
import { isCommonWord } from "@/core/dictionary";
import type { StandardMember, StandardMessage, PlatformAdapter, StandardMemberQuery } from "@/contracts";
import { KnownUsers, KnownUser, Conversation, getKnownUsersSnapshot } from "@/core/knownUsers";

const getEndearment = (plural: boolean = false): string => {
   const synonyms = ["pal", plural ? "buddie" : "buddy", "chum", "compadre", "comrade", "friend", "my friend", "mate", "amigo", "fella", "bro", "broseph", "darling", "sweetheart", "sweetpea", plural ? "honie" : "honey", "sweetie"];
   const endearment = synonyms[Math.floor(Math.random() * synonyms.length)];
   return `${endearment}${plural ? "s" : ""}`;
}

const MENTION_RX = newRX(`<@!?\\s*(\\d+)>`, "uig");

const lookupMember = async (platform: PlatformAdapter | undefined, guildId: string | undefined, query: StandardMemberQuery): Promise<StandardMember | undefined> => {
   if (!platform || !platform.fetchMember || !guildId) return undefined;
   return platform.fetchMember(guildId, query);
};

const isKnownAlias = (candidate: string, aliases: Set<string>): boolean => {
   const normalized = candidate.trim().toLowerCase();
   if (!normalized) return false;
   if (aliases.has(normalized)) return true;
   if (normalized.startsWith("@") && aliases.has(normalized.slice(1))) return true;
   return false;
};

interface AliasCache {
   version: number;
   aliasLookup: Set<string>;
   skipAliases: Set<string>;
}

let aliasCache: AliasCache = { version: -1, aliasLookup: new Set<string>(), skipAliases: new Set<string>() };

const buildAliasCache = (entries: Array<[string, KnownUser]>, version: number): AliasCache => {
   const aliasLookup = new Set<string>();
   const skipAliases = new Set<string>();
   for (const [, user] of entries) {
      if (user.name) aliasLookup.add(user.name.toLowerCase());
      for (const alias of user.aliases.values()) {
         if (!alias) continue;
         const normalized = alias.toLowerCase();
         aliasLookup.add(normalized);
         if (!alias.includes(" ") && isCommonWord(normalized)) skipAliases.add(normalized);
      }
   }
   aliasCache = { version, aliasLookup, skipAliases };
   return aliasCache;
};

const getAliasCache = (): AliasCache => {
   const snapshot = getKnownUsersSnapshot();
   if (aliasCache.version === snapshot.version) return aliasCache;
   return buildAliasCache(snapshot.entries, snapshot.version);
};

const interpolateUsers = async (text: string, context: StandardMessage | undefined = undefined, useEndearments: boolean = false): Promise<string> => {
   const snapshot = getKnownUsersSnapshot();
   const { aliasLookup, skipAliases } = getAliasCache();

   const directedMatch = text.match(/^([^:]+):/u);
   let directedTo = "";
   if (directedMatch) {
      const candidate = directedMatch[1].trim();
      const isMention = Boolean(candidate.match(/^<@!?\\s*\\d+>$/u));
      if (isMention || isKnownAlias(candidate, aliasLookup)) {
         directedTo = directedMatch[0];
         text = text.replace(newRX(`^${escapeRegExp(directedTo)}`, "uig"), "");
      }
   }
   const backupName = useEndearments ? getEndearment : () => "<UNKNOWN USER>";

   /* Replace raw @!UserID messages based on internal database of known users (whether they are still active or not) */
   for (const [id, user] of snapshot.entries) {
      const displayName = user?.name ?? backupName();
      /* Replace all known aliases for each user with the user's known name */
      for (const alias of user?.aliases.values() ?? []) {
         if (!alias) continue;
         const normalizedAlias = alias.toLowerCase();
         if (skipAliases.has(normalizedAlias)) continue;
         text = text.replace(newRX(`\\b${escapeRegExp(alias)}\\b`, "uig"), displayName);
      }
      text = text.replace(newRX(`<@!?\\s*${escapeRegExp(id)}>`, "uig"), displayName);
      if (useEndearments) text = text.replace(newRX(`\\b${escapeRegExp(displayName)}\\b`, "uig"), getEndearment());
   }

   const platform = context?.platform;
   const guildId = context?.guildId;
   if (platform && guildId) {
      const mentionMatches = Array.from(text.matchAll(MENTION_RX));
      const unresolved = new Set<string>();
      for (const match of mentionMatches) {
         const id = match[1];
         if (!id) continue;
         if (KnownUsers.has(id)) continue;
         unresolved.add(id);
      }
      for (const id of unresolved) {
         const member = await lookupMember(platform, guildId, { userId: id });
         if (!member) continue;
         text = text.replace(newRX(`<@!?\\s*${escapeRegExp(id)}>`, "uig"), member.displayName);
         if (useEndearments) {
            text = text.replace(newRX(`\\b${escapeRegExp(member.displayName)}\\b`, "uig"), getEndearment());
         }
      }
   }

   /* Replace any leftover user mentions with endearments, if appropriate */
   if (useEndearments) text = text.replace(/<@!?\s*\d+>/uig, getEndearment());

   /* Swap @roles, @everyone, @here references with plural endearment ('useEndearments' flag does not apply to these) */
   text = text.replace(/<@&\d+>/uig, getEndearment(true));
   text = text.replace(/@everyone|@here|@room/uig, getEndearment(true));

   return (directedTo !== "") ? `${directedTo}` + text : text;
}

export { interpolateUsers, getEndearment, KnownUser, KnownUsers, Conversation }
