/*
 * /api/active-model — 当前激活的模型 (mother | coder)
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * GET  / → 当前
 * POST / {name} → 切换 (本地状态 + 转发推理端)
 *
 * 注意: 推理端 switch-model 失败时, 本地状态不回滚.
 * 原因: 推理端可能没起 (AutoDL 关机 / 还没 refresh-endpoint), 但用户在前端
 *       切 tab 应该立即生效, 等推理端起来再连. 这跟 cc-004 "不让用户做无用功"
 *       一致. 如果回滚, 用户每次切 tab 都失败, 体验崩.
 */
"use strict";

const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    name: req.ctx.inference.getActiveModel()
  });
});

router.post("/", async (req, res) => {
  const body = req.body || {};
  const name = body.name;
  if (name !== "mother" && name !== "coder") {
    return res.status(400).json({ error: true, code: "bad_name", message: "name 只允许 mother 或 coder" });
  }
  // 本地立即生效
  req.ctx.inference.setActiveModel(name);
  // 异步通知推理端 (失败不挡前端)
  let upstream = { ok: false, message: "推理端尚未联通, 切换稍后生效" };
  try {
    const r = await req.ctx.inference.switchUpstreamModel(name);
    upstream = { ok: true, ...r };
  } catch (e) {
    upstream = { ok: false, message: e.message };
  }
  res.json({ name, upstream });
});

module.exports = router;
