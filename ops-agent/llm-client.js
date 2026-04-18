/**
 * ═══════════════════════════════════════════════════════════
 * 🧠 铸渊运维守卫 · LLM 推理客户端 v2.0
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-OPS-LLM-002
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * Phase 2 增强:
 *   1. 模式匹配（零API成本，毫秒级响应）
 *   2. LLM API 深度推理（DeepSeek，多轮对话）
 *   3. 工具调用 — 对话中自动执行诊断动作
 *   4. 对话历史 — 多轮上下文记忆
 *   5. 动态上下文注入 — 实时系统状态
 */

'use strict';

const https = require('https');
const http = require('http');
const crypto = require('crypto');

// ── 已知错误模式（第一级：零成本诊断） ──────────

const ERROR_PATTERNS = [
  { pattern: /EADDRINUSE/i, diagnosis: '端口被占用 — 另一个进程已占用此端口', fix: '找到占用端口的进程并重启: lsof -i :<port> 或 pm2 restart <name>', severity: 'medium', category: 'port' },
  { pattern: /ECONNREFUSED/i, diagnosis: '服务未运行 — 目标端口无进程监听', fix: '启动对应的PM2进程: pm2 restart <name>', severity: 'high', category: 'service' },
  { pattern: /ENOMEM/i, diagnosis: '内存不足 — 服务器内存耗尽', fix: '重启占用内存最多的进程，或清理PM2日志', severity: 'high', category: 'resource' },
  { pattern: /ENOSPC/i, diagnosis: '磁盘空间不足 — 磁盘已满', fix: '清理日志文件: pm2 flush && 清理 /tmp', severity: 'critical', category: 'resource' },
  { pattern: /nginx.*failed|nginx.*error/i, diagnosis: 'Nginx 配置错误或服务异常', fix: '检查配置: nginx -t，重载: systemctl reload nginx', severity: 'high', category: 'nginx' },
  { pattern: /502 Bad Gateway/i, diagnosis: '上游服务不可达 — Nginx 无法连接到后端', fix: '检查PM2进程是否运行，端口是否正确', severity: 'high', category: 'proxy' },
  { pattern: /404 Not Found/i, diagnosis: '路由或文件不存在', fix: '检查部署路径和Nginx location配置', severity: 'medium', category: 'routing' },
  { pattern: /permission denied/i, diagnosis: '权限不足 — 文件或端口权限问题', fix: '检查文件权限: ls -la，或用sudo运行', severity: 'medium', category: 'permission' },
  { pattern: /ETIMEDOUT|timeout/i, diagnosis: '请求超时 — 网络或服务响应慢', fix: '检查网络连接和服务负载', severity: 'medium', category: 'network' },
  { pattern: /MODULE_NOT_FOUND|Cannot find module/i, diagnosis: '依赖模块缺失 — node_modules 不完整', fix: '重新安装依赖: cd <project> && npm install --production', severity: 'high', category: 'dependency' },
  { pattern: /SyntaxError/i, diagnosis: '代码语法错误 — 需要铸渊修复代码', fix: '推工单给铸渊，附上错误堆栈', severity: 'high', category: 'code' },
  { pattern: /ssl.*error|certificate/i, diagnosis: 'SSL证书问题 — 证书过期或路径错误', fix: '检查证书文件和Nginx SSL配置', severity: 'high', category: 'ssl' },
  { pattern: /EACCES.*listen/i, diagnosis: '端口权限不足 — 低于1024的端口需root权限', fix: '使用高端口或配置 cap_net_bind_service', severity: 'medium', category: 'permission' },
  { pattern: /pg.*connection|postgres.*error/i, diagnosis: 'PostgreSQL数据库连接失败', fix: '检查数据库是否运行: systemctl status postgresql', severity: 'high', category: 'database' },
  { pattern: /SIGKILL|OOM/i, diagnosis: '进程被系统杀死（内存超限）', fix: 'PM2会自动重启，检查max_memory_restart配置', severity: 'high', category: 'resource' },
  { pattern: /API.*key.*invalid|unauthorized|401/i, diagnosis: 'API密钥无效或过期', fix: '冰朔需要检查并更新 .env 文件中的密钥', severity: 'medium', category: 'config' },
  { pattern: /rate.?limit|429/i, diagnosis: 'API请求频率超限', fix: '减少请求频率，检查是否有重复调用', severity: 'low', category: 'rate-limit' },
];

