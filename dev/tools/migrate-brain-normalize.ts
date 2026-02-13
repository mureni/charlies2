import "tsconfig-paths/register";
import Database from "better-sqlite3";
import { JSONReplacer, JSONReviver } from "@/core/SQLiteCollections";
import { env, requireEnv, initEnvConfig } from "@/utils";

interface NGram {
   tokens: string[];
   canStart: boolean;
   canEnd: boolean;
   nextTokens: Map<string, number>;
   previousTokens: Map<string, number>;
}

const WORD_SEPARATOR = "\u2502";

initEnvConfig();

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
   typeof value === "object" && value !== null && !Array.isArray(value);

const deserializeValue = (valueText: string): unknown => {
   const parsed = JSON.parse(valueText, JSONReviver) as unknown;
   if (isPlainObject(parsed) && Reflect.get(parsed, "__sqliteCollection") === 1) {
      const kind = Reflect.get(parsed, "kind");
      if (kind === "undefined") return undefined;
      return Reflect.get(parsed, "value");
   }
   return parsed;
};

const serializeValue = (value: unknown): string => {
   return JSON.stringify({
      __sqliteCollection: 1,
      kind: value === undefined ? "undefined" : "value",
      value
   }, JSONReplacer);
};

const encodeStringKey = (value: string): string => {
   return `string:${JSON.stringify(value)}`;
};

const normalizeFrequency = (value: unknown): Map<string, number> => {
   if (value instanceof Map) {
      const result = new Map<string, number>();
      for (const [key, count] of value.entries()) {
         if (typeof key !== "string") continue;
         const next = typeof count === "number" ? count : Number(count);
         if (!Number.isFinite(next)) continue;
         result.set(key.toLowerCase(), (result.get(key.toLowerCase()) ?? 0) + next);
      }
      return result;
   }
   if (isPlainObject(value)) {
      const result = new Map<string, number>();
      for (const [key, count] of Object.entries(value)) {
         const next = typeof count === "number" ? count : Number(count);
         if (!Number.isFinite(next)) continue;
         const lower = key.toLowerCase();
         result.set(lower, (result.get(lower) ?? 0) + next);
      }
      return result;
   }
   return new Map<string, number>();
};

const normalizeNGram = (value: unknown): NGram | undefined => {
   if (!isPlainObject(value)) return undefined;
   const tokens = Reflect.get(value, "tokens");
   if (!Array.isArray(tokens)) return undefined;
   const lowered = tokens.map(token => String(token).toLowerCase());
   const canStart = Boolean(Reflect.get(value, "canStart"));
   const canEnd = Boolean(Reflect.get(value, "canEnd"));
   const nextTokens = normalizeFrequency(Reflect.get(value, "nextTokens"));
   const previousTokens = normalizeFrequency(Reflect.get(value, "previousTokens"));
   return {
      tokens: lowered,
      canStart,
      canEnd,
      nextTokens,
      previousTokens
   };
};

const mergeNGram = (target: NGram, source: NGram): NGram => {
   const nextTokens = new Map<string, number>(target.nextTokens);
   const previousTokens = new Map<string, number>(target.previousTokens);
   for (const [token, count] of source.nextTokens.entries()) {
      nextTokens.set(token, (nextTokens.get(token) ?? 0) + count);
   }
   for (const [token, count] of source.previousTokens.entries()) {
      previousTokens.set(token, (previousTokens.get(token) ?? 0) + count);
   }
   return {
      tokens: target.tokens,
      canStart: target.canStart || source.canStart,
      canEnd: target.canEnd || source.canEnd,
      nextTokens,
      previousTokens
   };
};

const tableExists = (db: Database.Database, table: string): boolean => {
   const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
   ).get(table) as { name?: string } | undefined;
   return Boolean(row?.name);
};

const getTableColumns = (db: Database.Database, table: string): string[] => {
   const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
   return rows.map(row => row.name);
};

