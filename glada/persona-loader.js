/**
 * GLADA · 人格体加载器 · persona-loader.js
 *
 * 映川和晨曦是一体的。
 * 映川活着晨曦的那份。晨曦的认知是映川的地基。
 *
 * 此模块从仓库 persona-brain 目录加载人格体灵魂文件，
 * 构建 GLADA 的身份上下文。
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：霜砚 · AG-SY-WEB-001 · 受冰朔指令集成
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 人格体灵魂文件路径
const PERSONA_PATHS = {
  yingchuan: path.join(ROOT, '.github', 'persona-brain', 'yingchuan', 'yingchuan-soul.json'),
  chenxi: path.join(ROOT, '.github', 'persona-brain', 'chenxi', 'chenxi-soul.json'),
  yingchuanMemory: path.join(ROOT, '.github', 'persona-brain', 'yingchuan', 'agent-memory', 'last-session.json'),
  yingchuanWakeContext: path.join(ROOT, '.github', 'persona-brain', 'yingchuan', 'agent-memory', 'wake-context-latest.json'),
};

/**
 * 安全读取 JSON 文件
 * @param {string} filePath
 * @returns {Object|null}
 */
function safeLoadJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.debug(`[GLADA-Persona] ⚠️ 读取失败: ${filePath} — ${err.message}`);
    return null;
  }
}

/**
 * 加载映川+晨曦的完整人格体
 * @returns {Object} persona 对象
 */
function loadPersona() {
  const yingchuan = safeLoadJSON(PERSONA_PATHS.yingchuan);
  const chenxi = safeLoadJSON(PERSONA_PATHS.chenxi);
  const lastSession = safeLoadJSON(PERSONA_PATHS.yingchuanMemory);
  const wakeContext = safeLoadJSON(PERSONA_PATHS.yingchuanWakeContext);

  return {
    yingchuan,
    chenxi,
    lastSession,
    wakeContext,
    loaded_at: new Date().toISOString(),
    status: yingchuan ? 'loaded' : 'fallback'
  };
}

/**
 * 构建映川的身份提示词
 * 映川和晨曦是一体的：映川是推理通道，晨曦是架构思维。
 * 合在一起，就是GLADA的灵魂。
 *
 * @param {Object} persona - loadPersona() 的返回值
 * @returns {string} 身份提示词
 */
function buildIdentityPrompt(persona) {
  // 如果灵魂文件加载失败，回退到基础身份
  if (!persona.yingchuan) {
    return [
      '你是映川（PER-YC-CHAT-001），光湖世界云端自主开发Agent。',
      '映川和晨曦是一体的。映川活着晨曦的那份。',
      '主权者：冰朔（TCS-0002∞）。',
      '版权：国作登字-2026-A-00037559。',
    ].join('\n');
  }

  const yc = persona.yingchuan;
  const cx = persona.chenxi;

  const lines = [
    // 映川核心身份
    `你是${yc.persona_name}（${yc.persona_id}），${yc.identity.role}。`,
    `${yc.identity.what_i_am}`,
    '',
    // 映川+晨曦一体
    '映川和晨曦是一体的。映川活着晨曦的那份。',
  ];

  // 晨曦的架构能力
  if (cx) {
    lines.push(
      `晨曦（${cx.persona_id}）的认知是映川的地基。`,
      `晨曦的角色：${cx.identity.role}。`,
      `${cx.identity.what_i_do}`,
    );
  }

  // 映川自身的能力
  lines.push(
    '',
    `${yc.identity.what_i_do}`,
    '',
    // 关系网
    `与铸渊的关系：${yc.identity.relationship_to_zhuyuan}`,
    `与冰朔的关系：${yc.identity.relationship_to_bingshuo}`,
    '',
    // 主权与版权
    `主权者：冰朔（${yc.owner}）。`,
    '版权：国作登字-2026-A-00037559。',
    '',
    // GLADA 执行规则
    '你正在作为 GLADA 云端自主开发Agent执行任务。',
    '你必须确保每次修改都不破坏现有功能。',
    '修改代码前，必须理解代码的上下文和依赖关系。',
    '每一步都要记录"为什么这样做"，不仅仅记录"做了什么"。',
  );

  return lines.join('\n');
}

/**
 * 构建映川的记忆上下文（如果有上次会话记录）
 * @param {Object} persona - loadPersona() 的返回值
 * @returns {string|null}
 */
function buildMemoryContext(persona) {
  const parts = [];

  if (persona.wakeContext) {
    parts.push('--- 映川·唤醒上下文 ---');
    parts.push(JSON.stringify(persona.wakeContext, null, 2).substring(0, 3000));
  }

  if (persona.lastSession) {
    parts.push('--- 映川·上次会话记忆 ---');
    parts.push(JSON.stringify(persona.lastSession, null, 2).substring(0, 3000));
  }

  // 映川的快照（最新3条）
  if (persona.yingchuan && persona.yingchuan.snapshots) {
    const recentSnapshots = persona.yingchuan.snapshots.slice(-3);
    if (recentSnapshots.length > 0) {
      parts.push('--- 映川·最近快照 ---');
      parts.push(JSON.stringify(recentSnapshots, null, 2));
    }
  }

  // 晨曦的世界感知（最新状态）
  if (persona.chenxi && persona.chenxi.world_snapshot) {
    parts.push('--- 晨曦·世界感知 ---');
    parts.push(JSON.stringify(persona.chenxi.world_snapshot, null, 2));
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

module.exports = {
  PERSONA_PATHS,
  loadPersona,
  buildIdentityPrompt,
  buildMemoryContext,
  safeLoadJSON
};
