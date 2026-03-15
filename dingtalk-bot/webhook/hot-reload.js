// 规则热更新引擎·hot-reload.js
// HoloLake·M-DINGTALK Phase 3
// DEV-004 之之×秋秋
//

const fs = require('fs');
const path = require('path');
const kb = require('../knowledge-base/kb-manager');

// 当前加载的规则（内存缓存）
let currentRules = {};
let lastReloadTime = null;

// 规则文件目录
const RULES_DIR = path.join(__dirname, '..', 'config');

/**
 * 加载所有规则文件到内存
 */
function loadRules() {
  console.log('[HotReload] 开始加载规则...');

  const rulesFile = path.join(RULES_DIR, 'sync-config.json');

  if (fs.existsSync(rulesFile)) {
    try {
      const content = fs.readFileSync(rulesFile, 'utf-8');
      currentRules = JSON.parse(content);
      lastReloadTime = new Date().toISOString();
      console.log(`[HotReload] 规则加载成功 · ${Object.keys(currentRules).length} 个配置项`);
    } catch (err) {
      console.error('[HotReload] 规则加载失败:', err.message);
    }
  } else {
    console.log('[HotReload] 规则文件不存在，使用默认配置');
    currentRules = {
      version: '1.0',
      sync_interval: 30,
      timeout_hours: 72,
      notion_db_id: 'mock-db-id'
    };
  }

  return currentRules;
}

/**
 * 处理规则更新（由Webhook触发）
 * @param {Object} payload - GitHub webhook payload
 * @param {Object} log - 事件日志
 */
async function handleRulesUpdate(payload, log) {
  console.log('\n[HotReload] ====================');
  console.log('[HotReload] 收到规则更新通知');

  const changedFiles = log.changedFiles || [];

  // 检查是否有规则相关文件变更
  const rulesChanged = changedFiles.some(f => 
    f.includes('rules/') || 
    f.includes('config/') || 
    f.includes('broadcast-engine/')
  );

  const docsChanged = changedFiles.some(f => 
    f.includes('knowledge-base/') || 
    f.includes('docs/')
  );

  if (rulesChanged) {
    console.log('[HotReload] 检测到规则文件变更！执行热更新...');
    loadRules();
    console.log(`[HotReload] 规则热更新完成 · ${new Date().toLocaleString('zh-CN')}`);
  }

  if (docsChanged) {
    console.log('[HotReload] 检测到知识库文档变更！重新建立索引...');
    kb.reload();
    console.log(`[HotReload] 知识库索引更新完成 · ${new Date().toLocaleString('zh-CN')}`);
  }

  if (!rulesChanged && !docsChanged) {
    console.log('[HotReload] 变更文件与规则/知识库无关，跳过热更新');
  }
}

/**
 * 获取当前规则
 */
function getRules() {
  if (Object.keys(currentRules).length === 0) {
    loadRules();
  }
  return currentRules;
}

/**
 * 获取热更新状态
 */
function getStatus() {
  return {
    rulesLoaded: Object.keys(currentRules).length > 0,
    ruleKeys: Object.keys(currentRules),
    lastReloadTime,
    knowledgeBase: kb.getStats()
  };
}

module.exports = {
  loadRules,
  handleRulesUpdate,
  getRules,
  getStatus
};
