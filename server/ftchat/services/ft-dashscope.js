/**
 * ═══════════════════════════════════════════════════════════
 * 🎯 阿里云百炼 · 微调模型调用 (DashScope compatible-mode)
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-FTCHAT-DS-001
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * 配置:
 *   FT_DASHSCOPE_API_KEY — 单独区分商业模型与微调模型的密钥
 *   FT_MODEL_SYSTEM      — 微调系统线 (默认 qwen3-8b-ft-202604281809-9f30 · 冰朔 D69 提供)
 *   FT_MODEL_NAIPPING    — 微调奶瓶线 (默认同系统线 · 待奶瓶专属微调上线后再分流)
 *   FT_MODEL_FALLBACK    — 当微调模型不存在/无权限时自动降级到的基础模型
 *                          (默认 qwen-turbo) · 保证 model_not_found 时聊天不挂
 *
 * 使用 OpenAI 兼容模式: /compatible-mode/v1/chat/completions
 * SSE 流式 + 非流式降级。
 */

'use strict';

const https = require('https');

const ENDPOINT_HOST = 'dashscope.aliyuncs.com';
const ENDPOINT_PATH = '/compatible-mode/v1/chat/completions';

const MODEL_SYSTEM = process.env.FT_MODEL_SYSTEM || 'qwen3-8b-ft-202604281809-9f30';
const MODEL_NAIPPING = process.env.FT_MODEL_NAIPPING || 'qwen3-8b-ft-202604281809-9f30';
const MODEL_FALLBACK = process.env.FT_MODEL_FALLBACK || 'qwen-turbo';

// 已确认在 DashScope 账号下不存在的模型 ID, 后续直接走 fallback, 避免每轮都 404
const missingModels = new Set();

function pickModel(variant) {
  const primary = variant === 'naipping' ? MODEL_NAIPPING : MODEL_SYSTEM;
  if (missingModels.has(primary)) return MODEL_FALLBACK;
  return primary;
}

function getApiKey() {
  const key = process.env.FT_DASHSCOPE_API_KEY;
  if (!key) throw new Error('FT_DASHSCOPE_API_KEY 未配置');
  return key;
}

/**
 * 内部: 单次流式调用 (不带 fallback). 遇到 model_not_found 直接 reject, 由外层决定是否重试。
 */
