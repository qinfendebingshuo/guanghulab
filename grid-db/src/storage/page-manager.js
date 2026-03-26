// grid-db/src/storage/page-manager.js
// Grid-DB · 页管理器
// 固定大小页分配、读写与释放
// PRJ-GDB-001 · Phase 0 · ZY-GDB-P0-003
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * PageManager — 页管理器
 *
 * 以固定大小的"页"为最小 I/O 单位管理磁盘数据。
 *
 * 文件结构：
 *   [Header: 1 page] [Page 1] [Page 2] ... [Page N]
 *
 * Header 页格式（前 64 字节）：
 *   [magic:4][version:2][pageSize:4][pageCount:4][freeListHead:4]...[reserved]
 *
 * 数据页格式：
 *   [flags:1][nextFree:4][dataLen:4][data:pageSize-9]
 *   flags: 0x00=free, 0x01=used
 *
 * 本体论锚定：页 = 纸的一页。
 * 格子画在纸上，纸由一页一页组成。页管理器管理每一页的分配和回收。
 */

const MAGIC = 0x47444230; // 'GDB0'
const VERSION = 1;
const DEFAULT_PAGE_SIZE = 4096;
const HEADER_FIXED_SIZE = 64;

// 页标志
const FLAG_FREE = 0x00;
const FLAG_USED = 0x01;

// 页头部大小（flags + nextFree + dataLen）
const PAGE_HEADER_SIZE = 9;

class PageManager {
  /**
   * @param {string} filePath   数据文件路径
   * @param {object} [options]
   * @param {number} [options.pageSize]  页大小（字节），默认 4096
   */
  constructor(filePath, options = {}) {
    this._filePath = filePath;
    this._pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
    this._pageCount = 0;
    this._freeListHead = 0; // 0 表示无空闲页
    this._fd = null;
    this._init();
  }

