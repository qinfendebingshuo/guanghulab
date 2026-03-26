// grid-db/src/storage/wal.js
// Grid-DB · Write-Ahead Log
// 所有写操作先写 WAL，崩溃恢复保证
// PRJ-GDB-001 · Phase 0 · ZY-GDB-P0-002
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * WAL（Write-Ahead Log）
 *
 * 所有写操作先追加到 WAL 文件，确保崩溃后可从 WAL 恢复。
 *
 * 日志格式（每条记录）：
 *   [length:4][seqNo:4][op:1][keyLen:2][key:N][dataLen:4][data:M][checksum:4]
 *
 * 操作码：
 *   0x01 = PUT
 *   0x02 = DELETE
 *
 * 本体论锚定：WAL = 笔的草稿本。
 * 正式写到纸上之前，先在草稿本上记一笔。
 * 万一出了意外，草稿本里有记录，可以恢复。
 */

const OP_PUT = 0x01;
const OP_DELETE = 0x02;

class WAL {
  /**
   * @param {string} walPath  WAL 文件路径
   */
  constructor(walPath) {
    this._path = walPath;
    this._seqNo = 0;
    this._fd = null;
    this._init();
  }

  /**
   * 初始化 WAL 文件
   */
  _init() {
    const dir = path.dirname(this._path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this._path)) {
      // 从现有 WAL 文件中恢复最大序列号
      const entries = this._readAll();
      if (entries.length > 0) {
        this._seqNo = entries[entries.length - 1].seqNo;
      }
    }

    // 追加模式打开
    this._fd = fs.openSync(this._path, 'a');
  }

  /**
   * 追加一条 PUT 记录
   * @param {string} key    格点键
   * @param {Buffer} data   数据
   * @returns {number} 序列号
   */
  appendPut(key, data) {
    return this._append(OP_PUT, key, data);
  }

  /**
   * 追加一条 DELETE 记录
   * @param {string} key  格点键
   * @returns {number} 序列号
   */
  appendDelete(key) {
    return this._append(OP_DELETE, key, Buffer.alloc(0));
  }

  /**
   * 内部：追加记录
   * @param {number} op     操作码
   * @param {string} key    键
   * @param {Buffer} data   数据
   * @returns {number} 序列号
   */
  _append(op, key, data) {
    this._seqNo++;
    const keyBuf = Buffer.from(key, 'utf-8');
    const dataBuf = data instanceof Buffer ? data : Buffer.from(JSON.stringify(data));

    // 构建记录
    // [length:4][seqNo:4][op:1][keyLen:2][key:N][dataLen:4][data:M][checksum:4]
    const recordLen = 4 + 1 + 2 + keyBuf.length + 4 + dataBuf.length + 4;
    const buf = Buffer.alloc(4 + recordLen);
    let offset = 0;

    buf.writeUInt32BE(recordLen, offset); offset += 4;           // length
    buf.writeUInt32BE(this._seqNo, offset); offset += 4;         // seqNo
    buf.writeUInt8(op, offset); offset += 1;                      // op
    buf.writeUInt16BE(keyBuf.length, offset); offset += 2;        // keyLen
    keyBuf.copy(buf, offset); offset += keyBuf.length;            // key
    buf.writeUInt32BE(dataBuf.length, offset); offset += 4;       // dataLen
    dataBuf.copy(buf, offset); offset += dataBuf.length;          // data

    // 计算简单校验和（所有字节异或）
    let checksum = 0;
    for (let i = 0; i < offset; i++) {
      checksum = (checksum ^ buf[i]) & 0xFFFFFFFF;
    }
    buf.writeUInt32BE(checksum >>> 0, offset);

    fs.writeSync(this._fd, buf);
    fs.fsyncSync(this._fd);

    return this._seqNo;
  }

  /**
   * 读取所有 WAL 条目（用于崩溃恢复）
   * @returns {Array<{ seqNo: number, op: number, key: string, data: Buffer }>}
   */
  recover() {
    return this._readAll();
  }

  /**
   * 内部：读取 WAL 文件的所有记录
   * @returns {Array<{ seqNo: number, op: number, key: string, data: Buffer }>}
   */
  _readAll() {
    if (!fs.existsSync(this._path)) {
      return [];
    }

    const fileBuf = fs.readFileSync(this._path);
    const entries = [];
    let offset = 0;

    while (offset < fileBuf.length) {
      // 至少需要 4 字节读长度
      if (offset + 4 > fileBuf.length) break;

      const recordLen = fileBuf.readUInt32BE(offset);
      const totalLen = 4 + recordLen;

      // 完整性检查
      if (offset + totalLen > fileBuf.length) break;

      const recordStart = offset + 4;
      let rOffset = recordStart;

      const seqNo = fileBuf.readUInt32BE(rOffset); rOffset += 4;
      const op = fileBuf.readUInt8(rOffset); rOffset += 1;
      const keyLen = fileBuf.readUInt16BE(rOffset); rOffset += 2;
      const key = fileBuf.toString('utf-8', rOffset, rOffset + keyLen); rOffset += keyLen;
      const dataLen = fileBuf.readUInt32BE(rOffset); rOffset += 4;
      const data = fileBuf.subarray(rOffset, rOffset + dataLen); rOffset += dataLen;
      const storedChecksum = fileBuf.readUInt32BE(rOffset);

      // 校验
      let checksum = 0;
      for (let i = offset; i < rOffset; i++) {
        checksum = (checksum ^ fileBuf[i]) & 0xFFFFFFFF;
      }

      if ((checksum >>> 0) === storedChecksum) {
        entries.push({ seqNo, op, key, data: Buffer.from(data) });
      }
      // 校验失败的记录跳过（部分写入的残余）

      offset += totalLen;
    }

    return entries;
  }

  /**
   * 截断 WAL（在 checkpoint 后调用，清除已持久化的记录）
   */
  truncate() {
    this.close();
    fs.writeFileSync(this._path, Buffer.alloc(0));
    this._seqNo = 0;
    this._fd = fs.openSync(this._path, 'a');
  }

  /**
   * 获取当前序列号
   * @returns {number}
   */
  getSeqNo() {
    return this._seqNo;
  }

  /**
   * 关闭 WAL 文件
   */
  close() {
    if (this._fd !== null) {
      fs.closeSync(this._fd);
      this._fd = null;
    }
  }

  /**
   * 获取 WAL 状态
   * @returns {object}
   */
  getStatus() {
    let fileSize = 0;
    try {
      fileSize = fs.statSync(this._path).size;
    } catch {
      // 文件不存在
    }
    return {
      path: this._path,
      seqNo: this._seqNo,
      fileSize
    };
  }
}

WAL.OP_PUT = OP_PUT;
WAL.OP_DELETE = OP_DELETE;

module.exports = WAL;
