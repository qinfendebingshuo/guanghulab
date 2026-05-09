/*
 * /api/manifest — 现实开发层右栏: 模块注册表 (只读)
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * 数据源:
 *   1. 优先 PORTAL_DATA_DIR/manifest-snapshot.json (部署时由 CI 打包注入)
 *   2. 回退 repo 内 .github/brain/architecture/function-manifest.json
 *
 * baton-004 自检 3:
 *   "右栏要展示模块注册表. 数据从哪儿来? 直接从 GitHub API 拉?"
 *   答: 不从 GitHub API. 国内 2C2G 访问 GitHub API 不稳, 且会暴露主权.
 *      直接读本地快照. PR-6 forgejo 装好后, 这一份会从 forgejo 拉.
 */
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

let cache = null;
let cacheTs = 0;
const CACHE_MS = 30 * 1000;

function loadManifest(dataDir, repoRoot) {
  // 1. 部署快照
  const snap = path.join(dataDir, "manifest-snapshot.json");
  let raw = null;
  if (fs.existsSync(snap)) {
    try { raw = JSON.parse(fs.readFileSync(snap, "utf8")); } catch (_) {}
  }
  if (!raw) {
    // 2. 仓库内 manifest
    const repoManifest = path.join(repoRoot, ".github", "brain", "architecture", "function-manifest.json");
    if (fs.existsSync(repoManifest)) {
      try { raw = JSON.parse(fs.readFileSync(repoManifest, "utf8")); } catch (_) {}
    }
  }
  if (!raw) return { items: [] };

  const items = [];
  const fns = Array.isArray(raw.functions) ? raw.functions : [];
  for (const fn of fns) {
    if (!fn || typeof fn !== "object") continue;
    const tags = [];
    if (fn.id) tags.push(fn.id);
    if (fn.host_server) tags.push(fn.host_server);
    if (fn.status) tags.push(fn.status);
    if (fn.keep_decision === "keep") tags.push("活跃");
    items.push({
      title: fn.display_name_zh || fn.id || "(未命名)",
      tags,
      summary:
        (fn.description || fn.role || fn.notes || "").toString().replace(/\s+/g, " ").slice(0, 240)
    });
  }
  // 服务器/宿主也作为模块注册表的一部分展示 (开发层关心物理拓扑)
  const servers = Array.isArray(raw.servers) ? raw.servers : [];
  for (const s of servers) {
    if (!s || typeof s !== "object") continue;
    const tags = [];
    if (s.id) tags.push(s.id);
    if (s.spec) tags.push(s.spec);
    if (s.status) tags.push(s.status);
    items.push({
      title: s.display_name_zh || s.id || "(服务器)",
      tags,
      summary: (s.role || s.notes || "").toString().replace(/\s+/g, " ").slice(0, 240)
    });
  }
  return { items, version: raw._version || raw.version || null };
}

router.get("/", (req, res) => {
  const now = Date.now();
  if (!cache || now - cacheTs > CACHE_MS) {
    cache = loadManifest(req.ctx.dataDir, req.ctx.repoRoot);
    cacheTs = now;
  }
  res.json({ source: "function-manifest", ...(cache || { items: [] }) });
});

module.exports = router;
