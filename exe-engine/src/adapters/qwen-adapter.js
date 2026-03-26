// exe-engine/src/adapters/qwen-adapter.js
// EXE-Engine · Qwen (通义千问) 模型适配器
// 适配 Qwen-Max / Qwen-Coder（DashScope OpenAI 兼容模式）
// PRJ-EXE-001 · Phase 1 准备 · ZY-EXE-P1-001
// 版权：国作登字-2026-A-00037559

'use strict';

const https = require('https');
const http = require('http');
const BaseAdapter = require('./base-adapter');

/**
 * Qwen 模型适配器
 *
 * 本体论锚定：Qwen 是一瓶中文优化的墨水。
 * 中文生态优势突出，阿里云原生，适合文本处理任务。
 */
class QwenAdapter extends BaseAdapter {
  constructor(config) {
    super({
      ...config,
      provider: config.provider || 'dashscope'
    });
  }

  /**
   * 执行推理请求
   *
   * @param {object} request
   * @param {string} request.prompt       用户 prompt
   * @param {string} [request.systemPrompt] 系统 prompt
   * @param {string} [request.taskType]   任务类型
   * @param {number} [request.maxTokens]  最大输出 token
   * @param {number} [request.temperature] 温度
   * @returns {Promise<object>} EXE 标准响应
   */
  async execute(request) {
    if (this.isInCooldown()) {
      throw new Error(`[EXE] ${this.name} 处于冷却期，暂不可用`);
    }

    const startTime = Date.now();
    const messages = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    const body = JSON.stringify({
      model: this._resolveModel(request.taskType),
      messages,
      max_tokens: request.maxTokens || this.defaultMaxTokens,
      temperature: request.temperature ?? this.defaultTemperature,
      stream: false
    });

    try {
      const response = await this._httpPost(this.endpoint, body, {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      });

      const data = JSON.parse(response);

      if (!data.choices || !data.choices[0]) {
        throw new Error('Qwen API 返回格式异常: 缺少 choices');
      }

      const latency = Date.now() - startTime;
      const usage = data.usage || {};

      this.resetFailures();

      return {
        model: data.model || this.name,
        output: data.choices[0].message.content,
        usage: {
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
          cost: this._calculateCost(usage.prompt_tokens || 0, usage.completion_tokens || 0),
          unit: this.costPerToken.currency || 'CNY'
        },
        latency,
        status: 'success',
        finishReason: data.choices[0].finish_reason
      };
    } catch (err) {
      this.recordFailure(err.message);
      throw err;
    }
  }

  /**
   * 健康检查
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const body = JSON.stringify({
        model: 'qwen-turbo',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5
      });

      await this._httpPost(this.endpoint, body, {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      });

      this._healthy = true;
    } catch (err) {
      this._healthy = false;
      this._lastHealthError = err.message;
    }
    this._lastHealthCheck = new Date().toISOString();
    return this._healthy;
  }

  /**
   * 根据任务类型解析具体模型名
   * @param {string} taskType
   * @returns {string}
   */
  _resolveModel(taskType) {
    if (taskType === 'code_generation') return 'qwen-coder-plus-latest';
    return 'qwen-max';
  }

  /**
   * 计算调用成本（单位：元）
   * @param {number} inputTokens
   * @param {number} outputTokens
   * @returns {number}
   */
  _calculateCost(inputTokens, outputTokens) {
    const inputCost = (inputTokens / 1_000_000) * this.costPerToken.input;
    const outputCost = (outputTokens / 1_000_000) * this.costPerToken.output;
    return Math.round((inputCost + outputCost) * 10000) / 10000;
  }

  /**
   * HTTP POST 请求
   * @param {string} url
   * @param {string} body
   * @param {object} headers
   * @returns {Promise<string>}
   */
  _httpPost(url, body, headers) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const transport = parsed.protocol === 'https:' ? https : http;

      const req = transport.request({
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 120000
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`Qwen API 错误 (${res.statusCode}): ${data}`));
            return;
          }
          resolve(data);
        });
      });

      req.on('error', err => reject(new Error(`Qwen 网络错误: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Qwen API 请求超时'));
      });
      req.write(body);
      req.end();
    });
  }
}

module.exports = QwenAdapter;
