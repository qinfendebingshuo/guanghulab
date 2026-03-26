// grid-db/src/index/btree.js
// Grid-DB · B+Tree 主键索引
// 有序键值索引，支持范围扫描
// PRJ-GDB-001 · Phase 1 · ZY-GDB-P1-001
// 版权：国作登字-2026-A-00037559

'use strict';

/**
 * B+Tree — 主键索引
 *
 * 本体论锚定：索引 = 纸的目录。
 * 目录按页码排列，可以快速定位到任意一页。
 * 叶子节点串联 = 目录页之间的连续翻阅。
 *
 * 所有数据存储在叶子节点，内部节点仅存储路由键。
 * 叶子节点之间通过 next 指针串联，支持高效范围扫描。
 */

class BTreeNode {
  /**
   * @param {boolean} isLeaf 是否为叶子节点
   */
  constructor(isLeaf = false) {
    this.isLeaf = isLeaf;
    this.keys = [];
    this.children = []; // 内部节点：子节点引用；叶子节点：对应值
    this.next = null;   // 叶子节点链表指针
  }
}

class BTree {
  /**
   * @param {number} [order] B+Tree 的阶数（每个节点最大子节点数），默认 32
   */
  constructor(order = 32) {
    if (typeof order !== 'number' || order < 3) {
      throw new Error('BTree: order 必须是 >= 3 的整数');
    }
    this._order = order;
    this._maxKeys = order - 1;
    this._minKeys = Math.ceil(order / 2) - 1;
    this._root = new BTreeNode(true);
    this._size = 0;
  }

  /**
   * 当前索引中的条目数量
   * @returns {number}
   */
  get size() {
    return this._size;
  }

  /**
   * 插入键值对
   * @param {string} key   键
   * @param {*}      value 值
   */
  insert(key, value) {
    if (typeof key !== 'string') {
      throw new Error('BTree.insert: key 必须是字符串');
    }

    // 检查是否已存在（更新）
    const leaf = this._findLeaf(this._root, key);
    const idx = leaf.keys.indexOf(key);
    if (idx !== -1) {
      leaf.children[idx] = value;
      return;
    }

    // 根节点已满，先分裂
    if (this._root.keys.length >= this._maxKeys) {
      const newRoot = new BTreeNode(false);
      newRoot.children.push(this._root);
      this._splitChild(newRoot, 0);
      this._root = newRoot;
    }

    this._insertNonFull(this._root, key, value);
    this._size++;
  }

  /**
   * 查找键对应的值
   * @param {string} key
   * @returns {*|undefined} 找到返回值，否则 undefined
   */
  find(key) {
    const leaf = this._findLeaf(this._root, key);
    const idx = leaf.keys.indexOf(key);
    if (idx !== -1) {
      return leaf.children[idx];
    }
    return undefined;
  }

  /**
   * 删除键
   * @param {string} key
   * @returns {boolean} 是否删除成功
   */
  delete(key) {
    const leaf = this._findLeaf(this._root, key);
    const idx = leaf.keys.indexOf(key);
    if (idx === -1) {
      return false;
    }

    leaf.keys.splice(idx, 1);
    leaf.children.splice(idx, 1);
    this._size--;
    return true;
  }

  /**
   * 范围查询（闭区间 [startKey, endKey]）
   *
   * 利用叶子节点链表高效遍历
   *
   * @param {string} startKey 起始键
   * @param {string} endKey   结束键
   * @returns {Array<{key: string, value: *}>} 有序结果
   */
  range(startKey, endKey) {
    const results = [];
    let leaf = this._findLeaf(this._root, startKey);

    while (leaf) {
      for (let i = 0; i < leaf.keys.length; i++) {
        if (leaf.keys[i] >= startKey && leaf.keys[i] <= endKey) {
          results.push({ key: leaf.keys[i], value: leaf.children[i] });
        }
        if (leaf.keys[i] > endKey) {
          return results;
        }
      }
      leaf = leaf.next;
    }

    return results;
  }

  /**
   * 序列化为 JSON
   * @returns {object}
   */
  toJSON() {
    const entries = [];
    let leaf = this._getFirstLeaf();
    while (leaf) {
      for (let i = 0; i < leaf.keys.length; i++) {
        entries.push({ key: leaf.keys[i], value: leaf.children[i] });
      }
      leaf = leaf.next;
    }
    return { order: this._order, entries };
  }

  /**
   * 从 JSON 还原 B+Tree
   * @param {object} json
   * @returns {BTree}
   */
  static fromJSON(json) {
    const tree = new BTree(json.order || 32);
    for (const entry of json.entries) {
      tree.insert(entry.key, entry.value);
    }
    return tree;
  }

  /**
   * 清空索引
   */
  clear() {
    this._root = new BTreeNode(true);
    this._size = 0;
  }

  // ── 内部方法 ──

  /**
   * 找到 key 应当所在的叶子节点
   * @param {BTreeNode} node
   * @param {string} key
   * @returns {BTreeNode}
   */
  _findLeaf(node, key) {
    if (node.isLeaf) {
      return node;
    }

    // 在内部节点中找到正确的子节点
    let i = 0;
    while (i < node.keys.length && key >= node.keys[i]) {
      i++;
    }
    return this._findLeaf(node.children[i], key);
  }

  /**
   * 获取最左叶子节点
   * @returns {BTreeNode}
   */
  _getFirstLeaf() {
    let node = this._root;
    while (!node.isLeaf) {
      node = node.children[0];
    }
    return node;
  }

  /**
   * 向非满节点插入
   * @param {BTreeNode} node
   * @param {string} key
   * @param {*} value
   */
  _insertNonFull(node, key, value) {
    if (node.isLeaf) {
      // 在叶子节点中找到插入位置（保持有序）
      let i = 0;
      while (i < node.keys.length && node.keys[i] < key) {
        i++;
      }
      node.keys.splice(i, 0, key);
      node.children.splice(i, 0, value);
      return;
    }

    // 内部节点：找到正确的子节点
    let i = 0;
    while (i < node.keys.length && key >= node.keys[i]) {
      i++;
    }

    // 如果目标子节点已满，先分裂
    if (node.children[i].keys.length >= this._maxKeys) {
      this._splitChild(node, i);
      if (key >= node.keys[i]) {
        i++;
      }
    }

    this._insertNonFull(node.children[i], key, value);
  }

  /**
   * 分裂子节点
   * @param {BTreeNode} parent 父节点
   * @param {number} childIndex 要分裂的子节点索引
   */
  _splitChild(parent, childIndex) {
    const child = parent.children[childIndex];
    const mid = Math.floor(child.keys.length / 2);
    const newNode = new BTreeNode(child.isLeaf);

    if (child.isLeaf) {
      // 叶子节点分裂：splice 从 mid 处截断 child，返回值作为 newNode 内容
      newNode.keys = child.keys.splice(mid);
      newNode.children = child.children.splice(mid);

      // 维护叶子链表
      newNode.next = child.next;
      child.next = newNode;

      // 提升第一个新键到父节点
      parent.keys.splice(childIndex, 0, newNode.keys[0]);
      parent.children.splice(childIndex + 1, 0, newNode);
    } else {
      // 内部节点分裂：中间键提升，不保留在子节点
      const midKey = child.keys[mid];
      newNode.keys = child.keys.splice(mid + 1);
      newNode.children = child.children.splice(mid + 1);
      child.keys.splice(mid); // 移除中间键

      parent.keys.splice(childIndex, 0, midKey);
      parent.children.splice(childIndex + 1, 0, newNode);
    }
  }
}

module.exports = BTree;
