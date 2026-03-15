// 三节点数据同步引擎·sync-engine.js
// HoloLake·M-DINGTALK Phase 3
// DEV-004 之之×秋秋
//
// 三个节点：钉钉（本地）·GitHub·Notion
//

const fs = require('fs');
const path = require('path');
const syncToGitHub = require('./sync-to-github');
const syncToNotion = require('./sync-to-notion');

// 同步状态记录
const syncStatus = {
  lastSync: null,
  syncCount: 0,
  errors: [],
  history: []
};

/**
 * 执行全量同步（三节点）
 */
async function syncAll() {
  console.log('\n[Sync] ====================');
  console.log('[Sync] 开始三节点全量同步...');
  console.log(`[Sync] 时间: ${new Date().toLocaleString('zh-CN')}`);

  const result = {
    timestamp: new Date().toISOString(),
    github: { status: 'pending' },
    notion: { status: 'pending' }
  };

  // 第一步：同步到GitHub（SYSLOG归档 + 广播归档）
  try {
    result.github = await syncToGitHub.sync();
    console.log(`[Sync] GitHub同步: ${result.github.status}`);
  } catch (err) {
    result.github = { status: 'error', error: err.message };
    console.error('[Sync] GitHub同步失败:', err.message);
  }

  // 第二步：同步到Notion（主控台回写）
  try {
    result.notion = await syncToNotion.sync();
    console.log(`[Sync] Notion同步: ${result.notion.status}`);
  } catch (err) {
    result.notion = { status: 'error', error: err.message };
    console.error('[Sync] Notion同步失败:', err.message);
  }

  // 更新同步状态
  syncStatus.lastSync = result.timestamp;
  syncStatus.syncCount++;
  syncStatus.history.unshift(result);

  if (syncStatus.history.length > 50) {
    syncStatus.history = syncStatus.history.slice(0, 50);
  }

  // 记录错误
  if (result.github.status === 'error') {
    syncStatus.errors.push({
      time: result.timestamp,
      target: 'github',
      error: result.github.error
    });
  }

  if (result.notion.status === 'error') {
    syncStatus.errors.push({
      time: result.timestamp,
      target: 'notion',
      error: result.notion.error
    });
  }

  console.log('[Sync] 三节点同步完成 ✅');
  console.log(`[Sync] 累计同步次数：${syncStatus.syncCount}`);
  console.log('[Sync] ====================');

  return result;
}

/**
 * SYSLOG提交后触发同步
 */
async function syncAfterSyslog(syslogData) {
  console.log('[Sync] SYSLOG处理后同步...');

  const result = {
    timestamp: new Date().toISOString(),
    trigger: 'syslog',
    syslogId: syslogData.session_id
  };

  // 归档SYSLOG到GitHub
  try {
    result.github = await syncToGitHub.archiveSyslog(syslogData);
  } catch (err) {
    result.github = { status: 'error', error: err.message };
  }

  // 回写进度到Notion
  try {
    result.notion = await syncToNotion.updateProgress(syslogData);
  } catch (err) {
    result.notion = { status: 'error', error: err.message };
  }

  syncStatus.lastSync = result.timestamp;
  syncStatus.syncCount++;
  syncStatus.history.unshift(result);

  return result;
}

/**
 * 获取同步状态
 */
function getStatus() {
  return {
    ...syncStatus,
    recentErrors: syncStatus.errors.slice(-5)
  };
}

module.exports = {
  syncAll,
  syncAfterSyslog,
  getStatus
};
