/*
   SQLite-backed Map and Set replacements.
   Object and symbol keys are process-scoped and get purged on startup by default.
*/

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type SQLiteSerializer = (value: unknown) => string;
export type SQLiteDeserializer = (value: string) => unknown;
export type SQLiteObjectKeyTracking = "full" | "weak";
export type SQLiteIndexExpression =
   | { column: "id" | "key_hash" | "value" }
   | { jsonExtract: string }
   | { jsonType: string }
   | { jsonArrayLength: string }
   | { jsonValid: true };
export type SQLiteIndexDefinition = {
   name?: string;
   expression: SQLiteIndexExpression | SQLiteIndexExpression[];
};

type ReadonlySetLikeCompat<T> = {
   has(value: T): boolean;
   forEach?: (callbackfn: (value: T, value2: T, set: ReadonlySetLikeCompat<T>) => void, thisArg?: unknown) => void;
   [Symbol.iterator]?: () => Iterator<T>;
};

export interface SQLiteCollectionOptions {
   filename?: string;
   table?: string;
   debug?: boolean;
   pragmas?: string[];
   serializer?: SQLiteSerializer;
   deserializer?: SQLiteDeserializer;
   purgeStaleObjectKeys?: boolean;
   backupOnClear?: boolean;
   backupDirectory?: string;
   backupSuffix?: string;
   cacheSize?: number;
   objectKeyTracking?: SQLiteObjectKeyTracking;
   indexes?: SQLiteIndexDefinition[];
   allowSchemaMigration?: boolean;
}

const DEFAULT_PRAGMAS = ["journal_mode = WAL", "synchronous = NORMAL"];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
   typeof value === "object" && value !== null && !Array.isArray(value);

export function JSONReviver(this: unknown, _key: string, value: unknown): unknown {
   if (isPlainObject(value)) {
      const ctor = Reflect.get(value, "__ctor") as string | undefined;
      if (ctor === "Map") return new Map(Reflect.get(value, "value") as [unknown, unknown][]);
      if (ctor === "Set") return new Set(Reflect.get(value, "value") as unknown[]);
      if (ctor === "BigInt") return BigInt(Reflect.get(value, "value") as string);
      if (ctor === "Number") {
         const raw = Reflect.get(value, "value") as string;
         if (raw === "NaN") return NaN;
         if (raw === "Infinity") return Infinity;
         if (raw === "-Infinity") return -Infinity;
         if (raw === "-0") return -0;
      }
   }
   return value;
}

export function JSONReplacer(this: unknown, key: string, value: unknown): unknown {
   const originalObject = (this as Record<string, unknown>)[key];
   if (originalObject instanceof Map) {
      return { __ctor: "Map", value: Array.from(originalObject.entries()) };
   }
   if (originalObject instanceof Set) {
      return { __ctor: "Set", value: Array.from(originalObject) };
   }
   if (typeof originalObject === "bigint") {
      return { __ctor: "BigInt", value: originalObject.toString(10) };
   }
   if (typeof originalObject === "number" && !Number.isFinite(originalObject)) {
      return { __ctor: "Number", value: String(originalObject) };
   }
   if (typeof originalObject === "number" && Object.is(originalObject, -0)) {
      return { __ctor: "Number", value: "-0" };
   }
   return value;
}

const defaultSerializer: SQLiteSerializer = (value: unknown): string => {
   const payload = {
      __sqliteCollection: 1,
      kind: value === undefined ? "undefined" : "value",
      value
   };
   return JSON.stringify(payload, JSONReplacer);
};

const defaultDeserializer: SQLiteDeserializer = (value: string): unknown => {
   const parsed = JSON.parse(value, JSONReviver) as unknown;
   if (isPlainObject(parsed) && Reflect.get(parsed, "__sqliteCollection") === 1) {
      const kind = Reflect.get(parsed, "kind");
      if (kind === "undefined") return undefined;
      return Reflect.get(parsed, "value");
   }
   return parsed;
};

class KeyRegistry {
   private nextId = 1;
   private readonly trackObjects: boolean;
   private objectIds = new WeakMap<object, number>();
   private idToObject?: Map<number, object>;
   private symbolIds = new Map<symbol, number>();
   private idToSymbol?: Map<number, symbol>;

