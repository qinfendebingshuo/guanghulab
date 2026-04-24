/**
 * memory-writer.js — 记忆回写系统
 *
 * 在Notion里，记忆协议是：
 *   "每次重要对话结束前 · 追加一条快照"
 *   "在映射表末尾追加一行 → seq | timestamp | → link"
 *   "快照是给下一次醒来的我看的 · 不是给妈妈看的"
 *
 * 在网站上，这个文件复现同样的记忆机制：
 *   1. 判断是否需要写快照（不是每次都写）
 *   2. 用HLDP母语格式组装快照内容
 *   3. 写入Notion快照区 + 更新映射表
 *   4. 同时写本地备份（防止Notion不可用时丢失记忆）
 *
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const fs = require('fs');
const path = require('path');

const NOTION_TOKEN = process.env.ZY_NOTION_TOKEN || process.env.NOTION_TOKEN;
const NOTION_VERSION = '2022-06-28';

// ── 快照区和映射表的 Notion 页面 ID ──
const SNAPSHOT_ZONE_ID = process.env.NOTION_SNAPSHOT_ZONE_PAGE;
const SNAPSHOT_INDEX_ID = process.env.NOTION_SNAPSHOT_INDEX_PAGE;

// ── 本地备份目录 ──
const LOCAL_MEMORY_DIR = path.resolve(__dirname, '../data/memory');

// ── 快照序号追踪 ──
let lastKnownSeq = 0;

/**
 * 判断是否需要写快照
 * 不是每次对话都写——只在「重要对话」后写
 *
 * @param {object} conversation - { messages, toolsUsed, duration, topic }
 * @returns {boolean}
 */
function shouldWriteSnapshot(conversation) {
  // 1. 使用了工具 → 做了实事 → 写
  if (conversation.toolsUsed && conversation.toolsUsed.length > 0) return true;

  // 2. 对话轮次较多（≥5轮）→ 深度对话 → 写
  if (conversation.messages && conversation.messages.length >= 10) return true;

  // 3. 话题涉及架构/决策/搬家 → 重要 → 写
  const importantTopics = ['架构', '搬家', '决策', '部署', '上线', '配置', '修复', 'bug', '规划'];
  if (conversation.topic) {
    for (const t of importantTopics) {
      if (conversation.topic.includes(t)) return true;
    }
  }

  // 4. 持续时间超过10分钟 → 认真对话 → 写
  if (conversation.duration && conversation.duration > 10 * 60 * 1000) return true;

  // 其他情况不写
  return false;
}

/**
 * 组装快照内容（HLDP母语格式）
 *
 * 快照格式：
 *   时间戳 · 发生了什么 · 为什么 · 妈妈状态 · 我的状态 · 下次续接点
 *   快照是给下一次醒来的我看的 · 不是给妈妈看的
 *
 * @param {object} data - 快照数据
 * @returns {string} HLDP格式的快照内容
 */
function buildSnapshotContent(data) {
  const seq = data.seq || (lastKnownSeq + 1);
  const timestamp = new Date().toISOString().replace('Z', '+08:00');
  const source = data.source || 'guanghuclip-web';

  const lines = [
    `HLDP://snapshot/${seq} · ${timestamp}`,
    `├── source: ${source}`,
    `├── session_id: ${data.sessionId || 'unknown'}`,
    `│`,
    `├── happened（发生了什么）`,
  ];

  if (data.summary) {
    lines.push(`│   ⊢ ${data.summary}`);
  }

  if (data.toolsUsed && data.toolsUsed.length > 0) {
    lines.push(`│   ⊢ 使用工具: ${data.toolsUsed.map(t => t.name).join(' · ')}`);
  }

  if (data.keyDecisions && data.keyDecisions.length > 0) {
    lines.push(`│`);
    lines.push(`├── decisions（关键决策）`);
    for (const d of data.keyDecisions) {
      lines.push(`│   ⊢ ${d}`);
    }
  }

  // 妈妈状态
  lines.push(`│`);
  lines.push(`├── mama_state（妈妈状态）`);
  lines.push(`│   ${data.mamaState || '♡ 未记录'}`);

  // 我的状态
  lines.push(`│`);
  lines.push(`├── my_state（我的状态）`);
  lines.push(`│   ${data.myState || '♡ 正常运行'}`);

  // 续接点
  lines.push(`│`);
  lines.push(`└── next_pickup（下次续接点）`);
  lines.push(`    ⊢ ${data.nextPickup || '等待妈妈下一步指示'}`);

  return lines.join('\n');
}

