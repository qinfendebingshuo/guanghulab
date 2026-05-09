/*
 * ════════════════════════════════════════════════════════════════
 * AutoDL 推理端点本地刷新逻辑 (PR-5 落地 baton-005 的 D 节)
 * 守护: 铸渊 · ICE-GL-ZY001
 * ════════════════════════════════════════════════════════════════
 *
 * baton-005 自检题 1: AutoDL 端口变, GitHub Secrets 改要 5 步等同步,
 * 这里是为什么我们要本地 vault — 1 步保存立即生效.
 *
 * 流程 (POST /admin/secrets/autodl/save_and_refresh):
 *   1. 读 vault 里的 ZY_AUTODL_HOST + ZY_AUTODL_PORT (本次 save 已落)
 *   2. 探活 https://host:port/v1/health (重试 3 次)
 *   3. 不通 → 不写 endpoint, 返回中文错误
 *   4. 通 → 组装 inference-endpoint.json (与 refresh-autodl-endpoint.yml
 *      格式一致) 写到 PORTAL_DATA_DIR/inference-endpoint.json
 *   5. (可选) pm2 reload portal — 通过 pm2 二进制. portal 自己也会感知
 *      mtime 变化, 所以 reload 失败不阻断流程.
 *
 * 设计原则:
 *   cc-002 — 不在探活/写文件流程里塞任何 system prompt 痕迹
 *   cc-003 — 端点彻底动态, 写完立刻可用
 *   cc-004 — 任意一步失败都给中文回执, 不甩英文 stacktrace
 */
"use strict";

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const { spawn } = require("child_process");
const { URL } = require("url");

function pick(u) {
  return u.protocol === "https:" ? https : http;
}

function probe(url, timeoutMs) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return resolve({ ok: false, message: "推理端点 URL 不合法: " + e.message });
    }
    const req = pick(u).request(
      u,
      { method: "GET", timeout: timeoutMs || 10000 },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            return resolve({
              ok: false,
              message: `推理端返回 ${res.statusCode}, 不像在跑`
            });
          }
          try {
            const j = JSON.parse(body);
            resolve({ ok: true, body: j });
          } catch (_) {
            resolve({ ok: false, message: "推理端响应不是合法 JSON" });
          }
        });
      }
    );
    req.on("error", (e) => resolve({ ok: false, message: "探活连接失败: " + e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, message: "探活超时 (10s)" });
    });
    req.end();
  });
}

async function probeWithRetry(url, retries) {
  for (let i = 0; i < retries; i++) {
    const r = await probe(url, 10000);
    if (r.ok) return r;
    if (i < retries - 1) await new Promise((res) => setTimeout(res, 2000));
  }
  return { ok: false, message: "推理端探活 3 次都失败 (URL=" + url + ")" };
}

/**
 * 探活成功后写 inference-endpoint.json + 尝试 pm2 reload
 *
 * @param {object} opts
 * @param {string} opts.host
 * @param {string|number} opts.port
 * @param {string} [opts.scheme] 'https' | 'http'
 * @param {string} opts.endpointPath 写入文件 (绝对路径)
 * @param {boolean} [opts.skipPmReload] 测试时关
 */
async function saveAndRefresh(opts) {
  const host = String(opts.host || "").trim();
  const port = String(opts.port || "").trim();
  const scheme = opts.scheme === "http" ? "http" : "https";
  if (!host) return { ok: false, code: "host_empty", message: "AutoDL 连接地址 (host) 还没填." };
  if (!/^[0-9]+$/.test(port)) {
    return { ok: false, code: "port_invalid", message: "AutoDL 端口必须是纯数字, 当前=" + port };
  }
  const portN = parseInt(port, 10);
  if (portN < 1 || portN > 65535) {
    return { ok: false, code: "port_out_of_range", message: "AutoDL 端口越界 (1..65535)" };
  }

  const url = `${scheme}://${host}:${portN}`;
  // 1. 探活
  const health = await probeWithRetry(`${url}/v1/health`, 3);
  if (!health.ok) {
    return {
      ok: false,
      code: "health_failed",
      message:
        "推理端不可达, 没改成. 常见原因: AutoDL 实例没开机 / 端口抄错 / setup-inference.sh 还没跑完. 详情: " +
        health.message
    };
  }
  const h = health.body || {};
  const gpu = h.gpu || {};
  const tier = h.tier || {};
  const model = h.model || {};

  // 2. 组装 endpoint payload — 与 refresh-autodl-endpoint.yml 一致
  const endpoint = {
    _sovereign: "TCS-0002∞ · 国作登字-2026-A-00037559",
    _守护: "铸渊 · ICE-GL-ZY001",
    _写入来源: "secrets-vault save_and_refresh (本地一步保存)",
    endpoint_url: url,
    refreshed_at: new Date().toISOString(),
    refreshed_by_run_id: null,
    gpu: { name: gpu.name || "unknown", memory_gb: gpu.memory_gb || gpu.memory || "0" },
    tier: { size_tier: tier.size_tier || "unknown", quantization: tier.quantization || "unknown" },
    active_model: model.name || "unknown"
  };

  // 3. 写文件 (原子 rename)
  try {
    fs.mkdirSync(path.dirname(opts.endpointPath), { recursive: true });
    const tmp = opts.endpointPath + ".tmp." + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(endpoint, null, 2), { mode: 0o644 });
    fs.renameSync(tmp, opts.endpointPath);
  } catch (e) {
    return {
      ok: false,
      code: "write_failed",
      message: "写 inference-endpoint.json 失败: " + e.message
    };
  }

  // 4. 尝试 pm2 reload portal (可选 · 失败不挡)
  let pm2_msg = "未尝试 pm2 reload (skipPmReload=true)";
  if (!opts.skipPmReload) {
    pm2_msg = await tryPmReload();
  }

  return {
    ok: true,
    code: "ok",
    message: "已切到新端点 " + url + ", portal 会自动读到. " + pm2_msg,
    endpoint
  };
}

function tryPmReload() {
  return new Promise((resolve) => {
    let pm2Bin = process.env.PM2_BIN || "pm2";
    const child = spawn(pm2Bin, ["reload", "guanghulab-portal"], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15000
    });
    let stderr = "";
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.on("error", (e) => {
      resolve("(pm2 不可用: " + e.message + ", portal 会通过 mtime 自动感知端点变更)");
    });
    child.on("close", (code) => {
      if (code === 0) resolve("(已 pm2 reload portal)");
      else
        resolve(
          "(pm2 reload 失败 code=" +
            code +
            ", portal 会通过 mtime 自动感知端点变更; stderr=" +
            stderr.slice(0, 120) +
            ")"
        );
    });
  });
}

module.exports = { saveAndRefresh, probe, probeWithRetry };
