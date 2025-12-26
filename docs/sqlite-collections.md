# SQLiteCollections

SQLite-backed `Map` and `Set` replacements with synchronous behavior. The goal is to keep the same day-to-day feel as native `Map`/`Set` while letting SQLite do the storage work.

# Core behavior

## Keys
- Primitive keys (`string`, `number`, `boolean`, `null`, `undefined`, `bigint`) persist across restarts.
- Object and symbol keys are identity-based and process-scoped, matching native `Map`/`Set` rules inside a single process.
- Object/symbol keys are not meaningful after restart, and are purged by default on startup.

## Values
- Values are serialized as JSON with special handling for `Map`, `Set`, `BigInt`, and non-finite numbers.
- Nested `Map`/`Set` values round-trip correctly through JSON serialization.

## Order
- Iteration order follows insertion order (via an auto-incrementing `id` column).
- Delete + reinsert moves a key to the end, matching native `Map`/`Set`.

# Configuration

The constructor accepts an options object. The table below describes each option, defaults, and behavior.

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| filename | string | `:memory:` | SQLite database path or `:memory:` for in-memory DB. |
| table | string | `sqlite_map` / `sqlite_set` | Table name (sanitized). |
| debug | boolean | `false` | Logs SQL statements via `better-sqlite3` verbose mode. |
| pragmas | string[] | `["journal_mode = WAL", "synchronous = NORMAL"]` | SQLite pragmas applied on open. |
| serializer | (value) => string | internal | Serializer for values. |
| deserializer | (value) => unknown | internal | Deserializer for values. |
| purgeStaleObjectKeys | boolean | `true` | Removes object/symbol keys on startup since they cannot be resolved. |
| backupOnClear | boolean | `true` | Creates a backup on `clear()` by default. |
| backupDirectory | string | unset | Where backups are stored when using defaults. |
| backupSuffix | string | unset | Optional suffix appended to backup filenames. |
| cacheSize | number | `256` | Max size of the in-memory LRU cache. `0` disables caching. |
| objectKeyTracking | `"full"` \| `"weak"` | `"full"` | `"full"` preserves object keys for iteration. `"weak"` allows GC at the cost of losing object keys during iteration. |

# Cache size guidance

The cache holds values only. If your values are large arrays or nested structures, the cache can become a meaningful memory footprint. You may wish to adjust your cache size based on use case.

Typical starting points:
- `64` to `128` when values are large and repeated reads are localized.
- `256` or higher when values are small and you reuse keys heavily.
- `0` when you want SQLite-only behavior.

# Object key tracking

The default `"full"` mode keeps a reverse lookup table so `keys()` and `entries()` can return object keys. This preserves `Map`/`Set` behavior but keeps those objects alive in memory for as long as the collection exists.

The `"weak"` mode avoids that reverse table. It reduces memory pressure, but object keys can disappear from iteration after garbage collection, and should be treated as best-effort.

# Common patterns

## Track user-specific tokens with a set

Why: when you have a long-running bot, you often want to track small bits of user state (interests, tags, preferences) without loading a whole user profile every time.

This example stores a per-user set of tokens and checks membership without loading the full set into memory.

```ts
import { SQLiteSet } from "./SQLiteCollections";

const userTokens = new SQLiteSet<string>({
  filename: "brain.db",
  table: "user_tokens",
  cacheSize: 128
});

const addToken = (token: string): void => {
  if (!userTokens.has(token)) {
    userTokens.add(token);
  }
};

addToken("cat");
addToken("dog");
addToken("bird");

console.log(userTokens.has("cat"));
// true
```

## Track seen message IDs to prevent duplicates

Why: avoids double-processing messages when a webhook retries, a bot reconnects, or the same event is delivered twice.

```ts
import { SQLiteSet } from "./SQLiteCollections";

const seenMessages = new SQLiteSet<string>({
  filename: "brain.db",
  table: "seen_messages",
  cacheSize: 256
});

const shouldProcess = (messageId: string): boolean => {
  if (seenMessages.has(messageId)) return false;
  seenMessages.add(messageId);
  return true;
};
```

## Use a set alongside a map for a simple index

Why: keeps a compact list of known tags while still letting you query by tag.

```ts
import { SQLiteMap, SQLiteSet } from "./SQLiteCollections";

const byTag = new SQLiteMap<string, string[]>({
  filename: "brain.db",
  table: "tag_index",
  cacheSize: 64
});

const allTags = new SQLiteSet<string>({
  filename: "brain.db",
  table: "all_tags",
  cacheSize: 128
});

const tagItem = (tag: string, itemId: string): void => {
  const ids = byTag.get(tag) ?? [];
  if (!ids.includes(itemId)) ids.push(itemId);
  byTag.set(tag, ids);
  allTags.add(tag);
};
```

