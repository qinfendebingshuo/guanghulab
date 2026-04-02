#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// scripts/sync-work-order-to-notion.js
// 📋 铸渊工单 → Notion SYSLOG 同步器
//
// 架构说明:
//   工单是铸渊智能运维的核心记录单元
//   冰朔需要在 Notion 侧看到告警工单的完整上下文
//   复用已有的 SYSLOG 数据库（霜砚已在 Notion 侧建好）
//   不需要新建数据库，零额外配置成本
//
// 用法:
//   node scripts/sync-work-order-to-notion.js --order-id <WO-xxx>
//   node scripts/sync-work-order-to-notion.js --order-id "observer-23906843495"
//   node scripts/sync-work-order-to-notion.js --all-failed   (同步所有失败工单)
//
// 环境变量:
//   NOTION_TOKEN   GitHub Secret: NOTION_TOKEN (必须)
//   SYSLOG_DB_ID   覆盖默认数据库 ID (可选)
//   COMMIT_SHA     当前 commit SHA (可选，由 workflow 注入)
//   RUN_ID         工作流运行 ID (可选，由 workflow 注入)
//   WORKFLOW_NAME  工作流名称 (可选，由 workflow 注入)
//
// Notion「📥 GitHub SYSLOG 收件箱」数据库属性:
//   标题       title       工单ID + 任务名
//   DEV编号    select      "SYSTEM" (系统工单)
//   文件内容   rich_text   工单完整 JSON + 时间线
//   接收时间   date        工单创建时间
//   处理状态   status      待处理 / 人工干预
//   来源路径   rich_text   data/work-orders/active.json
//   commit_sha rich_text   工单关联的 commit SHA
//   推送方     rich_text   铸渊
// ═══════════════════════════════════════════════

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── 常量 ─────────────────────────────────────
const NOTION_VERSION       = '2022-06-28';
const NOTION_API_HOSTNAME  = 'api.notion.com';
const NOTION_RICH_TEXT_MAX = 2000;
const NOTION_TITLE_MAX     = 120;
const MAX_LOG_PREVIEW_LENGTH = 500;

// 复用 notion-bridge.js 已内置的数据库 ID
const DEFAULT_SYSLOG_DB_ID = '330ab17507d542c9bbb96d0749b41197';

