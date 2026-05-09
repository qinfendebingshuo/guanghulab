/*
 * 推理客户端
 * - 读 inference-endpoint.json (PR-3 的 refresh-autodl-endpoint.yml 写入)
 * - 提供 health() / fetch() / pipeChat()
 *
 * cc-002: 入口前再 strip 一次 system role (虽然前端不发, 但作为后端不补这层防线).
 * cc-003: 不假设 host:port 是固定的, 文件变了下次请求自动用新值.
 * cc-004: 错误信息走中文.
 */
"use strict";

const fs = require("fs");
const http = require("http");
const https = require("https");
const { URL } = require("url");

let endpointPath = null;
let activeModelPath = null;
let lastEndpoint = null;
let lastEndpointMtime = 0;
let activeModel = "mother";

function init({ endpointPath: epp, activeModelPath: amp }) {
  endpointPath = epp;
  activeModelPath = amp;
  // 加载已保存的 active model
  try {
    if (fs.existsSync(activeModelPath)) {
      const j = JSON.parse(fs.readFileSync(activeModelPath, "utf8"));
      if (j && (j.name === "mother" || j.name === "coder")) activeModel = j.name;
    }
  } catch (_) {
    /* ignore */
  }
}

function readEndpoint() {
  if (!endpointPath || !fs.existsSync(endpointPath)) {
    lastEndpoint = null;
    return null;
  }
  try {
    const stat = fs.statSync(endpointPath);
    if (stat.mtimeMs !== lastEndpointMtime) {
      const j = JSON.parse(fs.readFileSync(endpointPath, "utf8"));
      lastEndpoint = j;
      lastEndpointMtime = stat.mtimeMs;
    }
    return lastEndpoint;
  } catch (e) {
    return null;
  }
}

function getActiveModel() {
  return activeModel;
}

function setActiveModel(name) {
  if (name !== "mother" && name !== "coder") {
    throw Object.assign(new Error("模型名称只允许 mother 或 coder"), { status: 400 });
  }
  activeModel = name;
  try {
    fs.writeFileSync(
      activeModelPath,
      JSON.stringify({ name, updated_at: new Date().toISOString() }, null, 2)
    );
  } catch (_) {
    /* ignore — 即使写不下去也不挡前端 */
  }
  return name;
}

function buildUrl(ep, urlPath) {
  if (!ep || !ep.host) return null;
  const scheme = ep.scheme === "http" ? "http" : "https";
  const port = ep.port ? `:${ep.port}` : "";
  const base = `${scheme}://${ep.host}${port}`;
  return new URL(urlPath, base);
}

function pickClient(u) {
  return u.protocol === "https:" ? https : http;
}

function buildAuthHeaders(ep) {
  const h = {};
  if (ep && ep.bearer) h["Authorization"] = "Bearer " + ep.bearer;
  return h;
}

function _strip_system_messages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.filter((m) => m && m.role && m.role !== "system");
}

async function health() {
  const ep = readEndpoint();
  if (!ep) {
    return { ready: false, message: "推理端点未配置 · 等 refresh-autodl-endpoint.yml 写 inference-endpoint.json" };
  }
  const url = buildUrl(ep, "/v1/health");
  if (!url) return { ready: false, message: "推理端点配置无效" };
  return new Promise((resolve) => {
    const req = pickClient(url).request(
      url,
      { method: "GET", timeout: 5000, headers: buildAuthHeaders(ep) },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            return resolve({ ready: false, message: `推理端返回 ${res.statusCode}` });
          }
          try {
            const j = JSON.parse(body);
            resolve({
              ready: !!j.ready,
              model: j.model || activeModel,
              gpu: j.gpu || null,
              endpoint: { host: ep.host, port: ep.port }
            });
          } catch (_) {
            resolve({ ready: false, message: "推理端响应不是合法 JSON" });
          }
        });
      }
    );
    req.on("error", (e) => resolve({ ready: false, message: "推理端连接失败: " + e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ready: false, message: "推理端连接超时" });
    });
    req.end();
  });
}

async function switchUpstreamModel(name) {
  const ep = readEndpoint();
  if (!ep) throw Object.assign(new Error("推理端点未配置, 无法切换"), { status: 503 });
  const url = buildUrl(ep, "/v1/switch-model");
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ name });
    const req = pickClient(url).request(
      url,
      {
        method: "POST",
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...buildAuthHeaders(ep)
        }
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(buf)); } catch (_) { resolve({ ok: true }); }
          } else {
            reject(Object.assign(new Error(`推理端切模型失败 (${res.statusCode})`), { status: 502 }));
          }
        });
      }
    );
    req.on("error", (e) => reject(Object.assign(new Error("切模型连接失败: " + e.message), { status: 502 })));
    req.on("timeout", () => {
      req.destroy();
      reject(Object.assign(new Error("切模型超时"), { status: 504 }));
    });
    req.write(body);
    req.end();
  });
}