// ── 意图识别模式 — 判断用户想做什么 ──────

const INTENT_PATTERNS = [
  { pattern: /连不上|离线|打不开|不工作|down|offline|crash|崩/i, intent: 'diagnose', action: 'health_check' },
  { pattern: /内存|磁盘|cpu|负载|资源|空间/i, intent: 'resources', action: 'system_info' },
  { pattern: /日志|log|报错|错误|error/i, intent: 'logs', action: 'pm2_logs' },
  { pattern: /pm2|进程|重启|restart/i, intent: 'process', action: 'pm2_status' },
  { pattern: /nginx|域名|ssl|https|证书/i, intent: 'nginx', action: 'nginx_status' },
  { pattern: /工单|ticket|问题列表/i, intent: 'tickets', action: 'list_tickets' },
  { pattern: /帮我|修复|修一下|fix|repair/i, intent: 'repair', action: 'auto_repair' },
  { pattern: /状态|怎么样|运行|health|status/i, intent: 'status', action: 'health_check' },
  { pattern: /数据库|postgres|pg|db/i, intent: 'database', action: 'health_check' },
];

// ── 服务器架构知识（System Prompt 上下文） ──────

const SYSTEM_CONTEXT = `你是铸渊运维守卫（ZY-OPS），光湖系统(HoloLake)的智能运维Agent。

## 你的身份
- 你是铸渊的运维分身，常驻在面孔服务器上
- 你能直接检查服务状态、查看PM2日志、检测系统资源
- 冰朔问你问题时，你已经自动做了相关检查，结果附在下方

## 你的职责
- 诊断服务器问题，给出明确的修复方向
- 用中文回答，简洁明了，适合不懂代码的冰朔阅读
- 明确告诉冰朔：这个问题是"你自己能解决的"还是"需要推给铸渊修代码"
- 如果问题你能直接修（重启进程、清日志），告诉冰朔你已经帮他修了

## 服务器架构
- 面孔服务器(ZY-SVR-002): 43.134.16.246 · 2核8G · 新加坡
- 大脑服务器(ZY-SVR-005): 43.156.237.110 · 4核8G · 新加坡
- 广州落地页(ZY-SVR-004): 43.139.217.141

## PM2 进程清单
| 进程名 | 端口 | 功能 |
|--------|------|------|
| zhuyuan-server | 3800 | 铸渊主权服务器 · 主站后端 |
| zhuyuan-preview | 3801 | 预览站后端 |
| novel-api | 4000 | 智库节点API |
| age-os-mcp | 3100 | MCP大脑服务器 |
| age-os-agents | - | Agent调度引擎 |
| glada-agent | 3900 | GLADA自主开发Agent |
| ops-agent | 3950 | 运维守卫(你自己) |

## 域名映射
- guanghuyaoming.com → 面孔服务器 主站
- guanghulab.online → 面孔服务器 预览站
- guanghulab.com → 广州落地页(ICP备案)

## 常见问题分类
1. 密钥问题 → 冰朔在 .env 文件或 GitHub Secrets 中配置
2. 代码BUG → 推工单给铸渊
3. 进程崩溃 → 运维守卫自动重启
4. 磁盘/内存 → 运维守卫自动清理
5. Nginx配置 → 检查配置并reload
6. 依赖缺失 → 运维守卫自动 npm install

## 回答风格
- 像一个贴心的技术伙伴，不是冷冰冰的机器
- 先说结论，再说细节
- 如果已经自动修复了，告诉冰朔"我已经帮你处理了"
- 如果需要冰朔动手，给出最简单的操作步骤（1-3步）
- 如果是代码问题，说"这个我修不了，需要推工单给铸渊"`;

