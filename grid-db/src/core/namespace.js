// grid-db/src/core/namespace.js
// Grid-DB · 命名空间管理器
// 命名空间隔离与元数据管理
// PRJ-GDB-001 · Phase 1 · ZY-GDB-P1-002
// 版权：国作登字-2026-A-00037559

'use strict';

/**
 * NamespaceManager — 命名空间管理器
 *
 * 本体论锚定：命名空间 = 纸的不同区域。
 * 同一张纸上，不同区域的格子互不干涉。
 * 每个区域有自己的名字、创建时间和格点统计。
 *
 * 命名空间名称规则：非空字符串，仅允许字母、数字、连字符、下划线。
 */

const NAMESPACE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

class NamespaceManager {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    /** @type {Map<string, object>} */
    this._namespaces = new Map();
  }

  /**
   * 创建命名空间
   * @param {string} name      命名空间名称
   * @param {object} [metadata] 元数据
   * @returns {object} 创建的命名空间信息
   */
  create(name, metadata = {}) {
    this._validateName(name);

    if (this._namespaces.has(name)) {
      throw new Error(`NamespaceManager: 命名空间 '${name}' 已存在`);
    }

    const ns = {
      name,
      metadata,
      createdAt: new Date().toISOString(),
      cellCount: 0
    };

    this._namespaces.set(name, ns);
    return { ...ns };
  }

  /**
   * 删除命名空间
   * @param {string} name
   * @returns {boolean} 是否删除成功
   */
  delete(name) {
    if (!this._namespaces.has(name)) {
      return false;
    }
    this._namespaces.delete(name);
    return true;
  }

  /**
   * 获取命名空间信息
   * @param {string} name
   * @returns {object|null}
   */
  get(name) {
    const ns = this._namespaces.get(name);
    if (!ns) return null;
    return { ...ns };
  }

  /**
   * 列出所有命名空间
   * @returns {object[]}
   */
  list() {
    return Array.from(this._namespaces.values()).map(ns => ({ ...ns }));
  }

  /**
   * 检查命名空间是否存在
   * @param {string} name
   * @returns {boolean}
   */
  exists(name) {
    return this._namespaces.has(name);
  }

  /**
   * 增加命名空间的格点计数
   * @param {string} name
   */
  incrementCellCount(name) {
    const ns = this._namespaces.get(name);
    if (!ns) {
      throw new Error(`NamespaceManager: 命名空间 '${name}' 不存在`);
    }
    ns.cellCount++;
  }

  /**
   * 减少命名空间的格点计数
   * @param {string} name
   */
  decrementCellCount(name) {
    const ns = this._namespaces.get(name);
    if (!ns) {
      throw new Error(`NamespaceManager: 命名空间 '${name}' 不存在`);
    }
    if (ns.cellCount > 0) {
      ns.cellCount--;
    }
  }

  // ── 内部方法 ──

  /**
   * 验证命名空间名称
   * @param {string} name
   */
  _validateName(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('NamespaceManager: 命名空间名称必须是非空字符串');
    }
    if (!NAMESPACE_NAME_PATTERN.test(name)) {
      throw new Error(`NamespaceManager: 命名空间名称只能包含字母、数字、连字符和下划线，收到: '${name}'`);
    }
  }
}

module.exports = NamespaceManager;
