/*
 * /api/chat — SSE 字节管道转发到 AutoDL 推理端
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * cc-002 落地:
 *   后端不补 system. 收到任何 system 消息直接剥 (inference-client 也再剥一次).
 *   不重组 SSE. 上游写什么字节, 浏览器收什么字节.
 *
 * 上下文喂养 (2026-05-09 冰朔点透 · 模型零记忆需 Agent 持续喂):
 *   前端只发当前一条 user. 后端落库后, 从 SQLite 取该 conv 全部历史, 走
 *   context-window.buildContextWindow 折叠 (滚动 20 轮 + 16000 字 cap, cc-002
 *   再剥一次), 拼成完整 messages 数组发推理端. 这样模型每次都拿到全程上下文,
 *   可正常多轮对话.
 *
 * 流程:
 *   1. 校验 body
 *   2. 落库 user 消息 (在 stream 开始前, 失败也不挡 SSE)
 *   3. **从 DB 重新拉本对话所有 messages** + buildContextWindow
 *   4. inference.pipeChat 转发, 旁路累计 fullText
 *   5. 流结束后落库 assistant 消息 + 更新 conversations.updated_at
 */
"use strict";

const express = require("express");
const router = express.Router();

const { isValidId } = require("./conversations");
const { buildContextWindow } = require("../lib/context-window");

router.post("/", async (req, res) => {
  const body = req.body || {};
  const convId = body.conversation_id;
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (!isValidId(convId)) {
    return res.status(400).json({ error: true, code: "bad_id", message: "conversation_id 格式不合法" });
  }
  const conv = req.ctx.db
    .prepare("SELECT id, active_model FROM conversations WHERE id = ?")
    .get(convId);
  if (!conv) {
    return res.status(404).json({ error: true, code: "not_found", message: "对话不存在" });
  }

  // cc-002: 即便前端真的塞了 system 进来, 这里直接剥. 三道关之一.
  const cleaned = messages.filter((m) => m && m.role && m.role !== "system");
  const lastUser = [...cleaned].reverse().find((m) => m.role === "user");
  if (!lastUser || typeof lastUser.content !== "string" || !lastUser.content.trim()) {
    return res.status(400).json({ error: true, code: "empty_user", message: "缺少 user 消息内容" });
  }

  // 限长保护 (2C2G 内存: 单条不超过 8K 字符, 服务器 256K body limit 已经在 server.js)
  if (lastUser.content.length > 8000) {
    return res.status(413).json({ error: true, code: "too_long", message: "单条消息超过 8000 字, 请拆短" });
  }

  // 1. 落库 user 消息
  const now = Date.now();
  try {
    req.ctx.db
      .prepare("INSERT INTO messages (conv_id, role, content, ts) VALUES (?, 'user', ?, ?)")
      .run(convId, lastUser.content, now);
    // 第一次有用户消息时, 用截断后的内容做对话标题
    const titleRow = req.ctx.db
      .prepare("SELECT title FROM conversations WHERE id = ?")
      .get(convId);
    if (titleRow && (titleRow.title === "(新对话)" || !titleRow.title)) {
      const newTitle = lastUser.content.replace(/\s+/g, " ").trim().slice(0, 24) || "(新对话)";
      req.ctx.db
        .prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?")
        .run(newTitle, now, convId);
    } else {
      req.ctx.db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(now, convId);
    }
  } catch (e) {
    return res.status(500).json({ error: true, code: "db_error", message: "落库失败: " + e.message });
  }

  // 2. 从 DB 拉完整历史 + 折叠成上下文窗口 (这一步修复"模型一轮都记不住")
  let history;
  try {
    history = req.ctx.db
      .prepare(
        "SELECT role, content FROM messages WHERE conv_id = ? ORDER BY ts ASC, id ASC LIMIT 1000"
      )
      .all(convId);
  } catch (e) {
    return res.status(500).json({ error: true, code: "db_error", message: "读历史失败: " + e.message });
  }
  const ctxOpts = {
    maxTurns: parseInt(process.env.PORTAL_CTX_MAX_TURNS, 10) || undefined,
    maxChars: parseInt(process.env.PORTAL_CTX_MAX_CHARS, 10) || undefined
  };
  const ctx = buildContextWindow(history, ctxOpts);

  // 3. byte-pipe SSE 到推理端 — payload 用拼好的 ctx.messages, 不是前端原始
  const activeModel = req.ctx.inference.getActiveModel();
  const payload = {
    model: activeModel,
    messages: ctx.messages, // 已 cc-002 剥 system + 滚动窗口 + 字数 cap
    stream: true
  };

  let fullText = "";
  try {
    const result = await req.ctx.inference.pipeChat(payload, res);
    fullText = (result && result.fullText) || "";
  } catch (e) {
    if (!res.headersSent) {
      return res
        .status(e.status || 502)
        .json({ error: true, code: "inference_failed", message: e.message || "推理端不可达" });
    }
    // headers 已经写出去了, 流已经断, pipeChat 内部已经写过 SSE 错误事件并关流
    // eslint-disable-next-line no-console
    console.error("[portal] /api/chat 流中断:", e.message);
  }

  // 4. 落库 assistant 消息 (即使中间断流, 已收到的字也存)
  if (fullText) {
    try {
      const ts = Date.now();
      req.ctx.db
        .prepare("INSERT INTO messages (conv_id, role, content, ts) VALUES (?, 'assistant', ?, ?)")
        .run(convId, fullText, ts);
      req.ctx.db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(ts, convId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[portal] assistant 落库失败:", e.message);
    }
  }

  // pipeError 已在 headers 未写时直接返回 JSON, 这里不需要再处理
});

module.exports = router;
