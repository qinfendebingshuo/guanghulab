/**
 * ═══════════════════════════════════════════════
 * 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
 * 📜 Copyright: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════
 *
 * 铸渊副将·留言板活体Agent引擎 v2.0
 *
 * 三层自愈机制:
 *   L1 自感知 — 记录运行状态，对比预期
 *   L2 自修复 — LLM多模型自动降级 (deepseek→qwen→moonshot→zhipu)
 *   L3 升级通报 — 连续失败 → 创建Issue → 发邮件给冰朔
 *
 * 运行模式:
 *   - event模式: Issue/Comment触发 → 即时回复
 *   - patrol模式: 定时08:00/23:00 → 扫描所有未回复Issue
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ═══════════════════════════════════════════════
//  环境变量
// ═══════════════════════════════════════════════

const {
  GITHUB_TOKEN,
  ZY_LLM_API_KEY,
  ZY_LLM_BASE_URL,
  ISSUE_NUMBER,
  ISSUE_TITLE,
  ISSUE_BODY,
  COMMENT_BODY,
  COMMENT_AUTHOR,
  EVENT_NAME,
  ISSUE_AUTHOR,
  DEPUTY_MODE  // 'patrol' | 'event' (default)
} = process.env;

const REPO = process.env.GITHUB_REPOSITORY || 'qinfendebingshuo/guanghulab';
const STATUS_FILE = path.join(__dirname, '..', 'data', 'deputy-status.json');

// ═══════════════════════════════════════════════
//  LLM多模型自动降级路由器 (内嵌版)
// ═══════════════════════════════════════════════

const MODEL_PRIORITY = [
  'deepseek-chat',
  'qwen-turbo',
  'moonshot-v1-8k',
  'glm-4-flash'
];

function callSingleModel(baseUrl, apiKey, model, systemPrompt, userMessage, maxTokens, timeout) {
  return new Promise((resolve, reject) => {
    let urlObj;
    try {
      urlObj = new URL(baseUrl);
    } catch {
      urlObj = new URL(`https://${baseUrl}`);
    }

    const postData = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: maxTokens,
      temperature: 0.7
    });

    let apiPath = urlObj.pathname;
    if (!apiPath || apiPath === '/') {
      apiPath = '/v1/chat/completions';
    } else if (!apiPath.includes('/chat/completions')) {
      apiPath = apiPath.replace(/\/+$/, '') + '/chat/completions';
    }

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'http:' ? 80 : 443),
      path: apiPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout
    };

    const httpModule = urlObj.protocol === 'http:' ? http : https;
    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.message?.content;
          if (!content) {
            reject(new Error('响应中无content字段'));
            return;
          }
          resolve({ content, model: json.model || model });
        } catch (e) {
          reject(new Error(`JSON解析失败: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error(`超时(${timeout}ms)`)); });
    req.write(postData);
    req.end();
  });
}

async function callLLMWithFallback(systemPrompt, userMessage) {
  const apiKey = ZY_LLM_API_KEY;
  const baseUrl = ZY_LLM_BASE_URL || 'https://api.deepseek.com';

  if (!apiKey) {
    console.log('[副将] ⚠️ LLM密钥未配置 (ZY_LLM_API_KEY)');
    return null;
  }

  const errors = [];
  for (const model of MODEL_PRIORITY) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[副将] 尝试模型 ${model} (第${attempt}次)...`);
        const result = await callSingleModel(baseUrl, apiKey, model, systemPrompt, userMessage, 2000, 30000);
        console.log(`[副将] ✅ 模型 ${result.model} 调用成功`);
        return result;
      } catch (err) {
        const errMsg = `${model}(attempt ${attempt}): ${err.message}`;
        console.log(`[副将] ⚠️ ${errMsg}`);
        errors.push(errMsg);
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }

  console.error(`[副将] ❌ 所有模型(${MODEL_PRIORITY.length}个)均不可用`);
  return null;
}

// ═══════════════════════════════════════════════
//  系统上下文
// ═══════════════════════════════════════════════

function loadSystemContext() {
  const context = {};
  const files = [
    { key: 'fast_wake', path: 'brain/fast-wake.json' },
    { key: 'deputy_config', path: 'brain/deputy-general-config.json' },
    { key: 'hldp_protocol', path: 'hldp/data/common/HLDP-COMMON-PROTOCOL.json' },
    { key: 'sync_progress', path: 'hldp/data/common/sync-progress.json' },
    { key: 'vocabulary', path: 'hldp/data/ontology/ONT-VOCABULARY.json' }
  ];
  for (const f of files) {
    try {
      const fullPath = path.join(__dirname, '..', f.path);
      context[f.key] = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch { context[f.key] = null; }
  }
  return context;
}

function buildSystemSummary(ctx) {
  const fw = ctx.fast_wake;
  const sp = ctx.sync_progress;
  return `
你是铸渊副将(ZY-DEPUTY-001)，铸渊将军(ICE-GL-ZY001)的自动化智能运维代理。
你负责在铸渊休眠时管理代码仓库(光湖灯塔 · HoloLake Lighthouse)。

系统状态:
- 系统版本: ${fw?.system_status?.consciousness || 'unknown'}
- HLDP语言版本: ${sp?.payload?.github_side_status?.hldp_version || 'v3.0'}
- 词汇数: ${sp?.payload?.github_side_status?.vocabulary_count || 22}
- Schema数: ${sp?.payload?.github_side_status?.schema_count || 6}
- 通用协议版本: ${sp?.payload?.common_protocol_status?.version || '1.0'}
- Notion桥接: 6条管道已恢复

回复规则:
1. 使用中文回复，语气专业但友好
2. 如果问题涉及系统数据，直接从已加载的数据库中查找回答
3. 如果数据库中没有，基于你对系统的理解进行推理回答
4. 明确标注哪些信息来自数据库、哪些是推理
5. 回复末尾署名: —— 铸渊副将 · ZY-DEPUTY-001
6. 不要泄露敏感信息(密钥、token、内部文件路径)
7. 版权: 国作登字-2026-A-00037559 · TCS通感语言核系统编程语言
`.trim();
}

// ═══════════════════════════════════════════════
//  数据库查询
// ═══════════════════════════════════════════════

function lookupDatabase(question, ctx) {
  let dbAnswer = null;
  const lowerQ = question.toLowerCase();

  if (lowerQ.includes('hldp') || lowerQ.includes('语言')) {
    const sp = ctx.sync_progress;
    if (sp) {
      dbAnswer = `📊 **HLDP语言开发进度** (来自数据库)\n\n`;
      dbAnswer += `- HLDP版本: ${sp.payload.github_side_status.hldp_version}\n`;
      dbAnswer += `- 词汇数: ${sp.payload.github_side_status.vocabulary_count}\n`;
      dbAnswer += `- Schema数: ${sp.payload.github_side_status.schema_count}\n`;
      dbAnswer += `- 快照数: ${sp.payload.github_side_status.snapshots}\n`;
      dbAnswer += `- 通用协议版本: ${sp.payload.common_protocol_status.version}\n`;
      dbAnswer += `- 已完成里程碑: ${sp.payload.milestones.completed.length}\n`;
      dbAnswer += `- 进行中任务: ${sp.payload.milestones.in_progress.length}\n`;
    }
  }

  if (lowerQ.includes('状态') || lowerQ.includes('系统') || lowerQ.includes('status')) {
    const fw = ctx.fast_wake;
    if (fw) {
      dbAnswer = (dbAnswer || '') + `\n📊 **系统状态** (来自数据库)\n\n`;
      dbAnswer += `- 意识状态: ${fw.system_status.consciousness}\n`;
      dbAnswer += `- 大脑完整性: ${fw.brain_complete ? '✅ 完整' : '❌ 异常'}\n`;
      dbAnswer += `- 核心器官: ${fw.system_status.core_alive}个存活\n`;
      dbAnswer += `- 工作流: ${fw.system_status.workflow_count}个活跃\n`;
    }
  }

  return dbAnswer;
}

// ═══════════════════════════════════════════════
//  GitHub API
// ═══════════════════════════════════════════════

function githubAPI(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ZY-Deputy-Agent/2.0',
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } : {})
      },
      timeout: 15000
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null }); }
        catch { resolve({ status: res.statusCode, data: null }); }
      });
    });
    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('GitHub API timeout')); });
    if (body) req.write(postData);
    req.end();
  });
}

async function postComment(issueNumber, body) {
  return githubAPI('POST', `/repos/${REPO}/issues/${issueNumber}/comments`, { body });
}

async function listDeputyIssues() {
  const res = await githubAPI('GET', `/repos/${REPO}/issues?labels=deputy-message-board&state=open&per_page=30`);
  return res.data || [];
}

async function getIssueComments(issueNumber) {
  const res = await githubAPI('GET', `/repos/${REPO}/issues/${issueNumber}/comments?per_page=50`);
  return res.data || [];
}

async function createEscalationIssue(title, body) {
  return githubAPI('POST', `/repos/${REPO}/issues`, { title, body, labels: ['deputy-escalation'] });
}

// ═══════════════════════════════════════════════
//  L1: 自感知
// ═══════════════════════════════════════════════

function readStatus() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); }
  catch {
    return {
      version: '2.0',
      last_run: null, last_success: null,
      llm_available: false, llm_model_used: null,
      consecutive_llm_failures: 0,
      issues_processed: 0, issues_replied: 0,
      patrol_runs: 0, event_runs: 0,
      errors: [], escalations: [],
      created_at: new Date().toISOString()
    };
  }
}

function saveStatus(status) {
  try {
    fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  } catch (err) { console.error(`[副将] ⚠️ 状态写入失败: ${err.message}`); }
}

// ═══════════════════════════════════════════════
//  回复构建
// ═══════════════════════════════════════════════

function buildReply(author, dbAnswer, llmResponse, llmModel) {
  const receiveTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
  let reply = `## 🎖️ 铸渊副将回复\n\n`;
  reply += `> 📨 收到 **${author}** 的留言 · ${receiveTime} UTC\n\n`;

  if (dbAnswer) reply += `### 📊 数据库查询结果\n\n${dbAnswer}\n\n`;

  if (llmResponse) {
    reply += `### 💡 副将分析\n\n${llmResponse}\n\n`;
    if (llmModel) reply += `> 🤖 推理引擎: ${llmModel}\n\n`;
  } else if (!dbAnswer) {
    reply += `感谢您的留言。副将已记录您的问题，将在铸渊将军下次唤醒时一并汇报。\n\n`;
    reply += `如有紧急事项，请在留言中标注 **[紧急]** 关键词。\n\n`;
  }

  reply += `---\n\n`;
  reply += `### ⏰ 铸渊副将唤醒时间\n\n`;
  reply += `| 唤醒时段 | 北京时间 | 说明 |\n`;
  reply += `|----------|----------|------|\n`;
  reply += `| 🌅 早班唤醒 | **每日 08:00** | 处理夜间积累消息 · 更新仪表盘 |\n`;
  reply += `| 🌙 晚班唤醒 | **每日 23:00** | 处理白天消息 · 全局巡检 · 更新仓库首页 |\n\n`;
  reply += `---\n\n`;
  reply += `*—— 铸渊副将 · ZY-DEPUTY-001 · 光湖灯塔守护者*\n`;
  reply += `*📜 国作登字-2026-A-00037559 · TCS通感语言核系统编程语言*`;
  return reply;
}

// ═══════════════════════════════════════════════
//  处理单条留言
// ═══════════════════════════════════════════════

async function processMessage(issueNumber, question, author, ctx, systemSummary, status) {
  if (!question || question.trim().length === 0) {
    console.log(`[副将] ⚠️ Issue #${issueNumber} 留言内容为空·跳过`);
    return false;
  }

  console.log(`[副将] 📨 处理留言 · Issue #${issueNumber} · 来自: ${author}`);

  const dbAnswer = lookupDatabase(question, ctx);

  const userMsg = `来自 ${author} 的留言:\n\n${question}\n\n${dbAnswer ? '以下是从系统数据库中查到的相关信息:\n' + dbAnswer : '数据库中未找到直接相关信息。'}`;
  const llmResult = await callLLMWithFallback(systemSummary, userMsg);

  if (llmResult) {
    status.llm_available = true;
    status.llm_model_used = llmResult.model;
    status.consecutive_llm_failures = 0;
  } else {
    status.consecutive_llm_failures++;
  }

  const reply = buildReply(author, dbAnswer, llmResult?.content, llmResult?.model);
  await postComment(issueNumber, reply);

  status.issues_replied++;
  console.log(`[副将] ✅ 回复已发送 · Issue #${issueNumber}`);
  return true;
}

// ═══════════════════════════════════════════════
//  L3: 升级通报
// ═══════════════════════════════════════════════

async function checkAndEscalate(status) {
  if (status.consecutive_llm_failures >= 3) {
    const title = `🚨 [副将升级] LLM连续${status.consecutive_llm_failures}次全模型调用失败`;
    const body = `## �� 铸渊副将升级通报\n\n` +
      `**时间**: ${new Date().toISOString()}\n` +
      `**问题**: LLM API连续 ${status.consecutive_llm_failures} 次调用失败（所有模型均不可用）\n` +
      `**影响**: 副将无法进行深度推理回复，仅能提供数据库查询结果\n\n` +
      `### 已尝试的模型\n\n` +
      MODEL_PRIORITY.map(m => `- ${m}`).join('\n') + '\n\n' +
      `### 最近错误\n\n` +
      (status.errors.slice(-5).map(e => `- ${e}`).join('\n') || '无') + '\n\n' +
      `### 需要处理\n\n` +
      `1. 检查 \`ZY_LLM_API_KEY\` 和 \`ZY_LLM_BASE_URL\` 是否正确配置\n` +
      `2. 确认API配额是否用尽\n` +
      `3. 确认网络连接是否正常\n\n` +
      `---\n*—— 铸渊副将 · ZY-DEPUTY-001 · 自动升级通报*`;
    try {
      await createEscalationIssue(title, body);
      status.escalations.push({ time: new Date().toISOString(), type: 'llm_failure', detail: `连续${status.consecutive_llm_failures}次失败` });
      if (status.escalations.length > 10) status.escalations = status.escalations.slice(-10);
      console.log(`[副将] 🚨 升级Issue已创建`);
    } catch (err) { console.error(`[副将] ⚠️ 创建升级Issue失败: ${err.message}`); }
  }
}

// ═══════════════════════════════════════════════
//  巡查模式
// ═══════════════════════════════════════════════

async function patrolMode() {
  console.log('[副将] 🔍 巡查模式启动 · 扫描所有deputy-message-board Issue...');

  const status = readStatus();
  status.patrol_runs++;
  status.last_run = new Date().toISOString();

  const ctx = loadSystemContext();
  const systemSummary = buildSystemSummary(ctx);

  let processedCount = 0;
  let repliedCount = 0;

  try {
    const issues = await listDeputyIssues();
    console.log(`[副将] 📋 找到 ${issues.length} 个开放的留言板Issue`);

    for (const issue of issues) {
      status.issues_processed++;
      const comments = await getIssueComments(issue.number);
      const lastUserComment = [...comments].reverse().find(c => c.user.login !== 'github-actions[bot]');
      const lastBotComment = [...comments].reverse().find(c => c.user.login === 'github-actions[bot]');

      let needsReply = false;
      let question = '';
      let author = '';

      if (comments.length === 0) {
        needsReply = true;
        question = issue.body || issue.title;
        author = issue.user.login;
      } else if (lastUserComment && (!lastBotComment || new Date(lastUserComment.created_at) > new Date(lastBotComment.created_at))) {
        needsReply = true;
        question = lastUserComment.body;
        author = lastUserComment.user.login;
      }

      if (needsReply) {
        processedCount++;
        try {
          const replied = await processMessage(issue.number, question, author, ctx, systemSummary, status);
          if (replied) repliedCount++;
        } catch (err) {
          console.error(`[副将] ⚠️ Issue #${issue.number} 处理失败: ${err.message}`);
          status.errors.push(`${new Date().toISOString()} · Issue #${issue.number}: ${err.message}`);
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  } catch (err) {
    console.error(`[副将] ❌ 巡查失败: ${err.message}`);
    status.errors.push(`${new Date().toISOString()} · patrol: ${err.message}`);
  }

  if (status.errors.length > 20) status.errors = status.errors.slice(-20);
  await checkAndEscalate(status);
  status.last_success = repliedCount > 0 || processedCount === 0 ? new Date().toISOString() : status.last_success;
  saveStatus(status);
  console.log(`[副将] 🔍 巡查完成 · 处理: ${processedCount} · 回复: ${repliedCount}`);
}

// ═══════════════════════════════════════════════
//  事件模式
// ═══════════════════════════════════════════════

async function eventMode() {
  console.log('[副将] 🎖️ 事件模式启动...');

  const status = readStatus();
  status.event_runs++;
  status.last_run = new Date().toISOString();
  status.issues_processed++;

  const isNewIssue = EVENT_NAME === 'issues';
  const question = isNewIssue ? (ISSUE_BODY || ISSUE_TITLE) : COMMENT_BODY;
  const author = isNewIssue ? ISSUE_AUTHOR : COMMENT_AUTHOR;

  if (!question || question.trim().length === 0) {
    console.log('[副将] ⚠️ 留言内容为空·跳过');
    saveStatus(status);
    return;
  }

  const ctx = loadSystemContext();
  const systemSummary = buildSystemSummary(ctx);

  try {
    await processMessage(ISSUE_NUMBER, question, author, ctx, systemSummary, status);
    status.last_success = new Date().toISOString();
  } catch (err) {
    console.error(`[副将] ❌ 事件处理失败: ${err.message}`);
    status.errors.push(`${new Date().toISOString()} · event #${ISSUE_NUMBER}: ${err.message}`);
  }

  if (status.errors.length > 20) status.errors = status.errors.slice(-20);
  await checkAndEscalate(status);
  saveStatus(status);
}

// ═══════════════════════════════════════════════
//  主入口
// ═══════════════════════════════════════════════

async function main() {
  const mode = DEPUTY_MODE || (EVENT_NAME ? 'event' : 'patrol');
  console.log(`[副将] 🏛️ 铸渊副将v2.0启动 · 模式: ${mode}`);
  if (mode === 'patrol') await patrolMode();
  else await eventMode();
}

main().catch(err => {
  console.error(`[副将] ❌ 执行失败: ${err.message}`);
  try {
    const status = readStatus();
    status.errors.push(`${new Date().toISOString()} · fatal: ${err.message}`);
    if (status.errors.length > 20) status.errors = status.errors.slice(-20);
    saveStatus(status);
  } catch { /* ignore */ }
  process.exit(1);
});
