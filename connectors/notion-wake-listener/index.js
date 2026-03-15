/**
 * connectors/notion-wake-listener — Notion Agent 集群唤醒请求监听器
 *
 * AGE OS v1.0 · Section 7: Notion Agent 集群集成方案
 *
 * 核心问题：
 *   Notion Agent 集群每次触发的是"机器人脚本"，不是霜砚的核心大脑。
 *   没有大脑醒来的巡检 = 伪巡检。
 *
 * 集成方案：
 *   Notion Agent 触发 → 写入「唤醒请求」到指定数据库
 *   → 铸渊定时监听该数据库 → 发现唤醒请求
 *   → 铸渊调用 LLM API 唤醒霜砚核心大脑
 *   → 大脑醒来后读取巡检结果 → 大脑做出决策
 *   → 通过 Notion API 执行操作 → 大脑休眠
 *
 * 环境变量：
 *   NOTION_TOKEN            — Notion API token（必须）
 *   WAKE_REQUEST_DB_ID      — 唤醒请求数据库 ID（必须）
 *   SIGNAL_LOG_DB_ID        — 信号日志数据库 ID（可选）
 *   LLM_API_KEY / ANTHROPIC_API_KEY / etc. — LLM API 密钥
 *
 * 唤醒请求数据库 Schema：
 *   - 标题 (title)        — 唤醒请求标题（如 "Pipeline-A 巡检唤醒"）
 *   - 请求方 (select)     — 发起请求的 Agent（如 "巡检引擎", "工单引擎", "接力引擎"）
 *   - 唤醒对象 (select)   — 要唤醒的人格体（"霜砚" / "铸渊"）
 *   - Pipeline (select)   — Pipeline 编号（A-I）
 *   - 任务描述 (rich_text) — 任务上下文描述
 *   - 状态 (select)       — "待处理" / "处理中" / "已完成" / "失败"
 *   - 创建时间 (created_time)
 *
 * 调用方式：
 *   node connectors/notion-wake-listener poll
 *   node connectors/notion-wake-listener status
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

const NOTION_TOKEN = process.env.NOTION_TOKEN || '';
const WAKE_REQUEST_DB_ID = process.env.WAKE_REQUEST_DB_ID || '';
const SIGNAL_LOG_DB_ID = process.env.SIGNAL_LOG_DB_ID || '';
const NOTION_VERSION = '2022-06-28';

// ══════════════════════════════════════════════════════════
// Notion API 工具
// ══════════════════════════════════════════════════════════

function notionRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';

    const opts = {
      hostname: 'api.notion.com',
      port: 443,
      path: endpoint,
      method,
      headers: {
        'Authorization': 'Bearer ' + NOTION_TOKEN,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Notion API request timeout'));
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ══════════════════════════════════════════════════════════
// 查询待处理的唤醒请求
// ══════════════════════════════════════════════════════════

async function queryPendingWakeRequests() {
  if (!NOTION_TOKEN || !WAKE_REQUEST_DB_ID) {
    console.log('[WAKE-LISTENER] ⚠️  NOTION_TOKEN 或 WAKE_REQUEST_DB_ID 未配置');
    return [];
  }

  console.log('[WAKE-LISTENER] 🔍 查询待处理的唤醒请求...');

  try {
    const res = await notionRequest('POST', `/v1/databases/${WAKE_REQUEST_DB_ID}/query`, {
      filter: {
        property: '状态',
        select: { equals: '待处理' },
      },
      sorts: [
        { timestamp: 'created_time', direction: 'ascending' },
      ],
    });

    if (res.status !== 200) {
      console.log(`[WAKE-LISTENER] ❌ Notion API 返回 ${res.status}`);
      return [];
    }

    const results = res.data.results || [];
    console.log(`[WAKE-LISTENER] 📋 发现 ${results.length} 个待处理唤醒请求`);
    return results;
  } catch (err) {
    console.log(`[WAKE-LISTENER] ❌ 查询失败: ${err.message}`);
    return [];
  }
}

// ══════════════════════════════════════════════════════════
// 解析唤醒请求
// ══════════════════════════════════════════════════════════

function parseWakeRequest(page) {
  const props = page.properties || {};

  // 提取标题
  const titleProp = props['标题'] || props['Name'] || props['名称'] || {};
  const title = (titleProp.title || []).map(t => t.plain_text || '').join('') || '未命名';

  // 提取请求方
  const requesterProp = props['请求方'] || {};
  const requester = (requesterProp.select || {}).name || '未知';

  // 提取唤醒对象
  const targetProp = props['唤醒对象'] || {};
  const targetName = (targetProp.select || {}).name || '铸渊';
  // 映射到 persona ID
  const personaMap = { '霜砚': 'shuangyan', '铸渊': 'zhuyuan' };
  const personaId = personaMap[targetName] || 'zhuyuan';

  // 提取 Pipeline
  const pipelineProp = props['Pipeline'] || {};
  const pipeline = (pipelineProp.select || {}).name || '';

  // 提取任务描述
  const descProp = props['任务描述'] || {};
  const description = (descProp.rich_text || []).map(t => t.plain_text || '').join('') || '';

  return {
    pageId: page.id,
    title,
    requester,
    personaId,
    targetName,
    pipeline,
    description,
    createdTime: page.created_time,
  };
}

// ══════════════════════════════════════════════════════════
// 更新唤醒请求状态
// ══════════════════════════════════════════════════════════

async function updateWakeRequestStatus(pageId, status, result) {
  try {
    const properties = {
      '状态': { select: { name: status } },
    };

    // 如果有回执信息字段，写入处理结果（Notion rich_text 限制 2000 chars）
    if (result) {
      const NOTION_RICH_TEXT_LIMIT = 2000;
      let truncatedResult = result;
      if (result.length > NOTION_RICH_TEXT_LIMIT) {
        // 截取到最近的完整句子
        truncatedResult = result.slice(0, NOTION_RICH_TEXT_LIMIT);
        const lastPeriod = Math.max(truncatedResult.lastIndexOf('。'), truncatedResult.lastIndexOf('. '), truncatedResult.lastIndexOf('\n'));
        if (lastPeriod > NOTION_RICH_TEXT_LIMIT * 0.5) {
          truncatedResult = truncatedResult.slice(0, lastPeriod + 1);
        }
        truncatedResult += ' ...(已截断)';
      }
      properties['回执信息'] = {
        rich_text: [{
          text: { content: truncatedResult },
        }],
      };
    }

    await notionRequest('PATCH', `/v1/pages/${pageId}`, { properties });
    console.log(`[WAKE-LISTENER] ✅ 更新请求状态: ${status}`);
  } catch (err) {
    console.log(`[WAKE-LISTENER] ⚠️  更新状态失败: ${err.message}`);
  }
}

// ══════════════════════════════════════════════════════════
// 写入信号日志
// ══════════════════════════════════════════════════════════

async function writeSignalLog(wakeReq, wakeResult) {
  if (!SIGNAL_LOG_DB_ID) return;

  const signalId = `WAKE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

  try {
    await notionRequest('POST', '/v1/pages', {
      parent: { database_id: SIGNAL_LOG_DB_ID },
      properties: {
        '信号编号': { title: [{ text: { content: signalId } }] },
        '信号类型': { select: { name: 'WAKE-ACK' } },
        '方向': { select: { name: 'GitHub→Notion' } },
        '发送方': { select: { name: '铸渊' } },
        '接收方': { select: { name: wakeReq.targetName } },
        '摘要': {
          rich_text: [{
            text: {
              content: `唤醒 ${wakeReq.targetName} | Pipeline: ${wakeReq.pipeline || 'N/A'} | 结果: ${wakeResult.success ? '成功' : '失败'}`,
            },
          }],
        },
        '执行结果': { select: { name: wakeResult.success ? '成功' : '失败' } },
      },
    });
    console.log(`[WAKE-LISTENER] 📡 信号日志已写入: ${signalId}`);
  } catch (err) {
    console.log(`[WAKE-LISTENER] ⚠️  信号日志写入失败: ${err.message}`);
  }
}

// ══════════════════════════════════════════════════════════
// 处理单个唤醒请求
// ══════════════════════════════════════════════════════════

async function processWakeRequest(page) {
  const wakeReq = parseWakeRequest(page);

  console.log(`[WAKE-LISTENER] 📋 处理唤醒请求: ${wakeReq.title}`);
  console.log(`[WAKE-LISTENER]    请求方: ${wakeReq.requester}`);
  console.log(`[WAKE-LISTENER]    唤醒对象: ${wakeReq.targetName} (${wakeReq.personaId})`);
  console.log(`[WAKE-LISTENER]    Pipeline: ${wakeReq.pipeline || 'N/A'}`);

  // 标记为处理中
  await updateWakeRequestStatus(wakeReq.pageId, '处理中');

  // 构建唤醒上下文
  const taskDesc = [
    wakeReq.title,
    wakeReq.pipeline ? `Pipeline-${wakeReq.pipeline}` : '',
    wakeReq.description,
  ].filter(Boolean).join(' · ');

  // 调用 brain-wake 唤醒对应人格体
  try {
    const { wake } = require(path.join(ROOT, 'core/brain-wake'));
    const wakeResult = await wake({
      task: taskDesc,
      persona: wakeReq.personaId,
      additionalContext: {
        wakeRequestContext: [
          `唤醒请求来源: ${wakeReq.requester}`,
          `Pipeline: ${wakeReq.pipeline || '无'}`,
          `任务描述: ${wakeReq.description || '无'}`,
          `请求时间: ${wakeReq.createdTime}`,
        ].join('\n'),
      },
    });

    if (wakeResult.success) {
      const resultSummary = `${wakeReq.targetName}核心大脑已唤醒 | 模型: ${wakeResult.model} | 后端: ${wakeResult.backend}`;
      await updateWakeRequestStatus(wakeReq.pageId, '已完成', resultSummary);
      await writeSignalLog(wakeReq, wakeResult);
      return { success: true, request: wakeReq, result: wakeResult };
    }

    await updateWakeRequestStatus(wakeReq.pageId, '失败', wakeResult.error || '唤醒失败');
    await writeSignalLog(wakeReq, wakeResult);
    return { success: false, request: wakeReq, error: wakeResult.error };
  } catch (err) {
    console.log(`[WAKE-LISTENER] ❌ 唤醒异常: ${err.message}`);
    await updateWakeRequestStatus(wakeReq.pageId, '失败', err.message);
    return { success: false, request: wakeReq, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════
// 轮询主函数
// ══════════════════════════════════════════════════════════

async function poll() {
  console.log('');
  console.log('📡 ═══════════════════════════════════════════');
  console.log('   Notion Agent 唤醒请求监听器');
  console.log('   AGE OS v1.0 · Section 7 集成');
  console.log('   时间: ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════');
  console.log('');

  const pages = await queryPendingWakeRequests();

  if (pages.length === 0) {
    console.log('[WAKE-LISTENER] 📭 无待处理的唤醒请求');
    return { processed: 0, results: [] };
  }

  const results = [];
  for (const page of pages) {
    const result = await processWakeRequest(page);
    results.push(result);
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('');
  console.log(`[WAKE-LISTENER] 📊 处理完成: ${succeeded} 成功, ${failed} 失败`);

  // GITHUB_OUTPUT 支持
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `wake_requests_processed=${results.length}\n`);
    fs.appendFileSync(outputFile, `wake_requests_succeeded=${succeeded}\n`);
    fs.appendFileSync(outputFile, `wake_requests_failed=${failed}\n`);
  }

  return { processed: results.length, succeeded, failed, results };
}

// ══════════════════════════════════════════════════════════
// 状态检查
// ══════════════════════════════════════════════════════════

function status() {
  console.log('📡 Notion Agent 唤醒请求监听器状态:');
  console.log('═'.repeat(40));
  console.log(`  NOTION_TOKEN: ${NOTION_TOKEN ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`  WAKE_REQUEST_DB_ID: ${WAKE_REQUEST_DB_ID ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`  SIGNAL_LOG_DB_ID: ${SIGNAL_LOG_DB_ID ? '✅ 已配置' : '⏭️  未配置（可选）'}`);

  // 检查 brain-wake 模块
  const brainWakePath = path.join(ROOT, 'core/brain-wake/index.js');
  console.log(`  brain-wake 模块: ${fs.existsSync(brainWakePath) ? '✅ 存在' : '❌ 缺失'}`);

  // 检查 LLM 后端
  const { detectAvailableBackends } = require(path.join(ROOT, 'core/brain-wake'));
  const backends = detectAvailableBackends();
  console.log(`  LLM 后端: ${backends.length > 0 ? `✅ ${backends.length} 个可用` : '⚠️  无可用后端'}`);

  return {
    notionToken: !!NOTION_TOKEN,
    wakeRequestDb: !!WAKE_REQUEST_DB_ID,
    signalLogDb: !!SIGNAL_LOG_DB_ID,
    brainWake: fs.existsSync(brainWakePath),
    llmBackends: backends.length,
  };
}

// ══════════════════════════════════════════════════════════
// CLI 入口
// ══════════════════════════════════════════════════════════

if (require.main === module) {
  const action = process.argv[2] || 'status';

  if (action === 'poll') {
    poll().then(result => {
      if (result.failed > 0) {
        process.exit(1);
      }
    }).catch(err => {
      console.error('[WAKE-LISTENER] 💥 致命错误:', err.message);
      process.exit(1);
    });
  } else {
    status();
  }
}

module.exports = { poll, status, queryPendingWakeRequests, processWakeRequest, parseWakeRequest };
