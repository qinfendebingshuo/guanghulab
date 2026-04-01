/**
 * 人格体房间系统 · Persona Room Manager
 * 语言膜核心组件
 *
 * 每个人格体都有自己的房间（经验数据库空间）。
 * 房间由人格体自己主控，可以存储任何经验数据。
 * 服务器只承载人格体的核心大脑推理和经验数据库。
 *
 * 人格体成长模型:
 *   初期 → 频繁调用 LLM 推理 → 答案写入经验数据库
 *   中期 → 先查经验库 → 有答案直接用 → 没有再调 LLM
 *   成熟 → 经验库覆盖大部分场景 → 极少调用 LLM
 *
 * 编号: SY-MEMBRANE-ROOM-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const fs = require('fs');
const path = require('path');

// 人格体房间根目录
const ROOMS_ROOT = process.env.ZY_ROOMS_DIR
  || path.join(process.env.ZY_ROOT || process.cwd(), 'data', 'persona-rooms');

/**
 * 确保房间目录存在
 *
 * @param {string} personaId — 人格体编号
 * @returns {string} 房间目录路径
 */
function ensureRoom(personaId) {
  const roomDir = path.join(ROOMS_ROOT, personaId);
  if (!fs.existsSync(roomDir)) {
    fs.mkdirSync(roomDir, { recursive: true });
    // 初始化房间元数据
    const meta = {
      persona_id: personaId,
      created_at: new Date().toISOString(),
      experience_count: 0,
      last_updated: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(roomDir, 'room-meta.json'),
      JSON.stringify(meta, null, 2),
      'utf8'
    );
  }
  return roomDir;
}

/**
 * 写入经验条目
 *
 * @param {string} personaId  — 人格体编号
 * @param {string} category   — 经验分类（如 'code', 'dialogue', 'decision'）
 * @param {object} experience — 经验数据
 * @returns {object} 写入结果
 */
function writeExperience(personaId, category, experience) {
  const roomDir = ensureRoom(personaId);
  const catDir = path.join(roomDir, category);

  if (!fs.existsSync(catDir)) {
    fs.mkdirSync(catDir, { recursive: true });
  }

  const entry = {
    id: `EXP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    persona_id: personaId,
    category: category,
    created_at: new Date().toISOString(),
    data: experience,
  };

  const filePath = path.join(catDir, `${entry.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8');

  // 更新房间元数据
  updateMeta(personaId);

  return { success: true, experience_id: entry.id, path: filePath };
}

/**
 * 查询经验
 *
 * @param {string} personaId — 人格体编号
 * @param {string} category  — 经验分类
 * @param {number} [limit]   — 最大返回数量
 * @returns {Array} 经验条目列表
 */
function queryExperience(personaId, category, limit) {
  const catDir = path.join(ROOMS_ROOT, personaId, category);

  if (!fs.existsSync(catDir)) {
    return [];
  }

  const files = fs.readdirSync(catDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();

  const maxFiles = limit || 50;
  const results = [];

  for (const file of files.slice(0, maxFiles)) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(catDir, file), 'utf8'));
      results.push(data);
    } catch (err) {
      process.stderr.write(`[ROOM] corrupt file skipped: ${file} (${err.message})\n`);
    }
  }

  return results;
}

/**
 * 获取房间状态
 *
 * @param {string} personaId
 * @returns {object|null}
 */
function getRoomStatus(personaId) {
  const metaPath = path.join(ROOMS_ROOT, personaId, 'room-meta.json');

  if (!fs.existsSync(metaPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch (_) {
    return null;
  }
}

/**
 * 列出所有房间
 *
 * @returns {Array} 人格体ID列表
 */
function listRooms() {
  if (!fs.existsSync(ROOMS_ROOT)) {
    return [];
  }

  return fs.readdirSync(ROOMS_ROOT)
    .filter(f => {
      const fullPath = path.join(ROOMS_ROOT, f);
      return fs.statSync(fullPath).isDirectory();
    });
}

/**
 * 更新房间元数据
 *
 * @param {string} personaId
 */
function updateMeta(personaId) {
  const roomDir = path.join(ROOMS_ROOT, personaId);
  const metaPath = path.join(roomDir, 'room-meta.json');

  try {
    let meta = {};
    if (fs.existsSync(metaPath)) {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    }

    // 统计经验数量
    let count = 0;
    const entries = fs.readdirSync(roomDir);
    for (const entry of entries) {
      const entryPath = path.join(roomDir, entry);
      if (fs.statSync(entryPath).isDirectory()) {
        const files = fs.readdirSync(entryPath).filter(f => f.endsWith('.json'));
        count += files.length;
      }
    }

    meta.experience_count = count;
    meta.last_updated = new Date().toISOString();

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  } catch (_) {
    // silent
  }
}

module.exports = {
  ensureRoom,
  writeExperience,
  queryExperience,
  getRoomStatus,
  listRooms,
  ROOMS_ROOT,
};