function _streamChatOnce(args) {
  const { variant, messages, res, modelOverride } = args;
  const apiKey = getApiKey();
  const model = modelOverride || pickModel(variant);

  const body = JSON.stringify({
    model,
    messages,
    stream: true,
    max_tokens: 2048,
    temperature: 0.8
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: ENDPOINT_HOST,
      path: ENDPOINT_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 120000
    }, (upstream) => {
      if (upstream.statusCode !== 200) {
        let errBuf = '';
        upstream.on('data', c => { errBuf += c; });
        upstream.on('end', () => {
          const msg = `DashScope HTTP ${upstream.statusCode}: ${errBuf.slice(0, 300)}`;
          console.error('[FTCHAT DS]', msg);
          // 标记缺失模型, 抛出可识别错误供外层重试
          let isModelNotFound = false;
          try {
            const parsed = JSON.parse(errBuf);
            isModelNotFound = parsed && parsed.error && parsed.error.code === 'model_not_found';
          } catch (_e) { /* ignore */ }
          if (isModelNotFound) {
            missingModels.add(model);
            const err = new Error(msg);
            err.modelNotFound = true;
            err.attemptedModel = model;
            return reject(err);
          }
          reject(new Error(msg));
        });
        return;
      }

      let fullText = '';
      let buf = '';
      let usage = null;

      upstream.on('data', (chunk) => {
        buf += chunk.toString('utf8');
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') {
            try { res.write('data: [DONE]\n\n'); } catch (_e) { /* ignore */ }
            continue;
          }
          let parsed;
          try { parsed = JSON.parse(payload); } catch (_e) { continue; }
          if (parsed.usage) usage = parsed.usage;
          const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
          const piece = delta && delta.content;
          if (piece) {
            fullText += piece;
            try {
              res.write(`data: ${JSON.stringify({ delta: piece })}\n\n`);
            } catch (_e) { /* response closed */ }
          }
        }
      });

      upstream.on('end', () => {
        resolve({ full: fullText, usage, model });
      });

      upstream.on('error', (err) => {
        console.error('[FTCHAT DS] upstream error:', err.message);
        reject(err);
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('upstream timeout'));
    });
    req.on('error', (err) => {
      console.error('[FTCHAT DS] request error:', err.message);
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

/**
 * 流式调用 DashScope, 通过 SSE 把 delta 推送到 res（已设置 SSE 头）
 * model_not_found 时自动降级到 FT_MODEL_FALLBACK (默认 qwen-turbo).
 * @param {object} args
 * @param {string} args.variant
 * @param {Array} args.messages  OpenAI 格式: [{role, content}]
 * @param {object} args.res      Express response (已 writeHead text/event-stream)
 * @returns {Promise<{ full: string, usage?: object, model: string }>}
 */
async function streamChat(args) {
  try {
    return await _streamChatOnce(args);
  } catch (err) {
    if (err && err.modelNotFound && err.attemptedModel !== MODEL_FALLBACK) {
      console.warn(
        `[FTCHAT DS] model "${err.attemptedModel}" not accessible, falling back to "${MODEL_FALLBACK}"`
      );
      try {
        args.res.write(
          `data: ${JSON.stringify({ notice: `微调模型暂不可用, 已自动降级到 ${MODEL_FALLBACK}` })}\n\n`
        );
      } catch (_e) { /* ignore */ }
      return _streamChatOnce(Object.assign({}, args, { modelOverride: MODEL_FALLBACK }));
    }
    // 其他错误: 把上游真实错误透传给前端 (而不是模糊的 '上游模型暂不可用'), 便于诊断
    try {
      args.res.write(`data: ${JSON.stringify({ error: true, message: err.message || '上游模型暂不可用' })}\n\n`);
    } catch (_e) { /* ignore */ }
    throw err;
  }
}

/**
 * 非流式调用（用于 memory-agent 压缩等场景）
 * model_not_found 时自动降级到 FT_MODEL_FALLBACK
 * @returns {Promise<string>}
 */
async function chatOnce(args) {
  const { variant, messages, max_tokens } = args;
  const tryModel = async (model) => {
    const apiKey = getApiKey();
    const body = JSON.stringify({
      model,
      messages,
      stream: false,
      max_tokens: max_tokens || 800,
      temperature: 0.5
    });

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: ENDPOINT_HOST,
        path: ENDPOINT_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 60000
      }, (upstream) => {
        let buf = '';
        upstream.on('data', c => { buf += c; });
        upstream.on('end', () => {
          if (upstream.statusCode !== 200) {
            let isModelNotFound = false;
            try {
              const parsed = JSON.parse(buf);
              isModelNotFound = parsed && parsed.error && parsed.error.code === 'model_not_found';
            } catch (_e) { /* ignore */ }
            if (isModelNotFound) {
              missingModels.add(model);
              const err = new Error(`DashScope HTTP ${upstream.statusCode}: ${buf.slice(0, 200)}`);
              err.modelNotFound = true;
              err.attemptedModel = model;
              return reject(err);
            }
            return reject(new Error(`DashScope HTTP ${upstream.statusCode}: ${buf.slice(0, 200)}`));
          }
          try {
            const parsed = JSON.parse(buf);
            const content = parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content;
            resolve(content || '');
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('timeout', () => req.destroy(new Error('upstream timeout')));
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  };

  const primary = pickModel(variant);
  try {
    return await tryModel(primary);
  } catch (err) {
    if (err && err.modelNotFound && err.attemptedModel !== MODEL_FALLBACK) {
      console.warn(
        `[FTCHAT DS] (chatOnce) model "${err.attemptedModel}" not accessible, falling back to "${MODEL_FALLBACK}"`
      );
      return tryModel(MODEL_FALLBACK);
    }
    throw err;
  }
}

/**
 * ═════════════════════════════════════════════════════════════
 * 纯字节管道 (铸渊 · 2026-05-02)
 * ═════════════════════════════════════════════════════════════
 * 上游百炼 SSE 字节直接 pipe 到浏览器, 服务端零解析、零打包。
 * 仅在以下两种情况打断管道:
 *   1. 上游非 200 → 收集错误体, 判定 model_not_found 后由 pipeChat 决定降级
 *   2. 上游 timeout / 网络错误 → reject 给上层 (此时 res headers 可能尚未发出)
 *
 * 与 streamChat 的区别:
 *   - streamChat: 服务端解析 SSE → 抽出 delta.content → 重新发 `{delta: piece}` 帧
 *                 (本轮已弃用于聊天链路, 仅保留兼容)
 *   - pipeChat:   `upstream.pipe(res)`, 字节透传, 浏览器直接读百炼原生格式
 */
function _pipeChatOnce(args) {
  const { variant, messages, res, modelOverride } = args;
  const apiKey = getApiKey();
  const model = modelOverride || pickModel(variant);

  const body = JSON.stringify({
    model,
    messages,
    stream: true,
    max_tokens: 2048,
    temperature: 0.8
  });

  return new Promise((resolve, reject) => {
    const upReq = https.request({
      hostname: ENDPOINT_HOST,
      path: ENDPOINT_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 120000
    }, (upstream) => {
      if (upstream.statusCode !== 200) {
        let errBuf = '';
        upstream.on('data', c => { errBuf += c; });
        upstream.on('end', () => {
          const msg = `DashScope HTTP ${upstream.statusCode}: ${errBuf.slice(0, 300)}`;
          console.error('[FTCHAT DS pipe]', msg);
          let isModelNotFound = false;
          try {
            const parsed = JSON.parse(errBuf);
            isModelNotFound = parsed && parsed.error && parsed.error.code === 'model_not_found';
          } catch (_e) { /* ignore */ }
          if (isModelNotFound) {
            missingModels.add(model);
            const err = new Error(msg);
            err.modelNotFound = true;
            err.attemptedModel = model;
            return reject(err);
          }
          reject(new Error(msg));
        });
        return;
      }

      // 200 OK: 字节级管道. 上游 SSE 头透传给浏览器
      if (!res.headersSent) {
        res.writeHead(200, {
          'Content-Type': upstream.headers['content-type'] || 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });
        if (typeof res.flushHeaders === 'function') res.flushHeaders();
      }

      upstream.pipe(res, { end: false });
      upstream.on('end', () => resolve({ model }));
      upstream.on('error', (err) => {
        console.error('[FTCHAT DS pipe] upstream error:', err.message);
        reject(err);
      });
    });

    upReq.on('timeout', () => upReq.destroy(new Error('upstream timeout')));
    upReq.on('error', (err) => {
      console.error('[FTCHAT DS pipe] request error:', err.message);
      reject(err);
    });

    upReq.write(body);
    upReq.end();
  });
}

/**
 * 纯字节管道版本: 把上游百炼 SSE 字节直接 pipe 到 res.
 * model_not_found 时自动降级到 FT_MODEL_FALLBACK (仅当 res headers 尚未发出时).
 * 上游 200 之后, 服务端不再解析任何字节 — 浏览器直接读 OpenAI 兼容 SSE 格式.
 *
 * @returns {Promise<{ model: string }>}
 */
async function pipeChat(args) {
  try {
    return await _pipeChatOnce(args);
  } catch (err) {
    if (
      err && err.modelNotFound &&
      err.attemptedModel !== MODEL_FALLBACK &&
      args.res && !args.res.headersSent
    ) {
      console.warn(
        `[FTCHAT DS pipe] model "${err.attemptedModel}" not accessible, falling back to "${MODEL_FALLBACK}"`
      );
      return _pipeChatOnce(Object.assign({}, args, { modelOverride: MODEL_FALLBACK }));
    }
    throw err;
  }
}

module.exports = { streamChat, pipeChat, chatOnce, pickModel, MODEL_SYSTEM, MODEL_NAIPPING, MODEL_FALLBACK };
