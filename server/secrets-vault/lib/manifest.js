/*
 * 复用 scripts/preflight/secrets-manifest.json 的 schema, 把 secret 列表按
 * workflow 分组返回前端. 遵循 cc-004: 字段名走 `用途` 而不是 secret 名 (Awen
 * 一眼看懂).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const DEFAULT_MANIFEST = path.join(
  REPO_ROOT,
  "scripts",
  "preflight",
  "secrets-manifest.json"
);

function loadManifest(manifestPath) {
  const p = manifestPath || DEFAULT_MANIFEST;
  if (!fs.existsSync(p)) {
    throw new Error("密钥清单文件不存在: " + p);
  }
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!raw || !raw.workflows) throw new Error("密钥清单 schema 不识别 (缺 workflows)");
  return raw;
}

function buildGroups(manifestPath) {
  const raw = loadManifest(manifestPath);
  const groups = [];
  for (const [wf, def] of Object.entries(raw.workflows || {})) {
    const group = {
      workflow: wf,
      describe: def._describe || wf,
      subject: def._主体 || "",
      group_action: wf === "autodl-inference" ? "save_and_refresh" : null,
      secrets: []
    };
    for (const s of def.secrets || []) {
      group.secrets.push({
        name: s.name,
        level: s.level || "optional",
        stages: s.stages || [],
        targets: s.targets || [],
        用途: s["用途"] || s.name,
        如何配置: s["如何配置"] || s.where || s["更新方式"] || "",
        default_hint: s.default_hint || "",
        default: s.default || "",
        强校验: s["强校验"] || ""
      });
    }
    groups.push(group);
  }
  return groups;
}

function findSecretMeta(name, manifestPath) {
  const raw = loadManifest(manifestPath);
  for (const [wf, def] of Object.entries(raw.workflows || {})) {
    for (const s of def.secrets || []) {
      if (s.name === name) return { workflow: wf, ...s };
    }
  }
  return null;
}

// 列出所有合法的 key (write 路由白名单校验用)
function knownKeys(manifestPath) {
  const raw = loadManifest(manifestPath);
  const keys = new Set();
  for (const def of Object.values(raw.workflows || {})) {
    for (const s of def.secrets || []) keys.add(s.name);
  }
  return keys;
}

module.exports = { loadManifest, buildGroups, findSecretMeta, knownKeys, DEFAULT_MANIFEST };
