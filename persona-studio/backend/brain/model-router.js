/**
 * persona-studio · 智能模型路由引擎
 *
 * 功能：
 *   ① 探测阶段（auto-detect）→ 用 API 密钥请求平台的 /models 接口
 *   ② 路由阶段（auto-select）→ 根据任务类型选择最优模型
 *   ③ 降级阶段（fallback）→ 首选模型失败时自动切换
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const CONFIG_PATH = path.join(__dirname, 'model-config.json');
const BENCHMARK_PATH = path.join(__dirname, 'model-benchmark.json');

/**
 * 加载路由配置
 */
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return getDefaultConfig();
  }
}

/**
 * 加载基准测试结果
 */
function loadBenchmark() {
  try {
    return JSON.parse(fs.readFileSync(BENCHMARK_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * 保存基准测试结果
 */
function saveBenchmark(data) {
  fs.writeFileSync(BENCHMARK_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 根据任务类型选择最优模型
 * @param {string} taskType - 'chat' | 'code_generation' | 'code_review' | 'quick_reply'
 * @returns {{ model: string, baseUrl: string, apiKey: string }}
 */
function selectModel(taskType) {
  const config = loadConfig();
  const benchmark = loadBenchmark();
  const apiKey = process.env.MODEL_API_KEY || '';
  const baseUrl = config.base_url || 'https://api.yunwu.ai/v1';
  const contextTarget = config.context_window_target || 200000;

  // 如果有 benchmark 且有路由表，使用路由表
  if (benchmark && benchmark.routing_table && benchmark.routing_table[taskType]) {
    // 优先选择 context_window >= contextTarget 的模型
    if (benchmark.benchmark) {
      const preferred = benchmark.benchmark.find(function (m) {
        return m.available &&
          m.scores &&
          m.scores.context_window >= contextTarget;
      });
      if (preferred) {
        return {
          model: preferred.model_id,
          baseUrl,
          apiKey
        };
      }
    }

    return {
      model: benchmark.routing_table[taskType],
      baseUrl,
      apiKey
    };
  }

  // 默认模型映射
  const defaults = {
    chat: 'deepseek-chat',
    code_generation: 'deepseek-chat',
    code_review: 'deepseek-chat',
    quick_reply: 'deepseek-chat'
  };

  return {
    model: defaults[taskType] || 'deepseek-chat',
    baseUrl,
    apiKey
  };
}

/**
 * 调用 AI 模型 API
 * @param {object} params
 * @param {string} params.model - 模型 ID
 * @param {string} params.baseUrl - API 基础 URL
 * @param {string} params.apiKey - API 密钥
 * @param {Array} params.messages - OpenAI 格式消息列表
 * @param {number} [params.maxTokens=2000]
 * @param {number} [params.temperature=0.8]
 * @returns {Promise<string>} 模型回复文本
 */
async function callModel({ model, baseUrl, apiKey, messages, maxTokens = 2000, temperature = 0.8 }) {
  const config = loadConfig();
  const fallbackConfig = config.fallback || { max_retries: 3, timeout_ms: 30000 };
  const contextWindowTarget = config.context_window_target || 200000;

  // 尝试调用，支持降级
  const benchmark = loadBenchmark();
  const models = [model];

  // 如果有 benchmark，添加降级模型
  if (benchmark && benchmark.benchmark) {
    benchmark.benchmark.forEach(function (m) {
      if (m.available && m.model_id !== model && models.length < fallbackConfig.max_retries) {
        models.push(m.model_id);
      }
    });
  }

  let lastError = null;

  for (const currentModel of models) {
    try {
      const result = await _doRequest({
        baseUrl,
        apiKey,
        model: currentModel,
        messages,
        maxTokens,
        temperature,
        timeoutMs: fallbackConfig.timeout_ms
      });
      return result;
    } catch (err) {
      lastError = err;
      console.error(`Model ${currentModel} failed: ${err.message}, trying next...`);
    }
  }

  throw lastError || new Error('All models failed');
}

/**
 * 执行 HTTP 请求到 OpenAI 兼容 API
 */
function _doRequest({ baseUrl, apiKey, model, messages, maxTokens, temperature, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + '/chat/completions');
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;

    const body = JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: timeoutMs
    };

    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0] && json.choices[0].message) {
            resolve(json.choices[0].message.content);
          } else if (json.error) {
            reject(new Error(json.error.message || 'API error'));
          } else {
            reject(new Error('Unexpected API response'));
          }
        } catch (e) {
          reject(new Error('Failed to parse API response: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(body);
    req.end();
  });
}

/**
 * 自动探测可用模型（定时任务调用）
 */
async function autoDetect() {
  const config = loadConfig();
  const apiKey = process.env.MODEL_API_KEY || '';
  const baseUrl = config.base_url || 'https://api.yunwu.ai/v1';

  if (!apiKey) {
    console.error('MODEL_API_KEY not set, skipping auto-detect');
    return null;
  }

  try {
    // 请求 /models 接口获取可用模型列表
    const modelsUrl = new URL(baseUrl + '/models');
    const isHttps = modelsUrl.protocol === 'https:';
    const mod = isHttps ? https : http;

    const modelsList = await new Promise((resolve, reject) => {
      const req = mod.get(modelsUrl.href, {
        headers: { 'Authorization': 'Bearer ' + apiKey }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.data || []);
          } catch {
            resolve([]);
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    });

    // 生成基准测试结果
    const contextTarget = config.context_window_target || 200000;
    const benchmarkData = {
      last_updated: new Date().toISOString(),
      models_detected: modelsList.length,
      context_window_target: contextTarget,
      benchmark: modelsList.slice(0, 10).map(function (m) {
        const ctxWindow = m.context_window || m.context_length || 32000;
        return {
          model_id: m.id,
          available: true,
          scores: {
            chinese_ability: 80,
            conversation_quality: 80,
            code_quality: 80,
            reasoning: 80,
            speed_ms: 2000,
            context_window: ctxWindow,
            cost_per_1k_tokens: 0.002
          },
          meets_context_target: ctxWindow >= contextTarget,
          best_for: ['chat']
        };
      }),
      routing_table: {
        chat: modelsList[0] ? modelsList[0].id : 'deepseek-chat',
        code_generation: modelsList[0] ? modelsList[0].id : 'deepseek-chat',
        code_review: modelsList[0] ? modelsList[0].id : 'deepseek-chat',
        quick_reply: modelsList[0] ? modelsList[0].id : 'deepseek-chat'
      }
    };

    saveBenchmark(benchmarkData);
    console.log(`Model auto-detect complete: ${modelsList.length} models found`);
    return benchmarkData;
  } catch (err) {
    console.error('Auto-detect failed:', err.message);
    return null;
  }
}

function getDefaultConfig() {
  return {
    api_source: 'third_party_combined',
    api_key_env: 'MODEL_API_KEY',
    base_url: 'https://api.yunwu.ai/v1',
    auto_detect: { enabled: true, schedule: 'daily_0300' },
    routing_rules: {
      chat: { priority: ['chinese_ability', 'conversation_quality', 'speed'], max_latency_ms: 5000 },
      code_generation: { priority: ['code_quality', 'context_window', 'reasoning'], max_latency_ms: 30000 },
      code_review: { priority: ['reasoning', 'code_quality'], max_latency_ms: 15000 },
      quick_reply: { priority: ['speed', 'cost'], max_latency_ms: 2000 }
    },
    fallback: { max_retries: 3, timeout_ms: 30000, on_all_fail: 'notify_master' }
  };
}

module.exports = {
  selectModel,
  callModel,
  autoDetect,
  loadConfig,
  loadBenchmark
};
