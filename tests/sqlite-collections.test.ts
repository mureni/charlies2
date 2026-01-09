import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import util from "node:util";

import Database from "better-sqlite3";
import { JSONReviver, SQLiteMap, SQLiteSet } from "../src/core/SQLiteCollections";
import { it } from "vitest";

const keepDb = process.env.TEST_KEEP_DB === "1";
const dumpDb = process.env.TEST_DUMP_DB === "1";

const makeTempDir = (): string => {
   const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sqlite-collections-"));
   if (keepDb) console.log(`db-dir: ${dir}`);
   return dir;
};
const makeDbPath = (dir: string, name: string): string => path.join(dir, `${name}.db`);

const toSortedArray = <T>(set: Set<T>): T[] => Array.from(set).sort();
const createRng = (seed: number): (() => number) => {
   let t = seed >>> 0;
   return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
   };
};

const assertMapMatches = <K, V>(actual: SQLiteMap<K, V>, expected: Map<K, V>): void => {
   assert.strictEqual(actual.size, expected.size);
   for (const [key, value] of expected.entries()) {
      assert.strictEqual(actual.has(key), true);
      assert.deepStrictEqual(actual.get(key), value);
   }
   assert.deepStrictEqual(Array.from(actual.keys()), Array.from(expected.keys()));
   assert.deepStrictEqual(Array.from(actual.values()), Array.from(expected.values()));
};

const assertSetMatches = <T>(actual: SQLiteSet<T>, expected: Set<T>): void => {
   assert.strictEqual(actual.size, expected.size);
   for (const value of expected.values()) {
      assert.strictEqual(actual.has(value), true);
   }
   assert.deepStrictEqual(Array.from(actual.values()), Array.from(expected.values()));
};

const assertValueEqual = (actual: unknown, expected: unknown): void => {
   if (typeof expected === "number" && Number.isNaN(expected)) {
      assert.ok(Number.isNaN(actual as number));
      return;
   }
   if (typeof expected === "number" && Object.is(expected, -0)) {
      assert.ok(Object.is(actual as number, -0));
      return;
   }
   if (expected instanceof Map) {
      assert.ok(actual instanceof Map);
      assert.deepStrictEqual(Array.from((actual as Map<unknown, unknown>).entries()), Array.from(expected.entries()));
      return;
   }
   if (expected instanceof Set) {
      assert.ok(actual instanceof Set);
      assert.deepStrictEqual(Array.from((actual as Set<unknown>).values()), Array.from(expected.values()));
      return;
   }
   assert.deepStrictEqual(actual, expected);
};

const expectThrow = (fn: () => void, message: RegExp): void => {
   assert.throws(fn, message);
};

const test = (name: string, fn: () => void): void => {
   it(name, fn);
};

const dumpMap = <K, V>(label: string, map: SQLiteMap<K, V>): void => {
   if (!dumpDb) return;
   console.log(`dump:${label}`, Array.from(map.entries()));
};

const dumpSet = <T>(label: string, set: SQLiteSet<T>): void => {
   if (!dumpDb) return;
   console.log(`dump:${label}`, Array.from(set.values()));
};

