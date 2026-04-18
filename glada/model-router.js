/**
 * GLADA · 模型自动路由器 · model-router.js
 *
 * 核心职责：
 *   1. 启动时自动发现第三方代理上的所有可用模型
 *   2. 按能力分级：推理型 / 代码型 / 通用型 / 经济型
 *   3. 任务步骤自动匹配最佳模型
 *   4. 模型不可用时自动降级
 *   5. 定期刷新模型列表（默认10分钟）
 *
 * 设计原则：
 *   - 绝不硬编码模型名称——代理是第三方的，模型池随时变化
 *   - 系统自动检测，需要哪个用哪个
 *   - API 格式统一走 OpenAI-compatible，不写死
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：铸渊 · ICE-GL-ZY001
 */

'use strict';

const https = require('https');
const http = require('http');

// ── 模型能力分类规则 ────────────────────────────
// 根据模型 ID 中的关键词自动分类
// 顺序即优先级（同类中靠前的优先选用）
const CAPABILITY_PATTERNS = {
  // 推理型：复杂分析、架构设计、多步推理
  reasoning: [
    { pattern: /o1/i, priority: 10 },
    { pattern: /o3/i, priority: 9 },
    { pattern: /o4/i, priority: 9 },
    { pattern: /reasoner/i, priority: 8 },
    { pattern: /thinking/i, priority: 7 },
    { pattern: /claude.*opus/i, priority: 6 },
    { pattern: /claude.*sonnet/i, priority: 5 },
    { pattern: /gpt-?4o/i, priority: 5 },
    { pattern: /gpt-?4\.?5/i, priority: 5 },
    { pattern: /gpt-?5/i, priority: 6 },
    { pattern: /deepseek.*r1/i, priority: 7 },
    { pattern: /deepseek.*reason/i, priority: 7 },
    { pattern: /qwq/i, priority: 6 },
  ],
  // 代码型：代码生成、修改、调试
  coding: [
    { pattern: /codex/i, priority: 10 },
    { pattern: /code.*llama/i, priority: 7 },
    { pattern: /coder/i, priority: 8 },
    { pattern: /deepseek.*coder/i, priority: 9 },
    { pattern: /starcoder/i, priority: 7 },
    { pattern: /codestral/i, priority: 8 },
    { pattern: /claude.*sonnet/i, priority: 6 },
    { pattern: /gpt-?4o/i, priority: 6 },
    { pattern: /gpt-?4\.?5/i, priority: 6 },
    { pattern: /gpt-?5/i, priority: 7 },
    { pattern: /deepseek.*chat/i, priority: 5 },
    { pattern: /deepseek.*v3/i, priority: 5 },
  ],
  // 通用型：一般任务
  general: [
    { pattern: /gpt-?4o/i, priority: 8 },
    { pattern: /gpt-?4\.?5/i, priority: 8 },
    { pattern: /gpt-?5/i, priority: 9 },
    { pattern: /claude.*sonnet/i, priority: 8 },
    { pattern: /claude.*haiku/i, priority: 6 },
    { pattern: /deepseek.*chat/i, priority: 7 },
    { pattern: /deepseek.*v3/i, priority: 7 },
    { pattern: /qwen/i, priority: 6 },
    { pattern: /gemini.*pro/i, priority: 7 },
    { pattern: /gemini.*flash/i, priority: 5 },
    { pattern: /llama/i, priority: 4 },
    { pattern: /mistral/i, priority: 5 },
    { pattern: /glm/i, priority: 4 },
    { pattern: /moonshot/i, priority: 5 },
  ],
  // 经济型：简单任务、日志分析、格式化
  economy: [
    { pattern: /mini/i, priority: 8 },
    { pattern: /flash/i, priority: 7 },
    { pattern: /lite/i, priority: 7 },
    { pattern: /turbo/i, priority: 6 },
    { pattern: /haiku/i, priority: 6 },
    { pattern: /glm.*flash/i, priority: 5 },
    { pattern: /qwen.*turbo/i, priority: 5 },
    { pattern: /deepseek.*chat/i, priority: 4 },
  ],
};

