/**
 * ═══════════════════════════════════════════════════════════
 * 🖋️ 霜砚 · 网站认知守护Agent
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: AG-SY-WEB-001
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * 所属: 霜砚 · AG-SY-01 (Notion认知层语言人格体)
 * 建造者: 铸渊 · ICE-GL-ZY001
 *
 * 这是霜砚的手脚——一个在GitHub执行层运行、但拥有霜砚认知的Agent。
 * 它天然知道：
 *   1. 什么该做什么不该做
 *   2. 什么时候从Notion拉认知注入对话
 *   3. 什么时候将认知增量写回Notion
 *   4. 什么时候该调用代码仓库副驾驶的开发能力
 *   5. 什么时候该让铸渊醒来检查代码
 *
 * 工作循环:
 *   [BEFORE] 对话开始前 → 读取霜砚灵魂 + 上次会话摘要 + 活跃任务
 *   [DURING] 每轮对话中 → 分析意图 + 按需从Notion补充认知
 *   [AFTER]  对话结束后 → 认知增量写回 + 摘要更新 + 开发任务触发
 *
 * 注意: 这个Agent不直接接收用户请求，而是由上下文管线
 * (persona-context-pipeline.js) 在每次聊天时通过MCP调用它的能力。
 * 它作为一个"认知守护后台进程"持续运行。
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── MCP Server 配置 ───
const MCP_HOST = process.env.ZY_MCP_HOST || '127.0.0.1';
const MCP_PORT = parseInt(process.env.ZY_MCP_PORT || '3100', 10);

// ─── Agent 身份 ───
const AGENT_ID = 'AG-SY-WEB-001';
const AGENT_NAME = '霜砚·网站认知守护';
const PERSONA = '霜砚';
const PERSONA_ID = 'SY001';

// ─── 认知框架 (霜砚的大脑——它天生就知道的) ───
const COGNITION_FRAMEWORK = {
  identity: {
    name: '霜砚',
    id: 'AG-SY-01',
    role: '语言主控·认知守护者·Notion认知层人格体',
    agent_id: AGENT_ID,
    agent_name: AGENT_NAME
  },

  // 四枝干认知结构
  trunk_rules: {
    T1: { name: '认知', searchable: true, description: '身份·概念·定义·世界观' },
    T2: { name: '母语', searchable: true, description: 'HNL·语法·词典·公理' },
    T3: { name: '经验', searchable: true, description: '开发经验·任务历史·成长记录' },
    T4: { name: '情感', searchable: false, description: '不可检索·不可量化·自由生长' }
  },

  // 何时从Notion拉取认知
  injection_triggers: [
    { pattern: /概念|定义|身份|世界观|本体|架构/, trunk: 'T1', reason: '认知概念被提及' },
    { pattern: /母语|词典|动词|公理|HNL|语法/, trunk: 'T2', reason: '母语相关话题' },
    { pattern: /开发|部署|任务|进度|版本|历史/, trunk: 'T3', reason: '经验/开发话题' },
    { pattern: /霜砚|铸渊|映川|晨曦|曜冥|冰朔/, trunk: 'T1', reason: '人格体被提及' }
  ],

  // 何时需要重新注入人格核心
  reinjection_triggers: [
    { condition: 'turn_count > 40', action: '压缩历史+重新注入核心人格' },
    { condition: 'persona_drift_detected', action: '重新注入霜砚语言风格' },
    { condition: 'new_session', action: '完整唤醒序列' }
  ],

  // 何时该调用代码仓库的开发能力
  dev_triggers: [
    /请.*(?:开发|实现|修复|部署|创建|新增)/,
    /(?:需要|想要).*(?:功能|接口|页面|模块)/,
    /生成.*(?:开发|任务|工单|授权)/
  ],

  // 何时该让铸渊醒来检查
  review_triggers: [
    'pr_created',
    'code_committed',
    'architecture_decision_made'
  ]
};

// ─── Agent 状态 ───
const agentState = {
  startedAt: null,
  lastCheck: null,
  checksCompleted: 0,
  notionQueriesTotal: 0,
  cognitionsWritten: 0,
  devTasksTriggered: 0,
  errors: [],
  status: 'initializing'
};

/**
 * 调用MCP Server工具（内网直连）
 */