const dumpRawTable = (label: string, dbPath: string, table: string): void => {
   if (!dumpDb) return;
   const db = new Database(dbPath, { readonly: true });
   const rows = db.prepare(`SELECT id, key_hash, value FROM ${table} ORDER BY id ASC`).all() as Array<{
      id: number;
      key_hash: string;
      value: string | null;
   }>;
   const parsed = rows.map((row) => {
      if (row.value === null) return { id: row.id, key_hash: row.key_hash, value: null };
      try {
         return { id: row.id, key_hash: row.key_hash, value: JSON.parse(row.value, JSONReviver) };
      } catch {
         return { id: row.id, key_hash: row.key_hash, value: row.value };
      }
   });
   const formatValue = (value: unknown): string =>
      util.inspect(value, { depth: 6, colors: false, compact: false, breakLength: 80, sorted: true });
   const tableRows = parsed.map((row) => ({
      id: String(row.id),
      key: row.key_hash,
      value: formatValue(row.value)
   }));
   const widths = { id: 2, key: 3, value: 5 };
   for (const row of tableRows) {
      for (const line of row.id.split("\n")) widths.id = Math.max(widths.id, line.length);
      for (const line of row.key.split("\n")) widths.key = Math.max(widths.key, line.length);
      for (const line of row.value.split("\n")) widths.value = Math.max(widths.value, line.length);
   }

   const header = {
      id: "id".padEnd(widths.id),
      key: "key_hash".padEnd(widths.key),
      value: "value".padEnd(widths.value)
   };
   const separator = `${"-".repeat(widths.id)}-+-${"-".repeat(widths.key)}-+-${"-".repeat(widths.value)}`;
   console.log(`dump:table:${label}:${table}`);
   console.log(`${header.id} | ${header.key} | ${header.value}`);
   console.log(separator);
   for (const row of tableRows) {
      const idLines = row.id.split("\n");
      const keyLines = row.key.split("\n");
      const valueLines = row.value.split("\n");
      const lineCount = Math.max(idLines.length, keyLines.length, valueLines.length);
      for (let i = 0; i < lineCount; i += 1) {
         const idCell = (idLines[i] ?? "").padEnd(widths.id);
         const keyCell = (keyLines[i] ?? "").padEnd(widths.key);
         const valueCell = (valueLines[i] ?? "").padEnd(widths.value);
         console.log(`${idCell} | ${keyCell} | ${valueCell}`);
      }
   }
   db.close();
};

const getIndexNames = (dbPath: string, table: string): string[] => {
   const db = new Database(dbPath, { readonly: true });
   const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ?").all(table) as Array<{
      name: string;
   }>;
   db.close();
   return rows.map((row) => row.name).sort();
};

test("SQLiteMap basic operations and iteration order", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-basic");
   const map = new SQLiteMap<string, number>({
      filename: dbPath,
      table: "map_basic",
      backupOnClear: false
   });

   map.set("a", 1);
   map.set("b", 2);
   map.set("c", 3);
   assert.strictEqual(map.size, 3);
   assert.strictEqual(map.get("a"), 1);
   assert.strictEqual(map.has("b"), true);

   map.delete("b");
   assert.strictEqual(map.size, 2);
   assert.strictEqual(map.has("b"), false);

   map.set("d", 4);
   assert.deepStrictEqual(Array.from(map.keys()), ["a", "c", "d"]);
   dumpMap("map-basic", map);
   dumpRawTable("map-basic", dbPath, "map_basic");
   map.close();
});

test("SQLiteMap object identity is process-scoped and cleared on reopen", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-objects");
   const obj = { id: 1 };

   const map = new SQLiteMap<object, string>({ filename: dbPath, table: "map_objects" });
   map.set(obj, "value");
   assert.strictEqual(map.get(obj), "value");
   assert.strictEqual(map.has({ id: 1 } as object), false);
   map.close();

   const reopened = new SQLiteMap<object, string>({ filename: dbPath, table: "map_objects" });
   assert.strictEqual(reopened.has(obj), false);
   reopened.close();
});

test("SQLiteMap clear creates backup by default", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-backup");
   const backupDir = path.join(dir, "backups");
   const map = new SQLiteMap<string, number>({
      filename: dbPath,
      table: "map_backup",
      backupDirectory: backupDir,
      backupSuffix: "snapshot"
   });

   map.set("x", 1);
   map.clear();
   const backups = fs.readdirSync(backupDir).filter((file) => file.includes(".backup.") && file.endsWith(".snapshot"));
   assert.strictEqual(backups.length, 1);
   dumpRawTable("map-backup", dbPath, "map_backup");
   dumpRawTable("map-backup-snapshot", path.join(backupDir, backups[0]), "map_backup");
   map.close();
});

test("SQLiteMap clear can skip backup or use explicit backup path", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-backup-explicit");
   const backupPath = path.join(dir, "explicit-backup.db");
   const map = new SQLiteMap<string, number>({ filename: dbPath, table: "map_backup_explicit" });

   map.set("x", 1);
   map.clear({ backup: false });
   assert.strictEqual(fs.existsSync(backupPath), false);

   map.set("y", 2);
   map.clear({ backup: true, backupPath });
   assert.strictEqual(fs.existsSync(backupPath), true);
   dumpRawTable("map-backup-explicit", backupPath, "map_backup_explicit");
   map.close();
});

