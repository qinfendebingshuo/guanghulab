// exe-engine/src/controller/agent-controller.js
// EXE-Engine · Agent 调度器
// 将 Agent 执行链中的 AI 调用从 Copilot 切换到自研引擎
// PRJ-EXE-001 · Phase 0（基础版，P2 实现双轨切换）
// 版权：国作登字-2026-A-00037559

'use strict';

/**
 * Agent 调度器
 *
 * 本体论锚定：调度器 = 笔的手指。
 * 不同的笔尖（Agent）需要不同的墨水（模型），
 * 调度器负责为每个笔尖分配最合适的墨水。
 *
 * 职责：
 *   - 维护 Agent → 模型 的映射表
 *   - 支持 Agent 级别的模型偏好配置
 *   - 执行链断点续接（P2 实现）
 */
class AgentController {
  constructor() {
    // Agent → 模型偏好映射
    this._agentPreferences = new Map();

    // 默认 Agent 偏好
    this._defaultPreference = {
      model: 'auto',
      priority: 'balanced',
      maxTokens: 4096,
      mode: 'pool'  // byok | pool | hybrid
    };
  }

  /**
   * 注册 Agent 的模型偏好
   *
   * @param {string} agentId    Agent ID (如 AG-ZY-01)
   * @param {object} preference 偏好配置
   * @param {string} [preference.model]      首选模型
   * @param {string} [preference.priority]   优先策略
   * @param {number} [preference.maxTokens]  最大 token
   * @param {string} [preference.mode]       接入模式
   */
  registerAgent(agentId, preference = {}) {
    this._agentPreferences.set(agentId, {
      ...this._defaultPreference,
      ...preference
    });
  }

  /**
   * 获取 Agent 的模型偏好
   * @param {string} agentId
   * @returns {object}
   */
  getPreference(agentId) {
    return this._agentPreferences.get(agentId) || { ...this._defaultPreference };
  }

  /**
   * 将 Agent 请求转换为 EXE 标准请求
   *
   * @param {string} agentId     Agent ID
   * @param {object} agentRequest Agent 原始请求
   * @param {string} agentRequest.prompt
   * @param {string} [agentRequest.taskType]
   * @param {object} [agentRequest.context]
   * @returns {object} EXE 标准请求
   */
  buildExeRequest(agentId, agentRequest) {
    const pref = this.getPreference(agentId);

    return {
      agentId,
      taskType: agentRequest.taskType || 'agent_instruction',
      prompt: agentRequest.prompt,
      systemPrompt: agentRequest.systemPrompt || null,
      context: agentRequest.context || {},
      preferences: {
        model: agentRequest.model || pref.model,
        priority: agentRequest.priority || pref.priority,
        maxTokens: agentRequest.maxTokens || pref.maxTokens
      },
      resourcePool: pref.mode === 'byok' ? null : 'default'
    };
  }

  /**
   * 获取所有已注册 Agent 状态
   * @returns {object[]}
   */
  getRegisteredAgents() {
    const agents = [];
    for (const [agentId, pref] of this._agentPreferences) {
      agents.push({ agentId, ...pref });
    }
    return agents;
  }
}

module.exports = AgentController;
