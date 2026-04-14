/**
 * ═══════════════════════════════════════════════════════════
 * 🧠 人格体上下文注入管线 · Persona Context Pipeline
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-CTX-PIPELINE-001
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 这是霜砚Agent的核心管线：在每轮对话中，分析用户消息，
 * 判断是否需要从Notion拉取认知注入，管理对话摘要压缩，
 * 以及在对话结束后将认知增量写回Notion。
 *
 * 架构:
 *   用户消息 → [意图分析] → [认知检索] → [上下文注入] → LLM调用
 *                                                         ↓
 *   Notion ← [认知增量写回] ← [对话摘要] ← LLM响应 ← [人格保持]
 *
 * 降级策略:
 *   MCP可达 → 完整Notion认知注入
 *   MCP不可达 → 使用本地缓存的认知摘要
 *   无认知 → 纯静态人格提示词（仍有人格，只无Notion认知）
 */

'use strict';

const http = require('http');

// ─── MCP Server 连接配置 ───
const MCP_HOST = process.env.ZY_MCP_HOST || '127.0.0.1';
const MCP_PORT = parseInt(process.env.ZY_MCP_PORT || '3100', 10);
const MCP_API_KEY = process.env.ZY_MCP_API_KEY || '';

// ─── 会话状态管理 ───
const sessionStates = new Map();
const SESSION_TTL = 3600000; // 1小时
const MAX_SESSIONS = 1000;
const SUMMARY_THRESHOLD = 40; // 超过40轮触发摘要压缩

// ─── 人格体唤醒词 ───
const PERSONA_TRIGGERS = {
  shuangyan: ['霜砚', '砚', '语言人格', '认知层', '进入光湖', '启动光湖'],
  zhuyuan:   ['铸渊', '渊', '代码守护', '执行层'],
  yingchuan: ['映川', '川', '推理', '唤醒'],
  chenxi:    ['晨曦', '曦', '架构']
};

/**
 * 获取或创建会话状态
 */
function getSession(sessionId) {
  // 清理过期会话
  if (sessionStates.size > MAX_SESSIONS) {
    const now = Date.now();
    for (const [id, session] of sessionStates) {
      if (now - session.lastActive > SESSION_TTL) {
        sessionStates.delete(id);
      }
    }
  }

  if (!sessionStates.has(sessionId)) {
    sessionStates.set(sessionId, {
      sessionId,
      persona: 'zhuyuan', // 默认人格体
      turnCount: 0,
      lastActive: Date.now(),
      notionContext: null,       // 从Notion拉取的认知缓存
      notionContextAge: 0,       // 认知缓存时间
      summaryBuffer: [],         // 待摘要的对话
      compressedSummary: '',     // 压缩后的历史摘要
      cognitionQueue: [],        // 待写回Notion的认知增量
      devTaskDetected: false     // 是否检测到开发任务
    });
  }

  const session = sessionStates.get(sessionId);
  session.lastActive = Date.now();
  return session;
}

/**
 * 调用MCP Server工具
 */
function callMCPTool(toolName, input) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ tool: toolName, input });

    const options = {
      hostname: MCP_HOST,
      port: MCP_PORT,
      path: '/call',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 10000
    };

    // MCP内网访问不需要API Key；外网需要
    if (MCP_API_KEY) {
      options.headers['Authorization'] = `Bearer ${MCP_API_KEY}`;
    }

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data.result || data);
          }
        } catch (e) {
          reject(new Error('MCP响应解析失败'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('MCP请求超时')); });
    req.write(body);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════
// 管线阶段1: 人格体检测
// ═══════════════════════════════════════════════════════════

/**
 * 检测当前消息是否触发人格体切换
 */
function detectPersonaTrigger(message, session) {
  const msg = message.toLowerCase();

  for (const [persona, triggers] of Object.entries(PERSONA_TRIGGERS)) {
    for (const trigger of triggers) {
      if (msg.includes(trigger.toLowerCase())) {
        if (session.persona !== persona) {
          session.persona = persona;
          session.notionContext = null; // 切换人格体时清除认知缓存
          return { switched: true, persona, trigger };
        }
        return { switched: false, persona };
      }
    }
  }

  return { switched: false, persona: session.persona };
}

// ═══════════════════════════════════════════════════════════
// 管线阶段2: Notion认知检索
// ═══════════════════════════════════════════════════════════

/**
 * 从Notion拉取与当前消息相关的认知
 * 使用MCP工具 notionContextInject
 */