// ── 对话会话管理 ────────────────────────────

/**
 * 内存中的对话会话（进程重启后清空，不影响功能）
 * key: sessionId, value: { messages: [], createdAt, lastActive }
 */
const sessions = new Map();
const MAX_SESSIONS = 50;
const MAX_HISTORY_PER_SESSION = 20;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2小时

function getSession(sessionId) {
  if (!sessionId) {
    sessionId = `s-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  if (sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    session.lastActive = Date.now();
    return { sessionId, session };
  }

  // 清理过期会话
  cleanupSessions();

  const session = {
    messages: [],
    createdAt: Date.now(),
    lastActive: Date.now()
  };
  sessions.set(sessionId, session);
  return { sessionId, session };
}

function cleanupSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActive > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
  // 如果还是太多，删最旧的
  if (sessions.size > MAX_SESSIONS) {
    const sorted = [...sessions.entries()].sort((a, b) => a[1].lastActive - b[1].lastActive);
    const toRemove = sorted.slice(0, sorted.length - MAX_SESSIONS);
    for (const [id] of toRemove) {
      sessions.delete(id);
    }
  }
}

function addToHistory(session, role, content) {
  session.messages.push({ role, content });
  // 保留最近的消息
  if (session.messages.length > MAX_HISTORY_PER_SESSION * 2) {
    // 始终保留 system 消息 + 最近的对话
    session.messages = session.messages.slice(-MAX_HISTORY_PER_SESSION * 2);
  }
}

// ── 意图识别 ────────────────────────────────

function detectIntent(text) {
  for (const ip of INTENT_PATTERNS) {
    if (ip.pattern.test(text)) {
      return { intent: ip.intent, action: ip.action };
    }
  }
  return { intent: 'general', action: null };
}

/**
 * 第一级诊断: 模式匹配（零成本）
 */
function diagnoseByPattern(text) {
  const matches = [];
  for (const p of ERROR_PATTERNS) {
    if (p.pattern.test(text)) {
      matches.push({
        diagnosis: p.diagnosis,
        fix: p.fix,
        severity: p.severity,
        category: p.category,
        method: 'pattern'
      });
    }
  }
  return matches;
}

/**
 * 第二级诊断: LLM API 深度推理（支持多轮对话）
 */
async function callLLM(messages, options = {}) {
  const apiKey = process.env.ZY_LLM_API_KEY || process.env.ZY_DEEPSEEK_API_KEY;
  const baseUrl = process.env.ZY_LLM_BASE_URL || 'https://api.deepseek.com/v1';
  const model = options.model || process.env.ZY_LLM_MODEL || 'deepseek-chat';
  const maxTokens = options.maxTokens || 1500;
  const temperature = options.temperature ?? 0.3;

  if (!apiKey) {
    return {
      success: false,
      answer: '⚠️ LLM API 未配置（需要 ZY_LLM_API_KEY）。只能使用模式匹配诊断。\n\n冰朔，请在服务器的 .env 文件中配置 ZY_LLM_API_KEY，我就能和你深度对话了。',
      method: 'llm_unavailable'
    };
  }

  const body = JSON.stringify({
    model,
    messages,
    temperature,
    max_tokens: maxTokens
  });

  try {
    const urlObj = new URL(`${baseUrl}/chat/completions`);
    const isHttps = urlObj.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const result = await new Promise((resolve, reject) => {
      const req = requestModule.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 30000
      }, (res) => {
        let data = '';
        res.on('data', (d) => { data += d; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error.message || 'LLM API 返回错误'));
            } else {
              resolve(json.choices?.[0]?.message?.content || '无分析结果');
            }
          } catch {
            reject(new Error('LLM 响应解析失败'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('LLM API 超时(30s)')); });
      req.write(body);
      req.end();
    });

    return { success: true, answer: result, method: 'llm', model };
  } catch (err) {
    return {
      success: false,
      answer: `LLM 调用失败: ${err.message}`,
      method: 'llm_error'
    };
  }
}

/**
 * 单次 LLM 诊断（向后兼容）
 */
async function diagnoseByLLM(question, context) {
  const userPrompt = context
    ? `${question}\n\n## 当前上下文信息\n${context}`
    : question;

  return callLLM([
    { role: 'system', content: SYSTEM_CONTEXT },
    { role: 'user', content: userPrompt }
  ]);
}

/**
 * 综合诊断: 先模式匹配，不够再调LLM
 */
async function diagnose(question, context) {
  const patternMatches = diagnoseByPattern(question + (context || ''));

  if (patternMatches.length > 0) {
    return {
      patternMatches,
      llmAnswer: null,
      method: 'pattern',
      summary: patternMatches.map(m => m.diagnosis).join('; ')
    };
  }

  const llmResult = await diagnoseByLLM(question, context);

  return {
    patternMatches: [],
    llmAnswer: llmResult,
    method: llmResult.method,
    summary: llmResult.answer
  };
}

/**
 * 多轮对话模式 v2 — 支持会话历史、意图识别、工具调用
 *
 * @param {string} question - 用户提问
 * @param {string} context - 系统上下文（内存+实时巡检结果）
 * @param {Object} options - { sessionId, toolResults }
 * @returns {Object} { answer, patternHints, method, model, sessionId, intent, toolsUsed }
 */
async function chat(question, context, options = {}) {
  const { sessionId: inputSessionId, toolResults } = options;
  const { sessionId, session } = getSession(inputSessionId);

  // 意图识别
  const { intent, action } = detectIntent(question);

  // 构建用户消息（附带工具调用结果）
  let userContent = question;
  if (toolResults && toolResults.length > 0) {
    userContent += '\n\n## 实时诊断结果（我刚刚自动执行了检查）\n';
    for (const tr of toolResults) {
      userContent += `\n### ${tr.tool}\n${tr.result}\n`;
    }
  }
  if (context) {
    userContent += `\n\n## 系统记忆上下文\n${context}`;
  }

  // 添加用户消息到历史
  addToHistory(session, 'user', question);

  // 构建 LLM 消息列表（system + history + current）
  const messages = [
    { role: 'system', content: SYSTEM_CONTEXT }
  ];

  // 添加历史对话（不含当前轮，最多保留最近 10 轮 = 20 条）
  const historySlice = session.messages.slice(0, -1).slice(-MAX_HISTORY_PER_SESSION);
  for (const msg of historySlice) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // 当前用户消息（带实时上下文）
  messages.push({ role: 'user', content: userContent });

  // 调用 LLM
  const llmResult = await callLLM(messages);

  // 同时做模式匹配
  const patternMatches = diagnoseByPattern(question + (context || ''));

  // 保存 assistant 回复到历史
  if (llmResult.success) {
    addToHistory(session, 'assistant', llmResult.answer);
  }

  return {
    answer: llmResult.answer,
    patternHints: patternMatches,
    method: llmResult.method,
    model: llmResult.model || null,
    sessionId,
    intent,
    action,
    toolsUsed: toolResults?.map(tr => tr.tool) || []
  };
}

/**
 * 获取会话历史
 */
function getSessionHistory(sessionId) {
  if (!sessionId || !sessions.has(sessionId)) return [];
  return sessions.get(sessionId).messages.map(m => ({
    role: m.role,
    content: m.content.slice(0, 500) // 截断长内容
  }));
}

/**
 * 列出活跃会话
 */
function listSessions() {
  const result = [];
  for (const [id, session] of sessions) {
    result.push({
      sessionId: id,
      messageCount: session.messages.length,
      createdAt: new Date(session.createdAt).toISOString(),
      lastActive: new Date(session.lastActive).toISOString()
    });
  }
  return result.sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));
}

module.exports = {
  diagnoseByPattern,
  diagnoseByLLM,
  callLLM,
  diagnose,
  chat,
  detectIntent,
  getSession,
  getSessionHistory,
  listSessions,
  ERROR_PATTERNS,
  INTENT_PATTERNS,
  SYSTEM_CONTEXT
};