   public constructor(mode: SQLiteObjectKeyTracking) {
      this.trackObjects = mode === "full";
      if (this.trackObjects) {
         this.idToObject = new Map<number, object>();
         this.idToSymbol = new Map<number, symbol>();
      }
   }

   public objectId(value: object): number {
      const existing = this.objectIds.get(value);
      if (existing) return existing;
      const id = this.nextId++;
      this.objectIds.set(value, id);
      if (this.trackObjects) this.idToObject?.set(id, value);
      return id;
   }

   public symbolId(value: symbol): number {
      const existing = this.symbolIds.get(value);
      if (existing) return existing;
      const id = this.nextId++;
      this.symbolIds.set(value, id);
      if (this.trackObjects) this.idToSymbol?.set(id, value);
      return id;
   }

   public resolveObject(id: number): object | undefined {
      return this.idToObject?.get(id);
   }

   public resolveSymbol(id: number): symbol | undefined {
      return this.idToSymbol?.get(id);
   }
}

const encodeKey = (key: unknown, registry: KeyRegistry): string => {
   if (key === null) return "null:";
   const keyType = typeof key;
   if (keyType === "string") return `string:${JSON.stringify(key)}`;
   if (keyType === "number") {
      if (Number.isNaN(key)) return "number:NaN";
      if (key === Infinity) return "number:Infinity";
      if (key === -Infinity) return "number:-Infinity";
      return `number:${String(key)}`;
   }
   if (keyType === "boolean") return `boolean:${key ? "1" : "0"}`;
   if (keyType === "undefined") return "undefined:";
   if (keyType === "bigint") return `bigint:${(key as bigint).toString(10)}`;
   if (keyType === "symbol") return `symbol:${registry.symbolId(key as symbol)}`;
   if (keyType === "function" || keyType === "object") return `object:${registry.objectId(key as object)}`;
   throw new TypeError(`Unsupported key type: ${keyType}`);
};

const decodeKey = (keyHash: string, registry: KeyRegistry): unknown => {
   const separator = keyHash.indexOf(":");
   if (separator < 0) return undefined;
   const keyType = keyHash.slice(0, separator);
   const data = keyHash.slice(separator + 1);

   if (keyType === "null") return null;
   if (keyType === "string") return JSON.parse(data);
   if (keyType === "number") {
      if (data === "NaN") return NaN;
      if (data === "Infinity") return Infinity;
      if (data === "-Infinity") return -Infinity;
      return Number(data);
   }
   if (keyType === "boolean") return data === "1";
   if (keyType === "undefined") return undefined;
   if (keyType === "bigint") return BigInt(data);
   if (keyType === "symbol") return registry.resolveSymbol(Number(data));
   if (keyType === "object") return registry.resolveObject(Number(data));
   return undefined;
};

const sanitizeTableName = (table: string): string => {
   if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
      throw new TypeError(`Invalid table name: ${table}`);
   }
   return table;
};

const validateJsonPath = (pathValue: string): string => {
   if (!pathValue.startsWith("$.") && pathValue !== "$") {
      throw new TypeError(`Invalid JSON path: ${pathValue}`);
   }
   if (/[^A-Za-z0-9_\$\.\[\]\*]/.test(pathValue)) {
      throw new TypeError(`Invalid JSON path: ${pathValue}`);
   }
   return pathValue;
};

const buildIndexExpression = (expression: SQLiteIndexExpression): string => {
   if ("column" in expression) return expression.column;
   if ("jsonValid" in expression) return "json_valid(value)";
   if ("jsonExtract" in expression) return `json_extract(value, '${validateJsonPath(expression.jsonExtract)}')`;
   if ("jsonType" in expression) return `json_type(value, '${validateJsonPath(expression.jsonType)}')`;
   return `json_array_length(value, '${validateJsonPath(expression.jsonArrayLength)}')`;
};

const forEachReadonlySetLike = <U>(setLike: ReadonlySetLikeCompat<U>, fn: (value: U) => void): void => {
   const maybeForEach = (setLike as { forEach?: unknown }).forEach;
   if (typeof maybeForEach === "function") {
      (maybeForEach as (this: ReadonlySetLikeCompat<U>, cb: (value: U, value2: U, set: ReadonlySetLikeCompat<U>) => void) => void).call(
         setLike,
         (value) => {
         fn(value);
         }
      );
      return;
   }
   const maybeIterator = (setLike as { [Symbol.iterator]?: () => Iterator<U> })[Symbol.iterator];
   if (typeof maybeIterator === "function") {
      const iterable = setLike as unknown as Iterable<U>;
      for (const value of iterable) {
         fn(value);
      }
   }
};

