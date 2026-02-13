#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const Database = require("better-sqlite3");
const { SQLiteMap } = require("../dist/core/SQLiteCollections");
const { checkFilePath } = require("../dist/utils");

const WORD_SEPARATOR = "\u2502";

const DEFAULT_PARSED = path.join(
  __dirname,
  "..",
  "data",
  "charlies-data-backup",
  "charlies-logs",
  "parsed-chat.json"
);
const DEFAULT_RAW = path.join(
  __dirname,
  "..",
  "data",
  "charlies-data-backup",
  "charlies-logs",
  "raw-2023-to-2025.log"
);
const DEFAULT_OUTPUT = path.join(
  __dirname,
  "..",
  "data",
  "charlies-data-backup",
  "charlies-logs",
  "mentions-users.json"
);
const DEFAULT_PLAN_OUTPUT = path.join(
  __dirname,
  "..",
  "data",
  "charlies-data-backup",
  "charlies-logs",
  "brain-replacements.json"
);

const argv = process.argv.slice(2);
const getArgValue = (flag) => {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= argv.length) return null;
  return argv[idx + 1];
};

const parsedPath = getArgValue("--parsed") || DEFAULT_PARSED;
const rawPath = getArgValue("--raw") || DEFAULT_RAW;
const outputPath = getArgValue("--out") || DEFAULT_OUTPUT;
const planOutputPath = getArgValue("--plan-out") || DEFAULT_PLAN_OUTPUT;
const applyChanges = argv.includes("--apply");
const botName = getArgValue("--bot") || "recharlies";
const minTokenCount = Number(getArgValue("--min-token-count") || 2);
const fuzzyThreshold = Number(getArgValue("--fuzzy-threshold") || 0.88);

const CUSTOM_EMOJI_RX = /<a?:[^:>]+:\d+>/g;
const USER_MENTION_RX = /<@!?\s*(\d+)>/g;
const ROLE_MENTION_RX = /<@&\s*(\d+)>/g;
const CHANNEL_MENTION_RX = /<#\s*(\d+)>/g;
const GROUP_MENTION_RX = /@(?:everyone|here|room)\b/gi;

const GROUP_MENTION_TEST = /@(?:everyone|here|room)\b/i;
const ROLE_MENTION_TEST = /<@&\s*\d+>/i;

const USER_MENTION_CORE = /^<@!?\s*(\d+)>$/;
const ROLE_MENTION_CORE = /^<@&\s*(\d+)>$/;
const CHANNEL_MENTION_CORE = /^<#\s*(\d+)>$/;
const GROUP_MENTION_CORE = /^@(?:everyone|here|room)$/i;
const CUSTOM_EMOJI_CORE = /^<a?:[^:>]+:\d+>$/;

const ENDearments = [
  "pal",
  "buddy",
  "chum",
  "compadre",
  "comrade",
  "friend",
  "my friend",
  "mate",
  "amigo",
  "fella",
  "bro",
  "broseph",
  "darling",
  "sweetheart",
  "sweetpea",
  "honey",
  "sweetie",
];

const EMOJI_POOL = [
  "\u{1F600}",
  "\u{1F602}",
  "\u{1F60E}",
  "\u{1F607}",
  "\u{1F60A}",
  "\u{1F60D}",
  "\u{1F618}",
  "\u{1F44D}",
  "\u{1F44C}",
  "\u{1F389}",
  "\u{1F37B}",
  "\u{1F525}",
  "\u{1F4A1}",
  "\u{1F4AF}",
  "\u{1F31F}",
  "\u{1F330}",
  "\u{1F339}",
  "\u{1F381}",
  "\u{1F680}",
  "\u{1F9E0}",
];

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const buildEndearmentPool = (plural) =>
  ENDearments.map((word) => {
    if (!plural) return word;
    if (word === "buddy") return "buddie";
    if (word === "honey") return "honie";
    return word;
  });

const createEndearmentPicker = (plural) => {
  const pool = shuffle(buildEndearmentPool(plural));
  let idx = 0;
  return () => {
    if (idx >= pool.length) {
      shuffle(pool);
      idx = 0;
    }
    const base = pool[idx];
    idx += 1;
    return `${base}${plural ? "s" : ""}`;
  };
};

const createPoolPicker = (words) => {
  const pool = shuffle([...words]);
  let idx = 0;
  return () => {
    if (idx >= pool.length) {
      shuffle(pool);
      idx = 0;
    }
    const choice = pool[idx];
    idx += 1;
    return choice;
  };
};

const pickSingular = createEndearmentPicker(false);
const pickPlural = createEndearmentPicker(true);
const pickEmoji = createPoolPicker(EMOJI_POOL);

const normalizeToken = (value) => {
  if (!value) return "";
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
};

