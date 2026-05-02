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
 *   FT_MODEL_SYSTEM      — 微调系统线 (默认 shuangyan-system-v1)
 *   FT_MODEL_NAIPPING    — 微调奶瓶线 (默认 shuangyan-naipping-v1)
 *
 * 使用 OpenAI 兼容模式: /compatible-mode/v1/chat/completions
 * SSE 流式 + 非流式降级。
 */

'use strict';

const https = require('https');

const ENDPOINT_HOST = 'dashscope.aliyuncs.com';
const ENDPOINT_PATH = '/compatible-mode/v1/chat/completions';

const MODEL_SYSTEM = process.env.FT_MODEL_SYSTEM || 'shuangyan-system-v1';
const MODEL_NAIPPING = process.env.FT_MODEL_NAIPPING || 'shuangyan-naipping-v1';

function pickModel(variant) {
  return variant === 'naipping' ? MODEL_NAIPPING : MODEL_SYSTEM;
}

function getApiKey() {
  const key = process.env.FT_DASHSCOPE_API_KEY;
  if (!key) throw new Error('FT_DASHSCOPE_API_KEY 未配置');
  return key;
}

/**
 * 流式调用 DashScope, 通过 SSE 把 delta 推送到 res（已设置 SSE 头）
 * @param {object} args
 * @param {string} args.variant
 * @param {Array} args.messages  OpenAI 格式: [{role, content}]
 * @param {object} args.res      Express response (已 writeHead text/event-stream)
 * @returns {Promise<{ full: string, usage?: object }>}
 */
function streamChat(args) {
  const { variant, messages, res } = args;
  const apiKey = getApiKey();
  const model = pickModel(variant);

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
          try {
            res.write(`data: ${JSON.stringify({ error: true, message: '上游模型暂不可用' })}\n\n`);
          } catch (_e) { /* ignore */ }
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
        resolve({ full: fullText, usage });
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
 * 非流式调用（用于 memory-agent 压缩等场景）
 * @returns {Promise<string>}
 */
function chatOnce(args) {
  const { variant, messages, max_tokens } = args;
  const apiKey = getApiKey();
  const model = pickModel(variant);
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
}

module.exports = { streamChat, chatOnce, pickModel, MODEL_SYSTEM, MODEL_NAIPPING };
