/**
 * connectors/model-router — 模型调用路由
 *
 * 职责：
 *   - 提供统一的模型调用入口
 *   - 支持多模型切换（通过 backend-integration/api-proxy.js）
 *   - 任务分发至合适的模型端点
 *
 * 调用方式：
 *   node connectors/model-router [status]
 */

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '../..');

/**
 * 模型配置注册表
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
 * 获取模型配置
 */
function getModel(modelName = 'default') {
  return MODEL_REGISTRY[modelName] || MODEL_REGISTRY['default'];
}

/**
 * 列出所有可用模型
 */
function listModels() {
  return Object.values(MODEL_REGISTRY);
}

/**
 * 检查模型路由状态
 */
function status() {
  console.log('🤖 模型路由状态:');
  console.log('═'.repeat(40));

  const models = listModels();
  for (const model of models) {
    console.log(`  📌 ${model.name}`);
    console.log(`     端点: ${model.endpoint}`);
    console.log(`     说明: ${model.description}`);
  }

  // 检查 api-proxy 配置
  const proxyPath = path.join(ROOT, 'backend-integration/api-proxy.js');
  const proxyExists = fs.existsSync(proxyPath);
  console.log(`\n  ${proxyExists ? '✅' : '❌'} api-proxy.js 存在`);

  // 检查 persona-studio 配置
  const psPath = path.join(ROOT, 'persona-studio/backend/server.js');
  const psExists = fs.existsSync(psPath);
  console.log(`  ${psExists ? '✅' : '❌'} persona-studio server.js 存在`);

  return { models, proxy: proxyExists, persona_studio: psExists };
}

// CLI 入口
if (require.main === module) {
  status();
}

module.exports = { getModel, listModels, status, MODEL_REGISTRY };
