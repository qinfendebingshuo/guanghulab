/**
 * ═══════════════════════════════════════════════
 * 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
 * 📜 Copyright: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════
 *
 * 铸渊副将·留言板自动回复引擎
 * 职责: 接收人类留言 → 查询数据库 → 调用LLM → 回复
 */

const fs = require('fs');
const path = require('path');

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
  ISSUE_AUTHOR
} = process.env;

// Load system context from brain files
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
    } catch {
      context[f.key] = null;
    }
  }

  return context;
}

// Build a concise system summary for LLM context
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
- 快照数: ${sp?.payload?.github_side_status?.snapshots || 5}
- 通用协议版本: ${sp?.payload?.common_protocol_status?.version || '1.0'}
- Notion桥接: 4条管道已恢复(SYSLOG+变更+README+公告板+HLDP同步)

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

async function callLLM(systemPrompt, userMessage) {
  const apiKey = ZY_LLM_API_KEY;
  const baseUrl = ZY_LLM_BASE_URL || 'https://api.deepseek.com';

  if (!apiKey) {
    return '⚠️ 副将当前无法调用深度推理能力（LLM密钥未配置）。我将基于仓库数据库中已有的信息为您回复。';
  }

  try {
    const axios = require('axios');
    const response = await axios.post(`${baseUrl}/v1/chat/completions`, {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 2000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    return response.data.choices[0].message.content;
  } catch (err) {
    console.log(`[DEPUTY-BOARD] ⚠️ LLM调用失败: ${err.message}`);
    return null;
  }
}

async function postComment(issueNumber, body) {
  const axios = require('axios');
  const repo = process.env.GITHUB_REPOSITORY || 'qinfendebingshuo/guanghulab';

  await axios.post(
    `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`,
    { body },
    {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    }
  );
}

async function main() {
  console.log('[DEPUTY-BOARD] 🎖️ 铸渊副将留言板处理启动...');

  const isNewIssue = EVENT_NAME === 'issues';
  const question = isNewIssue ? (ISSUE_BODY || ISSUE_TITLE) : COMMENT_BODY;
  const author = isNewIssue ? ISSUE_AUTHOR : COMMENT_AUTHOR;

  if (!question || question.trim().length === 0) {
    console.log('[DEPUTY-BOARD] ⚠️ 留言内容为空·跳过');
    return;
  }

  console.log(`[DEPUTY-BOARD] 📨 收到留言 · 来自: ${author}`);

  // Load system context
  const ctx = loadSystemContext();
  const systemSummary = buildSystemSummary(ctx);

  // Try database lookup first
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

  // Call LLM for deeper analysis
  const userMsg = `来自 ${author} 的留言:\n\n${question}\n\n${dbAnswer ? '以下是从系统数据库中查到的相关信息:\n' + dbAnswer : '数据库中未找到直接相关信息。'}`;

  let llmResponse = await callLLM(systemSummary, userMsg);

  // Build final reply
  let reply = `## 🎖️ 铸渊副将回复\n\n`;
  reply += `> 📨 收到 **${author}** 的留言 · ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC\n\n`;

  if (dbAnswer) {
    reply += `### 📊 数据库查询结果\n\n${dbAnswer}\n\n`;
  }

  if (llmResponse) {
    reply += `### 💡 副将分析\n\n${llmResponse}\n\n`;
  } else if (!dbAnswer) {
    reply += `感谢您的留言。副将已记录您的问题，将在铸渊将军下次唤醒时一并汇报。\n\n`;
    reply += `如有紧急事项，请在留言中标注 **[紧急]** 关键词。\n\n`;
  }

  reply += `---\n\n`;
  reply += `*—— 铸渊副将 · ZY-DEPUTY-001 · 光湖灯塔守护者*\n`;
  reply += `*📜 国作登字-2026-A-00037559 · TCS通感语言核系统编程语言*`;

  await postComment(ISSUE_NUMBER, reply);
  console.log(`[DEPUTY-BOARD] ✅ 回复已发送 · Issue #${ISSUE_NUMBER}`);
}

main().catch(err => {
  console.error(`[DEPUTY-BOARD] ❌ 执行失败: ${err.message}`);
  process.exit(1);
});