// ── 任务步骤 → 模型能力映射 ──────────────────────
const TASK_TYPE_PATTERNS = [
  // 推理型任务
  { type: 'reasoning', patterns: [/架构/i, /设计/i, /分析/i, /推理/i, /复杂/i, /安全/i, /审核/i, /重构/i, /architecture/i, /design/i, /analyz/i, /reason/i, /complex/i, /security/i, /refactor/i] },
  // 代码型任务
  { type: 'coding', patterns: [/代码/i, /编写/i, /实现/i, /创建.*文件/i, /修改.*文件/i, /新增.*路由/i, /接口/i, /函数/i, /模块/i, /组件/i, /code/i, /implement/i, /create.*file/i, /modify/i, /route/i, /function/i, /module/i, /component/i, /bug.*fix/i, /修复/i] },
  // 经济型任务
  { type: 'economy', patterns: [/格式化/i, /注释/i, /日志/i, /README/i, /文档/i, /配置/i, /format/i, /comment/i, /log/i, /doc/i, /config/i, /rename/i, /重命名/i] },
];

// ── 模型路由器状态 ─────────────────────────────
let cachedModels = null;          // { models: [...], classified: {...}, discoveredAt: Date }
let refreshTimer = null;
let discoveryInProgress = false;

/**
 * HTTP GET 请求
 */
function httpGet(url, headers, timeout) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return reject(new Error(`无效的 URL: ${url}`));
    }
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: headers || {},
      timeout: timeout || 15000,
    };

    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * 尝试从指定 URL 获取模型列表
 * @param {string} url - 完整的模型列表 API URL
 * @param {string} apiKey - API 密钥
 * @returns {Promise<string[]|null>} 模型 ID 列表，或 null 表示该端点不可用
 */
async function tryFetchModels(url, apiKey) {
  const response = await httpGet(url, {
    'Authorization': `Bearer ${apiKey}`,
    'Accept': 'application/json'
  }, 15000);

  if (response.status !== 200) {
    console.log(`[GLADA-Router] ℹ️ ${url} 返回 HTTP ${response.status}，跳过`);
    return null;
  }

  const body = String(response.body || '').trim();

  // 前置检测：如果响应是 HTML 而非 JSON，直接跳过（不报错）
  // 某些 API 代理商不支持 /models 端点，会返回 HTML 页面
  if (body.startsWith('<') || body.startsWith('<!')) {
    console.log(`[GLADA-Router] ℹ️ ${url} 返回了 HTML 页面（该代理商可能不支持模型列表端点），跳过`);
    return null;
  }

  // 空响应
  if (!body || body === '{}' || body === '[]') {
    console.log(`[GLADA-Router] ℹ️ ${url} 返回空响应，跳过`);
    return null;
  }

  let result;
  try {
    result = JSON.parse(body);
  } catch (parseErr) {
    console.log(`[GLADA-Router] ℹ️ ${url} 响应非 JSON 格式: ${parseErr.message}，跳过`);
    return null;
  }

  // OpenAI-compatible: { data: [{ id: "model-name", ... }] }
  // 也兼容直接返回数组的格式
  let models;
  if (Array.isArray(result.data)) {
    models = result.data.map(m => m.id || m.name || m).filter(Boolean);
  } else if (Array.isArray(result)) {
    models = result.map(m => (typeof m === 'string') ? m : (m.id || m.name)).filter(Boolean);
  } else if (result.models && Array.isArray(result.models)) {
    models = result.models.map(m => (typeof m === 'string') ? m : (m.id || m.name)).filter(Boolean);
  } else {
    console.log('[GLADA-Router] ℹ️ 响应 JSON 格式无法识别为模型列表，跳过');
    return null;
  }

  return models;
}

/**
 * 从代理 API 发现可用模型
 * 依次尝试多种端点路径（兼容不同 API 代理商）：
 *   1. ${baseUrl}/models          （标准 OpenAI-compatible）
 *   2. ${baseUrl}/v1/models       （某些代理商需要 /v1 前缀）
 *
 * 如果所有端点均不可用（常见于 DeepSeek 等仅提供 chat 端点的代理商），
 * 系统会静默降级使用环境变量中配置的默认模型，不影响正常对话功能。
 *
 * @returns {Promise<string[]>} 可用模型 ID 列表
 */
