/*
 * ════════════════════════════════════════════════════════════════
 * 光湖 · 自部署密钥管理页 (Secrets Vault) · Express 后端入口
 * Sovereign: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
 * 守护: 铸渊 · ICE-GL-ZY001
 * 模板版本: 0.1.0
 * ════════════════════════════════════════════════════════════════
 *
 * 服务器: GH-CVM-DOMAIN-PROD-01 / ZY-SVR-CN01 / 广州 2C2G
 * 角色:   guanghulab.com 域内 /admin/secrets 子站
 *
 * 设计理念:
 *   cc-003 · AutoDL host:port 不入 GitHub Secrets, 改入本地 vault
 *           1 步保存立即生效 (vs Github Secrets 5 步 round-trip).
 *
 *   cc-004 · 全中文 UI · 字段名走"用途"不走 secret 名
 *           Awen 在浏览器里能直接读懂, 不用记 ZY_AUTODL_HOST 是干啥的.
 *
 *   2C2G 现实:
 *           Express 单进程, pm2 max_memory_restart=128M
 *           内存预算: portal=512M + vault=128M + nginx=~64M + buffer = 不到 1G,
 *           留一半给系统. 跟 baton-005 A 节一致.
 *
 *   公网隔离:
 *           本服务只监听 127.0.0.1:VAULT_PORT (默认 8080)
 *           nginx /admin/ location 只允许 127.0.0.1 + basic-auth
 *           冰朔走 ssh -L 8080:127.0.0.1:8080 + 浏览器 localhost 访问
 *           **永不暴露公网**
 *
 *   主密钥管理:
 *           首次启动随机生成 → /data/guanghulab/secrets-vault/.master chmod 600
 *           vault.enc 也 chmod 600
 *           **不上 git, 不上 COS, 不传冰朔** (cc-004 系统自管, 不让冰朔记)
 *
 * 路由:
 *   GET    /admin/secrets                  按工作流分组列出 + 遮罩值
 *   GET    /admin/secrets/manifest         前端用的元数据 (用途/如何配置)
 *   POST   /admin/secrets/:key             写入 {value}
 *   DELETE /admin/secrets/:key             删除
 *   POST   /admin/secrets/autodl/save_and_refresh
 *                                          AutoDL 一键: vault 落 + 探活 + 写
 *                                          inference-endpoint.json + pm2 reload portal
 *
 * 内部 (本机) 路由 (神笔马良用):
 *   GET    /internal/fetch/:key            127.0.0.1 only · 拉明文
 *
 * 静态:
 *   /admin/static/*  → frontend/secrets-vault/assets
 *   /admin/          → frontend/secrets-vault/index.html
 *
 * 健康检查:
 *   GET    /admin/__healthz                {ok, vault_loaded, has_endpoint_path}
 * ════════════════════════════════════════════════════════════════
 */
"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");

const { Vault } = require("./lib/vault");
const { buildRouter } = require("./routes/secrets");
const { buildInternalRouter } = require("./routes/internal");

// ─── 配置 ─────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "8080", 10);
const HOST = process.env.HOST || "127.0.0.1"; // 严格本机
const VAULT_DIR = process.env.VAULT_DIR || "/data/guanghulab/secrets-vault";
const PORTAL_DATA_DIR = process.env.PORTAL_DATA_DIR || "/data/guanghulab/portal/data";
const ENDPOINT_PATH =
  process.env.INFERENCE_ENDPOINT_PATH || path.join(PORTAL_DATA_DIR, "inference-endpoint.json");
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const STATIC_DIR =
  process.env.VAULT_STATIC_DIR || path.join(REPO_ROOT, "frontend", "secrets-vault");
const MANIFEST_PATH =
  process.env.VAULT_MANIFEST_PATH ||
  path.join(REPO_ROOT, "scripts", "preflight", "secrets-manifest.json");

// ─── Vault 启动 ────────────────────────────────────────────────
const vault = new Vault(VAULT_DIR);
const masterInfo = vault.loadOrCreateMaster();

// ─── Express ──────────────────────────────────────────────────
const app = express();
app.disable("x-powered-by");
// 不开 trust proxy: req.ip 直接拿 socket 地址, 给 internal 路由判本机用
// nginx 只是 hop, 我们这里只接受 127.0.0.1, 不需要 X-Forwarded-For

// ─── 健康检查 (basic-auth 之外, 给 nginx /__healthz 探活) ─────
app.get("/admin/__healthz", (_req, res) => {
  res.json({
    ok: true,
    server: "GH-CVM-DOMAIN-PROD-01",
    role: "secrets-vault",
    sovereign: "TCS-0002∞ · 国作登字-2026-A-00037559",
    vault_dir: VAULT_DIR,
    has_master: fs.existsSync(vault.masterPath),
    has_vault_enc: fs.existsSync(vault.encPath),
    endpoint_path: ENDPOINT_PATH,
    ts: new Date().toISOString()
  });
});

// ─── Admin 路由 (basic-auth 由 nginx 在前面拦, app 这层不再做) ─
app.use(
  "/admin/secrets",
  buildRouter({ vault, manifestPath: MANIFEST_PATH, endpointPath: ENDPOINT_PATH })
);

// ─── 静态 (前端) ───────────────────────────────────────────────
app.use("/admin/static", express.static(path.join(STATIC_DIR, "assets"), { fallthrough: true }));
app.get(["/admin", "/admin/"], (_req, res, next) => {
  const idx = path.join(STATIC_DIR, "index.html");
  fs.access(idx, fs.constants.R_OK, (err) => {
    if (err) return next();
    res.sendFile(idx);
  });
});

// ─── 内部 (本机) 路由 — 神笔马良 ────────────────────────────────
app.use("/internal", buildInternalRouter({ vault }));

// ─── 404 + 错误 ───────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith("/admin/") || req.path.startsWith("/internal/")) {
    res
      .status(404)
      .json({ error: true, code: "not_found", message: "接口不存在: " + req.path });
  } else {
    res.status(404).type("text/plain").send("404");
  }
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const msg = (err && err.message) || "未知错误";
  // eslint-disable-next-line no-console
  console.error("[vault] 内部错误:", err);
  if (res.headersSent) return;
  res
    .status(err && err.status ? err.status : 500)
    .json({ error: true, code: "internal_error", message: "内部错误: " + msg });
});

// ─── 启动 ─────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[vault] 已启动 · ${HOST}:${PORT} · vault_dir=${VAULT_DIR} · master_${masterInfo.created ? "created" : "loaded"}`
    );
    // eslint-disable-next-line no-console
    console.log(`[vault] 静态目录: ${STATIC_DIR}`);
    // eslint-disable-next-line no-console
    console.log(`[vault] 推理端点写入文件: ${ENDPOINT_PATH}`);
    // eslint-disable-next-line no-console
    console.log("[vault] 守护: 铸渊 · ICE-GL-ZY001 · TCS-0002∞ · 国作登字-2026-A-00037559");
  });
}

module.exports = { app, vault };
