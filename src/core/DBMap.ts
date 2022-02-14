/*
   Self-Contained Map and Set extensions.
   Adds filter, merge, update, loading/saving from/to SQLite, and other stuff.
   Requires: better-sqlite3 (don't waste time w/node-sqlite3 or others)
*/

import Database from "better-sqlite3";

const idgen = (slug?: string) => [slug ?? "", Date.now().toString(36), Math.random().toString(36).substring(2)].join("_");

export function JSONReviver(this: any, _key: string, value: any) {
   if (typeof value === 'object' && value !== null) {
      const ctor = Reflect.get(value, "__ctor") ?? undefined;
      if (ctor === 'Map') return new Map(Reflect.get(value, "value"));
      if (ctor === 'Set') return new Set(Reflect.get(value, "value"));
   }
   return value;
}

export function JSONReplacer(this: any, key: string, value: any) {
   const originalObject = this[key];
   if (originalObject instanceof Map) {
      return { __ctor: "Map", value: Array.from(originalObject.entries()) }
   } else if (originalObject instanceof Set) {
      return { __ctor: "Set", value: Array.from(originalObject) }
   } else { 
      return value;
   }
}

export class DBMap<K, V> {
   public debug: boolean;
   public readonly uniqueValues: boolean;
   private db: Database.Database | undefined = undefined;   
   private dbStatements: {
      insert: undefined | Database.Statement<{ key: string, value: string }>;
      select: undefined | Database.Statement<string>;
      delete: undefined | Database.Statement<string>;
      selectKeys: undefined | Database.Statement<string[]>;
      selectValues: undefined | Database.Statement<string[]>;
      selectEntries: undefined | Database.Statement<{ key: string, value: string }[]>;
      count: undefined | Database.Statement;
   } = {
      insert: undefined, select: undefined, delete: undefined, selectKeys: undefined, selectValues: undefined, selectEntries: undefined, count: undefined
   };
   private dbActions: {
      insert: undefined | ((key: string, value: string) => void);
      select: undefined | ((key: string) => string | undefined);
      delete: undefined | ((key: string) => void);
      count: undefined | (() => number);
   } = { insert: undefined, select: undefined, delete: undefined, count: undefined };
   private table: string = "";
   private datafile: string = "";
   private name: string = "";
   private keycache: Array<{ key: K, string: string }> = new Array();
   private keystring(key: K): string {      
      let keystring = this.keycache.find(n => n.key === key)?.string ?? "";
      if (!keystring) {
         keystring = JSON.stringify(key, JSONReplacer);
         this.keycache.push({ key: key, string: keystring });
      }
      return keystring;
   }

