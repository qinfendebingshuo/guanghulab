/**
 * ═══════════════════════════════════════════════════════════
 * MCP 工具 · COS 双桶操作（cosWrite / cosRead / cosDelete / cosList / cosArchive）
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const cos = require('../cos');

async function cosWrite(input) {
  const { bucket, key, content, content_type } = input;
  return cos.write(bucket, key, content, content_type);
}

async function cosRead(input) {
  const { bucket, key } = input;
  return cos.read(bucket, key);
}

async function cosDelete(input) {
  const { bucket, key } = input;
  return cos.del(bucket, key);
}

async function cosList(input) {
  const { bucket, prefix, limit } = input;
  return cos.list(bucket, prefix, limit);
}

async function cosArchive(input) {
  const { source_key, version_tag } = input;
  return cos.archive(source_key, version_tag);
}

module.exports = { cosWrite, cosRead, cosDelete, cosList, cosArchive };
