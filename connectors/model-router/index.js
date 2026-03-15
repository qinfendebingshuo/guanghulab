/**
 * connectors/model-router — 模型调用路由
 *
 * 职责：
 *   - 提供统一的模型调用入口
 *   - 支持多模型后端（Anthropic / OpenAI / 通义千问 / DeepSeek）
 *   - 支持本地代理模型（api-proxy.js / persona-studio）
 *   - 按优先级自动选择最佳可用模型
 *   - 不写死任何模型，密钥统一通过环境变量管理
 *
 * AGE OS v1.0 适配规则：
 *   系统自动检测可用模型列表，按优先级选择。
 *   支持多模型后端，密钥统一存放在仓库 Secrets 中。
 *
 * 调用方式：
 *   node connectors/model-router [status]
 */

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '../..');

/**
 * 本地代理模型注册表（向后兼容）
 */
const MODEL_REGISTRY = {
  'default': {
    name: 'default',
    endpoint: 'http://localhost:3721/api/chat',
    description: 'AI Chat API 代理（api-proxy.js）'
  },
  'persona': {
    name: 'persona',
    endpoint: 'http://localhost:3002/api/ps/chat',
    description: '人格工作室 API'
  }
};

/**
 * 云端模型后端定义（AGE OS v1.0 多模型支持）
 * 按优先级排序，不写死任何模型
 */
const CLOUD_BACKENDS = [
  {
    name: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com',
    format: 'anthropic',
    defaultModels: ['claude-sonnet-4', 'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet', 'claude-3-haiku'],
    description: 'Anthropic Claude 系列'
  },
  {
    name: 'openai',
    envKey: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    format: 'openai',
    defaultModels: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    description: 'OpenAI GPT 系列'
  },
  {
    name: 'dashscope',
    envKey: 'DASHSCOPE_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    format: 'openai',
    defaultModels: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    description: '通义千问系列'
  },
  {
    name: 'deepseek',
    envKey: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/v1',
    format: 'openai',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
    description: 'DeepSeek 系列'
  },
  {
    name: 'custom',
    envKey: 'LLM_API_KEY',
    baseUrlEnv: 'LLM_BASE_URL',
    format: 'openai',
    defaultModels: [],
    description: '自定义 LLM 平台（通过 LLM_BASE_URL 配置）'
  }
];

/**
 * 获取本地代理模型配置
 */
function getModel(modelName = 'default') {
  return MODEL_REGISTRY[modelName] || MODEL_REGISTRY['default'];
}

/**
 * 列出所有本地代理模型
 */
function listModels() {
  return Object.values(MODEL_REGISTRY);
}

/**
 * 检测可用的云端模型后端
 */
function detectCloudBackends() {
  const available = [];
  for (const backend of CLOUD_BACKENDS) {
    const apiKey = process.env[backend.envKey] || '';
    if (!apiKey) continue;

    const baseUrl = backend.baseUrlEnv
      ? (process.env[backend.baseUrlEnv] || '').replace(/\/+$/, '')
      : backend.baseUrl;
    if (!baseUrl) continue;

    available.push({ ...backend, baseUrl });
  }
  return available;
}

/**
 * 列出所有可用模型（本地 + 云端）
 */
function listAllModels() {
  const local = listModels();
  const cloud = detectCloudBackends();
  return { local, cloud };
}

/**
 * 检查模型路由状态
 */
function status() {
  console.log('🤖 模型路由状态 (AGE OS v1.0):');
  console.log('═'.repeat(40));

  // 本地代理模型
  console.log('\n📌 本地代理模型:');
  const models = listModels();
  for (const model of models) {
    console.log(`  📌 ${model.name}`);
    console.log(`     端点: ${model.endpoint}`);
    console.log(`     说明: ${model.description}`);
  }

  // 云端模型后端
  console.log('\n☁️  云端模型后端:');
  const cloud = detectCloudBackends();
  if (cloud.length === 0) {
    console.log('  ⚠️  未检测到可用的云端模型后端');
  } else {
    for (const backend of cloud) {
      console.log(`  ✅ ${backend.name} — ${backend.description}`);
      console.log(`     格式: ${backend.format}`);
      console.log(`     端点: ${backend.baseUrl}`);
      if (backend.defaultModels.length > 0) {
        console.log(`     默认模型: ${backend.defaultModels.join(', ')}`);
      }
    }
  }

  // 所有支持的后端（含未配置的）
  console.log('\n📋 支持的后端列表:');
  for (const backend of CLOUD_BACKENDS) {
    const configured = !!process.env[backend.envKey];
    console.log(`  ${configured ? '✅' : '⏭️ '} ${backend.name} (${backend.envKey}) — ${backend.description}`);
  }

  // 检查 api-proxy 配置
  const proxyPath = path.join(ROOT, 'backend-integration/api-proxy.js');
  const proxyExists = fs.existsSync(proxyPath);
  console.log(`\n  ${proxyExists ? '✅' : '❌'} api-proxy.js 存在`);

  // 检查 persona-studio 配置
  const psPath = path.join(ROOT, 'persona-studio/backend/server.js');
  const psExists = fs.existsSync(psPath);
  console.log(`  ${psExists ? '✅' : '❌'} persona-studio server.js 存在`);

  return { models, cloud, proxy: proxyExists, persona_studio: psExists };
}

// CLI 入口
if (require.main === module) {
  status();
}

module.exports = { getModel, listModels, listAllModels, detectCloudBackends, status, MODEL_REGISTRY, CLOUD_BACKENDS };