class LruCache<K, V> {
   private readonly maxSize: number;
   private readonly entries = new Map<K, V>();

   public constructor(maxSize: number) {
      this.maxSize = Math.max(0, maxSize);
   }

   public get(key: K): V | undefined {
      if (!this.entries.has(key)) return undefined;
      const value = this.entries.get(key) as V;
      this.entries.delete(key);
      this.entries.set(key, value);
      return value;
   }

   public set(key: K, value: V): void {
      if (this.maxSize === 0) return;
      if (this.entries.has(key)) this.entries.delete(key);
      this.entries.set(key, value);
      if (this.entries.size > this.maxSize) {
         const oldest = this.entries.keys().next().value as K | undefined;
         if (oldest !== undefined) this.entries.delete(oldest);
      }
   }

   public delete(key: K): void {
      this.entries.delete(key);
   }

   public clear(): void {
      this.entries.clear();
   }
}

abstract class SQLiteCollectionBase {
   private static exitHookRegistered = false;
   private static readonly closeables = new Set<Database.Database>();
   protected readonly db: Database.Database;
   protected readonly table: string;
   protected readonly registry: KeyRegistry;
   protected readonly serializer: SQLiteSerializer;
   protected readonly deserializer: SQLiteDeserializer;
   protected readonly filename: string;
   protected readonly backupOnClear: boolean;
   protected readonly backupDirectory?: string;
   protected readonly backupSuffix: string;
   protected readonly cacheSize: number;
   protected sizeCache: number;