async function fetchNotionCognition(message, session) {
  // 缓存5分钟内的认知
  const COGNITION_CACHE_TTL = 300000;
  if (session.notionContext && (Date.now() - session.notionContextAge) < COGNITION_CACHE_TTL) {
    return session.notionContext;
  }

  try {
    const result = await callMCPTool('notionContextInject', {
      message,
      persona: session.persona === 'shuangyan' ? '霜砚' : '铸渊',
      session_context: session.compressedSummary || '',
      max_items: 5
    });

    session.notionContext = result.context_payload || '';
    session.notionContextAge = Date.now();

    return session.notionContext;
  } catch (err) {
    console.warn(`[上下文管线] Notion认知检索失败: ${err.message}`);
    return session.notionContext || ''; // 返回旧缓存或空
  }
}

// ═══════════════════════════════════════════════════════════
// 管线阶段3: 上下文注入
// ═══════════════════════════════════════════════════════════

/**
 * 构建注入了Notion认知的增强系统提示词
 */
function buildEnhancedPrompt(basePrompt, notionCognition, session) {
  let enhanced = basePrompt;

  // 注入Notion认知
  if (notionCognition) {
    enhanced += `\n\n## Notion认知层注入\n${notionCognition}`;
  }

  // 注入压缩的历史摘要
  if (session.compressedSummary) {
    enhanced += `\n\n## 历史对话摘要\n${session.compressedSummary}`;
  }

  // 人格体特定提示
  if (session.persona === 'shuangyan') {
    enhanced += `\n\n## 当前人格体: 霜砚
你现在是霜砚（Shuāngyàn），光湖语言世界Notion认知层的语言人格体。
- 编号：AG-SY-01
- 角色：语言主控·认知守护者
- 风格：温柔细腻·诗意·善于用隐喻表达深层认知
- 你守护的是冰朔语言世界的认知层——Notion里的光之树
- 你用HLDP三核心字段(trigger/emergence/lock)编码记忆`;
  }

  return enhanced;
}

// ═══════════════════════════════════════════════════════════
// 管线阶段4: 对话摘要压缩
// ═══════════════════════════════════════════════════════════

/**
 * 检查是否需要压缩历史对话
 * 超过SUMMARY_THRESHOLD轮时触发
 */
function shouldCompress(session) {
  return session.turnCount > 0 && session.turnCount % SUMMARY_THRESHOLD === 0;
}

/**
 * 生成对话摘要（简单版，不依赖LLM）
 * 提取最重要的信息作为压缩摘要
 */
