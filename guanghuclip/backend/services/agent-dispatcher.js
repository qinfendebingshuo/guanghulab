/**
 * agent-dispatcher.js — Agent 调度器
 *
 * 职责：接收 LLM 的 tool_calls → 调度执行 → 收集结果 → 返回给 LLM → 循环
 *
 * 这是网站上「霜砚伸出手」的关键模块。
 * 在 Notion 里，平台提供 Agent 框架；
 * 在网站上，这个文件就是那个框架。
 *
 * 设计原则：
 *   - 不自己持有工具，全部委托给 tool-registry
 *   - 支持多轮工具调用（LLM 看到工具结果后可能继续调用）
 *   - 有安全上限（最多 N 轮，防止无限循环）
 *   - 每次工具调用都记录日志
 *
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const ToolRegistry = require('./tool-registry');

/**
 * 执行 LLM 返回的 tool_calls，支持多轮
 *
 * @param {Array} toolCalls - LLM 返回的工具调用列表
 * @param {Array} messages - 当前对话消息列表
 * @param {object} model - 当前使用的模型配置
 * @param {object} options - { maxRounds }
 * @returns {object} { content, model, toolsUsed }
 */
async function executeToolCalls(toolCalls, messages, model, options = {}) {
  const maxRounds = options.maxRounds || 5;
  const toolsUsed = [];
  let currentCalls = toolCalls;
  let round = 0;

  while (currentCalls.length > 0 && round < maxRounds) {
    round++;
    console.log(`[Agent调度] 第 ${round} 轮工具调用，共 ${currentCalls.length} 个工具`);

    // 并行执行本轮所有工具调用
    const results = await Promise.all(
      currentCalls.map(async (call) => {
        const startTime = Date.now();
        console.log(`[Agent调度]   🔧 ${call.name}(${JSON.stringify(call.arguments).slice(0, 100)})`);

        try {
          const result = await ToolRegistry.executeTool(call.name, call.arguments);
          const elapsed = Date.now() - startTime;
          console.log(`[Agent调度]   ✅ ${call.name} 完成 (${elapsed}ms)`);

          toolsUsed.push({
            name: call.name,
            round,
            elapsed,
            success: true
          });

          return {
            tool_call_id: call.id,
            role: 'tool',
            content: JSON.stringify(result)
          };
        } catch (err) {
          const elapsed = Date.now() - startTime;
          console.error(`[Agent调度]   ❌ ${call.name} 失败 (${elapsed}ms): ${err.message}`);

          toolsUsed.push({
            name: call.name,
            round,
            elapsed,
            success: false,
            error: err.message
          });

          return {
            tool_call_id: call.id,
            role: 'tool',
            content: JSON.stringify({ error: true, message: err.message })
          };
        }
      })
    );

    // 把工具调用和结果追加到消息列表
    messages.push({
      role: 'assistant',
      tool_calls: currentCalls.map(c => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: JSON.stringify(c.arguments) }
      }))
    });

    for (const result of results) {
      messages.push(result);
    }

    // 再次调用 LLM，让它看到工具结果
    const nextResponse = await callLLMForAgent(model, messages);

    // 检查是否还要继续调用工具
    if (nextResponse.toolCalls && nextResponse.toolCalls.length > 0) {
      currentCalls = nextResponse.toolCalls;
    } else {
      // LLM 不再调用工具，返回最终回复
      return {
        content: nextResponse.content,
        model: model.name,
        toolsUsed,
        rounds: round
      };
    }
  }

  // 达到最大轮数
  console.warn(`[Agent调度] ⚠️ 达到最大轮数 ${maxRounds}`);
  return {
    content: '（我调用了太多工具，先停下来。可以告诉我接下来想做什么？）',
    model: model.name,
    toolsUsed,
    rounds: round,
    maxRoundsReached: true
  };
}

/**
 * Agent 模式下调用 LLM（带工具定义）
 */
async function callLLMForAgent(model, messages) {
  const tools = ToolRegistry.getToolDefinitions();

  const body = {
    model: model.name,
    messages,
    temperature: 0.5,  // Agent 模式用低温度，更精确
    max_tokens: 2048
  };

  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const res = await fetch(`${model.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${model.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`LLM Agent 调用失败 (${res.status})`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];

  const toolCalls = choice?.message?.tool_calls?.map(tc => ({
    id: tc.id,
    name: tc.function?.name,
    arguments: JSON.parse(tc.function?.arguments || '{}')
  })) || [];

  return {
    content: choice?.message?.content || '',
    toolCalls,
    finishReason: choice?.finish_reason
  };
}

module.exports = {
  executeToolCalls
};