test("SQLiteMap delete + reinsert preserves order semantics", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-reinsert");
   const map = new SQLiteMap<string, number>({ filename: dbPath, table: "map_reinsert", backupOnClear: false });

   map.set("a", 1);
   map.set("b", 2);
   map.set("c", 3);
   map.delete("b");
   map.set("b", 4);
   assert.deepStrictEqual(Array.from(map.keys()), ["a", "c", "b"]);
   map.close();
});

test("SQLiteMap updating existing key keeps insertion order", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-update-order");
   const map = new SQLiteMap<string, number>({ filename: dbPath, table: "map_update_order", backupOnClear: false });

   map.set("first", 1);
   map.set("second", 2);
   map.set("first", 3);
   assert.deepStrictEqual(Array.from(map.keys()), ["first", "second"]);
   map.close();
});

test("SQLiteMap persists primitive keys/values across reopen", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-persist");
   const map = new SQLiteMap<string, number>({ filename: dbPath, table: "map_persist", backupOnClear: false });
   map.set("alpha", 1);
   map.set("beta", 2);
   map.close();

   const reopened = new SQLiteMap<string, number>({ filename: dbPath, table: "map_persist", backupOnClear: false });
   assert.strictEqual(reopened.get("alpha"), 1);
   assert.strictEqual(reopened.get("beta"), 2);
   assert.deepStrictEqual(Array.from(reopened.keys()), ["alpha", "beta"]);
   dumpRawTable("map-persist", dbPath, "map_persist");
   reopened.close();
});

test("SQLiteMap value serialization supports undefined, NaN, Infinity, BigInt, Map, Set", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-values");
   const map = new SQLiteMap<string, unknown>({ filename: dbPath, table: "map_values", backupOnClear: false });

   map.set("undef", undefined);
   map.set("nan", NaN);
   map.set("inf", Infinity);
   map.set("ninf", -Infinity);
   map.set("big", BigInt("9007199254740993"));
   map.set("map", new Map<string, number>([["a", 1]]));
   map.set("set", new Set<number>([1, 2]));

   assert.strictEqual(map.has("undef"), true);
   assert.strictEqual(map.get("undef"), undefined);
   assert.ok(Number.isNaN(map.get("nan") as number));
   assert.strictEqual(map.get("inf"), Infinity);
   assert.strictEqual(map.get("ninf"), -Infinity);
   assert.strictEqual(map.get("big"), BigInt("9007199254740993"));

   const storedMap = map.get("map");
   assert.ok(storedMap instanceof Map);
   assert.deepStrictEqual(Array.from((storedMap as Map<string, number>).entries()), [["a", 1]]);

   const storedSet = map.get("set");
   assert.ok(storedSet instanceof Set);
   assert.deepStrictEqual(Array.from((storedSet as Set<number>).values()), [1, 2]);
   dumpRawTable("map-values", dbPath, "map_values");
   map.close();
});

