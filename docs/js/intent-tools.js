/**
 * 前端 Function Calling 集成 · 意图工具层
 *
 * 为 AI 模型提供可调用工具列表，实现自然语言 → 系统操作映射。
 * 版权：国作登字-2026-A-00037559
 */

/* global HOLOLAKE_ENV */

(function(window) {
  'use strict';

  var API_BASE = HOLOLAKE_ENV === 'production' ? 'https://guanghulab.com/api' : '';

  /**
   * 从后端获取当前用户可用的工具列表
   */
  async function fetchAvailableTools(devId, token) {
    if (!API_BASE) return [];
    try {
      var res = await fetch(API_BASE + '/tools', {
        headers: {
          'x-dev-id': devId,
          'Authorization': 'Bearer ' + token
        }
      });
      if (res.ok) {
        var data = await res.json();
        return data.tools || [];
      }
    } catch (e) {
      console.debug('[IntentTools] fetch failed:', e.message);
    }
    return [];
  }

  /**
   * 构建带 function tools 的 system prompt 片段
   */
  function buildToolsPrompt(tools, environment) {
    if (!tools || !tools.length) return '';

    var lines = [
      '',
      '## 你能做的事（语言驱动操作系统）',
      '你可以通过 function calling 调用以下操作。开发者说话时，判断意图并调用对应操作。',
      ''
    ];

    for (var i = 0; i < tools.length; i++) {
      var t = tools[i];
      var danger = t.dangerous ? ' ⚠️危险' : '';
      lines.push('- **' + t.name + '**' + danger + '：' + t.description);
    }

    lines.push('');
    lines.push('## 语言驱动操作规则');
    lines.push('1. 开发者说什么，你就做什么。这是语言驱动操作系统，说即执行。');
    lines.push('2. 如果开发者的话不对应任何操作，正常聊天回复即可。');
    lines.push('3. 危险操作（标记为 ⚠️）必须要求开发者二次确认。');
    lines.push('4. 每次执行操作后，用自然语言告诉开发者结果。');

    if (environment === 'preview') {
      lines.push('5. 【预览环境】所有写入操作在沙箱中执行，不影响真实系统。告诉开发者：「这是预览环境，你的操作不会影响正式站。放心练习。」');
    }

    return lines.join('\n');
  }

  /**
   * 执行 function call（调用后端 API）
   */
  async function executeToolCall(toolName, params, devId, token) {
    if (!API_BASE) return { success: false, reply: '后端服务不可用' };

    // 工具名 → API 路径映射
    var toolApiMap = {
      'query_tickets': { method: 'GET', path: '/tickets' },
      'create_ticket': { method: 'POST', path: '/tickets/create' },
      'submit_syslog': { method: 'POST', path: '/syslog/submit' },
      'query_my_status': { method: 'GET', path: '/dev/' + devId },
      'deploy_to_preview': { method: 'POST', path: '/deploy/preview' },
      'deploy_to_production': { method: 'POST', path: '/deploy/production' },
      'query_agents': { method: 'GET', path: '/agents' },
      'query_recent_syslogs': { method: 'GET', path: '/syslogs' },
      'create_broadcast': { method: 'POST', path: '/broadcasts/create' },
      'query_repo_status': { method: 'GET', path: '/repo/status' }
    };

    var apiDef = toolApiMap[toolName];
    if (!apiDef) return { success: false, reply: '未知的操作: ' + toolName };

    try {
      var fetchOpts = {
        method: apiDef.method,
        headers: {
          'Content-Type': 'application/json',
          'x-dev-id': devId,
          'Authorization': 'Bearer ' + token
        }
      };

      if (apiDef.method === 'POST' || apiDef.method === 'PATCH') {
        fetchOpts.body = JSON.stringify(params || {});
      }

      var res = await fetch(API_BASE + apiDef.path, fetchOpts);
      return await res.json();
    } catch (e) {
      return { success: false, reply: '操作失败: ' + e.message };
    }
  }

  // 导出到全局
  window.IntentTools = {
    fetchAvailableTools: fetchAvailableTools,
    buildToolsPrompt: buildToolsPrompt,
    executeToolCall: executeToolCall
  };

})(window);
