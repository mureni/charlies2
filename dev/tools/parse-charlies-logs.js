#!/usr/bin/env node
"use strict";

const fs = require("fs");
const readline = require("readline");
const path = require("path");

const defaultInput = path.join(
  __dirname,
  "..",
  "data",
  "charlies-data-backup",
  "charlies-logs",
  "raw-2023-to-2025.log"
);
const defaultOutput = path.join(
  __dirname,
  "..",
  "data",
  "charlies-data-backup",
  "charlies-logs",
  "parsed-chat.json"
);

const inputPath = process.argv[2] || defaultInput;
const outputPath = process.argv[3] || defaultOutput;

const serverMap = new Map();
let lastMessage = null;
let totalParsed = 0;
let totalMessages = 0;
let totalContinuations = 0;

function getServerEntry(server) {
  let entry = serverMap.get(server);
  if (!entry) {
    entry = { server, channels: new Set(), users: new Map() };
    serverMap.set(server, entry);
  }
  return entry;
}

function getUserEntry(serverEntry, username) {
  let entry = serverEntry.users.get(username);
  if (!entry) {
    entry = { username, messages: [] };
    serverEntry.users.set(username, entry);
  }
  return entry;
}

function stripAttachedContent(message) {
  return message.replace(/\s*\[Attached content:[^\]]*\]/g, "").trimEnd();
}

function parseChatRest(rest) {
  if (!rest.startsWith("<")) return null;
  const endIdx = rest.indexOf(">");
  if (endIdx === -1) return null;
  const header = rest.slice(1, endIdx);
  const message = rest.slice(endIdx + 1).replace(/^ /, "");
  const firstColon = header.indexOf(":");
  const secondColon = header.indexOf(":", firstColon + 1);
  if (firstColon === -1 || secondColon === -1) return null;
  const server = header.slice(0, firstColon);
  const channel = header.slice(firstColon + 1, secondColon);
  const username = header.slice(secondColon + 1);
  return { server, channel, username, message };
}

function addMessage(server, channel, username, text) {
  const serverEntry = getServerEntry(server);
  serverEntry.channels.add(channel);
  const userEntry = getUserEntry(serverEntry, username);
  const message = { channel, text };
  userEntry.messages.push(message);
  totalMessages += 1;
  return message;
}

async function run() {
  const stream = fs.createReadStream(inputPath, { encoding: "utf8" });
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
    if (logValue === null) continue;

    totalParsed += 1;
    let content = logValue.replace(/\r?\n$/, "");
    if (!content) continue;
    const trimmed = content.trim();
    if (!trimmed) continue;

    if (/^\[Attached content:/i.test(trimmed)) {
      continue;
    }

    const headerMatch = content.match(/^\[(.+?) - (.+?)\] (.*)$/);
    if (headerMatch) {
      const rest = headerMatch[3];
      const chat = parseChatRest(rest);
      if (!chat) {
        lastMessage = null;
        continue;
      }

      let message = stripAttachedContent(chat.message);
      message = message.replace(/\r?\n$/, "");
      if (!message.trim()) {
        lastMessage = null;
        continue;
      }

      lastMessage = addMessage(chat.server, chat.channel, chat.username, message);
      continue;
    }

    if (lastMessage) {
      lastMessage.text += `\n${content}`;
      totalContinuations += 1;
    }
  }

  const output = [];
  for (const serverEntry of serverMap.values()) {
    const users = [];
    for (const userEntry of serverEntry.users.values()) {
      users.push({
        username: userEntry.username,
        messages: userEntry.messages,
      });
    }
    output.push({
      server: serverEntry.server,
      channels: Array.from(serverEntry.channels),
      users,
    });
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(
    `Parsed ${totalParsed} log lines into ${totalMessages} messages ` +
      `with ${totalContinuations} continuations.`
  );
  console.log(`Wrote ${outputPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
