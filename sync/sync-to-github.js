// GitHub 同步模块 · sync-to-github.js
// 钉钉 → GitHub (SYSLOG归档 + 广播归档)
// HoloLake · M-DINGTALK Phase 3
//

const fs = require('fs');
const path = require('path');

// GitHub归档目录（本地，后续通过git push同步到远程）
const ARCHIVE_BASE = path.join(__dirname, '..', 'archive');
const SYSLOG_ARCHIVE = path.join(ARCHIVE_BASE, 'syslog');
const BROADCAST_ARCHIVE = path.join(ARCHIVE_BASE, 'broadcast');

// 确保归档目录存在
function ensureDirs() {
  [ARCHIVE_BASE, SYSLOG_ARCHIVE, BROADCAST_ARCHIVE].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * 归档SYSLOG到本地（准备git push）
 */
async function archiveSyslog(syslogData) {
  ensureDirs();

  const filename = `${syslogData.session_id || 'unknown'}_${Date.now()}.json`;
  const filePath = path.join(SYSLOG_ARCHIVE, filename);

  const archiveData = {
    ...syslogData,
    archived_at: new Date().toISOString(),
    archived_by: 'M-DINGTALK-Phase3-SyncEngine'
  };

  fs.writeFileSync(filePath, JSON.stringify(archiveData, null, 2), 'utf-8');
  console.log(`[GitHub Sync] SYSLOG已归档: ${filename}`);

  return {
    status: 'success',
    file: filename,
    path: filePath
  };
}

/**
 * 归档广播到本地
 */
async function archiveBroadcast(broadcastData) {
  ensureDirs();

  const filename = `${broadcastData.bc_id || 'unknown'}_${Date.now()}.json`;
  const filePath = path.join(BROADCAST_ARCHIVE, filename);

  const archiveData = {
    ...broadcastData,
    archived_at: new Date().toISOString(),
    archived_by: 'M-DINGTALK-Phase3-SyncEngine'
  };

  fs.writeFileSync(filePath, JSON.stringify(archiveData, null, 2), 'utf-8');
  console.log(`[GitHub Sync] 广播已归档: ${filename}`);

  return {
    status: 'success',
    file: filename
  };
}

/**
 * 执行完整同步（准备所有数据供git push）
 */
async function sync() {
  ensureDirs();

  // 统计归档文件
  const syslogFiles = fs.existsSync(SYSLOG_ARCHIVE)
    ? fs.readdirSync(SYSLOG_ARCHIVE).filter(f => f.endsWith('.json'))
    : [];

  const broadcastFiles = fs.existsSync(BROADCAST_ARCHIVE)
    ? fs.readdirSync(BROADCAST_ARCHIVE).filter(f => f.endsWith('.json'))
    : [];

  console.log(`[GitHub Sync] SYSLOG归档: ${syslogFiles.length} 个文件`);
  console.log(`[GitHub Sync] 广播归档: ${broadcastFiles.length} 个文件`);

  return {
    status: 'success',
    syslogCount: syslogFiles.length,
    broadcastCount: broadcastFiles.length,
    message: '本地归档就绪，等待git push'
  };
}

module.exports = {
  archiveSyslog,
  archiveBroadcast,
  sync
};