   private closeDB(): void {
      if (!this.db) return;
      this.db.close();
   }
   private initDB = (filename: string): void => {
      try {
         if (!filename) return;
         if (this.debug) console.info(`[DBMap-${this.name}] Loading or creating database file: ${filename}`);
         const db = new Database(filename, this.debug ? { verbose: (text) => console.info(`[SQL] ${text}`) } : {});

         // Synchronous NORMAL (1) slows it down a bit, but prevents corruption in the event of failure
         db.pragma("synchronous = 1");
         // Journal mode WAL not really needed, but pairs with normal synchronous mode to prevent corruption
         db.pragma("journal_mode = wal");
         
         if (this.debug) console.info(`[DBMap-${this.name}] Checking or creating table: ${this.table}`);
         db.prepare(`CREATE TABLE IF NOT EXISTS ${this.table} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            CONSTRAINT key_unique UNIQUE ${this.uniqueValues ? `(key, value)` : `(key)`}
         )`).run();
                 
         // Iterators
         this.dbStatements.selectValues = db.prepare(`SELECT value FROM ${this.table}`);         
         this.dbStatements.selectKeys = db.prepare(`SELECT key FROM ${this.table}`);
         this.dbStatements.selectEntries = db.prepare(`SELECT key,value FROM ${this.table}`);
         

         // Single use functions, no transaction needed (no changes made)
         this.dbStatements.select = db.prepare(`SELECT value FROM ${this.table} WHERE key = ?`);
         this.dbActions.select = (key: string): string | undefined => {
            if (!key) return "";
            const obj = this.dbStatements.select!.get(key) ?? undefined;            
            if (!obj || !obj['value']) return undefined;
            return obj['value'];
         }

         // Single use functions, transaction needed (changes made -- transactions won't be committed unless they are successful)
         this.dbStatements.insert = db.prepare(`INSERT OR REPLACE INTO ${this.table} (key, value) VALUES (@key, @value)`);
         this.dbActions.insert = (key: string, value: string): Database.RunResult => {
            const tx = db.transaction((data: { key: string, value: string }) => this.dbStatements.insert!.run(data));
            return tx({ key: key, value: value });            
         }

         this.dbStatements.delete = db.prepare(`DELETE FROM ${this.table} WHERE key = ?`);
         this.dbActions.delete = (key: string): Database.RunResult => {
            const tx = db.transaction((key: string) => this.dbStatements.delete!.run(key));
            return tx(key);            
         }

         this.dbStatements.count = db.prepare(`SELECT COUNT(*) FROM ${this.table}`);
         this.dbActions.count = (): number => {
            const result: { [request: string]: number } = this.dbStatements.count!.get();
            if (this.debug) {
               console.log(`[SQL] Retrieving row count of ${this.table}:`);
               console.dir(result);
            }
            if (!result) return 0;
            let value = Number(result['COUNT(*)']) ?? 0;
            return (value !== NaN) ? value : 0;
         }
         
         this.db = db;

         process.on('exit', () => this.closeDB());
                           

      } catch (err: unknown) {
         if (err instanceof Error) {
            // TODO: Implement cleaner error handling
            if (this.debug) console.error(`Error while initializing DBMap. Contents of 'this':`);
            if (this.debug) console.dir(this);
            if (this.debug) console.error(`Actual error: ${err.message}`);
            throw err;
         } else {            
            if (this.debug) console.error(`Error while initializing DBMap. Contents of 'this':`);
            if (this.debug) console.dir(this);
            if (this.debug) console.error(`Actual error: ${JSON.stringify(err)}`);
         }
      }
   }
   public delete(key: K): void {
      if (!this.has(key) || !this.dbActions.delete) return;
      const target = this.keystring(key);
      if (this.debug) console.info(`[DBMap-${this.name}] Deleting key '${target}'`);
      this.dbActions.delete(target);

      const keyindex = this.keycache.findIndex(keystring => keystring.string === target);
      if (keyindex >= 0) this.keycache.splice(keyindex, 1);
      
      return;
   }
   public get(key: K): V | undefined {
      if (!this.dbActions.select) return undefined;
      const keystring = this.keystring(key);
      const value = this.dbActions.select(keystring);
      if (!value) return undefined;
      if (this.debug) console.info(`[DBMap-${this.name}] Getting value of '${keystring}'`);
      try {
         return JSON.parse(value, JSONReviver);
      } catch {
         if (this.debug) console.error(`[DBMap-${this.name}] Unable to parse value for key '${keystring}'.`);
         return undefined;
      }
   }

   public set(key: K, value: V): void {
      if (!value || !this.dbActions.insert) return;
      
      const keystring = this.keystring(key);
      const valuestring = JSON.stringify(value, JSONReplacer);
      if (this.debug) console.info(`[DBMap-${this.name}] Setting value of '${keystring}'`);      
      this.dbActions.insert(keystring, valuestring);
      
      return;      
   }
   public has(key: K): boolean {
      return Boolean(this.keystring(key) ?? false);
   }
   
   public clear(): void {
      this.keycache = new Array();      
      // technically does not delete the table, to prevent accidents, and just makes a new one
      this.table = this.name ?? "dbmap";
      if (this.db) {
         // rename the table for backup purposes, and close the current database connection
         this.db.prepare(`ALTER TABLE ${this.table} RENAME TO ${idgen(this.table)}`).run();
         this.closeDB();
      }
      this.initDB(this.datafile);
      return;
   }

   public get size(): number {
      if (!this.dbActions.count) return 0;
      return this.dbActions.count(); 
   }
   
