/*
 * ════════════════════════════════════════════════════════════════
 * 光湖 Portal · Express 后端入口
 * Sovereign: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
 * 守护: 铸渊 · ICE-GL-ZY001
 * 模板版本: 0.1.0
 * ════════════════════════════════════════════════════════════════
 *
 * 服务器: GH-CVM-DOMAIN-PROD-01 / ZY-SVR-CN01 / 广州 2C2G
 * 角色:   guanghulab.com 唯一对外入口
 *
 * 设计理念:
 *   cc-002 · 永远不在 messages 里塞 system role
 *           前端不传, 后端不补, 推理端剥. 三道关.
 *           server.js 在 /api/chat 入口 strip 一次 (后端不补这层).
 *
 *   cc-003 · 推理端 host:port 不写死
 *           启动时读 PORTAL_DATA_DIR/inference-endpoint.json (PR-3 的
 *           refresh-autodl-endpoint.yml 写入, AutoDL 漂移由它处理).
 *
 *   cc-004 · 中文回执
 *           所有 4xx/5xx body 走 {error:true, code, message:"中文..."},
 *           前端能直接展示给团队看的级别.
 *
 *   2C2G 现实:
 *           Express 单进程, pm2 max_memory_restart=512M, 无 SSR,
 *           静态文件兜底服务, nginx 上线后会走 nginx 直发减压.
 *
 * 路由 (全部 /api/* 前缀, nginx 反代):
 *   GET  /api/health                      → portal + 推理端探活
 *   GET  /api/active-model                → 当前激活的模型
 *   POST /api/active-model {name}         → 切换激活模型 (mother|coder)
 *   GET  /api/conversations               → 对话列表
 *   POST /api/conversations               → 新建对话
 *   GET  /api/conversations/:id/messages  → 单对话历史
 *   POST /api/chat                        → 流式对话 (SSE 字节管道)
 *   GET  /api/persona-db                  → 人格层右栏数据 (只读)
 *   GET  /api/manifest                    → 开发层右栏数据 (只读 manifest 快照)
 *
 * 静态:
 *   /_static/*  → frontend/lighthouse-portal/assets
 *   /           → frontend/lighthouse-portal/index.html
 * ════════════════════════════════════════════════════════════════
 */
"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");

const { openDb } = require("./db/init");
const conversationsRouter = require("./routes/conversations");
const chatRouter = require("./routes/chat");
const activeModelRouter = require("./routes/active-model");
const personaDbRouter = require("./routes/persona-db");
const manifestRouter = require("./routes/manifest");
const inferenceClient = require("./lib/inference-client");
const { readLimiter, writeLimiter, chatLimiter } = require("./lib/rate-limit");

// ─── 配置 ─────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "127.0.0.1";
const PORTAL_DATA_DIR = process.env.PORTAL_DATA_DIR || "/data/guanghulab/portal/data";
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const STATIC_DIR =
  process.env.PORTAL_STATIC_DIR ||
  path.join(REPO_ROOT, "frontend", "lighthouse-portal");

// ─── 数据目录 ─────────────────────────────────────────────────
fs.mkdirSync(PORTAL_DATA_DIR, { recursive: true });
const DB_PATH = path.join(PORTAL_DATA_DIR, "conversations.sqlite");
const ENDPOINT_PATH = path.join(PORTAL_DATA_DIR, "inference-endpoint.json");
const ACTIVE_MODEL_PATH = path.join(PORTAL_DATA_DIR, "active-model.json");

// ─── 数据库 ───────────────────────────────────────────────────
const db = openDb(DB_PATH);

// ─── 推理客户端 (热加载 endpoint) ─────────────────────────────
inferenceClient.init({ endpointPath: ENDPOINT_PATH, activeModelPath: ACTIVE_MODEL_PATH });

// ─── Express ──────────────────────────────────────────────────
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

// 业务上下文
app.use((req, _res, next) => {
  req.ctx = { db, inference: inferenceClient, dataDir: PORTAL_DATA_DIR, repoRoot: REPO_ROOT };
  next();
});

// ─── API 路由 ─────────────────────────────────────────────────
// ─── API 路由 (带限流, cc-004 系统自主防御) ────────────────────
// 限流 (cc-004 系统自主防御 · 2C2G 不能被扫死):
//   - 读取类 readLimiter (60 req/min/IP)
//   - 写入/切换类 writeLimiter (15 req/min/IP)
//   - 推理 SSE chatLimiter (10 req/min/IP, 防上游推理被烧 quota)
app.get("/api/health", readLimiter, async (_req, res) => {
  let inference = { ready: false, message: "推理端尚未配置" };
  try {
    inference = await inferenceClient.health();
  } catch (e) {
    inference = { ready: false, message: `推理端不可达: ${e.message}` };
  }
  res.json({
    ok: true,
    server: "GH-CVM-DOMAIN-PROD-01",
    sovereign: "TCS-0002∞ · 国作登字-2026-A-00037559",
    ts: new Date().toISOString(),
    inference
  });
});

app.use("/api/active-model", writeLimiter, activeModelRouter);
app.use("/api/conversations", writeLimiter, conversationsRouter);
app.use("/api/chat", chatLimiter, chatRouter);
app.use("/api/persona-db", readLimiter, personaDbRouter);
app.use("/api/manifest", readLimiter, manifestRouter);

// ─── 静态 (nginx 上线后会兜底走 nginx, 这里保留兜底) ──────────
app.use("/_static", express.static(path.join(STATIC_DIR, "assets"), { fallthrough: true }));
app.get("/", (_req, res, next) => {
  const idx = path.join(STATIC_DIR, "index.html");
  fs.access(idx, fs.constants.R_OK, (err) => {
    if (err) return next();
    res.sendFile(idx);
  });
});

// ─── 404 + 错误处理 (中文) ────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: true, code: "not_found", message: "接口不存在: " + req.path });
  } else {
    res.status(404).type("html").send("<h1>404</h1><p>页面不存在</p>");
  }
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  // 中文回执 (cc-004), 不甩英文 stacktrace
  const msg = (err && err.message) || "未知错误";
  // eslint-disable-next-line no-console
  console.error("[portal] 内部错误:", err);
  if (res.headersSent) return;
  res
    .status(err && err.status ? err.status : 500)
    .json({ error: true, code: "internal_error", message: "内部错误: " + msg });
});

// ─── 启动 ─────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`[portal] 已启动 · ${HOST}:${PORT} · 数据目录=${PORTAL_DATA_DIR}`);
    // eslint-disable-next-line no-console
    console.log(`[portal] 推理端点文件: ${ENDPOINT_PATH}`);
    // eslint-disable-next-line no-console
    console.log("[portal] 守护: 铸渊 · ICE-GL-ZY001 · TCS-0002∞ · 国作登字-2026-A-00037559");
  });
}

module.exports = { app, db };