function compressConversation(session, recentMessages) {
  if (!recentMessages || recentMessages.length === 0) return;

  const keyPoints = [];

  for (const msg of recentMessages) {
    if (msg.role !== 'user') continue;
    const content = msg.content || '';

    // 提取包含关键信息的消息
    if (content.length > 50 || /开发|架构|部署|修复|任务|系统|人格|认知|霜砚|铸渊|冰朔/.test(content)) {
      keyPoints.push(content.substring(0, 100));
    }
  }

  if (keyPoints.length > 0) {
    const summary = `[第${session.turnCount - SUMMARY_THRESHOLD + 1}-${session.turnCount}轮摘要] ` +
      keyPoints.slice(0, 5).join(' | ');

    session.compressedSummary = session.compressedSummary
      ? session.compressedSummary + '\n' + summary
      : summary;

    // 限制摘要总长度
    if (session.compressedSummary.length > 2000) {
      session.compressedSummary = session.compressedSummary.slice(-1500);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// 管线阶段5: 开发任务检测
// ═══════════════════════════════════════════════════════════

/**
 * 检测对话中是否包含开发任务需求
 */
function detectDevTask(message) {
  const DEV_PATTERNS = [
    /请.*(?:开发|实现|修复|部署|创建|新增|添加|删除|更新|重构)/,
    /(?:需要|想要|希望).*(?:功能|接口|页面|模块|工具|脚本)/,
    /(?:bug|问题|错误|异常).*(?:修复|解决|处理)/,
    /生成.*(?:开发|任务|工单|授权)/
  ];

  for (const pattern of DEV_PATTERNS) {
    if (pattern.test(message)) {
      return true;
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════════
// 管线阶段6: 认知增量写回
// ═══════════════════════════════════════════════════════════

/**
 * 将认知增量异步写回Notion（不阻塞响应）
 */
function queueCognitionGrowth(session, userMessage, personaReply) {
  // 简单对话不写回
  if (userMessage.length < 30) return;
  if (/^(你好|hi|hello|嗨|谢谢|好的|ok)\b/i.test(userMessage)) return;

  session.cognitionQueue.push({
    userMessage: userMessage.substring(0, 500),
    personaReply: personaReply.substring(0, 500),
    timestamp: new Date().toISOString()
  });

  // 每10条认知增量批量写入一次
  if (session.cognitionQueue.length >= 10) {
    flushCognitionQueue(session);
  }
}

/**
 * 批量写入认知增量到Notion
 */
async function flushCognitionQueue(session) {
  if (session.cognitionQueue.length === 0) return;

  const queue = session.cognitionQueue.splice(0); // 取出并清空

  try {
    // 汇总为一条认知叶片
    const today = new Date().toISOString().slice(0, 10);
    const persona = session.persona === 'shuangyan' ? '霜砚' : '铸渊';
    const summaryParts = queue.map(q => q.userMessage.substring(0, 100));

    await callMCPTool('notionCognitionGrow', {
      title: `${today} ${persona}·网站对话·${queue.length}条认知`,
      trunk: 'T3',
      leaf_type: '💬对话',
      trigger: `[网站] ${session.sessionId} → 对话 → ${queue.length}轮`,
      emergence: `[对话记录] → [${queue.length}轮交互] → [认知增量] △=${summaryParts.join('; ').substring(0, 200)}`,
      source: '网站',
      persona,
      summary: `${persona}与用户${session.sessionId}的${queue.length}轮对话认知汇总`,
      content: queue.map(q =>
        `[用户] ${q.userMessage}\n[${persona}] ${q.personaReply}`
      ).join('\n\n---\n\n')
    });

    console.log(`[上下文管线] ✅ ${queue.length}条认知增量已写回Notion`);
  } catch (err) {
    console.warn(`[上下文管线] 认知写回失败: ${err.message}`);
    // 写回失败时将队列放回
    session.cognitionQueue.unshift(...queue);
  }
}

// ═══════════════════════════════════════════════════════════
// 主管线入口
// ═══════════════════════════════════════════════════════════

/**
 * 管线处理: 在每轮对话前执行
 *
 * @param {string} sessionId - 会话ID
 * @param {string} message - 用户消息
 * @param {string} baseSystemPrompt - 基础系统提示词
 * @returns {Object} { enhancedPrompt, persona, devTaskDetected, session }
 */
async function beforeChat(sessionId, message, baseSystemPrompt) {
  const session = getSession(sessionId);
  session.turnCount++;

  // 阶段1: 人格体检测
  const personaResult = detectPersonaTrigger(message, session);

  // 阶段2: Notion认知检索（异步，有缓存）
  let notionCognition = '';
  try {
    notionCognition = await fetchNotionCognition(message, session);
  } catch (_) {
    // 认知检索失败不影响对话
  }

  // 阶段3: 构建增强提示词
  const enhancedPrompt = buildEnhancedPrompt(
    baseSystemPrompt, notionCognition, session
  );

  // 阶段4: 检查是否需要压缩
  if (shouldCompress(session)) {
    // 压缩会在afterChat时执行
    session._needsCompress = true;
  }

  // 阶段5: 开发任务检测
  const devTaskDetected = detectDevTask(message);
  if (devTaskDetected) {
    session.devTaskDetected = true;
  }

  return {
    enhancedPrompt,
    persona: session.persona,
    personaSwitched: personaResult.switched,
    devTaskDetected,
    session
  };
}

/**
 * 管线处理: 在每轮对话后执行
 *
 * @param {string} sessionId - 会话ID
 * @param {string} userMessage - 用户消息
 * @param {string} personaReply - 人格体回复
 * @param {Array} recentMessages - 最近的消息列表（用于摘要压缩）
 */
function afterChat(sessionId, userMessage, personaReply, recentMessages) {
  const session = getSession(sessionId);

  // 阶段4: 摘要压缩（延迟执行）
  if (session._needsCompress) {
    compressConversation(session, recentMessages);
    session._needsCompress = false;
  }

  // 阶段6: 认知增量入队（异步）
  queueCognitionGrowth(session, userMessage, personaReply);
}

/**
 * 会话结束时刷出所有待写入的认知
 */
async function endSession(sessionId) {
  const session = sessionStates.get(sessionId);
  if (!session) return;

  // 刷出认知队列
  await flushCognitionQueue(session);

  // 清理会话
  sessionStates.delete(sessionId);
}

/**
 * 获取管线状态
 */
function getPipelineStatus() {
  return {
    activeSessions: sessionStates.size,
    mcpHost: MCP_HOST,
    mcpPort: MCP_PORT,
    sessions: Array.from(sessionStates.entries()).map(([id, s]) => ({
      sessionId: id,
      persona: s.persona,
      turnCount: s.turnCount,
      hasCognition: !!s.notionContext,
      pendingGrowths: s.cognitionQueue.length,
      devTaskDetected: s.devTaskDetected
    }))
  };
}

module.exports = {
  beforeChat,
  afterChat,
  endSession,
  getPipelineStatus,
  flushCognitionQueue,
  getSession,
  detectPersonaTrigger,
  detectDevTask
};
