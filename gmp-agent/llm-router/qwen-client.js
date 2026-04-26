/**
 * 通义千问 API 客户端
 * GH-GMP-005 · M2 · LLM Router
 *
 * OpenAI兼容格式 · 重试 · 降级 · token计数
 */

'use strict';

const https = require('https');
const http = require('http');

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_TIMEOUT_MS = 120000;
const MAX_RETRIES = 2;

class QwenClient {
  /**
   * @param {object} [opts]
   * @param {string} [opts.apiKey] - DashScope API Key, defaults to env GH_LLM_API_KEY
   * @param {string} [opts.baseUrl]
   * @param {object} [opts.logger]
   */
  constructor(opts = {}) {
    this.apiKey = opts.apiKey || process.env.GH_LLM_API_KEY;
    this.baseUrl = opts.baseUrl || process.env.GH_LLM_BASE_URL || DEFAULT_BASE_URL;
    this.logger = opts.logger || console;
    this._totalInputTokens = 0;
    this._totalOutputTokens = 0;
    this._callCount = 0;
  }

  /**
   * Chat completion (OpenAI兼容格式)
   * @param {object} params
   * @param {string} params.model
   * @param {Array} params.messages - [{role, content}]
   * @param {number} [params.maxTokens]
   * @param {number} [params.temperature]
   * @returns {Promise<{content: string, usage: object}>}
   */
  async chat({ model, messages, maxTokens = 4000, temperature = 0.7 }) {
    if (!this.apiKey) {
      throw new Error('[qwen-client] GH_LLM_API_KEY 未配置');
    }

    const body = JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    });

    let lastErr;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        this._callCount++;
        const resp = await this._post('/chat/completions', body);
        const data = JSON.parse(resp);

        if (data.error) {
          throw new Error(`API Error: ${data.error.message || JSON.stringify(data.error)}`);
        }

        const choice = data.choices && data.choices[0];
        if (!choice) {
          throw new Error('Empty response from LLM');
        }

        // 记录token用量
        if (data.usage) {
          this._totalInputTokens += data.usage.prompt_tokens || 0;
          this._totalOutputTokens += data.usage.completion_tokens || 0;
        }

        return {
          content: choice.message.content,
          usage: data.usage || {},
          model: data.model,
          finishReason: choice.finish_reason,
        };
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_RETRIES) {
          const delay = 1000 * Math.pow(2, attempt);
          this.logger.warn(
            `[qwen-client] 调用失败 · 重试 ${attempt + 1}/${MAX_RETRIES} · ${err.message} · 等待 ${delay}ms`
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastErr;
  }

  get stats() {
    return {
      callCount: this._callCount,
      totalInputTokens: this._totalInputTokens,
      totalOutputTokens: this._totalOutputTokens,
    };
  }

  // ─── HTTP请求 ───

  _post(endpoint, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + endpoint);
      const mod = url.protocol === 'https:' ? https : http;

      const req = mod.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: DEFAULT_TIMEOUT_MS,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
            } else {
              resolve(data);
            }
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(body);
      req.end();
    });
  }
}

module.exports = QwenClient;