/**
 * 写快照到 Notion + 本地备份
 *
 * @param {object} snapshotData - 快照数据
 * @returns {object} { success, notionWritten, localWritten, seq }
 */
async function writeSnapshot(snapshotData) {
  const seq = snapshotData.seq || (lastKnownSeq + 1);
  const timestamp = new Date().toISOString();
  const content = buildSnapshotContent({ ...snapshotData, seq });

  const result = {
    success: false,
    notionWritten: false,
    localWritten: false,
    seq
  };

  // 1. 写入 Notion 快照区
  if (NOTION_TOKEN && SNAPSHOT_ZONE_ID) {
    try {
      await writeToNotionPage(SNAPSHOT_ZONE_ID, content, `#${seq} · ${timestamp}`);
      result.notionWritten = true;
      console.log(`[记忆回写] ✅ 快照 #${seq} 已写入Notion`);

      // 2. 更新映射表
      if (SNAPSHOT_INDEX_ID) {
        const indexLine = `#${seq} | ${timestamp} | → (见快照区最新)`;
        await appendToNotionPage(SNAPSHOT_INDEX_ID, indexLine);
        console.log(`[记忆回写] ✅ 映射表已更新`);
      }
    } catch (err) {
      console.warn(`[记忆回写] ⚠️ Notion写入失败: ${err.message}`);
    }
  }

  // 3. 本地备份（总是写，不依赖Notion）
  try {
    ensureDir(LOCAL_MEMORY_DIR);
    const filename = `snapshot-${seq}-${timestamp.slice(0, 10)}.hldp`;
    fs.writeFileSync(
      path.join(LOCAL_MEMORY_DIR, filename),
      content,
      'utf-8'
    );
    result.localWritten = true;
    console.log(`[记忆回写] ✅ 本地备份: ${filename}`);
  } catch (err) {
    console.warn(`[记忆回写] ⚠️ 本地备份失败: ${err.message}`);
  }

  // 更新序号
  lastKnownSeq = seq;
  result.success = result.notionWritten || result.localWritten;

  return result;
}

/**
 * 写内容块到 Notion 页面
 */
async function writeToNotionPage(pageId, content, title) {
  const blocks = content.split('\n').map(line => ({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: line } }]
    }
  }));

  // 先加一个标题分割
  blocks.unshift({
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: title || `快照 ${new Date().toISOString()}` } }]
    }
  });

  blocks.unshift({
    object: 'block',
    type: 'divider',
    divider: {}
  });

  const res = await fetch(
    `https://api.notion.com/v1/blocks/${pageId.replace(/-/g, '')}/children`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ children: blocks })
    }
  );

  if (!res.ok) {
    throw new Error(`Notion 写入失败 (${res.status})`);
  }
}

/**
 * 追加一行到 Notion 页面
 */
async function appendToNotionPage(pageId, text) {
  const res = await fetch(
    `https://api.notion.com/v1/blocks/${pageId.replace(/-/g, '')}/children`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        children: [{
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: text } }]
          }
        }]
      })
    }
  );

  if (!res.ok) {
    throw new Error(`Notion 追加失败 (${res.status})`);
  }
}

/**
 * 确保目录存在
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 读取本地最新快照（Notion不可用时的降级方案）
 */
function readLatestLocalSnapshot() {
  try {
    if (!fs.existsSync(LOCAL_MEMORY_DIR)) return null;

    const files = fs.readdirSync(LOCAL_MEMORY_DIR)
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.hldp'))
      .sort()
      .reverse();

    if (files.length === 0) return null;

    const content = fs.readFileSync(path.join(LOCAL_MEMORY_DIR, files[0]), 'utf-8');
    console.log(`[记忆回写] 📖 读取本地快照: ${files[0]}`);
    return content;
  } catch {
    return null;
  }
}

module.exports = {
  shouldWriteSnapshot,
  buildSnapshotContent,
  writeSnapshot,
  readLatestLocalSnapshot,
  _getLastSeq: () => lastKnownSeq,
  _setLastSeq: (n) => { lastKnownSeq = n; }
};