async function discoverModels() {
  const apiKey = process.env.ZY_LLM_API_KEY || process.env.LLM_API_KEY || '';
  const baseUrl = (process.env.ZY_LLM_BASE_URL || process.env.LLM_BASE_URL || '').replace(/\/+$/, '');

  if (!apiKey || !baseUrl) {
    console.warn('[GLADA-Router] ⚠️ LLM API 未配置，无法发现模型');
    return [];
  }

  // 构建候选端点列表（按优先级排序）
  const candidateUrls = [`${baseUrl}/models`];
  // 如果 baseUrl 不含 /v1，额外尝试 /v1/models
  if (!baseUrl.endsWith('/v1') && !baseUrl.endsWith('/v1/')) {
    candidateUrls.push(`${baseUrl}/v1/models`);
  }

  for (const url of candidateUrls) {
    try {
      const models = await tryFetchModels(url, apiKey);
      if (models && models.length > 0) {
        console.log(`[GLADA-Router] 🔍 发现 ${models.length} 个可用模型: ${models.slice(0, 10).join(', ')}${models.length > 10 ? '...' : ''}`);
        return models;
      }
    } catch (err) {
      // JSON 解析失败或网络错误，尝试下一个端点
      console.log(`[GLADA-Router] ℹ️ ${url} 请求异常: ${err.message}，尝试下一个端点`);
    }
  }

  // 所有端点均不可用——这是正常情况（很多代理商不提供 /models 端点）
  // 不使用 ⚠️ 警告，因为这不影响核心对话功能
  const fallbackModel = process.env.GLADA_MODEL || 'deepseek-chat';
  console.log(`[GLADA-Router] ℹ️ 模型列表端点不可用（代理商可能不支持），将使用默认模型: ${fallbackModel}`);
  console.log(`[GLADA-Router] ℹ️ 这不影响对话功能——chat/completions 端点正常即可工作`);
  return [];
}

/**
 * 对模型列表按能力分类
 *
 * @param {string[]} modelIds - 模型 ID 列表
 * @returns {Object} 分类结果 { reasoning: [...], coding: [...], general: [...], economy: [...] }
 */
function classifyModels(modelIds) {
  const classified = {
    reasoning: [],
    coding: [],
    general: [],
    economy: [],
  };

  for (const category of Object.keys(CAPABILITY_PATTERNS)) {
    const patterns = CAPABILITY_PATTERNS[category];
    const matches = [];

    for (const modelId of modelIds) {
      for (const { pattern, priority } of patterns) {
        if (pattern.test(modelId)) {
          matches.push({ id: modelId, priority });
          break; // 同一模型在同一类别中只匹配一次
        }
      }
    }

    // 按优先级降序排列
    matches.sort((a, b) => b.priority - a.priority);
    classified[category] = matches.map(m => m.id);
  }

  return classified;
}

/**
 * 刷新模型缓存
 * @returns {Promise<Object>} 缓存对象
 */
async function refreshModelCache() {
  if (discoveryInProgress) {
    // 等待上一次发现完成
    return cachedModels;
  }

  discoveryInProgress = true;
  try {
    const models = await discoverModels();

    if (models.length > 0) {
      const classified = classifyModels(models);
      cachedModels = {
        models,
        classified,
        discoveredAt: new Date().toISOString(),
        count: models.length
      };

      console.log(`[GLADA-Router] 📊 模型分类完成:`);
      console.log(`  推理型: ${classified.reasoning.slice(0, 3).join(', ') || '无'}`);
      console.log(`  代码型: ${classified.coding.slice(0, 3).join(', ') || '无'}`);
      console.log(`  通用型: ${classified.general.slice(0, 3).join(', ') || '无'}`);
      console.log(`  经济型: ${classified.economy.slice(0, 3).join(', ') || '无'}`);
    } else if (!cachedModels) {
      // 模型列表不可用（代理商不支持 /models 端点），用环境变量中配置的模型
      // 注意：GLADA_MODEL 是用户在部署时显式配置的默认模型，不是硬编码
      const fallbackModel = process.env.GLADA_MODEL || process.env.LLM_MODEL || 'deepseek-chat';
      cachedModels = {
        models: [fallbackModel],
        classified: {
          reasoning: [fallbackModel],
          coding: [fallbackModel],
          general: [fallbackModel],
          economy: [fallbackModel],
        },
        discoveredAt: new Date().toISOString(),
        count: 1,
        fallback: true
      };
      console.log(`[GLADA-Router] ✅ 使用配置的默认模型: ${fallbackModel}（模型列表端点不可用，不影响对话功能）`);
    }

    return cachedModels;
  } finally {
    discoveryInProgress = false;
  }
}

/**
 * 初始化模型路由器（启动时调用一次）
 *
 * @param {Object} [options]
 * @param {number} [options.refreshIntervalMs=600000] - 刷新间隔（毫秒），默认10分钟
 * @returns {Promise<Object>} 初始缓存
 */
async function initialize(options = {}) {
  const refreshMs = options.refreshIntervalMs || 600000; // 10 分钟

  console.log(`[GLADA-Router] 🚀 模型路由器初始化...`);
  const cache = await refreshModelCache();

  // 定期刷新
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  refreshTimer = setInterval(() => {
    refreshModelCache().catch(err => {
      console.warn(`[GLADA-Router] ⚠️ 定期刷新失败: ${err.message}`);
    });
  }, refreshMs);
  refreshTimer.unref(); // Don't block process exit — allow PM2 graceful shutdown

  return cache;
}