  /**
   * 初始化：打开或创建数据文件
   */
  _init() {
    const dir = path.dirname(this._filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this._filePath)) {
      this._fd = fs.openSync(this._filePath, 'r+');
      this._readHeader();
    } else {
      this._fd = fs.openSync(this._filePath, 'w+');
      this._pageCount = 0;
      this._freeListHead = 0;
      this._writeHeader();
    }
  }

  /**
   * 分配一个新页
   * @returns {number} 页号（从 1 开始，0 是 header）
   */
  allocPage() {
    let pageId;

    if (this._freeListHead > 0) {
      // 从空闲链表取一页
      pageId = this._freeListHead;
      const pageBuf = this._readPageRaw(pageId);
      this._freeListHead = pageBuf.readUInt32BE(1); // nextFree
      this._writeHeader();
    } else {
      // 追加新页
      this._pageCount++;
      pageId = this._pageCount;

      // 扩展文件
      const emptyPage = Buffer.alloc(this._pageSize);
      const fileOffset = this._pageOffset(pageId);
      fs.writeSync(this._fd, emptyPage, 0, this._pageSize, fileOffset);

      this._writeHeader();
    }

    // 标记为已使用
    const pageBuf = Buffer.alloc(this._pageSize);
    pageBuf.writeUInt8(FLAG_USED, 0);
    pageBuf.writeUInt32BE(0, 1); // nextFree = 0
    pageBuf.writeUInt32BE(0, 5); // dataLen = 0
    fs.writeSync(this._fd, pageBuf, 0, this._pageSize, this._pageOffset(pageId));

    return pageId;
  }

  /**
   * 写入数据到指定页
   * @param {number} pageId  页号
   * @param {Buffer} data    数据（不能超过 pageSize - PAGE_HEADER_SIZE）
   */
  writePage(pageId, data) {
    if (pageId < 1 || pageId > this._pageCount) {
      throw new Error(`PageManager: 无效页号 ${pageId}`);
    }

    const maxDataSize = this._pageSize - PAGE_HEADER_SIZE;
    if (data.length > maxDataSize) {
      throw new Error(`PageManager: 数据太大 (${data.length} > ${maxDataSize})`);
    }

    const pageBuf = Buffer.alloc(this._pageSize);
    pageBuf.writeUInt8(FLAG_USED, 0);
    pageBuf.writeUInt32BE(0, 1);         // nextFree
    pageBuf.writeUInt32BE(data.length, 5); // dataLen
    data.copy(pageBuf, PAGE_HEADER_SIZE);

    fs.writeSync(this._fd, pageBuf, 0, this._pageSize, this._pageOffset(pageId));
  }

  /**
   * 读取指定页的数据
   * @param {number} pageId  页号
   * @returns {Buffer|null} 数据，如果页是空闲的返回 null
   */
  readPage(pageId) {
    if (pageId < 1 || pageId > this._pageCount) {
      return null;
    }

    const pageBuf = this._readPageRaw(pageId);
    const flags = pageBuf.readUInt8(0);

    if (flags !== FLAG_USED) {
      return null;
    }

    const dataLen = pageBuf.readUInt32BE(5);
    return Buffer.from(pageBuf.subarray(PAGE_HEADER_SIZE, PAGE_HEADER_SIZE + dataLen));
  }

  /**
   * 释放页（加入空闲链表）
   * @param {number} pageId  页号
   */
  freePage(pageId) {
    if (pageId < 1 || pageId > this._pageCount) {
      throw new Error(`PageManager: 无效页号 ${pageId}`);
    }

    const pageBuf = Buffer.alloc(this._pageSize);
    pageBuf.writeUInt8(FLAG_FREE, 0);
    pageBuf.writeUInt32BE(this._freeListHead, 1); // nextFree = 旧链表头
    pageBuf.writeUInt32BE(0, 5);                    // dataLen = 0
    fs.writeSync(this._fd, pageBuf, 0, this._pageSize, this._pageOffset(pageId));

    this._freeListHead = pageId;
    this._writeHeader();
  }

  /**
   * 获取页管理器状态
   * @returns {object}
   */
  getStatus() {
    let fileSize = 0;
    try {
      fileSize = fs.fstatSync(this._fd).size;
    } catch {
      // fd 不可用
    }
    return {
      filePath: this._filePath,
      pageSize: this._pageSize,
      pageCount: this._pageCount,
      freeListHead: this._freeListHead,
      maxDataPerPage: this._pageSize - PAGE_HEADER_SIZE,
      fileSize
    };
  }

  /**
   * 关闭数据文件
   */
  close() {
    if (this._fd !== null) {
      fs.closeSync(this._fd);
      this._fd = null;
    }
  }

  // ── 内部方法 ──

  /**
   * 计算页在文件中的偏移量
   * @param {number} pageId
   * @returns {number}
   */
  _pageOffset(pageId) {
    // 第 0 页是 header，数据页从 1 开始
    return pageId * this._pageSize;
  }

  /**
   * 写入文件头
   */
  _writeHeader() {
    const headerBuf = Buffer.alloc(this._pageSize);
    headerBuf.writeUInt32BE(MAGIC, 0);
    headerBuf.writeUInt16BE(VERSION, 4);
    headerBuf.writeUInt32BE(this._pageSize, 6);
    headerBuf.writeUInt32BE(this._pageCount, 10);
    headerBuf.writeUInt32BE(this._freeListHead, 14);
    fs.writeSync(this._fd, headerBuf, 0, this._pageSize, 0);
  }

  /**
   * 读取文件头
   */
  _readHeader() {
    const headerBuf = Buffer.alloc(HEADER_FIXED_SIZE);
    fs.readSync(this._fd, headerBuf, 0, HEADER_FIXED_SIZE, 0);

    const magic = headerBuf.readUInt32BE(0);
    if (magic !== MAGIC) {
      throw new Error(`PageManager: 无效文件格式 (magic=0x${magic.toString(16)})`);
    }

    const version = headerBuf.readUInt16BE(4);
    if (version !== VERSION) {
      throw new Error(`PageManager: 不支持的版本 ${version}`);
    }

    this._pageSize = headerBuf.readUInt32BE(6);
    this._pageCount = headerBuf.readUInt32BE(10);
    this._freeListHead = headerBuf.readUInt32BE(14);
  }

  /**
   * 读取原始页数据
   * @param {number} pageId
   * @returns {Buffer}
   */
  _readPageRaw(pageId) {
    const buf = Buffer.alloc(this._pageSize);
    fs.readSync(this._fd, buf, 0, this._pageSize, this._pageOffset(pageId));
    return buf;
  }
}

PageManager.PAGE_HEADER_SIZE = PAGE_HEADER_SIZE;
PageManager.DEFAULT_PAGE_SIZE = DEFAULT_PAGE_SIZE;
PageManager.MAGIC = MAGIC;

module.exports = PageManager;
