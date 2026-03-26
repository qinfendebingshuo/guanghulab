// grid-db/src/api/grid-api.js
// Grid-DB · API 层
// 统一 CRUD / Query 接口
// PRJ-GDB-001 · Phase 0 · ZY-GDB-P0-005
// 版权：国作登字-2026-A-00037559

'use strict';

const GridCell = require('../core/grid-cell');
const WAL = require('../storage/wal');
const PageManager = require('../storage/page-manager');
const EventLog = require('../events/event-log');

/**
 * GridAPI — Grid-DB 统一接口
 *
 * 提供 put / get / delete / scan 等操作，
 * 内部协调 WAL、PageManager、EventLog 协同工作。
 *
 * 本体论锚定：API = 笔的握持接口。
 * 无论笔内部结构如何，写字的人只需要握住笔就能写字。
 */
class GridAPI {
  /**
   * @param {object} config
   * @param {string} config.dataDir  数据目录
   * @param {number} [config.pageSize]  页大小
   */
  constructor(config) {
    this._dataDir = config.dataDir;
    this._pageSize = config.pageSize || PageManager.DEFAULT_PAGE_SIZE;

    // 核心组件
    this._wal = new WAL(`${this._dataDir}/grid.wal`);
    this._pageManager = new PageManager(`${this._dataDir}/grid.gdb`, {
      pageSize: this._pageSize
    });
    this._eventLog = new EventLog();

    // 内存索引：key → pageId
    this._index = new Map();

    // 从 WAL 恢复
    this._recoverFromWAL();
  }

  /**
   * 写入格点数据
   * @param {string} namespace  命名空间
   * @param {GridCell|object} gridCell  格点（或 { gridX, gridY, layer }）
   * @param {*} data  数据
   * @returns {object} { key, seqNo, event }
   */
  put(namespace, gridCell, data) {
    const cell = this._resolveCell(namespace, gridCell);
    const key = cell.toKey();
    const dataBuf = Buffer.from(JSON.stringify(data));

    // 1. 先写 WAL
    const seqNo = this._wal.appendPut(key, dataBuf);

    // 2. 写入 PageManager
    let pageId = this._index.get(key);
    if (pageId !== undefined) {
      // 更新现有页
      this._pageManager.writePage(pageId, dataBuf);
    } else {
      // 分配新页
      pageId = this._pageManager.allocPage();
      this._pageManager.writePage(pageId, dataBuf);
      this._index.set(key, pageId);
    }

    // 3. 记录事件
    const event = this._eventLog.append(namespace, 'put', key, {
      dataSize: dataBuf.length
    });

    return { key, seqNo, event };
  }

  /**
   * 读取格点数据
   * @param {string} namespace  命名空间
   * @param {GridCell|object} gridCell  格点
   * @returns {*|null} 数据，不存在返回 null
   */
  get(namespace, gridCell) {
    const cell = this._resolveCell(namespace, gridCell);
    const key = cell.toKey();
    const pageId = this._index.get(key);

    if (pageId === undefined) {
      return null;
    }

    const dataBuf = this._pageManager.readPage(pageId);
    if (!dataBuf) {
      return null;
    }

    try {
      return JSON.parse(dataBuf.toString('utf-8'));
    } catch {
      return dataBuf;
    }
  }

  /**
   * 删除格点数据
   * @param {string} namespace  命名空间
   * @param {GridCell|object} gridCell  格点
   * @returns {boolean} 是否删除成功
   */
  delete(namespace, gridCell) {
    const cell = this._resolveCell(namespace, gridCell);
    const key = cell.toKey();
    const pageId = this._index.get(key);

    if (pageId === undefined) {
      return false;
    }

    // 1. 先写 WAL
    this._wal.appendDelete(key);

    // 2. 释放页
    this._pageManager.freePage(pageId);
    this._index.delete(key);

    // 3. 记录事件
    this._eventLog.append(namespace, 'delete', key);

    return true;
  }

  /**
   * 范围扫描（Phase 0 简版：基于内存索引）
   * @param {string} namespace
   * @param {object} range  { xRange: [min, max], yRange: [min, max], layer }
   * @returns {Array<{ cell: GridCell, data: * }>}
   */
  scan(namespace, range = {}) {
    const results = [];

    for (const [key, pageId] of this._index) {
      try {
        const cell = GridCell.fromKey(key);

        if (cell.namespace !== namespace) continue;
        if (range.layer && cell.layer !== range.layer) continue;

        if (range.xRange) {
          if (cell.gridX < range.xRange[0] || cell.gridX > range.xRange[1]) continue;
        }
        if (range.yRange) {
          if (cell.gridY < range.yRange[0] || cell.gridY > range.yRange[1]) continue;
        }

        const dataBuf = this._pageManager.readPage(pageId);
        if (dataBuf) {
          let data;
          try { data = JSON.parse(dataBuf.toString('utf-8')); } catch { data = dataBuf; }
          results.push({ cell, data });
        }
      } catch {
        // 跳过无效键
      }
    }

    this._eventLog.append(namespace, 'scan', `scan:${namespace}`, {
      resultCount: results.length
    });

    return results;
  }

  /**
   * 获取命名空间统计
   * @param {string} [namespace]  不传则统计全部
   * @returns {object}
   */
  stats(namespace) {
    let count = 0;
    for (const key of this._index.keys()) {
      if (!namespace || key.startsWith(namespace + ':')) {
        count++;
      }
    }

    return {
      namespace: namespace || '*',
      cellCount: count,
      wal: this._wal.getStatus(),
      pageManager: this._pageManager.getStatus(),
      eventLog: this._eventLog.getStatus()
    };
  }

  /**
   * 订阅事件流
   * @param {string} subscriberId
   * @param {Function} handler
   * @returns {Function} 取消订阅函数
   */
  subscribe(subscriberId, handler) {
    return this._eventLog.subscribe(subscriberId, handler);
  }

  /**
   * 执行 checkpoint：截断 WAL
   */
  checkpoint() {
    this._wal.truncate();
  }

  /**
   * 关闭数据库
   */
  close() {
    this._wal.close();
    this._pageManager.close();
  }

  // ── 内部方法 ──

  /**
   * 解析格点参数
   * @param {string} namespace
   * @param {GridCell|object} input
   * @returns {GridCell}
   */
  _resolveCell(namespace, input) {
    if (input instanceof GridCell) {
      return input;
    }
    return new GridCell(
      namespace,
      input.gridX ?? input.grid_x ?? 0,
      input.gridY ?? input.grid_y ?? 0,
      input.layer || 'raw'
    );
  }

  /**
   * 从 WAL 恢复数据到内存索引
   */
  _recoverFromWAL() {
    const entries = this._wal.recover();

    for (const entry of entries) {
      if (entry.op === WAL.OP_PUT) {
        // 检查是否已有页
        let pageId = this._index.get(entry.key);
        if (pageId !== undefined) {
          // 页已存在，更新
          try {
            this._pageManager.writePage(pageId, entry.data);
          } catch {
            // 页可能已损坏，分配新页
            pageId = this._pageManager.allocPage();
            this._pageManager.writePage(pageId, entry.data);
            this._index.set(entry.key, pageId);
          }
        } else {
          // 分配新页并写入
          pageId = this._pageManager.allocPage();
          this._pageManager.writePage(pageId, entry.data);
          this._index.set(entry.key, pageId);
        }
      } else if (entry.op === WAL.OP_DELETE) {
        const pageId = this._index.get(entry.key);
        if (pageId !== undefined) {
          this._pageManager.freePage(pageId);
          this._index.delete(entry.key);
        }
      }
    }
  }
}

module.exports = GridAPI;