   protected constructor(options: SQLiteCollectionOptions | undefined, tableFallback: string) {
      const filename = options?.filename ?? ":memory:";
      this.table = sanitizeTableName(options?.table ?? tableFallback);
      this.registry = new KeyRegistry(options?.objectKeyTracking ?? "full");
      this.serializer = options?.serializer ?? defaultSerializer;
      this.deserializer = options?.deserializer ?? defaultDeserializer;
      this.filename = filename;
      this.backupOnClear = options?.backupOnClear ?? true;
      this.backupDirectory = options?.backupDirectory;
      this.backupSuffix = options?.backupSuffix ?? "";
      // cacheSize is a speed knob; big values mean you probably want it smaller than you think.
      this.cacheSize = Math.max(0, options?.cacheSize ?? 256);

      this.db = new Database(filename, options?.debug ? { verbose: (text) => console.info(`[SQL] ${text}`) } : {});

      const pragmas = options?.pragmas ?? DEFAULT_PRAGMAS;
      for (const pragma of pragmas) {
         this.db.pragma(pragma);
      }

      this.ensureSchema(options);

      const countRow = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.table}`).get() as { count: number };
      this.sizeCache = Number.isFinite(countRow.count) ? countRow.count : 0;

      SQLiteCollectionBase.closeables.add(this.db);
      if (!SQLiteCollectionBase.exitHookRegistered) {
         SQLiteCollectionBase.exitHookRegistered = true;
         process.on("exit", () => {
            for (const db of SQLiteCollectionBase.closeables) {
               try {
                  db.close();
               } catch {
                  // ignore close errors on exit
               }
            }
         });
      }
   }

   public get size(): number {
      return this.sizeCache;
   }

   public close(): void {
      SQLiteCollectionBase.closeables.delete(this.db);
      this.db.close();
   }

   protected maybeBackup(backup?: boolean, backupPath?: string): void {
      const shouldBackup = backup ?? this.backupOnClear;
      if (!shouldBackup) return;
      if (this.filename === ":memory:") return;
      const sourcePath = path.resolve(this.filename);
      if (!fs.existsSync(sourcePath)) return;

      const timestamp = Date.now();
      const suffix = this.backupSuffix ? `.${this.backupSuffix}` : "";
      const defaultBackupPath = `${sourcePath}.backup.${timestamp}${suffix}`;
      const resolvedBackupPath = backupPath ? path.resolve(backupPath) : defaultBackupPath;
      const targetPath = this.backupDirectory && !backupPath
         ? path.join(this.backupDirectory, path.basename(defaultBackupPath))
         : resolvedBackupPath;
      const targetDir = path.dirname(targetPath);
      fs.mkdirSync(targetDir, { recursive: true });
      try {
         this.db.prepare("VACUUM INTO ?").run(targetPath);
      } catch {
         fs.copyFileSync(sourcePath, targetPath);
      }
   }

   private ensureSchema(options: SQLiteCollectionOptions | undefined): void {
      const tableExists = this.db
         .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
         .get(this.table);

      if (!tableExists) {
         this.createTable();
         this.createIndexes(options);
         return;
      }

      const columns = this.db.prepare(`PRAGMA table_info(${this.table})`).all() as Array<{ name: string }>;
      const hasKeyHash = columns.some((column) => column.name === "key_hash");
      if (hasKeyHash) {
         this.createIndexes(options);
         if (options?.purgeStaleObjectKeys ?? true) {
            this.db.prepare(`DELETE FROM ${this.table} WHERE key_hash LIKE 'object:%' OR key_hash LIKE 'symbol:%'`).run();
         }
         return;
      }

      const hasLegacyKey = columns.some((column) => column.name === "key");
      if (hasLegacyKey) {
         if (!options?.allowSchemaMigration) {
            throw new Error(
               `Table '${this.table}' uses legacy schema; set allowSchemaMigration to migrate it.`
            );
         }
         this.migrateLegacyTable(options);
         return;
      }

      throw new Error(`Table '${this.table}' has an incompatible schema.`);
   }

   private createTable(): void {
      this.db.prepare(`CREATE TABLE IF NOT EXISTS ${this.table} (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         key_hash TEXT NOT NULL UNIQUE,
         value TEXT
      )`).run();
   }

   private createIndexes(options: SQLiteCollectionOptions | undefined): void {
      if (!options?.indexes?.length) return;
      const baseName = this.table.replace(/[^A-Za-z0-9_]/g, "_");
      options.indexes.forEach((entry, index) => {
         const indexName = sanitizeTableName(entry.name ?? `${baseName}_idx_${index}`);
         const expressions = Array.isArray(entry.expression) ? entry.expression : [entry.expression];
         const sqlExpression = expressions.map((expr) => buildIndexExpression(expr)).join(", ");
         this.db.prepare(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${this.table} (${sqlExpression})`).run();
      });
   }

   private migrateLegacyTable(options: SQLiteCollectionOptions | undefined): void {
      const legacyTable = sanitizeTableName(`${this.table}_legacy_${Date.now()}`);
      this.db.prepare(`ALTER TABLE ${this.table} RENAME TO ${legacyTable}`).run();
      this.createTable();

      const rows = this.db.prepare(`SELECT key, value FROM ${legacyTable}`).all() as Array<{ key: string; value: string }>;
      const insert = this.db.prepare(`INSERT INTO ${this.table} (key_hash, value) VALUES (@key_hash, @value)`);
      const tx = this.db.transaction((entries: Array<{ key_hash: string; value: string }>) => {
         for (const entry of entries) insert.run(entry);
      });

      const migrated = rows.map((row) => {
         let parsedKey: unknown = row.key;
         try {
            parsedKey = JSON.parse(row.key, JSONReviver);
         } catch {
            parsedKey = row.key;
         }
         const keyForHash = this.isLegacyPrimitiveKey(parsedKey) ? parsedKey : row.key;
         return { key_hash: encodeKey(keyForHash, this.registry), value: row.value };
      });

      tx(migrated);
      this.createIndexes(options);
      if (options?.purgeStaleObjectKeys ?? true) {
         this.db.prepare(`DELETE FROM ${this.table} WHERE key_hash LIKE 'object:%' OR key_hash LIKE 'symbol:%'`).run();
      }
   }

   private isLegacyPrimitiveKey(value: unknown): boolean {
      const keyType = typeof value;
      if (value === null) return true;
      return keyType === "string"
         || keyType === "number"
         || keyType === "boolean"
         || keyType === "undefined"
         || keyType === "bigint";
   }

   protected encodeKey(key: unknown): string {
      return encodeKey(key, this.registry);
   }

   protected decodeKey(keyHash: string): unknown {
      return decodeKey(keyHash, this.registry);
   }
}