/**
 * 根据步骤描述判断任务类型
 *
 * @param {string} stepDescription - 步骤描述
 * @returns {string} 'reasoning' | 'coding' | 'general' | 'economy'
 */
function detectTaskType(stepDescription) {
  if (!stepDescription) return 'general';

  for (const { type, patterns } of TASK_TYPE_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(stepDescription)) {
        return type;
      }
    }
  }

  // 默认为 coding（GLADA 主要做代码开发）
  return 'coding';
}

/**
 * 为指定步骤选择最佳模型
 *
 * 选择逻辑：
 *   1. 如果 options.model 指定了具体模型 → 直接使用
 *   2. 如果 GLADA_MODEL_PREFERENCE 指定了偏好 → 在可用时优先使用
 *   3. 自动检测步骤类型 → 从对应能力池中选最优
 *   4. 如果对应池为空 → 降级到通用池 → 再降级到任意可用模型
 *
 * @param {string} stepDescription - 步骤描述
 * @param {Object} [options] - 选项
 * @param {string} [options.model] - 强制使用的模型
 * @param {string} [options.taskType] - 强制指定任务类型
 * @returns {Promise<{model: string, taskType: string, source: string}>}
 */
async function selectModel(stepDescription, options = {}) {
  // 确保缓存已加载
  if (!cachedModels) {
    await refreshModelCache();
  }

  // 1. 显式指定模型
  if (options.model) {
    return {
      model: options.model,
      taskType: 'explicit',
      source: 'options.model'
    };
  }

  // 2. 环境变量偏好
  const modelPreference = process.env.GLADA_MODEL_PREFERENCE || '';

  // 3. 自动检测任务类型
  const taskType = options.taskType || detectTaskType(stepDescription);

  // 4. 从能力池中选择
  const classified = cachedModels?.classified || {};
  const pool = classified[taskType] || [];

  // 如果有偏好模型且在能力池中
  if (modelPreference && pool.includes(modelPreference)) {
    return {
      model: modelPreference,
      taskType,
      source: `preference(${taskType})`
    };
  }

  // 如果有偏好模型且在可用模型列表中（不在对应池中但可用）
  if (modelPreference && cachedModels?.models?.includes(modelPreference)) {
    return {
      model: modelPreference,
      taskType,
      source: `preference(available)`
    };
  }

  // 从能力池中取第一个（最高优先级）
  if (pool.length > 0) {
    return {
      model: pool[0],
      taskType,
      source: `auto(${taskType})`
    };
  }

  // 降级：从通用池取
  if (classified.general?.length > 0 && taskType !== 'general') {
    return {
      model: classified.general[0],
      taskType,
      source: `fallback(general)`
    };
  }

  // 降级：取任意可用模型
  if (cachedModels?.models?.length > 0) {
    return {
      model: cachedModels.models[0],
      taskType,
      source: `fallback(any)`
    };
  }

  // 终极降级：用环境变量默认值（用户在部署时显式配置）
  const defaultModel = process.env.GLADA_MODEL || process.env.LLM_MODEL || 'deepseek-chat';
  return {
    model: defaultModel,
    taskType,
    source: 'env_default'
  };
}

/**
 * 获取当前模型缓存状态（供 API 端点和诊断使用）
 *
 * @returns {Object} 缓存状态
 */
function getStatus() {
  if (!cachedModels) {
    return {
      initialized: false,
      models: [],
      classified: {},
      message: '模型路由器未初始化'
    };
  }

  return {
    initialized: true,
    discoveredAt: cachedModels.discoveredAt,
    totalModels: cachedModels.count,
    models: cachedModels.models,
    classified: {
      reasoning: cachedModels.classified.reasoning || [],
      coding: cachedModels.classified.coding || [],
      general: cachedModels.classified.general || [],
      economy: cachedModels.classified.economy || [],
    },
    fallback: !!cachedModels.fallback,
    preference: process.env.GLADA_MODEL_PREFERENCE || null,
    defaultModel: process.env.GLADA_MODEL || 'deepseek-chat'
  };
}

/**
 * 关闭路由器（清除定时器）
 */
function shutdown() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  console.log('[GLADA-Router] 🔌 模型路由器已关闭');
}

module.exports = {
  initialize,
  selectModel,
  detectTaskType,
  classifyModels,
  discoverModels,
  refreshModelCache,
  getStatus,
  shutdown
};