test("SQLiteMap round-trips nested Map/Set structures", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-nested");
   const map = new SQLiteMap<string, unknown>({ filename: dbPath, table: "map_nested", backupOnClear: false });

   const deepSet = new Set<number>([7, 8, 9]);
   const deepMap = new Map<string, Set<number>>([["nums", deepSet]]);
   const middleSet = new Set<Map<string, Set<number>>>([deepMap]);
   const nestedValue = new Map<string, unknown>([
      ["setOfMaps", middleSet],
      ["mapOfSets", new Map<string, Set<string>>([["letters", new Set(["a", "b"])]] )],
      ["deep", new Map<string, Map<string, Set<number>>>([["layer", deepMap]])]
   ]);

   map.set("complex", nestedValue);

   const stored = map.get("complex");
   assert.ok(stored instanceof Map);
   const storedMap = stored as Map<string, unknown>;
   const storedSetOfMaps = storedMap.get("setOfMaps");
   assert.ok(storedSetOfMaps instanceof Set);
   const storedInnerMap = Array.from((storedSetOfMaps as Set<Map<string, Set<number>>>).values())[0];
   assert.ok(storedInnerMap instanceof Map);
   assert.deepStrictEqual(Array.from((storedInnerMap.get("nums") as Set<number>).values()), [7, 8, 9]);

   const storedMapOfSets = storedMap.get("mapOfSets") as Map<string, Set<string>>;
   assert.ok(storedMapOfSets instanceof Map);
   assert.deepStrictEqual(Array.from((storedMapOfSets.get("letters") as Set<string>).values()), ["a", "b"]);

   const storedDeep = storedMap.get("deep") as Map<string, Map<string, Set<number>>>;
   assert.ok(storedDeep instanceof Map);
   const storedLayer = storedDeep.get("layer") as Map<string, Set<number>>;
   assert.ok(storedLayer instanceof Map);
   assert.deepStrictEqual(Array.from((storedLayer.get("nums") as Set<number>).values()), [7, 8, 9]);
   dumpRawTable("map-nested", dbPath, "map_nested");
   map.close();

   const reopened = new SQLiteMap<string, unknown>({ filename: dbPath, table: "map_nested", backupOnClear: false });
   const reopenedValue = reopened.get("complex");
   assert.ok(reopenedValue instanceof Map);
   const reopenedMap = reopenedValue as Map<string, unknown>;
   const reopenedSetOfMaps = reopenedMap.get("setOfMaps") as Set<Map<string, Set<number>>>;
   assert.ok(reopenedSetOfMaps instanceof Set);
   const reopenedInnerMap = Array.from(reopenedSetOfMaps.values())[0];
   assert.ok(reopenedInnerMap instanceof Map);
   assert.deepStrictEqual(Array.from((reopenedInnerMap.get("nums") as Set<number>).values()), [7, 8, 9]);
   dumpMap("map-nested-reopen", reopened);
   dumpRawTable("map-nested-reopen", dbPath, "map_nested");
   reopened.close();
});

test("SQLiteMap supports all key/value permutations for supported types", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-permutations");
   const map = new SQLiteMap<unknown, unknown>({ filename: dbPath, table: "map_permutations", backupOnClear: false });
   const sharedObj = { label: "obj" };
   const sharedFn = () => "fn";
   const sharedSymbol = Symbol("sym");

   const keyCases: Array<{ label: string; key: unknown }> = [
      { label: "string", key: "hello" },
      { label: "empty-string", key: "" },
      { label: "zero", key: 0 },
      { label: "neg-zero", key: -0 },
      { label: "nan", key: NaN },
      { label: "inf", key: Infinity },
      { label: "ninf", key: -Infinity },
      { label: "true", key: true },
      { label: "false", key: false },
      { label: "null", key: null },
      { label: "undef", key: undefined },
      { label: "bigint", key: BigInt("42") },
      { label: "symbol", key: sharedSymbol },
      { label: "object", key: sharedObj },
      { label: "function", key: sharedFn }
   ];

   const valueCases: unknown[] = [
      undefined,
      null,
      true,
      false,
      "",
      "text",
      0,
      -0,
      3.14,
      NaN,
      Infinity,
      -Infinity,
      BigInt("9007199254740993"),
      { a: 1, nested: { b: 2 } },
      [1, 2, 3],
      new Map<string, number>([["k", 7]]),
      new Set<number>([5, 6]),
      new Map<string, unknown>([
         ["deepSet", new Set([new Set([1, 2])])],
         ["deepMap", new Map([["inner", new Map([["x", 1]])]])]
      ])
   ];

   const lastValues = new Map<string, unknown>();
   for (const keyCase of keyCases) {
      for (const value of valueCases) {
         map.set(keyCase.key, value);
         assert.strictEqual(map.has(keyCase.key), true);
         assertValueEqual(map.get(keyCase.key), value);
         lastValues.set(keyCase.label, value);
      }
   }

   map.close();

   const reopened = new SQLiteMap<unknown, unknown>({
      filename: dbPath,
      table: "map_permutations",
      backupOnClear: false
   });
   for (const keyCase of keyCases) {
      const value = reopened.get(keyCase.key);
      const isObjectKey = typeof keyCase.key === "object" && keyCase.key !== null;
      const isFunctionKey = typeof keyCase.key === "function";
      const isSymbolKey = typeof keyCase.key === "symbol";
      if (isObjectKey || isFunctionKey || isSymbolKey) {
         assert.strictEqual(reopened.has(keyCase.key), false);
      } else {
         assert.strictEqual(reopened.has(keyCase.key), true);
         assertValueEqual(value, lastValues.get(keyCase.label));
      }
   }
   dumpRawTable("map-permutations", dbPath, "map_permutations");
   reopened.close();
});

