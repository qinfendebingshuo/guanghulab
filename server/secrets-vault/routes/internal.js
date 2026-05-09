/*
 * 内部本机 socket 接口 · 给神笔马良 (zhuyuan-pen) 拉密钥用.
 *   只允许 127.0.0.1 / ::1 (IPv6 loopback) 来源, 其他一律 403.
 *   不需要 basic-auth (本机进程权限 = vault 用户已经够了).
 *
 *   GET /internal/fetch/:key  → { value }
 *
 * baton-005 C 节: 神笔马良不走环境变量, 走本地 socket. 这里其实是 loopback HTTP,
 * 比 unix domain socket 简单 (2C2G 上少一份 socket 文件管理负担), 实质等价.
 */
"use strict";

const express = require("express");
const { KEY_RE } = require("./secrets");

function buildInternalRouter({ vault }) {
  const router = express.Router();

  // 只允许本机
  router.use((req, res, next) => {
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || "";
    // express 的 req.ip: 如果 trust proxy 没开, 是 socket.remoteAddress
    // 我们 server.js 不开 trust proxy, 所以 req.ip 直接是 socket 地址.
    if (
      ip === "127.0.0.1" ||
      ip === "::1" ||
      ip === "::ffff:127.0.0.1" ||
      ip === "localhost"
    ) {
      return next();
    }
    return res
      .status(403)
      .json({ error: true, code: "forbidden_non_local", message: "只允许本机访问 (来源=" + ip + ")" });
  });

  router.get("/fetch/:key", (req, res) => {
    const key = String(req.params.key || "");
    if (!KEY_RE.test(key)) {
      return res
        .status(400)
        .json({ error: true, code: "invalid_key", message: "密钥名格式不对: " + key });
    }
    let val;
    try {
      val = vault.get(key);
    } catch (e) {
      return res
        .status(500)
        .json({ error: true, code: "vault_decrypt_failed", message: e.message });
    }
    if (val == null) {
      return res
        .status(404)
        .json({ error: true, code: "not_configured", message: "密钥未配置: " + key });
    }
    res.json({ ok: true, key, value: val });
  });

  return router;
}

module.exports = { buildInternalRouter };