export class SQLiteMap<K, V> extends SQLiteCollectionBase {
   private readonly cache?: LruCache<string, { present: boolean; hasValue: boolean; value?: V }>;
   private readonly selectValue: Database.Statement<[string], { value: string } | undefined>;
   private readonly selectExists: Database.Statement<[string], { present: number } | undefined>;
   private readonly insertOrUpdate: Database.Statement<{ key: string; value: string }>;
   private readonly deleteKey: Database.Statement<[string]>;
   private readonly selectEntries: Database.Statement<[], { key_hash: string; value: string }>;
   private readonly selectKeys: Database.Statement<[], { key_hash: string }>;
   private readonly selectValues: Database.Statement<[], { value: string }>;
   private readonly clearAll: Database.Statement<[]>;

   public constructor(options?: SQLiteCollectionOptions) {
      super(options, "sqlite_map");
      this.cache = this.cacheSize > 0 ? new LruCache<string, { present: boolean; hasValue: boolean; value?: V }>(this.cacheSize) : undefined;
      this.selectValue = this.db.prepare(`SELECT value FROM ${this.table} WHERE key_hash = ?`);
      this.selectExists = this.db.prepare(`SELECT 1 as present FROM ${this.table} WHERE key_hash = ?`);
      this.insertOrUpdate = this.db.prepare(
         `INSERT INTO ${this.table} (key_hash, value)
          VALUES (@key, @value)
          ON CONFLICT(key_hash) DO UPDATE SET value = excluded.value`
      );
      this.deleteKey = this.db.prepare(`DELETE FROM ${this.table} WHERE key_hash = ?`);
      this.selectEntries = this.db.prepare(`SELECT key_hash, value FROM ${this.table} ORDER BY id ASC`);
      this.selectKeys = this.db.prepare(`SELECT key_hash FROM ${this.table} ORDER BY id ASC`);
      this.selectValues = this.db.prepare(`SELECT value FROM ${this.table} ORDER BY id ASC`);
      this.clearAll = this.db.prepare(`DELETE FROM ${this.table}`);
   }

   public has(key: K): boolean {
      const keyHash = this.encodeKey(key);
      const cached = this.cache?.get(keyHash);
      if (cached) return cached.present;
      return Boolean(this.selectExists.get(keyHash));
   }

   public get(key: K): V | undefined {
      const keyHash = this.encodeKey(key);
      const cached = this.cache?.get(keyHash);
      if (cached?.hasValue) return cached.present ? cached.value : undefined;
      const row = this.selectValue.get(keyHash);
      if (!row) {
         this.cache?.set(keyHash, { present: false, hasValue: true });
         return undefined;
      }
      const value = this.deserializer(row.value) as V;
      this.cache?.set(keyHash, { present: true, hasValue: true, value });
      return value;
   }

   public set(key: K, value: V): this {
      const keyHash = this.encodeKey(key);
      const existed = Boolean(this.selectExists.get(keyHash));
      this.insertOrUpdate.run({ key: keyHash, value: this.serializer(value) });
      if (!existed) this.sizeCache += 1;
      this.cache?.set(keyHash, { present: true, hasValue: true, value });
      return this;
   }

   public delete(key: K): boolean {
      const keyHash = this.encodeKey(key);
      const result = this.deleteKey.run(keyHash);
      if (result.changes > 0) {
         this.sizeCache -= 1;
         this.cache?.set(keyHash, { present: false, hasValue: true });
         return true;
      }
      return false;
   }

   public clear(options?: { backup?: boolean; backupPath?: string }): void {
      this.maybeBackup(options?.backup, options?.backupPath);
      this.clearAll.run();
      this.sizeCache = 0;
      this.cache?.clear();
   }

   private *entriesIterator(): IterableIterator<[K, V]> {
      const rows = this.selectEntries.iterate() as IterableIterator<{ key_hash: string; value: string }>;
      for (const row of rows) {
         const key = this.decodeKey(row.key_hash) as K;
         if (key === undefined && row.key_hash.startsWith("undefined:") === false) continue;
         yield [key, this.deserializer(row.value) as V];
      }
   }

