import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/SQLiteCollections", () => ({
   SQLiteMap: class<K, V> extends Map<K, V> {
      constructor() {
         super();
      }
   }
}));

vi.mock("@/utils", () => ({
   checkFilePath: () => "memory.sqlite",
   env: (_key: string, defaultValue = "") => defaultValue,
   envFlag: () => false,
   getBotName: () => "anonymous"
}));

beforeEach(() => {
   vi.resetModules();
});

describe("known users", () => {
   it("upserts users and merges aliases", async () => {
      const { upsertKnownUser } = await import("@/core/knownUsers");
      const user = upsertKnownUser("u1", "Neo", ["One", "The One"]);
      expect(user.name).toBe("Neo");
      expect(user.aliases.has("One")).toBe(true);
      expect(user.aliases.has("The One")).toBe(true);
   });

   it("tracks display names and aliases in profile sync", async () => {
      const { syncKnownUserProfile } = await import("@/core/knownUsers");
      const user = syncKnownUserProfile({
         id: "u2",
         username: "Trinity",
         displayName: "Tri",
         aliases: ["T"]
      });
      expect(user.name).toBe("Trinity");
      expect(user.aliases.has("Tri")).toBe(true);
      expect(user.aliases.has("T")).toBe(true);
   });

   it("updates users when names change", async () => {
      const { upsertKnownUser } = await import("@/core/knownUsers");
      upsertKnownUser("u3", "Old");
      const updated = upsertKnownUser("u3", "New");
      expect(updated.name).toBe("New");
      expect(updated.aliases.has("New")).toBe(true);
   });

   it("caches snapshots until the version changes", async () => {
      const { getKnownUsersSnapshot, upsertKnownUser, saveKnownUser } = await import("@/core/knownUsers");
      const snap1 = getKnownUsersSnapshot();
      const snap2 = getKnownUsersSnapshot();
      expect(snap2).toBe(snap1);

      const user = upsertKnownUser("u4", "Agent");
      const snap3 = getKnownUsersSnapshot();
      expect(snap3).not.toBe(snap1);

      const snap4 = getKnownUsersSnapshot();
      expect(snap4).toBe(snap3);

      saveKnownUser("u4", user, { bump: false });
      const snap5 = getKnownUsersSnapshot();
      expect(snap5).toBe(snap4);
   });
});