test("SQLiteMap backup contains previous data", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-backup-content");
   const backupPath = path.join(dir, "backup-content.db");
   const map = new SQLiteMap<string, number>({ filename: dbPath, table: "map_backup_content" });
   map.set("one", 1);
   map.set("two", 2);
   map.clear({ backupPath });
   map.close();

   const backup = new SQLiteMap<string, number>({
      filename: backupPath,
      table: "map_backup_content",
      backupOnClear: false,
      purgeStaleObjectKeys: false
   });
   assert.deepStrictEqual(Array.from(backup.entries()), [
      ["one", 1],
      ["two", 2]
   ]);
   dumpRawTable("map-backup-content", backupPath, "map_backup_content");
   backup.close();
});

test("SQLiteSet basic operations and iteration order", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "set-basic");
   const set = new SQLiteSet<number>({ filename: dbPath, table: "set_basic", backupOnClear: false });

   set.add(1);
   set.add(2);
   set.add(2);
   assert.strictEqual(set.size, 2);
   assert.strictEqual(set.has(1), true);

   set.delete(1);
   assert.strictEqual(set.size, 1);
   assert.strictEqual(set.has(1), false);

   set.add(3);
   set.add(4);
   assert.deepStrictEqual(Array.from(set.values()), [2, 3, 4]);
   dumpSet("set-basic", set);
   dumpRawTable("set-basic", dbPath, "set_basic");
   set.close();
});

test("SQLiteSet persists values across reopen", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "set-persist");
   const set = new SQLiteSet<number>({ filename: dbPath, table: "set_persist", backupOnClear: false });
   set.add(10);
   set.add(20);
   set.close();

   const reopened = new SQLiteSet<number>({ filename: dbPath, table: "set_persist", backupOnClear: false });
   assert.deepStrictEqual(Array.from(reopened.values()), [10, 20]);
   dumpRawTable("set-persist", dbPath, "set_persist");
   reopened.close();
});

test("SQLiteSet supports supported value permutations and persistence for primitives", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "set-permutations");
   const set = new SQLiteSet<unknown>({ filename: dbPath, table: "set_permutations", backupOnClear: false });
   const sharedObj = { label: "obj" };
   const sharedFn = () => "fn";
   const sharedSymbol = Symbol("sym");

   const values: unknown[] = [
      "hello",
      "",
      0,
      -0,
      NaN,
      Infinity,
      -Infinity,
      true,
      false,
      null,
      undefined,
      BigInt("123"),
      sharedSymbol,
      sharedObj,
      sharedFn
   ];

   for (const value of values) {
      set.add(value);
      assert.strictEqual(set.has(value), true);
   }
   dumpRawTable("set-permutations", dbPath, "set_permutations");
   set.close();

   const reopened = new SQLiteSet<unknown>({ filename: dbPath, table: "set_permutations", backupOnClear: false });
   for (const value of values) {
      const isObjectValue = typeof value === "object" && value !== null;
      const isFunctionValue = typeof value === "function";
      const isSymbolValue = typeof value === "symbol";
      if (isObjectValue || isFunctionValue || isSymbolValue) {
         assert.strictEqual(reopened.has(value), false);
      } else {
         assert.strictEqual(reopened.has(value), true);
      }
   }
   reopened.close();
});

