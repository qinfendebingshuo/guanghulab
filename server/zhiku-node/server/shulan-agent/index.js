/**
 * ═══════════════════════════════════════════════════════════
 * 书岚 Agent 系统 · 主入口
 * AG-SL-WEB-001 · 光湖智库守藏者
 * ═══════════════════════════════════════════════════════════
 *
 * 三体结构：
 *   书岚（人格体）    — 与用户对话
 *   守护（守护代理）  — 监视对话·注入提示词
 *   工具包（技能注册表）— 视觉化回复工具
 *
 * 版权：国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const { assembleShulanPrompt, shulanFallbackReply } = require('./shulan-prompt');
const guardian = require('./prompt-guardian');
const { getToolkitDescription } = require('./chat-toolkit');

// 冰朔邮箱列表（用于识别妈妈）
const SOVEREIGN_EMAILS = [
  // 在生产环境中通过环境变量或配置文件加载
];

/**
 * 判断用户角色
 * @param {string} userEmail - 用户邮箱
 * @param {object} memory - 用户Agent记忆
 * @returns {string} sovereign / regular / guest
 */
function detectUserRole(userEmail, memory) {
  if (!userEmail) return 'guest';

  // 环境变量中的主权邮箱
  const sovereignEmail = process.env.ZY_SOVEREIGN_EMAIL || '';
  if (sovereignEmail && userEmail === sovereignEmail) return 'sovereign';
  if (SOVEREIGN_EMAILS.includes(userEmail)) return 'sovereign';

  // 有历史对话记录的是常客
  if (memory && memory.conversation_history && memory.conversation_history.length > 0) {
    return 'regular';
  }

  return 'guest';
}

/**
 * 构建完整的书岚系统提示词
 * 整合：四层人格 + 守护Agent动态补注 + 工具包描述
 *
 * @param {object} opts
 * @param {string} opts.userEmail
 * @param {object} opts.memory - Agent记忆
 * @param {string} opts.userMessage - 用户当前消息
 * @param {number} opts.booksCount - 书库数量
 * @param {number} opts.lastReplyScore - 上一轮回复质量分
 * @returns {string} 完整的系统提示词
 */
function buildSystemPrompt(opts) {
  const {
    userEmail,
    memory,
    userMessage,
    booksCount = 0,
    lastReplyScore = 100
  } = opts;

  const userRole = detectUserRole(userEmail, memory);
  const userName = memory?.preferences?.name || '';

  // 1. 守护Agent分析对话 · 决定是否需要补注
  const guardianDecision = guardian.analyzeConversation(userMessage, {
    historyLength: memory?.conversation_history?.length || 0,
    lastReplyScore,
    userRole
  });

  // 2. 获取守护Agent学习到的纠正
  const learnedCorrections = guardian.getLearnedCorrections();
  let guardianNote = guardianDecision.guardianNote || '';
  if (learnedCorrections) {
    guardianNote += '\n' + learnedCorrections;
  }

  // 3. 组装四层人格提示词
  const shulanPrompt = assembleShulanPrompt({
    booksCount,
    userRole,
    userName,
    userPrefs: memory?.preferences || {},
    pg_connected: false,
    guardianNote: guardianNote.trim()
  });

  // 4. 附加工具包描述
  const toolkitDesc = getToolkitDescription();

  return shulanPrompt + '\n\n' + toolkitDesc;
}

/**
 * 回复后审计 · 委托守护Agent
 */
function postReplyAudit(reply, userMessage) {
  return guardian.auditReply(reply, userMessage);
}

/**
 * 获取系统状态
 */
function getSystemStatus() {
  return {
    persona: {
      name: '书岚',
      code: 'AG-SL-WEB-001 / PER-SL001',
      status: 'active',
      version: '1.0.0'
    },
    guardian: guardian.getStatus(),
    toolkit: {
      id: 'AG-SL-TOOLKIT-001',
      version: '1.0.0',
      active: true
    }
  };
}

module.exports = {
  buildSystemPrompt,
  postReplyAudit,
  shulanFallbackReply,
  detectUserRole,
  getSystemStatus
};