   public constructor(datafile: string = ":memory:", name: string = "dbmap", uniqueValues: boolean = false, newEntries?: readonly (readonly [K, V])[] | null, debug: boolean = false) {
      
      this.debug = debug;
      this.uniqueValues = uniqueValues;

      if (!datafile) throw new TypeError(`${this.toString()} requires a valid database filepath or :memory:. Path provided was invalid: ${datafile}`);
      this.name = name;      
      this.initialize(datafile); // Initialize database
      
      if (!newEntries) return;
      newEntries.map(([key, value]) => this.set(key, value));     
   }

   public initialize = (datafile: string): void => {
      if (!datafile) return;
      this.datafile = datafile;
      this.clear(); // Note: clear() also runs initDB()
   }
  
   public *entries(): IterableIterator<[K, V]> {
      if (!this.dbStatements.selectEntries) return;
      for (const entry of this.dbStatements.selectEntries.iterate() as unknown as IterableIterator<{ key: string, value: string }>) {
         if (!entry.key || !entry.value) continue;
         const key = JSON.parse(entry.key, JSONReviver) as K;
         const value = JSON.parse(entry.value, JSONReviver) as V;         
         yield [key, value];
      }
   }

   public *keys(): IterableIterator<K> {      
      if (!this.dbStatements.selectKeys) return;
      for (const entry of this.dbStatements.selectKeys.iterate() as unknown as IterableIterator<{ key: string }>) {
         if (!entry.key) continue;
         const key = JSON.parse(entry.key, JSONReviver) as K;                  
         yield key;
      }  

   }
   public *values(): IterableIterator<V> {
      if (!this.dbStatements.selectValues) return;
      for (const entry of this.dbStatements.selectValues.iterate() as unknown as IterableIterator<{ value: string }>) {
         if (!entry.value) continue;
         const value = JSON.parse(entry.value, JSONReviver) as V;
         yield value;
      }
   }

   // self-definition things
   public get [Symbol.toStringTag](): string {
      return `DBMap[${this.name}]`;
   }

   public get toJSON(): string {
      return "none"//JSON.stringify(this);
   }

   // additional functionality for map structure
   public safeGet(key: K, defaultValue: V): V {
      return this.get(key) ?? defaultValue;
   }

   public update(
      key: K,
      updater: (value: V, key: K) => V,
      defaultValue: V
   ): void {
      if (this.has(key)) {
         this.set(key, updater(this.safeGet(key, defaultValue), key));
      } else {
         this.set(key, defaultValue);
      }
   }   
   
   public filter(predicate: (value: V, key: K) => boolean): Map<K, V> {
      // Returns a standard Map<K, V>, not a new database map. Changes to the retuened map will not save to database.
      
      // Essentially does a slow version of: SELECT * FROM table WHERE predicate(row.value, row.key) = true
      // Where predicate is (for example) a function: (value, key) => { return (key.id === "name" && value.id === "Joe") }
      // TODO: Use SQL evaluation for predicate

      const newMap: Map<K, V> = new Map<K, V>();
      const entries: Array<[K, V]> = this.entriesArray;
      for (const [key, value] of entries) {
         if (predicate(value, key)) newMap.set(key, value);
      }
      return newMap;
   }

   public merge(
      map: DBMap<K, V>,
      resolve: (key: K, A: V, B: V) => V = (_key: K, _A: V, B: V) => B
   ): void {      
      const entries: Array<[K, V]> = Array.from(map.entries()) ?? [];
      for (const [key, value] of entries) {
         if (this.has(key)) {
            this.set(key, resolve(key, this.safeGet(key, value), value));
         } else {
            this.set(key, value);
         }
      }
   }
   
   // convenience things
   public get keyArray(): Array<K> {
      return Array.from(this.keys() ?? []);
   }

   public get valueArray(): Array<V> {
      return Array.from(this.values() ?? []);
   }

   public get entriesArray(): Array<[K, V]> {      
      return Array.from(this.entries() ?? []);
   }   

   public get randomKey(): K {
      const keys: Array<K> = this.keyArray;
      return keys[Math.floor(Math.random() * keys.length)];
   }

   public get randomValue(): V {
      const values: Array<V> = this.valueArray;
      return values[Math.floor(Math.random() * values.length)];
   }
   
   public get randomEntry(): [K, V] {
      const entries: Array<[K, V]> = this.entriesArray;
      return entries[Math.floor(Math.random() * entries.length)];
   }
}