test("SQLiteSet ESNext set-algebra methods", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "set-algebra");
   const set = new SQLiteSet<number>({ filename: dbPath, table: "set_algebra", backupOnClear: false });
   set.add(1);
   set.add(2);
   set.add(3);

   const other = new Set<number>([3, 4]);

   assert.deepStrictEqual(toSortedArray(set.union(other)), [1, 2, 3, 4]);
   assert.deepStrictEqual(toSortedArray(set.intersection(other)), [3]);
   assert.deepStrictEqual(toSortedArray(set.difference(other)), [1, 2]);
   assert.deepStrictEqual(toSortedArray(set.symmetricDifference(other)), [1, 2, 4]);
   assert.strictEqual(set.isSubsetOf(new Set([1, 2, 3, 4])), true);
   assert.strictEqual(set.isSupersetOf(new Set([2])), true);
   assert.strictEqual(set.isDisjointFrom(new Set([9, 10])), true);
   dumpRawTable("set-algebra", dbPath, "set_algebra");
   set.close();
});

test("SQLiteSet matches native Set for random operations", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "set-oracle");
   const actual = new SQLiteSet<number>({ filename: dbPath, table: "set_oracle", backupOnClear: false });
   const expected = new Set<number>();
   const rng = createRng(42);

   for (let i = 0; i < 300; i += 1) {
      const value = Math.floor(rng() * 10);
      const op = Math.floor(rng() * 4);
      if (op === 0) {
         actual.add(value);
         expected.add(value);
      } else if (op === 1) {
         actual.delete(value);
         expected.delete(value);
      } else if (op === 2) {
         assert.strictEqual(actual.has(value), expected.has(value));
      }
      assertSetMatches(actual, expected);
   }

   assertSetMatches(actual, expected);
   dumpRawTable("set-oracle", dbPath, "set_oracle");
   actual.close();
});

test("SQLiteMap matches native Map for random operations", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-oracle");
   const actual = new SQLiteMap<string, number>({ filename: dbPath, table: "map_oracle", backupOnClear: false });
   const expected = new Map<string, number>();
   const rng = createRng(123);
   const keys = ["a", "b", "c", "d", "e"];

   for (let i = 0; i < 300; i += 1) {
      const key = keys[Math.floor(rng() * keys.length)];
      const op = Math.floor(rng() * 4);
      if (op === 0) {
         const value = Math.floor(rng() * 100);
         actual.set(key, value);
         expected.set(key, value);
      } else if (op === 1) {
         actual.delete(key);
         expected.delete(key);
      } else if (op === 2) {
         assert.strictEqual(actual.has(key), expected.has(key));
      }
      assertMapMatches(actual, expected);
   }

   assertMapMatches(actual, expected);
   dumpRawTable("map-oracle", dbPath, "map_oracle");
   actual.close();
});

test("SQLiteMap convenience methods are available and correct", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-convenience");
   const map = new SQLiteMap<string, number>({ filename: dbPath, table: "map_convenience", backupOnClear: false });

   assert.strictEqual(map.safeGet("missing", 5), 5);
   map.set("a", 1);
   map.update("a", (value) => value + 1, 0);
   map.update("b", (value) => value + 1, 3);
   assert.strictEqual(map.get("a"), 2);
   assert.strictEqual(map.get("b"), 3);

   const filtered = map.filter((value) => value >= 2);
   assert.deepStrictEqual(Array.from(filtered.entries()), [["a", 2], ["b", 3]]);

   const merged = new SQLiteMap<string, number>({ filename: dbPath, table: "map_convenience_merge", backupOnClear: false });
   merged.set("a", 10);
   merged.set("c", 4);
   map.merge(merged, (_key, left, right) => left + right);
   assert.deepStrictEqual(map.get("a"), 12);
   assert.deepStrictEqual(map.get("c"), 4);

   const key = map.randomKey;
   const value = map.randomValue;
   const entry = map.randomEntry;
   assert.ok(map.keyArray.includes(key));
   assert.ok(map.valueArray.includes(value));
   assert.ok(map.entriesArray.some(([k, v]) => k === entry[0] && v === entry[1]));

   merged.close();
   map.close();
});

