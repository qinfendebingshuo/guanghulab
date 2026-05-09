/*
 * /admin/secrets · 路由层
 *   GET    /admin/secrets                列出所有 key (遮罩值)
 *   GET    /admin/secrets/manifest       列出按 workflow 分组的 secret 元数据 (用途/如何配置)
 *   POST   /admin/secrets/:key           写入/更新单个 key {value: "..."}
 *   DELETE /admin/secrets/:key           删除单个 key
 *   POST   /admin/secrets/autodl/save_and_refresh
 *                                        一键: 把 host/port/user/pass 写入 vault, 然后探活 + 写
 *                                        inference-endpoint.json + pm2 reload (PR-3 联动)
 *
 * cc-004: 全部中文回执
 */
"use strict";

const express = require("express");
const path = require("path");

const { maskValue } = require("../lib/vault");
const manifestLib = require("../lib/manifest");
const refresh = require("../lib/refresh-inference");

// 合法 key 名: 大写字母数字下划线 (跟 GitHub Secrets 风格一致)
const KEY_RE = /^[A-Z][A-Z0-9_]{1,63}$/;

const VALUE_MAX = 8 * 1024; // 8KB 单 value 上限 (秘钥/SSH key 也够)

function chineseError(res, status, code, message) {
  return res.status(status).json({ error: true, code, message });
}

function buildRouter({ vault, manifestPath, endpointPath }) {
  const router = express.Router();
  const known = manifestLib.knownKeys(manifestPath);

  // ─── manifest (前端拉分组定义) ────────────────────────────
  router.get("/manifest", (_req, res) => {
    try {
      const groups = manifestLib.buildGroups(manifestPath);
      res.json({
        _sovereign: "TCS-0002∞ · 国作登字-2026-A-00037559",
        groups
      });
    } catch (e) {
      chineseError(res, 500, "manifest_load_failed", "密钥清单加载失败: " + e.message);
    }
  });

  // ─── 列出已配置的 key (只返回遮罩值) ─────────────────────
  router.get("/", (_req, res) => {
    let all;
    try {
      all = vault.loadAll();
    } catch (e) {
      return chineseError(res, 500, "vault_decrypt_failed",
        "密钥库读取失败 (主密钥可能换过): " + e.message);
    }
    const masked = {};
    for (const k of Object.keys(all.secrets)) {
      masked[k] = {
        configured: true,
        masked: maskValue(all.secrets[k]),
        length: String(all.secrets[k]).length
      };
    }
    res.json({
      updated_at: all.updated_at,
      configured_keys: Object.keys(all.secrets),
      values: masked
    });
  });

  // ─── 写入单个 key ──────────────────────────────────────────
  // 注: 路径参数 :key 严格 KEY_RE 校验, 不允许任意字符串落到 vault
  router.post("/:key", express.json({ limit: "16kb" }), (req, res) => {
    const key = String(req.params.key || "");
    if (!KEY_RE.test(key)) {
      return chineseError(res, 400, "invalid_key",
        "密钥名格式不对 (只允许大写字母+数字+下划线, 2-64 位, 字母开头): " + key);
    }
    if (!known.has(key)) {
      return chineseError(res, 400, "unknown_key",
        "这个密钥名不在 secrets-manifest.json 白名单里: " + key + ". 请铸渊先在清单里登记后再来.");
    }
    const v = req.body && req.body.value;
    if (typeof v !== "string") {
      return chineseError(res, 400, "missing_value", "请求体必须是 {\"value\":\"...\"} 这样的 JSON.");
    }
    if (v.length > VALUE_MAX) {
      return chineseError(res, 413, "value_too_large",
        "密钥值过长 (>" + VALUE_MAX + " 字节). 真要存这么大, 联系铸渊.");
    }

    // 强校验 (跟 manifest 对齐: 比如 ZY_GITEA_ADMIN_PASS length>=24)
    const meta = manifestLib.findSecretMeta(key, manifestPath);
    if (meta && meta["强校验"]) {
      const rule = meta["强校验"];
      const m = rule.match(/^length>=(\d+)$/);
      if (m) {
        const need = parseInt(m[1], 10);
        if (v.length < need) {
          return chineseError(res, 400, "weak_value",
            `密钥强度不够 · 要求 ${rule}, 当前长度 ${v.length}.`);
        }
      }
    }

    let updated_at;
    try {
      updated_at = vault.set(key, v);
    } catch (e) {
      return chineseError(res, 500, "vault_write_failed", "密钥写入失败: " + e.message);
    }
    res.json({
      ok: true,
      key,
      configured: true,
      masked: maskValue(v),
      updated_at,
      message: "已保存 · " + (meta ? meta["用途"] || key : key)
    });
  });

  // ─── 删除单个 key ──────────────────────────────────────────
  router.delete("/:key", (req, res) => {
    const key = String(req.params.key || "");
    if (!KEY_RE.test(key)) {
      return chineseError(res, 400, "invalid_key", "密钥名格式不对: " + key);
    }
    let removed;
    try {
      removed = vault.delete(key);
    } catch (e) {
      return chineseError(res, 500, "vault_write_failed", "密钥删除失败: " + e.message);
    }
    if (!removed) {
      return chineseError(res, 404, "not_configured", "这个密钥本来就没存过: " + key);
    }
    res.json({ ok: true, key, configured: false, message: "已删除 · " + key });
  });

  // ─── AutoDL 一键: 保存并刷新推理端点 ────────────────────────
  // body: { host, port, user?, pass?, scheme? }
  router.post("/autodl/save_and_refresh", express.json({ limit: "16kb" }), async (req, res) => {
    const { host, port, user, pass, scheme } = req.body || {};
    if (typeof host !== "string" || !host.trim()) {
      return chineseError(res, 400, "host_required", "AutoDL 连接地址 (host) 不能为空.");
    }
    if (typeof port !== "string" && typeof port !== "number") {
      return chineseError(res, 400, "port_required", "AutoDL 端口 (port) 不能为空.");
    }

    // 1. 先把 vault 写一份 (即使探活不通也要保留, 方便冰朔下次)
    try {
      vault.set("ZY_AUTODL_HOST", String(host).trim());
      vault.set("ZY_AUTODL_PORT", String(port).trim());
      if (typeof user === "string" && user) vault.set("ZY_AUTODL_USER", user);
      if (typeof pass === "string" && pass) vault.set("ZY_AUTODL_PASS", pass);
    } catch (e) {
      return chineseError(res, 500, "vault_write_failed",
        "vault 写入失败 (端点未刷新): " + e.message);
    }

    // 2. 探活 + 写 inference-endpoint.json + pm2 reload
    const r = await refresh.saveAndRefresh({
      host,
      port,
      scheme,
      endpointPath,
      skipPmReload: process.env.VAULT_SKIP_PM_RELOAD === "1"
    });

    if (!r.ok) {
      // 已写 vault, 但端点没刷成 — 给前端透明的中文回执
      return res.status(502).json({
        error: true,
        code: r.code,
        message: r.message,
        vault_saved: true,
        endpoint_refreshed: false
      });
    }
    res.json({
      ok: true,
      vault_saved: true,
      endpoint_refreshed: true,
      endpoint: r.endpoint,
      message: r.message
    });
  });

  return router;
}

module.exports = { buildRouter, KEY_RE, VALUE_MAX };
