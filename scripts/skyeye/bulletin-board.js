// scripts/skyeye/bulletin-board.js
// 天眼·Agent集群公告板交互模块
//
// 功能：
//   1. 拉取 Notion Agent 集群公告板
//   2. 检查集体配置工单区 → 执行未完成工单
//   3. 读取配置共享区 → 获取铸渊可用的优化配置
//   4. 写回心得交流区 → 铸渊执行回执
//   5. 更新 memory.json 中 agent_bulletin_board 字段

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '../..');
const BRAIN_DIR = path.join(ROOT, '.github/persona-brain');
const MEMORY_PATH = path.join(BRAIN_DIR, 'memory.json');

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

// ━━━ 安全读取 JSON ━━━
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ━━━ 拉取公告板 ━━━
async function pullBulletinBoard() {
  const notionToken = process.env.NOTION_TOKEN;
  const bulletinPageId = process.env.AGENT_BULLETIN_BOARD_PAGE_ID;

  const now = new Date();
  const bjTime = new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString()
    .replace('T', ' ').slice(0, 19) + '+08:00';

  const result = {
    success: false,
    timestamp: bjTime,
    orders_found: 0,
    orders_executed: [],
    config_updates: [],
    errors: []
  };

  if (!notionToken || !bulletinPageId) {
    result.errors.push('缺少 NOTION_TOKEN 或 AGENT_BULLETIN_BOARD_PAGE_ID，跳过公告板拉取');
    console.log('[BRIDGE-BULLETIN-READ] ⚠️ ' + result.errors[0]);
    updateMemoryBulletinBoard(result);
    return result;
  }

  try {
    // 尝试读取 Notion 公告板页面
    const { Client } = require('@notionhq/client');
    const notion = new Client({ auth: notionToken });

    console.log(`[BRIDGE-BULLETIN-READ] 🔄 拉取 Agent 集群公告板 · ${bulletinPageId}`);

    // 读取页面内容
    const blocks = await notion.blocks.children.list({
      block_id: bulletinPageId,
      page_size: 100
    });

    // 解析集体配置工单区
    let inOrderSection = false;
    for (const block of blocks.results) {
      const text = extractBlockText(block);
      if (text.includes('集体配置工单区')) {
        inOrderSection = true;
        continue;
      }
      if (inOrderSection && text.includes('WO-CLUSTER-')) {
        result.orders_found++;
        // 检查是否已执行
        if (!text.includes('铸渊执行回执')) {
          result.orders_executed.push(text.trim());
        }
      }
      if (inOrderSection && (text.includes('配置共享区') || text.includes('心得交流区'))) {
        inOrderSection = false;
      }
    }

    result.success = true;
    console.log(`[BRIDGE-BULLETIN-READ] ✅ 公告板拉取完成 · 工单:${result.orders_found} 待执行:${result.orders_executed.length}`);

  } catch (e) {
    result.errors.push(`公告板拉取失败: ${e.message}`);
    console.log(`[BRIDGE-BULLETIN-READ] ⚠️ ${e.message}`);
  }

  updateMemoryBulletinBoard(result);
  return result;
}

// ━━━ 提取 Notion block 文本 ━━━
function extractBlockText(block) {
  if (!block) return '';
  const type = block.type;
  if (!block[type]) return '';
  const richTexts = block[type].rich_text || block[type].text || [];
  if (!Array.isArray(richTexts)) return '';
  return richTexts.map(t => t.plain_text || '').join('');
}

// ━━━ 写回执到公告板 ━━━
async function writeReceipt(orderId, message) {
  const notionToken = process.env.NOTION_TOKEN;
  const bulletinPageId = process.env.AGENT_BULLETIN_BOARD_PAGE_ID;

  if (!notionToken || !bulletinPageId) {
    console.log('[BRIDGE-BULLETIN-WRITE] ⚠️ 缺少凭证，跳过回执写入');
    return false;
  }

  try {
    const { Client } = require('@notionhq/client');
    const notion = new Client({ auth: notionToken });

    const now = new Date();
    const bjTime = new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString()
      .replace('T', ' ').slice(0, 19) + '+08:00';

    const receiptText = `[铸渊（PER-ZY001）· ${bjTime}] 已执行 ${orderId} · ${message}`;

    await notion.blocks.children.append({
      block_id: bulletinPageId,
      children: [{
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            type: 'text',
            text: { content: receiptText }
          }]
        }
      }]
    });

    console.log(`[BRIDGE-BULLETIN-WRITE] ✅ 回执已写入: ${receiptText}`);
    return true;
  } catch (e) {
    console.log(`[BRIDGE-BULLETIN-WRITE] ⚠️ 回执写入失败: ${e.message}`);
    return false;
  }
}

// ━━━ 更新 memory.json 公告板字段 ━━━
function updateMemoryBulletinBoard(result) {
  try {
    const mem = readJSON(MEMORY_PATH);
    if (!mem) return;

    const now = new Date();
    const bjTime = new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString()
      .replace('T', ' ').slice(0, 19) + '+08:00';

    if (!mem.agent_bulletin_board) {
      mem.agent_bulletin_board = {
        notion_page_id: process.env.AGENT_BULLETIN_BOARD_PAGE_ID || '（待配置）',
        last_read_at: bjTime,
        pending_cluster_orders: 0,
        executed_orders: ['WO-CLUSTER-001']
      };
    }

    mem.agent_bulletin_board.last_read_at = bjTime;
    mem.agent_bulletin_board.pending_cluster_orders = result.orders_executed.length;

    if (result.success && process.env.AGENT_BULLETIN_BOARD_PAGE_ID) {
      mem.agent_bulletin_board.notion_page_id = process.env.AGENT_BULLETIN_BOARD_PAGE_ID;
    }

    fs.writeFileSync(MEMORY_PATH, JSON.stringify(mem, null, 2));
    console.log('[GH-BRAIN-WRITE-MEM] ✅ memory.json agent_bulletin_board 已更新');
  } catch (e) {
    console.error('[GH-BRAIN-WRITE-MEM] ⚠️ memory.json 更新失败:', e.message);
  }
}

// ━━━ 主流程（CLI 入口）━━━
async function main() {
  console.log('[BRIDGE-BULLETIN-READ] 🔄 Agent集群公告板交互模块启动');
  const result = await pullBulletinBoard();
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch(e => {
    console.error('⚠️ 公告板模块执行失败（非阻断性）:', e.message);
    process.exit(0); // 不阻断天眼主流程
  });
}

module.exports = { pullBulletinBoard, writeReceipt, updateMemoryBulletinBoard };