test("SQLiteMap creates structured indexes and composite indexes", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-indexes");
   const map = new SQLiteMap<string, { count: number; tokens: string[] }>({
      filename: dbPath,
      table: "map_indexes",
      backupOnClear: false,
      indexes: [
         { name: "idx_count", expression: { jsonExtract: "$.count" } },
         { name: "idx_type", expression: { jsonType: "$.tokens" } },
         { name: "idx_len", expression: { jsonArrayLength: "$.tokens" } },
         { name: "idx_valid", expression: { jsonValid: true } },
         { name: "idx_combo", expression: [
            { jsonExtract: "$.count" },
            { jsonExtract: "$.tokens[0]" }
         ] }
      ]
   });

   const indexNames = getIndexNames(dbPath, "map_indexes");
   assert.ok(indexNames.includes("idx_count"));
   assert.ok(indexNames.includes("idx_type"));
   assert.ok(indexNames.includes("idx_len"));
   assert.ok(indexNames.includes("idx_valid"));
   assert.ok(indexNames.includes("idx_combo"));
   map.close();
});

test("SQLiteMap objectKeyTracking full preserves object keys in iteration", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-object-keys-full");
   const map = new SQLiteMap<object, string>({
      filename: dbPath,
      table: "map_object_keys_full",
      backupOnClear: false,
      objectKeyTracking: "full"
   });
   const obj = { id: 1 };
   map.set(obj, "value");
   map.set({ id: 2 }, "other");
   const keys = Array.from(map.keys());
   assert.ok(keys.some((key) => key === obj));
   assert.strictEqual(map.has(obj), true);
   assert.strictEqual(map.get(obj), "value");
   map.close();
});

test("SQLiteMap objectKeyTracking weak skips object keys in iteration", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-object-keys-weak");
   const map = new SQLiteMap<unknown, string>({
      filename: dbPath,
      table: "map_object_keys_weak",
      backupOnClear: false,
      objectKeyTracking: "weak"
   });
   const obj = { id: 1 };
   map.set(obj, "value");
   map.set("primitive", "ok");
   const keys = Array.from(map.keys());
   assert.ok(keys.includes("primitive"));
   assert.ok(keys.every((key) => typeof key !== "object"));
   assert.strictEqual(map.has(obj), true);
   assert.strictEqual(map.get(obj), "value");
   map.close();
});

test("SQLiteMap cacheSize 0 does not change correctness", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-cache-zero");
   const map = new SQLiteMap<string, number>({
      filename: dbPath,
      table: "map_cache_zero",
      cacheSize: 0,
      backupOnClear: false
   });
   map.set("a", 1);
   map.set("b", 2);
   assert.strictEqual(map.get("a"), 1);
   assert.strictEqual(map.has("b"), true);
   map.delete("a");
   assert.strictEqual(map.has("a"), false);
   map.close();
});

test("SQLiteSet cacheSize 0 does not change correctness", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "set-cache-zero");
   const set = new SQLiteSet<string>({
      filename: dbPath,
      table: "set_cache_zero",
      cacheSize: 0,
      backupOnClear: false
   });
   set.add("a");
   set.add("b");
   assert.strictEqual(set.has("a"), true);
   set.delete("a");
   assert.strictEqual(set.has("a"), false);
   set.close();
});

test("SQLiteMap rejects invalid index definitions", () => {
   const dir = makeTempDir();
   const dbPath = makeDbPath(dir, "map-indexes-invalid");

   expectThrow(
      () => {
         new SQLiteMap<string, { count: number }>({
            filename: dbPath,
            table: "map_indexes_invalid",
            backupOnClear: false,
            indexes: [{ name: "idx-bad-name", expression: { jsonExtract: "$.count" } }]
         });
      },
      /Invalid table name/
   );

   expectThrow(
      () => {
         new SQLiteMap<string, { count: number }>({
            filename: dbPath,
            table: "map_indexes_invalid2",
            backupOnClear: false,
            indexes: [{ name: "idx_count", expression: { jsonExtract: "count" } }]
         });
      },
      /Invalid JSON path/
   );

   expectThrow(
      () => {
         new SQLiteMap<string, { count: number }>({
            filename: dbPath,
            table: "map_indexes_invalid3",
            backupOnClear: false,
            indexes: [{ name: "idx_count", expression: { jsonExtract: "$.count;drop" } }]
         });
      },
      /Invalid JSON path/
   );
});
