/*
 * /api/persona-db — 人格层右栏数据 (只读)
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * 数据源:
 *   1. 优先读 PORTAL_DATA_DIR/persona-db-snapshot.json (生产环境由部署时打包)
 *   2. 回退 repo 内 persona-brain-db/seed-data/*.json (开发/演示用)
 *
 * 设计理念 (cc-004):
 *   不直接连 GitHub 或 Notion API — 国内 2C2G 不稳, 也暴露主权.
 *   一律走本地快照, 把不稳定性吞进部署管道.
 */
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

let cache = null;
let cacheTs = 0;
const CACHE_MS = 30 * 1000;

function loadSnapshot(dataDir, repoRoot) {
  // 1. 部署时打包的快照
  const snap = path.join(dataDir, "persona-db-snapshot.json");
  if (fs.existsSync(snap)) {
    try {
      return JSON.parse(fs.readFileSync(snap, "utf8"));
    } catch (_) {
      /* fallthrough */
    }
  }
  // 2. 仓库内的 seed-data
  const items = [];
  const seedDir = path.join(repoRoot, "persona-brain-db", "seed-data");
  if (fs.existsSync(seedDir)) {
    for (const f of fs.readdirSync(seedDir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const j = JSON.parse(fs.readFileSync(path.join(seedDir, f), "utf8"));
        const item = normalize(f, j);
        if (item) items.push(item);
      } catch (_) {
        /* ignore broken seed file */
      }
    }
  }
  return { items };
}

function normalize(filename, raw) {
  if (!raw || typeof raw !== "object") return null;
  const stem = filename.replace(/\.json$/, "");
  if (Array.isArray(raw)) {
    return {
      title: stem,
      tags: ["seed", "list", `${raw.length} 条`],
      summary: `数组型种子数据, 共 ${raw.length} 条`
    };
  }
  // 取一些常见字段做摘要
  const title =
    raw.title ||
    raw.name ||
    raw.persona_name ||
    raw.display_name ||
    stem;
  const summary =
    raw.summary ||
    raw.description ||
    raw.bio ||
    (Array.isArray(raw.entries) ? `共 ${raw.entries.length} 条记忆条目` : "");
  const tags = [];
  if (raw.persona_id) tags.push(raw.persona_id);
  if (raw.scope) tags.push(raw.scope);
  if (raw.layer) tags.push(raw.layer);
  if (!tags.length) tags.push("seed");
  return { title: String(title).slice(0, 48), tags, summary: String(summary || "").slice(0, 240) };
}

router.get("/", (req, res) => {
  const now = Date.now();
  if (!cache || now - cacheTs > CACHE_MS) {
    cache = loadSnapshot(req.ctx.dataDir, req.ctx.repoRoot);
    cacheTs = now;
  }
  res.json({ source: "persona-brain-db", ...(cache || { items: [] }) });
});

module.exports = router;
