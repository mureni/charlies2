import { SQLiteMap } from "@/core/SQLiteCollections";
import { checkFilePath, env } from "@/utils";

interface Conversation {
   lastSpokeAt: number;
   lastTopic: string;
}

interface KnownUser {
   name: string;
   aliases: Set<string>;
   conversations: Map<string, Conversation>;
}

const BOT_NAME = env("BOT_NAME", "default");
const KnownUsers = new SQLiteMap<string, KnownUser>({
   filename: checkFilePath("data", `${BOT_NAME}-known-users.sqlite`),
   table: "known_users",
   cacheSize: 64,
   allowSchemaMigration: env("NODE_ENV") !== "production",
   debug: /^(1|true|yes|on)$/i.test(env("TRACE_SQL") ?? "")
});

interface KnownUsersSnapshot {
   version: number;
   entries: Array<[string, KnownUser]>;
}

let knownUsersVersion = 0;
let snapshotCache: KnownUsersSnapshot | null = null;

const bumpVersion = (): void => {
   knownUsersVersion += 1;
   snapshotCache = null;
};

const saveKnownUser = (id: string, user: KnownUser, options?: { bump?: boolean }): KnownUser => {
   KnownUsers.set(id, user);
   if (options?.bump !== false) bumpVersion();
   return user;
};

const upsertKnownUser = (id: string, name: string, aliases: string[] = []): KnownUser => {
   const existing = KnownUsers.get(id);
   const user: KnownUser = existing ?? {
      name: name || "<UNKNOWN USER>",
      aliases: new Set<string>(),
      conversations: new Map<string, Conversation>()
   };
   let changed = !existing;
   if (name && name !== user.name) {
      user.aliases.add(name);
      user.name = name;
      changed = true;
   } else if (name && !user.name) {
      user.name = name;
      changed = true;
   }
   for (const alias of aliases) {
      if (!alias) continue;
      if (!user.aliases.has(alias)) {
         user.aliases.add(alias);
         changed = true;
      }
   }
   if (changed) return saveKnownUser(id, user);
   return user;
};

const touchKnownUser = (id: string, name: string): KnownUser => upsertKnownUser(id, name);

const getKnownUsersSnapshot = (): KnownUsersSnapshot => {
   if (snapshotCache && snapshotCache.version === knownUsersVersion) return snapshotCache;
   const entries = Array.from(KnownUsers.entries());
   snapshotCache = { version: knownUsersVersion, entries };
   return snapshotCache;
};

export type { KnownUser, Conversation };
export { KnownUsers, touchKnownUser, upsertKnownUser, saveKnownUser, getKnownUsersSnapshot };