# API coverage

The goal is to mirror `Map` and `Set` as closely as possible while keeping storage in SQLite. The tables below show the methods implemented and any special notes.

## SQLiteMap compatibility

| Method | Support | Notes |
| ------ | ------- | ----- |
| `constructor` | yes | Accepts options object. |
| `size` | yes | Maintained in memory, updated on write. |
| `get` | yes | Returns deserialized value. |
| `set` | yes | Inserts or updates. |
| `has` | yes | Uses cache when enabled. |
| `delete` | yes | Removes a key. |
| `clear` | yes | Optionally backs up before clearing. |
| `keys` | yes | Iteration order matches insertion order. |
| `values` | yes | Iteration order matches insertion order. |
| `entries` | yes | Iteration order matches insertion order. |
| `forEach` | yes | Same callback signature as native Map. |
| `[Symbol.iterator]` | yes | Returns entries iterator. |
| `[Symbol.toStringTag]` | yes | `"SQLiteMap"`. |

## SQLiteSet compatibility

| Method | Support | Notes |
| ------ | ------- | ----- |
| `constructor` | yes | Accepts options object. |
| `size` | yes | Maintained in memory, updated on write. |
| `add` | yes | Inserts if not present. |
| `has` | yes | Uses cache when enabled. |
| `delete` | yes | Removes a value. |
| `clear` | yes | Optionally backs up before clearing. |
| `keys` | yes | Same as `values`. |
| `values` | yes | Iteration order matches insertion order. |
| `entries` | yes | Iteration order matches insertion order. |
| `forEach` | yes | Same callback signature as native Set. |
| `[Symbol.iterator]` | yes | Returns values iterator. |
| `[Symbol.toStringTag]` | yes | `"SQLiteSet"`. |
| `union` | yes | ES2023 set method. |
| `intersection` | yes | ES2023 set method. |
| `difference` | yes | ES2023 set method. |
| `symmetricDifference` | yes | ES2023 set method. |
| `isSubsetOf` | yes | ES2023 set method. |
| `isSupersetOf` | yes | ES2023 set method. |
| `isDisjointFrom` | yes | ES2023 set method. |

# Compatibility notes

## Older ECMAScript targets

If you are targeting older ECMAScript versions that do not include the ES2023 Set methods (`union`, `intersection`, etc.), the runtime behavior is still fine because these methods are implemented here. The only potential friction is in TypeScript type definitions, not at runtime.

This file keeps the public classes structurally compatible with both older and newer lib definitions by not hard‑binding to the ES2023 `Set` interface in the class declaration. That keeps the runtime the same and avoids forcing users to change their build config just to use the library.

# Example

This is a more complete example that mirrors how a small bot brain might use a lexicon and n-gram index. The `lexicon` maps tokens to the n-grams that contain them. The `nGrams` map tracks the n-gram itself and a basic count.

```ts
import { SQLiteMap } from "./SQLiteCollections";

const lexicon = new SQLiteMap<string, string[]>({
  filename: "brain.db",
  table: "lexicon",
  cacheSize: 128,
  backupOnClear: true,
  backupDirectory: "./data/brain-backups"
});

const nGrams = new SQLiteMap<string, { count: number; tokens: string[] }>({
  filename: "brain.db",
  table: "ngrams",
  cacheSize: 64
});

const addNGram = (ngram: string, tokens: string[]): void => {
  const current = nGrams.get(ngram);
  if (current) {
    current.count += 1;
    nGrams.set(ngram, current);
  } else {
    nGrams.set(ngram, { count: 1, tokens });
  }

  for (const token of tokens) {
    const existing = lexicon.get(token) ?? [];
    if (existing.includes(ngram)) continue;
    existing.push(ngram);
    lexicon.set(token, existing);
  }
};

addNGram("the|cat|is", ["the", "cat", "is"]);
addNGram("the|dog|is", ["the", "dog", "is"]);
addNGram("the|bird|is", ["the", "bird", "is"]);
addNGram("the|chair|is", ["the", "chair", "is"]);

console.log(lexicon.get("the"));
// ["the|cat|is", "the|dog|is", "the|bird|is", "the|chair|is"]

console.log(nGrams.get("the|cat|is"));
// { count: 1, tokens: ["the", "cat", "is"] }

// If you need a reset, clear will snapshot first (unless you disable it).
// lexicon.clear();
// nGrams.clear();
```