/**
 * pipeChat — 字节级 SSE 转发.
 * 入口前 strip system, 之后服务端只做 auth+rate-limit, 不重组 SSE.
 *
 * 注意: 这里是 byte-pipe — 上游写什么字节, 浏览器就收什么字节
 *      (cc-002 的"不重组"原则).
 *
 * @param {object} payload  OpenAI 兼容 chat.completions 请求体
 * @param {object} res      Express response (将被 pipe)
 * @returns {object}        { fullText } 在流结束后, 用于持久化 assistant 消息
 */
function pipeChat(payload, res) {
  return new Promise((resolve, reject) => {
    const ep = readEndpoint();
    if (!ep) {
      const err = Object.assign(new Error("推理端点未配置"), { status: 503 });
      return reject(err);
    }
    const url = buildUrl(ep, "/v1/chat/completions");
    if (!url) return reject(Object.assign(new Error("推理端点配置无效"), { status: 503 }));

    // cc-002 后端最后一道防线: 剥 system
    const safe = {
      ...payload,
      stream: true,
      model: payload.model || activeModel,
      messages: _strip_system_messages(payload.messages)
    };
    const body = JSON.stringify(safe);

    // 写 SSE 头
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    let fullText = "";

    const upstream = pickClient(url).request(
      url,
      {
        method: "POST",
        timeout: 120000,
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "Content-Length": Buffer.byteLength(body),
          ...buildAuthHeaders(ep)
        }
      },
      (upRes) => {
        if (upRes.statusCode !== 200) {
          let buf = "";
          upRes.on("data", (c) => (buf += c));
          upRes.on("end", () => {
            // 没开始 stream 之前, 推理端返回非 200 — 报中文错给浏览器
            const msg = `推理端拒绝请求 (${upRes.statusCode}): ${buf.slice(0, 200)}`;
            try {
              res.write(`data: ${JSON.stringify({ error: true, message: msg })}\n\n`);
              res.write("data: [DONE]\n\n");
            } finally {
              res.end();
              reject(Object.assign(new Error(msg), { status: 502 }));
            }
          });
          return;
        }
        // byte-pipe: 上游写什么, 我们写什么. 同时旁路解析以便落库.
        upRes.on("data", (chunk) => {
          res.write(chunk);
          // 旁路解析 OpenAI 兼容 SSE — 失败也不影响 pipe
          try {
            const text = chunk.toString("utf8");
            for (const block of text.split("\n\n")) {
              for (const line of block.split("\n")) {
                const t = line.trim();
                if (!t.startsWith("data:")) continue;
                const data = t.slice(5).trim();
                if (!data || data === "[DONE]") continue;
                const j = JSON.parse(data);
                const piece = j && j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
                if (piece) fullText += piece;
              }
            }
          } catch (_) {
            /* ignore parse error — pipe 不能因为解析失败断 */
          }
        });
        upRes.on("end", () => {
          res.end();
          resolve({ fullText });
        });
        upRes.on("error", (e) => {
          try { res.end(); } catch (_) {}
          reject(Object.assign(new Error("推理端流断: " + e.message), { status: 502 }));
        });
      }
    );

    upstream.on("error", (e) => {
      // 还没开始写 SSE body 时直接 reject; 已经写了就关流 (检查 writableEnded 防双关)
      if (!res.headersSent) {
        return reject(Object.assign(new Error("推理端连接失败: " + e.message), { status: 502 }));
      }
      if (!res.writableEnded) {
        try {
          res.write(`data: ${JSON.stringify({ error: true, message: "推理端连接断: " + e.message })}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
        } catch (_) {
          /* socket 已断, 写不进去就算了 */
        }
      }
      reject(Object.assign(new Error("推理端连接失败: " + e.message), { status: 502 }));
    });
    upstream.on("timeout", () => {
      upstream.destroy();
    });

    upstream.write(body);
    upstream.end();
  });
}

module.exports = {
  init,
  health,
  pipeChat,
  switchUpstreamModel,
  getActiveModel,
  setActiveModel,
  _strip_system_messages
};
