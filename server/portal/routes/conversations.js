/*
 * /api/conversations
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * GET    /         → 列表 (按 updated_at desc)
 * POST   /         → 新建对话, 返回 {id, ...}
 * GET    /:id/messages → 单对话 + 历史
 */
"use strict";

const express = require("express");
const crypto = require("crypto");

const router = express.Router();

function genConvId() {
  return "conv_" + crypto.randomBytes(8).toString("hex");
}

function isValidId(id) {
  return typeof id === "string" && /^conv_[0-9a-f]{16}$/.test(id);
}

router.get("/", (req, res) => {
  const rows = req.ctx.db
    .prepare("SELECT id, title, active_model, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 200")
    .all();
  res.json({ items: rows.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString(), updated_at: new Date(r.updated_at).toISOString() })) });
});

router.post("/", (req, res) => {
  const body = req.body || {};
  let active = body.active_model;
  if (active !== "mother" && active !== "coder") active = "mother";
  let title = typeof body.title === "string" ? body.title.trim().slice(0, 64) : "";
  if (!title) title = "(新对话)";
  const id = genConvId();
  const now = Date.now();
  req.ctx.db
    .prepare(
      "INSERT INTO conversations (id, title, active_model, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(id, title, active, now, now);
  res.status(201).json({
    id,
    title,
    active_model: active,
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString()
  });
});

router.get("/:id/messages", (req, res) => {
  const id = req.params.id;
  if (!isValidId(id)) {
    return res.status(400).json({ error: true, code: "bad_id", message: "对话 id 格式不合法" });
  }
  const conv = req.ctx.db
    .prepare("SELECT id, title, active_model, created_at, updated_at FROM conversations WHERE id = ?")
    .get(id);
  if (!conv) {
    return res.status(404).json({ error: true, code: "not_found", message: "对话不存在: " + id });
  }
  const rows = req.ctx.db
    .prepare("SELECT id, role, content, ts FROM messages WHERE conv_id = ? ORDER BY ts ASC, id ASC LIMIT 1000")
    .all(id);
  res.json({
    conversation: {
      ...conv,
      created_at: new Date(conv.created_at).toISOString(),
      updated_at: new Date(conv.updated_at).toISOString()
    },
    items: rows.map((r) => ({ ...r, ts: new Date(r.ts).toISOString() }))
  });
});

module.exports = router;
module.exports.isValidId = isValidId;
module.exports.genConvId = genConvId;
