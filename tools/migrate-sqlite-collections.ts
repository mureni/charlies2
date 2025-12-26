import Database from "better-sqlite3";
import { JSONReviver } from "../src/core/SQLiteCollections";

type MigrationConfig = {
   filename: string;
   tables: string[];
};

const config: MigrationConfig = {
   filename: process.env.DB_PATH ?? "",
   tables: process.env.DB_TABLES ? process.env.DB_TABLES.split(",") : []
};

const requireEnv = (value: string, name: string): string => {
   if (!value) {
      throw new Error(`Missing env var: ${name}`);
   }
   return value;
};

const migrateTable = (dbPath: string, table: string): void => {
   const db = new Database(dbPath);
   const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
   const hasKeyHash = columns.some((column) => column.name === "key_hash");
   const hasLegacyKey = columns.some((column) => column.name === "key");

   if (hasKeyHash) {
      console.log(`[migrate] ${table}: already on key_hash schema`);
      db.close();
      return;
   }
   if (!hasLegacyKey) {
      console.log(`[migrate] ${table}: no legacy schema found`);
      db.close();
      return;
   }

   const legacyTable = `${table}_legacy_${Date.now()}`;
   db.prepare(`ALTER TABLE ${table} RENAME TO ${legacyTable}`).run();
   db.prepare(`CREATE TABLE IF NOT EXISTS ${table} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash TEXT NOT NULL UNIQUE,
      value TEXT
   )`).run();

   const rows = db.prepare(`SELECT key, value FROM ${legacyTable}`).all() as Array<{ key: string; value: string }>;
   const insert = db.prepare(`INSERT INTO ${table} (key_hash, value) VALUES (@key_hash, @value)`);
   const tx = db.transaction((entries: Array<{ key_hash: string; value: string }>) => {
      for (const entry of entries) insert.run(entry);
   });

   const migrated = rows.map((row) => {
      let parsedKey: unknown = row.key;
      try {
         parsedKey = JSON.parse(row.key, JSONReviver);
      } catch {
         parsedKey = row.key;
      }
      return { key_hash: encodeKey(parsedKey), value: row.value };
   });

   tx(migrated);
   const legacyCount = rows.length;
   const newCount = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
   const distinctCount = db.prepare(`SELECT COUNT(DISTINCT key_hash) as count FROM ${table}`).get() as { count: number };
   const sample = db
      .prepare(`SELECT key, value FROM ${legacyTable} ORDER BY RANDOM() LIMIT 5`)
      .all() as Array<{ key: string; value: string }>;

   console.log(`[migrate] ${table}: migrated ${migrated.length} rows (legacy table: ${legacyTable})`);
   console.log(`[migrate] ${table}: legacy rows=${legacyCount}, new rows=${newCount.count}, distinct keys=${distinctCount.count}`);
   if (legacyCount !== newCount.count) {
      console.warn(`[migrate] ${table}: row count mismatch`);
   }
   if (distinctCount.count < newCount.count) {
      console.warn(`[migrate] ${table}: duplicate key_hash entries detected`);
   }
   if (sample.length > 0) {
      console.log(`[migrate] ${table}: sample of legacy rows (pre-migration)`);
      for (const row of sample) {
         console.log(`  key=${row.key} value=${row.value?.slice(0, 120) ?? ""}`);
      }
   }
   db.close();
};

const encodeKey = (key: unknown): string => {
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
   if (keyType === "symbol") return "symbol:legacy";
   if (keyType === "function" || keyType === "object") return "object:legacy";
   throw new TypeError(`Unsupported key type: ${keyType}`);
};

const main = (): void => {
   const filename = requireEnv(config.filename, "DB_PATH");
   const tables = config.tables;
   if (!tables.length) {
      throw new Error("No tables provided. Set DB_TABLES=table1,table2");
   }
   for (const table of tables) {
      migrateTable(filename, table.trim());
   }
};

main();