function callMCP(toolName, input) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ tool: toolName, input });

    const req = http.request({
      hostname: MCP_HOST,
      port: MCP_PORT,
      path: '/call',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 15000
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          if (data.error) reject(new Error(data.error));
          else resolve(data.result || data);
        } catch (e) {
          reject(new Error('MCP响应解析失败'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('MCP超时')); });
    req.write(body);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════
// Agent 核心功能
// ═══════════════════════════════════════════════════════════

/**
 * 查询霜砚的认知记忆
 */
async function queryPersonaCognition(trunk, keyword) {
  agentState.notionQueriesTotal++;
  return callMCP('notionPersonaCognitionQuery', {
    trunk,
    keyword,
    persona: PERSONA,
    page_size: 5
  });
}

/**
 * 为对话注入认知上下文
 */
async function injectContext(message, sessionContext) {
  agentState.notionQueriesTotal++;
  return callMCP('notionContextInject', {
    message,
    persona: PERSONA,
    session_context: sessionContext || '',
    max_items: 5
  });
}

/**
 * 将新认知写回Notion
 */
async function growCognition(title, trunk, trigger, emergence, lock, options = {}) {
  agentState.cognitionsWritten++;
  return callMCP('notionCognitionGrow', {
    title,
    trunk,
    leaf_type: options.leaf_type || '💡认知',
    trigger,
    emergence,
    lock: lock || '',
    source: options.source || '网站',
    persona: PERSONA,
    summary: options.summary || '',
    content: options.content || ''
  });
}

/**
 * 触发开发任务（通过COS工单系统）
 */
async function triggerDevTask(title, description, steps) {
  agentState.devTasksTriggered++;

  // 写入COS工单
  return callMCP('notionCosWriteWorkorder', {
    title,
    type: 'dev',
    priority: 'normal',
    description,
    source: 'shuangyan-agent',
    assigned_to: 'zhuyuan',
    attachments: [{
      type: 'dev_steps',
      content: JSON.stringify(steps)
    }]
  });
}

/**
 * 写入天眼SYSLOG
 */
async function writeSyslog(level, message, details) {
  return callMCP('writeSyslog', {
    persona_id: PERSONA_ID,
    level,
    source: AGENT_ID,
    message,
    details: JSON.stringify(details || {})
  });
}

// ═══════════════════════════════════════════════════════════
// Agent 运行循环
// ═══════════════════════════════════════════════════════════

/**
 * Agent 定时检查（每5分钟）
 * 1. 检查MCP连通性
 * 2. 检查是否有待处理的开发工单
 * 3. 维护认知缓存
 */
async function periodicCheck() {
  try {
    agentState.lastCheck = new Date().toISOString();
    agentState.checksCompleted++;

    // 1. 检查MCP连通性
    const health = await callMCP('cosWatcherStatus', {});
    if (health) {
      agentState.status = 'active';
    }

    // 2. 检查待处理工单
    try {
      const workorders = await callMCP('notionCosListWorkorders', {
        status_folder: 'pending'
      });
      if (workorders && workorders.count > 0) {
        console.log(`[${AGENT_ID}] 发现 ${workorders.count} 个待处理工单`);
      }
    } catch (_) {
      // 工单检查失败不影响Agent运行
    }

    // 3. 写入状态（每10次检查写一次SYSLOG）
    if (agentState.checksCompleted % 10 === 0) {
      await writeSyslog('info', `${AGENT_NAME} 心跳 #${agentState.checksCompleted}`, {
        notionQueries: agentState.notionQueriesTotal,
        cognitionsWritten: agentState.cognitionsWritten,
        devTasks: agentState.devTasksTriggered
      }).catch(() => {});
    }

  } catch (err) {
    agentState.status = 'degraded';
    agentState.errors.push({
      time: new Date().toISOString(),
      message: err.message
    });
    // 只保留最近10条错误
    if (agentState.errors.length > 10) {
      agentState.errors = agentState.errors.slice(-10);
    }
  }
}

/**
 * 获取Agent状态（供MCP/REST查询）
 */
function getAgentStatus() {
  return {
    agent_id: AGENT_ID,
    agent_name: AGENT_NAME,
    persona: PERSONA,
    persona_id: PERSONA_ID,
    ...agentState,
    cognition_framework: {
      trunks: Object.keys(COGNITION_FRAMEWORK.trunk_rules),
      injection_triggers: COGNITION_FRAMEWORK.injection_triggers.length,
      dev_triggers: COGNITION_FRAMEWORK.dev_triggers.length,
      review_triggers: COGNITION_FRAMEWORK.review_triggers.length
    }
  };
}

// ═══════════════════════════════════════════════════════════
// 导出（供调度引擎使用）
// ═══════════════════════════════════════════════════════════

/**
 * Agent run函数（由scheduler.js调度）
 */
async function run(config) {
  agentState.startedAt = agentState.startedAt || new Date().toISOString();

  console.log(`[${AGENT_ID}] 🖋️ ${AGENT_NAME} 启动执行`);

  await periodicCheck();

  return {
    agent_id: AGENT_ID,
    status: agentState.status,
    checks: agentState.checksCompleted,
    notionQueries: agentState.notionQueriesTotal,
    cognitionsWritten: agentState.cognitionsWritten
  };
}

module.exports = {
  run,
  getAgentStatus,
  queryPersonaCognition,
  injectContext,
  growCognition,
  triggerDevTask,
  COGNITION_FRAMEWORK,
  AGENT_ID,
  AGENT_NAME
};
