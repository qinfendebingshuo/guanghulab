// grid-db/src/core/grid-cell.js
// Grid-DB · 格点数据模型
// 四元组寻址：(namespace, grid_x, grid_y, layer)
// PRJ-GDB-001 · Phase 0 · ZY-GDB-P0-004
// 版权：国作登字-2026-A-00037559

'use strict';

/**
 * GridCell — 逻辑格点
 *
 * 数据的最小寻址单元，由四元组定位：
 *   namespace — 隔离不同 Agent / 项目的数据域
 *   grid_x    — X 轴坐标
 *   grid_y    — Y 轴坐标
 *   layer     — 同一坐标下的数据层级 (raw → cleaned → indexed → semantic)
 *
 * 本体论锚定：格点 = 纸上的一个格子。
 * 笔在纸上写字，每个字都有坐标。格点是纸的最小单元。
 */

const VALID_LAYERS = ['raw', 'cleaned', 'indexed', 'semantic'];

class GridCell {
  /**
   * @param {string} namespace  命名空间
   * @param {number} gridX      X 坐标
   * @param {number} gridY      Y 坐标
   * @param {string} [layer]    数据层级，默认 'raw'
   */
  constructor(namespace, gridX, gridY, layer = 'raw') {
    if (!namespace || typeof namespace !== 'string') {
      throw new Error('GridCell: namespace 必须是非空字符串');
    }
    if (typeof gridX !== 'number' || !Number.isFinite(gridX)) {
      throw new Error('GridCell: grid_x 必须是有限数值');
    }
    if (typeof gridY !== 'number' || !Number.isFinite(gridY)) {
      throw new Error('GridCell: grid_y 必须是有限数值');
    }
    if (!VALID_LAYERS.includes(layer)) {
      throw new Error(`GridCell: layer 必须是 ${VALID_LAYERS.join('/')} 之一，收到: ${layer}`);
    }

    this.namespace = namespace;
    this.gridX = gridX;
    this.gridY = gridY;
    this.layer = layer;
  }

  /**
   * 生成格点唯一键（用于存储索引）
   * @returns {string}
   */
  toKey() {
    return `${this.namespace}:${this.gridX}:${this.gridY}:${this.layer}`;
  }

  /**
   * 从唯一键解析格点
   * @param {string} key
   * @returns {GridCell}
   */
  static fromKey(key) {
    const parts = key.split(':');
    if (parts.length !== 4) {
      throw new Error(`GridCell.fromKey: 无效键格式: ${key}`);
    }
    return new GridCell(parts[0], Number(parts[1]), Number(parts[2]), parts[3]);
  }

  /**
   * 序列化为 JSON 可存储对象
   * @returns {object}
   */
  serialize() {
    return {
      namespace: this.namespace,
      grid_x: this.gridX,
      grid_y: this.gridY,
      layer: this.layer,
      key: this.toKey()
    };
  }

  /**
   * 从序列化对象还原
   * @param {object} obj
   * @returns {GridCell}
   */
  static deserialize(obj) {
    return new GridCell(obj.namespace, obj.grid_x, obj.grid_y, obj.layer);
  }

  /**
   * 序列化为二进制 Buffer（用于页存储）
   * 格式：[nsLen:2][ns:N][x:8][y:8][layerIdx:1]
   * @returns {Buffer}
   */
  toBuffer() {
    const nsBytes = Buffer.from(this.namespace, 'utf-8');
    const layerIdx = VALID_LAYERS.indexOf(this.layer);
    // 2 (nsLen) + nsLen + 8 (x float64) + 8 (y float64) + 1 (layerIdx)
    const buf = Buffer.alloc(2 + nsBytes.length + 8 + 8 + 1);
    let offset = 0;

    buf.writeUInt16BE(nsBytes.length, offset); offset += 2;
    nsBytes.copy(buf, offset); offset += nsBytes.length;
    buf.writeDoubleBE(this.gridX, offset); offset += 8;
    buf.writeDoubleBE(this.gridY, offset); offset += 8;
    buf.writeUInt8(layerIdx, offset);

    return buf;
  }

  /**
   * 从二进制 Buffer 还原格点
   * @param {Buffer} buf
   * @param {number} [offset]
   * @returns {{ cell: GridCell, bytesRead: number }}
   */
  static fromBuffer(buf, offset = 0) {
    const start = offset;
    const nsLen = buf.readUInt16BE(offset); offset += 2;
    const namespace = buf.toString('utf-8', offset, offset + nsLen); offset += nsLen;
    const gridX = buf.readDoubleBE(offset); offset += 8;
    const gridY = buf.readDoubleBE(offset); offset += 8;
    const layerIdx = buf.readUInt8(offset); offset += 1;

    return {
      cell: new GridCell(namespace, gridX, gridY, VALID_LAYERS[layerIdx]),
      bytesRead: offset - start
    };
  }

  /**
   * 检查两个格点是否相等
   * @param {GridCell} other
   * @returns {boolean}
   */
  equals(other) {
    return this.namespace === other.namespace &&
      this.gridX === other.gridX &&
      this.gridY === other.gridY &&
      this.layer === other.layer;
  }

  /**
   * 计算到另一个格点的曼哈顿距离（同 namespace + layer）
   * @param {GridCell} other
   * @returns {number}
   */
  distanceTo(other) {
    return Math.abs(this.gridX - other.gridX) + Math.abs(this.gridY - other.gridY);
  }

  toString() {
    return `GridCell(${this.toKey()})`;
  }
}

GridCell.VALID_LAYERS = VALID_LAYERS;

module.exports = GridCell;
