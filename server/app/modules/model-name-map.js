/**
 * ═══════════════════════════════════════════════════════════
 * 🗺️ 模型名称映射 · Model Name Registry
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-MODEL-MAP-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 将内部模型ID映射为用户可见的真实模型名称。
 * 解决前端「模型 unknown」的显示问题。
 */

'use strict';

const MODEL_NAME_MAP = {
  // ─── 国内四条官方线路 ───
  'ds':            'DeepSeek-V3',
  'deepseek-chat': 'DeepSeek-V3',
  'deepseek-reasoner': 'DeepSeek-R1',

  'qw':          '通义千问 Turbo',
  'qwen-turbo':  '通义千问 Turbo',
  'qwen-plus':   '通义千问 Plus',
  'qwen-max':    '通义千问 Max',

  'km':              'Kimi (Moonshot)',
  'moonshot-v1-8k':  'Kimi (Moonshot-8K)',
  'moonshot-v1-32k': 'Kimi (Moonshot-32K)',
  'moonshot-v1-128k': 'Kimi (Moonshot-128K)',

  'zp':           '智谱清言 GLM-4',
  'glm-4-flash':  '智谱清言 GLM-4-Flash',
  'glm-4':        '智谱清言 GLM-4',
  'glm-4-plus':   '智谱清言 GLM-4-Plus',

  // ─── 通用聊天引擎模型 ───
  'gpt-4o':         'GPT-4o',
  'gpt-4o-mini':    'GPT-4o-mini',
  'claude-3-haiku-20240307': 'Claude 3 Haiku',
  'claude-3-sonnet': 'Claude 3 Sonnet',

  // ─── 特殊标记 ───
  'offline':  '本地离线应答',
  'fallback': '降级回复',
  'none':     '未配置',
  'unknown':  '检测中'
};

/**
 * 解析模型ID为用户可见的显示名称
 * @param {string} modelId - 内部模型ID或模型名
 * @returns {string} 用户可见的模型名称
 */
function resolveModelName(modelId) {
  if (!modelId) return '检测中';
  return MODEL_NAME_MAP[modelId] || modelId;
}

/**
 * 获取完整的模型名称映射表（供前端使用）
 */
function getModelNameMap() {
  return { ...MODEL_NAME_MAP };
}

module.exports = {
  MODEL_NAME_MAP,
  resolveModelName,
  getModelNameMap
};