const splitToken = (token) => {
  if (!token) return { prefix: "", core: "", suffix: "" };
  let prefix = "";
  let suffix = "";
  let core = token;

  const prefixMatch = core.match(/^[\"'“”‘’\(\[\{]+/);
  if (prefixMatch) {
    prefix = prefixMatch[0];
    core = core.slice(prefix.length);
  }

  const suffixMatch = core.match(/[\"”’'\)\]\}!?.:,;]+$/);
  if (suffixMatch) {
    suffix = suffixMatch[0] + suffix;
    core = core.slice(0, -suffixMatch[0].length);
  }

  const possMatch = core.match(/(.+)(['’]s)$/);
  if (possMatch) {
    core = possMatch[1];
    suffix = possMatch[2] + suffix;
  }

  return { prefix, core, suffix };
};

const levenshtein = (a, b) => {
  if (a === b) return 0;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  const matrix = Array.from({ length: aLen + 1 }, () => new Array(bLen + 1).fill(0));
  for (let i = 0; i <= aLen; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= aLen; i += 1) {
    for (let j = 1; j <= bLen; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[aLen][bLen];
};

const similarityScore = (a, b) => {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
};

const readParsedChat = () => {
  const data = JSON.parse(fs.readFileSync(parsedPath, "utf8"));
  const usernames = new Set();
  const tokenCounts = new Map();
  const tokenVariants = new Map();
  const contextHashtags = new Set();

  for (const serverEntry of data) {
    if (!serverEntry?.users) continue;
    for (const userEntry of serverEntry.users) {
      if (userEntry?.username) usernames.add(userEntry.username);
      if (!userEntry?.messages) continue;
      for (const messageEntry of userEntry.messages) {
        const text = messageEntry?.text;
        if (typeof text !== "string") continue;
        const hasGroupMention =
          GROUP_MENTION_TEST.test(text) || ROLE_MENTION_TEST.test(text);
        if (hasGroupMention) {
          const hashtags = text.match(/#\w[\w-]*/g);
          if (hashtags) {
            for (const tag of hashtags) {
              contextHashtags.add(tag.toLowerCase());
            }
          }
        }

        const tokens = text.split(/\s+/);
        for (const token of tokens) {
          const normalized = normalizeToken(token);
          if (!normalized) continue;
          const count = tokenCounts.get(normalized) || 0;
          tokenCounts.set(normalized, count + 1);
          if (!tokenVariants.has(normalized)) tokenVariants.set(normalized, new Set());
          const variants = tokenVariants.get(normalized);
          if (variants && variants.size < 6) variants.add(token);
        }
      }
    }
  }

  return { usernames, tokenCounts, tokenVariants, contextHashtags };
};

const readRawLog = async () => {
  const userMentionIds = new Set();
  const roleMentionIds = new Set();
  const channelMentionIds = new Set();
  const groupMentions = new Set();
  const customEmojiTokens = new Set();

  const stream = fs.createReadStream(rawPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    const logValue =
      typeof record.log === "string"
        ? record.log
        : typeof record["log:"] === "string"
          ? record["log:"]
          : null;
    if (!logValue) continue;

    USER_MENTION_RX.lastIndex = 0;
    ROLE_MENTION_RX.lastIndex = 0;
    CHANNEL_MENTION_RX.lastIndex = 0;
    CUSTOM_EMOJI_RX.lastIndex = 0;
    GROUP_MENTION_RX.lastIndex = 0;

    let match;
    while ((match = USER_MENTION_RX.exec(logValue))) userMentionIds.add(match[1]);
    while ((match = ROLE_MENTION_RX.exec(logValue))) roleMentionIds.add(match[1]);
    while ((match = CHANNEL_MENTION_RX.exec(logValue))) channelMentionIds.add(match[1]);
    while ((match = CUSTOM_EMOJI_RX.exec(logValue))) customEmojiTokens.add(match[0]);
    while ((match = GROUP_MENTION_RX.exec(logValue))) groupMentions.add(match[0].toLowerCase());
  }

  return {
    userMentionIds,
    roleMentionIds,
    channelMentionIds,
    groupMentions,
    customEmojiTokens,
  };
};

const buildFuzzyAliases = (usernames, tokenCounts, tokenVariants) => {
  const normalizedUsers = new Map();
  const usersByLength = new Map();
  for (const username of usernames) {
    const normalized = normalizeToken(username);
    if (!normalized) continue;
    normalizedUsers.set(normalized, username);
    const len = normalized.length;
    if (!usersByLength.has(len)) usersByLength.set(len, new Set());
    usersByLength.get(len).add(normalized);
  }

  const aliases = new Set();
  for (const [tokenNorm, count] of tokenCounts.entries()) {
    if (count < minTokenCount) continue;
    if (tokenNorm.length < 3) continue;
    const len = tokenNorm.length;
    const minLen = Math.max(1, len - 2);
    const maxLen = len + 2;
    const effectiveThreshold = len <= 4 ? Math.max(fuzzyThreshold, 0.92) : fuzzyThreshold;

    for (let l = minLen; l <= maxLen; l += 1) {
      const candidates = usersByLength.get(l);
      if (!candidates) continue;
      for (const userNorm of candidates) {
        if (userNorm === tokenNorm) continue;
        const score = similarityScore(tokenNorm, userNorm);
        if (score >= effectiveThreshold) {
          const variants = tokenVariants.get(tokenNorm);
          if (variants) {
            for (const variant of variants) aliases.add(variant);
          } else {
            aliases.add(tokenNorm);
          }
        }
      }
    }
  }

  return aliases;
};

const main = async () => {
  const parsed = readParsedChat();
  const raw = await readRawLog();
  const fuzzyAliases = buildFuzzyAliases(parsed.usernames, parsed.tokenCounts, parsed.tokenVariants);

  const userReplacement = new Map();
  const mentionReplacement = new Map();
  const roleReplacement = new Map();
  const groupReplacement = new Map();
  const emojiReplacement = new Map();

  const addUserReplacement = (token) => {
    const key = token.toLowerCase();
    if (!userReplacement.has(key)) userReplacement.set(key, pickSingular());
  };

  for (const username of parsed.usernames) addUserReplacement(username);
  for (const alias of fuzzyAliases) addUserReplacement(alias);

  for (const id of raw.userMentionIds) {
    if (!mentionReplacement.has(id)) mentionReplacement.set(id, pickSingular());
  }
  for (const id of raw.roleMentionIds) {
    if (!roleReplacement.has(id)) roleReplacement.set(id, pickPlural());
  }
  for (const group of raw.groupMentions) {
    if (!groupReplacement.has(group)) groupReplacement.set(group, pickPlural());
  }
  for (const emoji of raw.customEmojiTokens) {
    if (!emojiReplacement.has(emoji)) emojiReplacement.set(emoji, pickEmoji());
  }

  const getOrAssignMention = (map, key, picker) => {
    if (!map.has(key)) map.set(key, picker());
    return map.get(key);
  };

  const replaceCore = (core) => {
    if (!core) return core;
    const userMatch = core.match(USER_MENTION_CORE);
    if (userMatch) {
      return getOrAssignMention(mentionReplacement, userMatch[1], pickSingular);
    }

    const roleMatch = core.match(ROLE_MENTION_CORE);
    if (roleMatch) {
      return getOrAssignMention(roleReplacement, roleMatch[1], pickPlural);
    }

    if (CHANNEL_MENTION_CORE.test(core)) return "my secret place";
    if (GROUP_MENTION_CORE.test(core)) {
      const key = core.toLowerCase();
      return getOrAssignMention(groupReplacement, key, pickPlural);
    }
    if (CUSTOM_EMOJI_CORE.test(core)) {
      return getOrAssignMention(emojiReplacement, core, pickEmoji);
    }

    if (parsed.contextHashtags.has(core.toLowerCase())) return "my secret place";

    if (core.startsWith("@")) {
      const withoutAt = core.slice(1).toLowerCase();
      if (userReplacement.has(withoutAt)) return userReplacement.get(withoutAt);
    }

    const lower = core.toLowerCase();
    if (userReplacement.has(lower)) return userReplacement.get(lower);

    return core;
  };

  const replaceToken = (token) => {
    const { prefix, core, suffix } = splitToken(token);
    if (!core) return token;
    const replaced = replaceCore(core);
    if (replaced === core) return token;
    return `${prefix}${replaced}${suffix}`;
  };

  const output = {
    usernames: Array.from(parsed.usernames).sort(),
    userMentionIds: Array.from(raw.userMentionIds).sort(),
    roleMentionIds: Array.from(raw.roleMentionIds).sort(),
    channelMentionIds: Array.from(raw.channelMentionIds).sort(),
    groupMentions: Array.from(raw.groupMentions).sort(),
    customEmojiTokens: Array.from(raw.customEmojiTokens).sort(),
    fuzzyAliases: Array.from(fuzzyAliases).sort(),
    contextHashtagChannels: Array.from(parsed.contextHashtags).sort(),
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  const writePlan = () => {
    const plan = {
      botName,
      replacements: {
        userTokens: Object.fromEntries(userReplacement.entries()),
        userMentions: Object.fromEntries(mentionReplacement.entries()),
        roleMentions: Object.fromEntries(roleReplacement.entries()),
        groupMentions: Object.fromEntries(groupReplacement.entries()),
        customEmoji: Object.fromEntries(emojiReplacement.entries()),
        channelReplacement: "my secret place",
        hashtagChannels: Array.from(parsed.contextHashtags).sort(),
      },
    };
    fs.writeFileSync(planOutputPath, JSON.stringify(plan, null, 2));
  };

  console.log(`Wrote ${outputPath}`);
  writePlan();
  console.log(`Wrote ${planOutputPath}`);

  if (!applyChanges) {
    console.log("Dry run complete. Re-run with --apply to modify the brain database.");
    return;
  }

  const dbPath = checkFilePath("data", `${botName}.sqlite`);
  const backupPath = checkFilePath(
    "data",
    `${botName}.sqlite.bak-${Date.now()}`
  );
  fs.copyFileSync(dbPath, backupPath);
  console.log(`Backup created at ${backupPath}`);

  const oldLexicon = new SQLiteMap({
    filename: dbPath,
    table: "lexicon",
    cacheSize: 0,
    allowSchemaMigration: false,
  });
  const oldNgrams = new SQLiteMap({
    filename: dbPath,
    table: "ngrams",
    cacheSize: 0,
    allowSchemaMigration: false,
  });
  const newLexicon = new SQLiteMap({
    filename: dbPath,
    table: "lexicon_clean",
    cacheSize: 0,
    allowSchemaMigration: false,
  });
  const newNgrams = new SQLiteMap({
    filename: dbPath,
    table: "ngrams_clean",
    cacheSize: 0,
    allowSchemaMigration: false,
  });

  newLexicon.clear();
  newNgrams.clear();

  let ngramCount = 0;
  for (const [hash, ngram] of oldNgrams.entries()) {
    const updatedTokens = (ngram.tokens || []).map(replaceToken);
    const updatedNext = new Map();
    const updatedPrev = new Map();

    for (const [word, freq] of ngram.nextTokens.entries()) {
      const newWord = replaceToken(word);
      updatedNext.set(newWord, (updatedNext.get(newWord) || 0) + freq);
    }
    for (const [word, freq] of ngram.previousTokens.entries()) {
      const newWord = replaceToken(word);
      updatedPrev.set(newWord, (updatedPrev.get(newWord) || 0) + freq);
    }

    const newHash = updatedTokens.join(WORD_SEPARATOR);
    const existing = newNgrams.get(newHash);
    if (existing) {
      existing.canStart = existing.canStart || ngram.canStart;
      existing.canEnd = existing.canEnd || ngram.canEnd;
      for (const [word, freq] of updatedNext.entries()) {
        existing.nextTokens.set(word, (existing.nextTokens.get(word) || 0) + freq);
      }
      for (const [word, freq] of updatedPrev.entries()) {
        existing.previousTokens.set(word, (existing.previousTokens.get(word) || 0) + freq);
      }
      newNgrams.set(newHash, existing);
    } else {
      newNgrams.set(newHash, {
        canStart: ngram.canStart,
        canEnd: ngram.canEnd,
        tokens: updatedTokens,
        nextTokens: updatedNext,
        previousTokens: updatedPrev,
      });
    }

    ngramCount += 1;
    if (ngramCount % 500000 === 0) {
      console.log(`Processed ${ngramCount} ngrams...`);
    }
  }

  let lexCount = 0;
  for (const [word, hashes] of oldLexicon.entries()) {
    const updatedWord = replaceToken(word);
    const updatedHashes = new Set();
    for (const hashEntry of hashes) {
      const tokens = String(hashEntry).split(WORD_SEPARATOR).map(replaceToken);
      updatedHashes.add(tokens.join(WORD_SEPARATOR));
    }

    const existing = newLexicon.get(updatedWord);
    if (existing) {
      for (const hashEntry of updatedHashes) existing.add(hashEntry);
      newLexicon.set(updatedWord, existing);
    } else {
      newLexicon.set(updatedWord, updatedHashes);
    }

    lexCount += 1;
    if (lexCount % 250000 === 0) {
      console.log(`Processed ${lexCount} lexicon entries...`);
    }
  }

  oldLexicon.db.close();
  oldNgrams.db.close();
  newLexicon.db.close();
  newNgrams.db.close();

  const db = new Database(dbPath);
  const ts = Date.now();
  const oldLexTable = `lexicon_old_${ts}`;
  const oldNgramTable = `ngrams_old_${ts}`;
  db.exec("BEGIN");
  db.exec(`ALTER TABLE lexicon RENAME TO ${oldLexTable}`);
  db.exec(`ALTER TABLE ngrams RENAME TO ${oldNgramTable}`);
  db.exec(`ALTER TABLE lexicon_clean RENAME TO lexicon`);
  db.exec(`ALTER TABLE ngrams_clean RENAME TO ngrams`);
  db.exec(`DROP TABLE ${oldLexTable}`);
  db.exec(`DROP TABLE ${oldNgramTable}`);
  db.exec("COMMIT");
  db.close();

  writePlan();
  console.log(`Updated ${planOutputPath}`);
  console.log("Brain cleanup complete.");
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