   private *keysIterator(): IterableIterator<K> {
      const rows = this.selectKeys.iterate() as IterableIterator<{ key_hash: string }>;
      for (const row of rows) {
         const key = this.decodeKey(row.key_hash) as K;
         if (key === undefined && row.key_hash.startsWith("undefined:") === false) continue;
         yield key;
      }
   }

   private *valuesIterator(): IterableIterator<V> {
      const rows = this.selectValues.iterate() as IterableIterator<{ value: string }>;
      for (const row of rows) {
         yield this.deserializer(row.value) as V;
      }
   }

   public entries(): MapIterator<[K, V]> {
      return this.entriesIterator() as unknown as MapIterator<[K, V]>;
   }

   public keys(): MapIterator<K> {
      return this.keysIterator() as unknown as MapIterator<K>;
   }

   public values(): MapIterator<V> {
      return this.valuesIterator() as unknown as MapIterator<V>;
   }

   public forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: unknown): void {
      for (const [key, value] of this.entries()) {
         callbackfn.call(thisArg, value, key, this);
      }
   }

   public [Symbol.iterator](): MapIterator<[K, V]> {
      return this.entries();
   }

   public get [Symbol.toStringTag](): string {
      return "SQLiteMap";
   }

   public safeGet(key: K, defaultValue: V): V {
      return this.get(key) ?? defaultValue;
   }

   public update(key: K, updater: (value: V, key: K) => V, defaultValue: V): void {
      if (this.has(key)) {
         this.set(key, updater(this.safeGet(key, defaultValue), key));
      } else {
         this.set(key, defaultValue);
      }
   }

   public filter(predicate: (value: V, key: K) => boolean): Map<K, V> {
      const newMap = new Map<K, V>();
      for (const [key, value] of this.entries()) {
         if (predicate(value, key)) newMap.set(key, value);
      }
      return newMap;
   }

   public merge(
      map: SQLiteMap<K, V> | Map<K, V>,
      resolve: (key: K, A: V, B: V) => V = (_key: K, _A: V, B: V) => B
   ): void {
      for (const [key, value] of map.entries()) {
         if (this.has(key)) {
            this.set(key, resolve(key, this.safeGet(key, value), value));
         } else {
            this.set(key, value);
         }
      }
   }

   public get keyArray(): Array<K> {
      return Array.from(this.keys());
   }

   public get valueArray(): Array<V> {
      return Array.from(this.values());
   }

   public get entriesArray(): Array<[K, V]> {
      return Array.from(this.entries());
   }

   public get randomKey(): K {
      const keys = this.keyArray;
      return keys[Math.floor(Math.random() * keys.length)];
   }

   public get randomValue(): V {
      const values = this.valueArray;
      return values[Math.floor(Math.random() * values.length)];
   }

   public get randomEntry(): [K, V] {
      const entries = this.entriesArray;
      return entries[Math.floor(Math.random() * entries.length)];
   }
}

export class SQLiteSet<T> extends SQLiteCollectionBase {
   private readonly cache?: LruCache<string, boolean>;
   private readonly selectExists: Database.Statement<[string], { present: number } | undefined>;
   private readonly insertIgnore: Database.Statement<{ key: string }>;
   private readonly deleteKey: Database.Statement<[string]>;
   private readonly selectKeys: Database.Statement<[], { key_hash: string }>;
   private readonly clearAll: Database.Statement<[]>;

   public constructor(options?: SQLiteCollectionOptions) {
      super(options, "sqlite_set");
      this.cache = this.cacheSize > 0 ? new LruCache<string, boolean>(this.cacheSize) : undefined;
      this.selectExists = this.db.prepare(`SELECT 1 as present FROM ${this.table} WHERE key_hash = ?`);
      this.insertIgnore = this.db.prepare(`INSERT OR IGNORE INTO ${this.table} (key_hash, value) VALUES (@key, NULL)`);
      this.deleteKey = this.db.prepare(`DELETE FROM ${this.table} WHERE key_hash = ?`);
      this.selectKeys = this.db.prepare(`SELECT key_hash FROM ${this.table} ORDER BY id ASC`);
      this.clearAll = this.db.prepare(`DELETE FROM ${this.table}`);
   }

