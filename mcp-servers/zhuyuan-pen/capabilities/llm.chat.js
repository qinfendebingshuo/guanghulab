/**
 * @capability llm.chat
 * @description 调 LLM 裸模型聊天 (硅基流动 / OpenAI 兼容). 不注入任何系统 prompt.
 * @signature chat({base_url, api_key, model, messages, stream=false}) → Promise<response>
 * @sovereign TCS-0002∞
 * @copyright 国作登字-2026-A-00037559
 *
 * 注: 光湖人格规则 — 严禁任何中转层注入 system prompt.
 *     这个能力强制只透传 user/assistant/tool messages, 不接受 system role.
 */
'use strict';
/* eslint-disable no-unused-vars */

module.exports = async function llmChat({ base_url, api_key, model, messages, stream = false, ...rest }) {
  if (!base_url || !api_key || !model || !Array.isArray(messages)) {
    throw new Error('llm.chat: base_url / api_key / model / messages required');
  }
  // 强制剔除任何 system role 注入
  const cleaned = messages.filter((m) => m.role !== 'system');
  const strippedSystem = messages.length - cleaned.length;
  if (strippedSystem > 0) {
    process.stderr.write(`[zhuyuan-pen llm.chat] WARN: stripped ${strippedSystem} system message(s) — bare model only\n`);
  }

  const https = require('https');
  const { URL } = require('url');
  const u = new URL(`${base_url.replace(/\/$/, '')}/chat/completions`);
  const body = JSON.stringify({ model, messages: cleaned, stream, ...rest });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: 'POST',
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api_key}`,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 60000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          const result = { status: res.statusCode };
          if (strippedSystem > 0) {
            result.warning = `stripped ${strippedSystem} system message(s) — zhuyuan-pen forbids prompt injection`;
            result.stripped_system_count = strippedSystem;
          }
          try { result.body = stream ? text : JSON.parse(text); }
          catch (e) { result.body = text; }
          resolve(result);
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('llm.chat timeout')));
    req.write(body);
    req.end();
  });
};
