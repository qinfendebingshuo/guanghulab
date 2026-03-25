/**
 * 意图路由中间件 · 自然语言 → 操作映射
 *
 * 核心逻辑：
 * 1. 接收模型输出的 function_call
 * 2. 验证权限
 * 3. 调用对应的后端 API
 * 4. 返回结果
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var tools = require('../config/function-tools.json');

/**
 * 意图路由核心
 *
 * @param {Object} functionCall - { name, parameters }
 * @param {Object} user - 当前用户信息（含 permissions, environment, modules）
 * @param {Function} apiClient - API 调用函数 (method, path, body) => result
 * @returns {Object} 执行结果
 */
async function routeIntent(functionCall, user, apiClient) {
  var tool = null;
  for (var i = 0; i < tools.tools.length; i++) {
    if (tools.tools[i].name === functionCall.name) {
      tool = tools.tools[i];
      break;
    }
  }

  if (!tool) {
    return {
      success: false,
      reply: '❓ 我不认识这个操作：' + functionCall.name + '。你可以问我能做什么。'
    };
  }

  // 权限检查
  if (!user.permissions.includes(tool.permission)) {
    return {
      success: false,
      reply: '🔒 你没有执行「' + tool.description + '」的权限。当前权限等级：' + user.permissionLabel
    };
  }

  // 危险操作二次确认
  if (tool.dangerous && !functionCall.parameters.confirmToken) {
    return {
      success: false,
      requireConfirmation: true,
      reply: '⚠️ 这是一个**危险操作**。请说「确认执行」来确认。'
    };
  }

  // 预览环境检查
  if (user.environment === 'preview' && tool.permission.includes('production')) {
    return {
      success: false,
      reply: '🔒 你目前在**预览环境**，不能执行正式站操作。在预览站充分练习后，由冰朔开放正式站权限。'
    };
  }

  // 解析 API 路径
  var apiDef = tool.api.split(' ');
  var method = apiDef[0];
  var path = apiDef[1];

  // 替换路径中的变量
  path = path.replace('{devId}', user.devId);
  var params = functionCall.parameters || {};
  for (var key in params) {
    path = path.replace('{' + key + '}', encodeURIComponent(params[key]));
  }

  // 调用 API
  try {
    var result = await apiClient(method, path, Object.assign({}, params, { devId: user.devId }));
    return result;
  } catch (e) {
    return {
      success: false,
      reply: '❌ 操作失败：' + e.message
    };
  }
}

/**
 * 获取用户可用的工具列表（已根据权限过滤）
 */
function getAvailableTools(user) {
  return tools.tools.filter(function(tool) {
    return user.permissions.includes(tool.permission);
  });
}

/**
 * 获取全部工具定义
 */
function getAllTools() {
  return tools.tools;
}

module.exports = {
  routeIntent: routeIntent,
  getAvailableTools: getAvailableTools,
  getAllTools: getAllTools
};