// ── Notion API 基础请求 ──────────────────────
function notionPost(endpoint, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname: NOTION_API_HOSTNAME,
      port: 443,
      path: endpoint,
      method: 'POST',
      headers: {
        'Authorization':  'Bearer ' + token,
        'Content-Type':   'application/json',
        'Notion-Version': NOTION_VERSION,
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
          else reject(new Error(`Notion API ${res.statusCode}: ${parsed.message || data.slice(0, 200)}`));
        } catch (e) {
          reject(new Error(`Notion 解析失败: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Notion 属性构建 ───────────────────────────
function richText(content) {
  const str = String(content || '');
  const chunks = [];
  for (let i = 0; i < str.length; i += NOTION_RICH_TEXT_MAX) {
    chunks.push({ type: 'text', text: { content: str.slice(i, i + NOTION_RICH_TEXT_MAX) } });
  }
  return chunks.length ? chunks : [{ type: 'text', text: { content: '' } }];
}

function titleProp(text) {
  return { title: [{ type: 'text', text: { content: String(text || '').slice(0, NOTION_TITLE_MAX) } }] };
}

// ── 工单格式化 ────────────────────────────────
function formatOrderForNotion(order, runId, workflowName) {
  // 构建时间线文本
  const timelineText = (order.timeline || [])
    .map(t => `[${t.timestamp}] ${t.actor}: ${t.message}`)
    .join('\n');

  // 构建部署日志文本
  const logsText = (order.deploy_logs || [])
    .map(l => `[${l.timestamp}] ${l.content}`)
    .join('\n');

  // 完整内容（传入 SYSLOG 文件内容字段）
  const fullContent = [
    '═══ 工单基本信息 ═══',
    `工单ID:    ${order.id}`,
    `状态:      ${order.status}`,
    `任务:      ${order.title}`,
    `提交SHA:   ${order.commit_sha || 'N/A'}`,
    `分支:      ${order.branch || 'main'}`,
    `创建者:    ${order.created_by || 'system'}`,
    `创建时间:  ${order.created_at}`,
    `更新时间:  ${order.updated_at}`,
    `重试次数:  ${order.retry_count || 0}/${order.max_retries || 3}`,
    '',
    '═══ 执行时间线 ═══',
    timelineText || '(无时间线记录)',
    '',
    '═══ 部署日志 ═══',
    logsText || '(无部署日志)',
    '',
    '═══ 观测信息 ═══',
    `触发工作流: ${workflowName || '铸渊智能运维'}`,
    `运行 ID:   ${runId || 'N/A'}`,
    `同步时间:  ${new Date().toISOString()}`,
    '',
    '═══ 原始数据 ═══',
    JSON.stringify(order, null, 2),
  ].join('\n');

  return fullContent;
}

// ── 同步单条工单到 Notion ─────────────────────
async function syncOrderToNotion(order, token, dbId, options = {}) {
  const { runId, workflowName, commitSha } = options;

  const statusText = order.status === 'failed' || order.status === 'human-intervened'
    ? '人工干预'
    : '待处理';

  const notionTitle = `[${order.id}] ${(order.title || '').slice(0, 80)} · ${order.status}`;
  const content = formatOrderForNotion(order, runId, workflowName);

  const properties = {
    '标题':      titleProp(notionTitle),
    '文件内容':  { rich_text: richText(content) },
    '接收时间':  { date: { start: order.created_at || new Date().toISOString() } },
    '来源路径':  { rich_text: richText('data/work-orders/active.json') },
    '推送方':    { rich_text: richText('铸渊') },
  };

  // commit_sha 字段
  if (commitSha || order.commit_sha) {
    properties['commit_sha'] = { rich_text: richText(commitSha || order.commit_sha || '') };
  }

  // 处理状态（SYSLOG 里是 status 字段）
  try {
    properties['处理状态'] = { status: { name: statusText } };
  } catch (e) {
    // 某些 Notion 数据库可能用 select 而非 status，忽略此字段错误
    console.log(`  ℹ️ 处理状态字段跳过: ${e.message}`);
  }

  // DEV编号 select
  properties['DEV编号'] = { select: { name: 'SYSTEM' } };

  const body = {
    parent: { database_id: dbId },
    properties,
  };

  const page = await notionPost('/v1/pages', body, token);
  return page;
}

// ── 读取工单数据 ──────────────────────────────
function loadOrders() {
  const activeFile = path.join(ROOT, 'data/work-orders/active.json');
  try {
    return JSON.parse(fs.readFileSync(activeFile, 'utf8'));
  } catch (e) {
    console.error(`❌ 读取工单文件失败: ${e.message}`);
    return { orders: [] };
  }
}

// ── 解析命令行参数 ────────────────────────────
function parseArgs() {
  const argv = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      params[argv[i].slice(2)] = argv[i + 1] || 'true';
      i++;
    }
  }
  return params;
}

// ── 主函数 ────────────────────────────────────
async function main() {
  const token = process.env.NOTION_TOKEN;
  const dbId  = process.env.SYSLOG_DB_ID || DEFAULT_SYSLOG_DB_ID;

  if (!token) {
    console.error('❌ 缺少 NOTION_TOKEN 环境变量');
    process.exit(1);
  }

  const args = parseArgs();
  const orderId     = args['order-id'];
  const allFailed   = args['all-failed'] === 'true';
  const runId       = args['run-id']       || process.env.RUN_ID       || '';
  const workflowName = args['workflow']    || process.env.WORKFLOW_NAME || '铸渊智能运维';
  const commitSha   = args['commit-sha']   || process.env.COMMIT_SHA   || '';

  if (!orderId && !allFailed) {
    console.error('❌ 请提供 --order-id <ID> 或 --all-failed');
    console.log('用法:');
    console.log('  node scripts/sync-work-order-to-notion.js --order-id <WO-xxx>');
    console.log('  node scripts/sync-work-order-to-notion.js --all-failed');
    process.exit(1);
  }

  const data = loadOrders();
  let targets = [];

  if (allFailed) {
    targets = data.orders.filter(o =>
      o.status === 'failed' || o.status === 'human-intervened'
    );
    if (targets.length === 0) {
      console.log('✅ 没有失败或人工干预工单，无需同步');
      return;
    }
    console.log(`📋 找到 ${targets.length} 条失败/干预工单，准备同步到 Notion`);
  } else {
    // 支持 observer-{runId} 格式工单（观测系统生成）
    if (orderId.startsWith('observer-')) {
      // 构造虚拟工单，从部署日志文件读取信息
      const logRunId = orderId.replace('observer-', '');

      // 尝试直接找文件
      const logsDir = path.join(ROOT, 'data/deploy-logs');
      const files = fs.readdirSync(logsDir).filter(f => f.includes(logRunId));

      if (files.length > 0) {
        const logData = JSON.parse(fs.readFileSync(path.join(logsDir, files[0]), 'utf8'));
        // 构造虚拟工单
        const virtualOrder = {
          id: orderId,
          title: `部署观测告警 · ${logData.run?.workflow_name || workflowName}`,
          status: 'human-intervened',
          commit_sha: logData.run?.head_sha || commitSha,
          branch: logData.run?.head_branch || 'main',
          created_by: logData.run?.actor || 'system',
          created_at: logData.run?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          retry_count: 0,
          max_retries: 3,
          timeline: [
            { timestamp: logData.run?.created_at, actor: 'system', message: '部署工作流执行' },
            { timestamp: logData._meta?.collected_at, actor: '副将', message: '观测系统采集日志' },
            { timestamp: new Date().toISOString(), actor: '铸渊', message: '人工干预·工单同步到Notion' },
          ],
          deploy_logs: (logData.failed_jobs || []).map(j => ({
            timestamp: j.completed_at,
            content: `Job: ${j.job_name} · ${j.conclusion}\n${j.log_content?.slice(-MAX_LOG_PREVIEW_LENGTH) || ''}`,
          })),
          _observer_data: {
            run_id: logRunId,
            workflow: logData.run?.workflow_name,
            conclusion: logData.run?.conclusion,
            failed_jobs: (logData.failed_jobs || []).map(j => j.job_name),
            analysis: logData.analysis,
          },
        };
        targets = [virtualOrder];
      } else {
        // 找不到日志文件，构造最小虚拟工单
        targets = [{
          id: orderId,
          title: `部署观测告警 · ${workflowName}`,
          status: 'human-intervened',
          commit_sha: commitSha,
          branch: 'main',
          created_by: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          retry_count: 3,
          max_retries: 3,
          timeline: [
            { timestamp: new Date().toISOString(), actor: '铸渊', message: '人工干预·工单同步到Notion' },
          ],
          deploy_logs: [],
        }];
      }
    } else {
      // 标准工单格式
      const order = data.orders.find(o => o.id === orderId);
      if (!order) {
        console.error(`❌ 工单 ${orderId} 未找到`);
        process.exit(1);
      }
      targets = [order];
    }
  }

  console.log(`📡 开始同步 ${targets.length} 条工单到 Notion SYSLOG 收件箱`);
  console.log(`   数据库: ${dbId}`);
  console.log('');

  let ok = 0, failed = 0;

  for (const order of targets) {
    try {
      console.log(`  📋 同步工单: ${order.id} · ${order.status}`);
      const page = await syncOrderToNotion(order, token, dbId, {
        runId, workflowName, commitSha,
      });
      console.log(`  ✅ 已写入 Notion: ${page.id || page.url || '成功'}`);
      ok++;
    } catch (e) {
      console.error(`  ❌ 工单 ${order.id} 同步失败: ${e.message}`);
      failed++;
    }
  }

  console.log('');
  console.log(`✅ Notion 同步完成 · 成功 ${ok} 条 · 失败 ${failed} 条`);

  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error('❌ 同步脚本异常:', e.message);
  process.exit(1);
});