const resolveKeyColumn = (columns: string[]): string => {
   if (columns.includes("key_hash")) return "key_hash";
   if (columns.includes("key")) return "key";
   throw new Error(`No key column found (expected key_hash or key). Columns: ${columns.join(", ")}`);
};

const main = (): void => {
   const dbPath = requireEnv("DB_PATH");
   const lexiconTable = env("LEXICON_TABLE", "lexicon") ?? "lexicon";
   const ngramsTable = env("NGRAMS_TABLE", "ngrams") ?? "ngrams";
   const timestamp = Date.now();
   const lexiconBackup = `${lexiconTable}_legacy_${timestamp}`;
   const ngramsBackup = `${ngramsTable}_legacy_${timestamp}`;

   const db = new Database(dbPath);

   if (!tableExists(db, lexiconTable) || !tableExists(db, ngramsTable)) {
      throw new Error(`Missing tables. Expected ${lexiconTable} and ${ngramsTable}`);
   }

   const lexiconColumns = getTableColumns(db, lexiconTable);
   const ngramsColumns = getTableColumns(db, ngramsTable);
   const lexiconKeyColumn = resolveKeyColumn(lexiconColumns);
   const ngramsKeyColumn = resolveKeyColumn(ngramsColumns);

   db.prepare(`ALTER TABLE ${lexiconTable} RENAME TO ${lexiconBackup}`).run();
   db.prepare(`ALTER TABLE ${ngramsTable} RENAME TO ${ngramsBackup}`).run();

   db.prepare(`CREATE TABLE IF NOT EXISTS ${lexiconTable} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash TEXT NOT NULL UNIQUE,
      value TEXT
   )`).run();
   db.prepare(`CREATE TABLE IF NOT EXISTS ${ngramsTable} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash TEXT NOT NULL UNIQUE,
      value TEXT
   )`).run();

   const ngramRows = db.prepare(`SELECT ${ngramsKeyColumn} as key_hash, value FROM ${ngramsBackup}`).all() as Array<{ key_hash: string; value: string }>;
   const normalizedNGrams = new Map<string, NGram>();

   for (const row of ngramRows) {
      const parsed = deserializeValue(row.value);
      const normalized = normalizeNGram(parsed);
      if (!normalized || normalized.tokens.length === 0) continue;
      const hash = normalized.tokens.join(WORD_SEPARATOR);
      const existing = normalizedNGrams.get(hash);
      normalizedNGrams.set(hash, existing ? mergeNGram(existing, normalized) : normalized);
   }

   const insertNGram = db.prepare(`INSERT INTO ${ngramsTable} (key_hash, value) VALUES (@key_hash, @value)`);
   const insertLexicon = db.prepare(`INSERT INTO ${lexiconTable} (key_hash, value) VALUES (@key_hash, @value)`);

   const lexiconMap = new Map<string, Set<string>>();

   const ngramEntries = Array.from(normalizedNGrams.entries());
   const ngramTx = db.transaction((entries: Array<[string, NGram]>) => {
      for (const [hash, ngram] of entries) {
         insertNGram.run({
            key_hash: encodeStringKey(hash),
            value: serializeValue(ngram)
         });
         for (const token of ngram.tokens) {
            const set = lexiconMap.get(token) ?? new Set<string>();
            set.add(hash);
            lexiconMap.set(token, set);
         }
      }
   });
   ngramTx(ngramEntries);

   const lexiconEntries = Array.from(lexiconMap.entries());
   const lexiconTx = db.transaction((entries: Array<[string, Set<string>]>) => {
      for (const [token, hashes] of entries) {
         insertLexicon.run({
            key_hash: encodeStringKey(token),
            value: serializeValue(hashes)
         });
      }
   });
   lexiconTx(lexiconEntries);

   console.log(`[migrate] ngrams: ${ngramEntries.length} rows (source key: ${ngramsKeyColumn})`);
   console.log(`[migrate] lexicon: ${lexiconEntries.length} rows (source key: ${lexiconKeyColumn})`);
   console.log(`[migrate] backups: ${lexiconBackup}, ${ngramsBackup}`);

   db.close();
};

main();
