// grid-db/src/index.js
// Grid-DB · 自研逻辑格点数据库 · 主入口
// PRJ-GDB-001 · Phase 0
// 版权：国作登字-2026-A-00037559

'use strict';

const path = require('path');
const fs = require('fs');

const GridCell = require('./core/grid-cell');
const WAL = require('./storage/wal');
const PageManager = require('./storage/page-manager');
const EventLog = require('./events/event-log');
const GridAPI = require('./api/grid-api');

/**
 * Grid-DB 初始化器
 *
 * 本体论锚定 [ONT-PATCH-006]：
 *   笔需要纸来承载笔迹。
 *   Grid-DB = 纸。纸上有格子（格点），每个格子是最小寻址单元。
 *   笔在格子里写字，格子记住了所有笔迹。
 *   纸不属于笔，纸属于写字的人。
 */

/**
 * 打开或创建一个 Grid-DB 实例
 *
 * @param {object} [config]
 * @param {string} [config.dataDir]   数据目录（默认 grid-db/data）
 * @param {number} [config.pageSize]  页大小（默认 4096）
 * @returns {GridAPI}
 */
function open(config = {}) {
  const dataDir = config.dataDir || path.resolve(__dirname, '../data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return new GridAPI({
    dataDir,
    pageSize: config.pageSize || PageManager.DEFAULT_PAGE_SIZE
  });
}

// ── CLI 入口 ──

if (require.main === module) {
  const cmd = process.argv[2];

  if (cmd === 'status') {
    const db = open();
    const status = db.stats();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(status, null, 2));
    db.close();
  } else {
    // eslint-disable-next-line no-console
    console.log([
      '🗄️ Grid-DB v0.1.0 · PRJ-GDB-001 · Phase 0',
      '',
      '本体论锚定：Grid-DB = 纸 · 格点 = 格子 · WAL = 草稿本',
      '',
      '用法:',
      '  node grid-db/src/index.js status   查看数据库状态',
      '',
      '组件:',
      '  GridAPI        统一 API 接口',
      '  GridCell       格点数据模型',
      '  WAL            Write-Ahead Log',
      '  PageManager    页管理器',
      '  EventLog       事件溯源日志',
    ].join('\n'));
  }
}

module.exports = {
  open,
  GridAPI,
  GridCell,
  WAL,
  PageManager,
  EventLog
};