   public has(value: T): boolean {
      const keyHash = this.encodeKey(value);
      const cached = this.cache?.get(keyHash);
      if (cached !== undefined) return cached;
      const exists = Boolean(this.selectExists.get(keyHash));
      this.cache?.set(keyHash, exists);
      return exists;
   }

   public add(value: T): this {
      const keyHash = this.encodeKey(value);
      const result = this.insertIgnore.run({ key: keyHash });
      if (result.changes > 0) this.sizeCache += 1;
      this.cache?.set(keyHash, true);
      return this;
   }

   public delete(value: T): boolean {
      const keyHash = this.encodeKey(value);
      const result = this.deleteKey.run(keyHash);
      if (result.changes > 0) {
         this.sizeCache -= 1;
         this.cache?.set(keyHash, false);
         return true;
      }
      return false;
   }

   public clear(options?: { backup?: boolean; backupPath?: string }): void {
      this.maybeBackup(options?.backup, options?.backupPath);
      this.clearAll.run();
      this.sizeCache = 0;
      this.cache?.clear();
   }

   private *entriesIterator(): IterableIterator<[T, T]> {
      const rows = this.selectKeys.iterate() as IterableIterator<{ key_hash: string }>;
      for (const row of rows) {
         const key = this.decodeKey(row.key_hash) as T;
         if (key === undefined && row.key_hash.startsWith("undefined:") === false) continue;
         yield [key, key];
      }
   }

   private *keysIterator(): IterableIterator<T> {
      const rows = this.selectKeys.iterate() as IterableIterator<{ key_hash: string }>;
      for (const row of rows) {
         const key = this.decodeKey(row.key_hash) as T;
         if (key === undefined && row.key_hash.startsWith("undefined:") === false) continue;
         yield key;
      }
   }

   private *valuesIterator(): IterableIterator<T> {
      yield* this.keysIterator();
   }

   public entries(): SetIterator<[T, T]> {
      return this.entriesIterator() as unknown as SetIterator<[T, T]>;
   }

   public keys(): SetIterator<T> {
      return this.keysIterator() as unknown as SetIterator<T>;
   }

   public values(): SetIterator<T> {
      return this.valuesIterator() as unknown as SetIterator<T>;
   }

   public forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: unknown): void {
      for (const value of this.values()) {
         callbackfn.call(thisArg, value, value, this);
      }
   }

   public union<U>(other: ReadonlySetLikeCompat<U>): Set<T | U> {
      const result = new Set<T | U>();
      for (const value of this.values()) result.add(value);
      forEachReadonlySetLike(other, (value) => result.add(value));
      return result;
   }

   public intersection<U>(other: ReadonlySetLikeCompat<U>): Set<T & U> {
      const result = new Set<T & U>();
      for (const value of this.values()) {
         if (other.has(value as unknown as U)) result.add(value as T & U);
      }
      return result;
   }

   public difference<U>(other: ReadonlySetLikeCompat<U>): Set<T> {
      const result = new Set<T>();
      for (const value of this.values()) {
         if (!other.has(value as unknown as U)) result.add(value);
      }
      return result;
   }

   public symmetricDifference<U>(other: ReadonlySetLikeCompat<U>): Set<T | U> {
      const result = new Set<T | U>();
      for (const value of this.values()) {
         if (!other.has(value as unknown as U)) result.add(value);
      }
      forEachReadonlySetLike(other, (value) => {
         if (!this.has(value as unknown as T)) result.add(value);
      });
      return result;
   }

   public isSubsetOf<U>(other: ReadonlySetLikeCompat<U>): boolean {
      for (const value of this.values()) {
         if (!other.has(value as unknown as U)) return false;
      }
      return true;
   }

   public isSupersetOf<U>(other: ReadonlySetLikeCompat<U>): boolean {
      let isSuperset = true;
      forEachReadonlySetLike(other, (value) => {
         if (!this.has(value as unknown as T)) isSuperset = false;
      });
      if (!isSuperset) return false;
      return true;
   }

   public isDisjointFrom<U>(other: ReadonlySetLikeCompat<U>): boolean {
      for (const value of this.values()) {
         if (other.has(value as unknown as U)) return false;
      }
      return true;
   }

   public [Symbol.iterator](): SetIterator<T> {
      return this.values();
   }

   public get [Symbol.toStringTag](): string {
      return "SQLiteSet";
   }
}
