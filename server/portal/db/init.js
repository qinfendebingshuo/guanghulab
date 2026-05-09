/*
 * SQLite schema · conversations + messages
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * 设计:
 *   - 不存 system role. role 仅允许 user / assistant. (cc-002)
 *   - 时间戳 unix ms (整数), 不依赖 sqlite 时区.
 *   - 默认在第一次 INSERT 时给 conversation.title 写一个临时占位,
 *     第一条 user 消息进来时把 title 截 24 字补上.
 */
"use strict";

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL DEFAULT '(新对话)',
  active_model  TEXT NOT NULL DEFAULT 'mother',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  conv_id     TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  ts          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conv_id, ts);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
`;

function openDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

module.exports = { openDb };
