import { SQLiteMap } from "@/core/SQLiteCollections";
import { checkFilePath, env, envFlag, getBotName } from "@/utils";

interface KnownUser {
   name: string;
   aliases: Set<string>;
   topicMemoryByChannel?: Map<string, KnownUserTopicMemoryEntry>;
   topicProfile?: KnownUserTopicProfileEntry;
}

interface KnownUserProfile {
   id: string;
   username: string;
   displayName?: string;
   aliases?: string[];
}

interface KnownUserTopicMemoryEntry {
   keywords: string[];
   updatedAt: number;
   expiresAt: number;
   remainingInteractions: number;
}

interface KnownUserTopicProfileEntry {
   keywords: string[];
   scores: Record<string, number>;
   updatedAt: number;
}

const BOT_NAME = getBotName();
const KnownUsers = new SQLiteMap<string, KnownUser>({
   filename: checkFilePath("data", `${BOT_NAME}-known-users.sqlite`),
   table: "known_users",
   cacheSize: 64,
   purgeStaleObjectKeys: false,
   allowSchemaMigration: env("NODE_ENV") !== "production",
   debug: envFlag("TRACE_SQL")
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
      aliases: new Set<string>()
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

const syncKnownUserProfile = (profile: KnownUserProfile): KnownUser => {
   const aliases: string[] = [];
   if (profile.displayName && profile.displayName !== profile.username) aliases.push(profile.displayName);
   if (profile.aliases && profile.aliases.length > 0) aliases.push(...profile.aliases);
   return upsertKnownUser(profile.id, profile.username, aliases);
};

const getKnownUsersSnapshot = (): KnownUsersSnapshot => {
   if (snapshotCache && snapshotCache.version === knownUsersVersion) return snapshotCache;
   const entries = Array.from(KnownUsers.entries());
   snapshotCache = { version: knownUsersVersion, entries };
   return snapshotCache;
};

const getKnownUserTopicMemory = (id: string, channelId: string): KnownUserTopicMemoryEntry | undefined => {
   if (!id || !channelId) return undefined;
   const user = KnownUsers.get(id);
   return user?.topicMemoryByChannel?.get(channelId);
};

const setKnownUserTopicMemory = (id: string, channelId: string, entry: KnownUserTopicMemoryEntry): void => {
   if (!id || !channelId) return;
   const user: KnownUser = KnownUsers.get(id) ?? {
      name: "<UNKNOWN USER>",
      aliases: new Set<string>()
   };
   if (!user.topicMemoryByChannel) user.topicMemoryByChannel = new Map<string, KnownUserTopicMemoryEntry>();
   user.topicMemoryByChannel.set(channelId, entry);
   saveKnownUser(id, user, { bump: false });
};

const deleteKnownUserTopicMemory = (id: string, channelId: string): void => {
   if (!id || !channelId) return;
   const user = KnownUsers.get(id);
   if (!user?.topicMemoryByChannel) return;
   if (!user.topicMemoryByChannel.delete(channelId)) return;
   if (user.topicMemoryByChannel.size === 0) delete user.topicMemoryByChannel;
   saveKnownUser(id, user, { bump: false });
};

const getKnownUserTopicProfile = (id: string): KnownUserTopicProfileEntry | undefined => {
   if (!id) return undefined;
   return KnownUsers.get(id)?.topicProfile;
};

const setKnownUserTopicProfile = (id: string, profile: KnownUserTopicProfileEntry): void => {
   if (!id) return;
   const user: KnownUser = KnownUsers.get(id) ?? {
      name: "<UNKNOWN USER>",
      aliases: new Set<string>()
   };
   user.topicProfile = profile;
   saveKnownUser(id, user, { bump: false });
};

const deleteKnownUserTopicProfile = (id: string): void => {
   if (!id) return;
   const user = KnownUsers.get(id);
   if (!user?.topicProfile) return;
   delete user.topicProfile;
   saveKnownUser(id, user, { bump: false });
};

export type {
   KnownUser,
   KnownUserProfile,
   KnownUserTopicMemoryEntry,
   KnownUserTopicProfileEntry
};
export {
   KnownUsers,
   touchKnownUser,
   upsertKnownUser,
   saveKnownUser,
   getKnownUsersSnapshot,
   syncKnownUserProfile,
   getKnownUserTopicMemory,
   setKnownUserTopicMemory,
   deleteKnownUserTopicMemory,
   getKnownUserTopicProfile,
   setKnownUserTopicProfile,
   deleteKnownUserTopicProfile
};
