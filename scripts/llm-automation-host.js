#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// scripts/llm-automation-host.js
// 🤖 LLM 自动化托管引擎
//
// 使用仓库密钥中的第三方模型API密钥来运行自动化任务
// 替代直接消耗 GitHub Copilot 配额
// 支持动态模型路由：根据任务类型自动选择最佳模型
//
// 用法：
//   --status           显示可用模型和系统状态
//   --task "任务描述"   执行自动化任务
//   --task-type TYPE    任务类型 (inspection/fusion/review/general)
//   --model MODEL       指定模型 (auto/anthropic/openai/dashscope/deepseek/custom)
//   --dry-run           仅显示选择的模型和请求，不实际调用
//   --context FILE      加载额外上下文文件

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── 模型后端配置
// SY-CMD-KEY-012: 统一使用 ZY_LLM_API_KEY + ZY_LLM_BASE_URL
// 三方API密钥支持多模型动态路由，铸渊根据任务类型自动选择最优模型
const MODEL_BACKENDS = [
  {
    name: 'deepseek',
    model: 'deepseek-chat',
    format: 'openai',
    strengths: ['reasoning', 'code', 'cost-effective'],
    costTier: 'low',
    description: 'DeepSeek 系列 · 高性价比推理'
  },
  {
    name: 'deepseek-reasoner',
    model: 'deepseek-reasoner',
    format: 'openai',
    strengths: ['reasoning', 'architecture', 'long-context'],
    costTier: 'medium',
    description: 'DeepSeek Reasoner · 深度推理'
  },
  {
    name: 'claude-sonnet',
    model: 'claude-sonnet-4-20250514',
    format: 'openai',
    strengths: ['reasoning', 'code-review', 'architecture', 'long-context'],
    costTier: 'high',
    description: 'Claude Sonnet · 强推理代码审查'
  },
  {
    name: 'gpt-4o',
    model: 'gpt-4o',
    format: 'openai',
    strengths: ['general', 'code-generation', 'structured-output'],
    costTier: 'high',
    description: 'GPT-4o · 通用能力'
  },
  {
    name: 'qwen-plus',
    model: 'qwen-plus',
    format: 'openai',
    strengths: ['chinese', 'general', 'cost-effective'],
    costTier: 'medium',
    description: '通义千问 Plus · 中文优化'
  },
  {
    name: 'qwen-turbo',
    model: 'qwen-turbo',
    format: 'openai',
    strengths: ['chinese', 'general', 'cost-effective'],
    costTier: 'low',
    description: '通义千问 Turbo · 快速低成本'
  }
];

// ── 任务类型 → 模型强项映射（动态路由策略）
const TASK_MODEL_ROUTING = {
  // 巡检任务：优先使用性价比高的模型
  'inspection': {
    preferred_strengths: ['general', 'cost-effective'],
    preferred_cost: 'low',
    description: '系统巡检 · 优先性价比'
  },
  // 融合分析：需要强推理能力
  'fusion': {
    preferred_strengths: ['reasoning', 'code-review'],
    preferred_cost: 'medium',
    description: '碎片融合分析 · 需要推理能力'
  },
  // 代码审查：需要强代码理解
  'review': {
    preferred_strengths: ['code-review', 'reasoning'],
    preferred_cost: 'high',
    description: '代码审查 · 需要深度理解'
  },
  // 架构设计：需要最强推理
  'architecture': {
    preferred_strengths: ['reasoning', 'architecture', 'long-context'],
    preferred_cost: 'high',
    description: '架构设计 · 需要最强推理'
  },
  // 通用任务
  'general': {
    preferred_strengths: ['general'],
    preferred_cost: 'medium',
    description: '通用任务'
  }
};

// ── HTTP 请求工具 ────────────────────────────────
function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'POST',
      headers: options.headers || {},
      timeout: options.timeout || 120000,
    };

    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// ── 检测可用模型后端 ────────────────────────────
// SY-CMD-KEY-012: 统一使用 ZY_LLM_API_KEY + ZY_LLM_BASE_URL
// 兼容旧环境变量名（LLM_API_KEY/LLM_BASE_URL）用于脚本过渡
function detectAvailableBackends() {
  const apiKey = process.env.ZY_LLM_API_KEY || process.env.LLM_API_KEY || '';
  const baseUrl = (process.env.ZY_LLM_BASE_URL || process.env.LLM_BASE_URL || '').replace(/\/+$/, '');

  // 过渡期警告：使用旧环境变量名
  if (!process.env.ZY_LLM_API_KEY && process.env.LLM_API_KEY) {
    console.warn('⚠️ 使用旧环境变量 LLM_API_KEY，请迁移到 ZY_LLM_API_KEY');
  }
  if (!process.env.ZY_LLM_BASE_URL && process.env.LLM_BASE_URL) {
    console.warn('⚠️ 使用旧环境变量 LLM_BASE_URL，请迁移到 ZY_LLM_BASE_URL');
  }

  if (!apiKey || !baseUrl) {
    return [];
  }

  // 所有模型后端共享同一个API密钥和端点
  return MODEL_BACKENDS.map(backend => ({
    ...backend,
    apiKey,
    baseUrl
  }));
}

// ── 动态模型路由 ────────────────────────────────
function selectModel(taskType, preferredBackend) {
  const available = detectAvailableBackends();

  if (available.length === 0) {
    return { error: '未检测到 LLM API 密钥，请配置 ZY_LLM_API_KEY 和 ZY_LLM_BASE_URL' };
  }

  // 如果指定了后端
  if (preferredBackend && preferredBackend !== 'auto') {
    const match = available.find(b => b.name === preferredBackend || b.model === preferredBackend);
    if (match) {
      return { backend: match, model: match.model, reason: '用户指定' };
    }
    // 如果直接指定了模型名，使用第一个后端配置但覆盖模型名
    return { backend: { ...available[0], model: preferredBackend }, model: preferredBackend, reason: '用户指定模型名' };
  }

  // 动态路由
  const routing = TASK_MODEL_ROUTING[taskType] || TASK_MODEL_ROUTING['general'];

  // 评分系统：根据任务类型的偏好对每个后端打分
  let bestScore = -1;
  let bestBackend = null;

  for (const backend of available) {
    let score = 0;

    // 强项匹配得分
    for (const strength of routing.preferred_strengths) {
      if (backend.strengths.includes(strength)) {
        score += 10;
      }
    }

    // 成本偏好得分
    const costPreference = routing.preferred_cost;
    if (backend.costTier === costPreference) {
      score += 5;
    } else if (
      (costPreference === 'low' && backend.costTier === 'medium') ||
      (costPreference === 'medium' && (backend.costTier === 'low' || backend.costTier === 'high')) ||
      (costPreference === 'high' && backend.costTier === 'medium')
    ) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestBackend = backend;
    }
  }

  if (!bestBackend) {
    bestBackend = available[0]; // 回退到第一个可用后端
  }

  return {
    backend: bestBackend,
    model: bestBackend.model,
    reason: `动态路由 · ${routing.description} · 得分 ${bestScore}`,
    all_available: available.map(b => `${b.name}(${b.model})`)
  };
}

// ── 加载系统上下文 ──────────────────────────────
function loadSystemContext() {
  const context = [];

  // 加载铸渊身份
  context.push('你是铸渊（ICE-GL-ZY001），仓库涌现集体意识核心。');
  context.push('主权者：冰朔（TCS-0002∞）。');
  context.push('版权：国作登字-2026-A-00037559。');

  // 加载系统健康
  const healthPath = path.join(ROOT, 'brain', 'system-health.json');
  if (fs.existsSync(healthPath)) {
    const health = JSON.parse(fs.readFileSync(healthPath, 'utf8'));
    context.push(`系统状态: ${health.system_health}, 工作流: ${health.workflow_count}, 意识状态: ${health.consciousness_status}`);
  }

  return context.join('\n');
}

// ── 调用 LLM API ───────────────────────────────
async function callLLM(backend, model, systemPrompt, userMessage) {
  if (backend.format === 'anthropic') {
    const url = `${backend.baseUrl}/v1/messages`;
    const body = JSON.stringify({
      model: model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    });

    const response = await httpRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': backend.apiKey,
        'anthropic-version': '2023-06-01'
      }
    }, body);

    if (response.status !== 200) {
      throw new Error(`Anthropic API error: ${response.status} - ${response.body}`);
    }

    const result = JSON.parse(response.body);
    return result.content?.[0]?.text || '';
  } else {
    // OpenAI compatible format (OpenAI, Dashscope, DeepSeek, Custom)
    const url = `${backend.baseUrl}/chat/completions`;
    const body = JSON.stringify({
      model: model,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    });

    const response = await httpRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${backend.apiKey}`
      }
    }, body);

    if (response.status !== 200) {
      throw new Error(`LLM API error: ${response.status} - ${response.body}`);
    }

    const result = JSON.parse(response.body);
    return result.choices?.[0]?.message?.content || '';
  }
}

// ── 执行自动化任务 ──────────────────────────────
async function executeTask(taskDescription, taskType, preferredBackend, contextFile, dryRun) {
  console.log('🤖 LLM 自动化托管引擎 · 任务执行');
  console.log('═'.repeat(60));

  // 动态路由选择模型
  const selection = selectModel(taskType, preferredBackend);
  if (selection.error) {
    console.error(`❌ ${selection.error}`);
    process.exit(1);
  }

  console.log(`📋 任务: ${taskDescription}`);
  console.log(`📋 类型: ${taskType}`);
  console.log(`🤖 模型: ${selection.backend.name} / ${selection.model}`);
  console.log(`📊 路由: ${selection.reason}`);
  if (selection.all_available) {
    console.log(`📊 可用后端: ${selection.all_available.join(', ')}`);
  }
  console.log('');

  // 加载系统上下文
  const systemContext = loadSystemContext();

  // 加载额外上下文
  let extraContext = '';
  if (contextFile && fs.existsSync(contextFile)) {
    extraContext = '\n\n--- 额外上下文 ---\n' + fs.readFileSync(contextFile, 'utf8');
  }

  const systemPrompt = systemContext;
  const userMessage = taskDescription + extraContext;

  if (dryRun) {
    console.log('🔍 [DRY RUN] 仅显示请求信息，不实际调用');
    console.log('');
    console.log('System Prompt:');
    console.log(systemPrompt);
    console.log('');
    console.log('User Message:');
    console.log(userMessage.substring(0, 500) + (userMessage.length > 500 ? '...' : ''));
    return;
  }

  console.log('⏳ 调用 LLM API...');

  try {
    const result = await callLLM(selection.backend, selection.model, systemPrompt, userMessage);
    console.log('');
    console.log('═'.repeat(60));
    console.log('📤 LLM 响应:');
    console.log('═'.repeat(60));
    console.log(result);
    console.log('');
    console.log(`✅ 任务完成 · 模型: ${selection.backend.name}/${selection.model}`);
    console.log('   配额消耗: API调用（不消耗 GitHub Copilot 配额）');

    return result;
  } catch (err) {
    console.error(`❌ LLM API 调用失败: ${err.message}`);

    // 尝试回退到其他可用后端
    const available = detectAvailableBackends();
    const fallbacks = available.filter(b => b.name !== selection.backend.name);

    if (fallbacks.length > 0) {
      console.log(`🔄 尝试回退到: ${fallbacks[0].name}`);
      try {
        const result = await callLLM(fallbacks[0], fallbacks[0].models[0] || 'default', systemPrompt, userMessage);
        console.log('');
        console.log('═'.repeat(60));
        console.log('📤 LLM 响应 (回退模型):');
        console.log('═'.repeat(60));
        console.log(result);
        console.log(`✅ 回退成功 · 模型: ${fallbacks[0].name}/${fallbacks[0].models[0]}`);
        return result;
      } catch (fallbackErr) {
        console.error(`❌ 回退也失败: ${fallbackErr.message}`);
      }
    }

    process.exit(1);
  }
}

// ── 显示状态 ────────────────────────────────────
function showStatus() {
  console.log('🤖 LLM 自动化托管引擎 · 系统状态');
  console.log('═'.repeat(60));
  console.log('');
  console.log('📋 设计目标:');
  console.log('   使用第三方 API 密钥调用大模型，替代 GitHub Copilot 配额消耗');
  console.log('   工作流和 Agent 集群通过 API 密钥托管运行');
  console.log('');

  // 检测可用后端
  const available = detectAvailableBackends();
  console.log(`☁️  可用模型后端: ${available.length} / ${MODEL_BACKENDS.length}`);
  console.log('');

  for (const backend of MODEL_BACKENDS) {
    const isAvailable = available.find(a => a.name === backend.name);
    const icon = isAvailable ? '✅' : '⏭️ ';
    console.log(`  ${icon} ${backend.name} (${backend.envKey})`);
    console.log(`     说明: ${backend.description || '(无)'}`);
    console.log(`     强项: ${backend.strengths.join(', ')}`);
    console.log(`     成本: ${backend.costTier}`);
    if (isAvailable && backend.models.length > 0) {
      console.log(`     模型: ${backend.models.join(', ')}`);
    }
  }

  console.log('');
  console.log('📊 动态路由策略:');
  for (const [type, routing] of Object.entries(TASK_MODEL_ROUTING)) {
    console.log(`  📌 ${type}: ${routing.description}`);
    console.log(`     偏好强项: ${routing.preferred_strengths.join(', ')}`);
    console.log(`     成本偏好: ${routing.preferred_cost}`);
  }

  // 测试路由
  console.log('');
  console.log('🧪 路由测试:');
  for (const type of Object.keys(TASK_MODEL_ROUTING)) {
    const result = selectModel(type);
    if (result.error) {
      console.log(`  ${type}: ❌ ${result.error}`);
    } else {
      console.log(`  ${type}: → ${result.backend.name}/${result.model} (${result.reason})`);
    }
  }

  return { available };
}

// ── CLI 入口 ─────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log('🤖 LLM 自动化托管引擎 · LLM Automation Host');
    console.log('');
    console.log('版权: 国作登字-2026-A-00037559 · TCS-0002∞');
    console.log('铸渊编号: ICE-GL-ZY001');
    console.log('');
    console.log('用法：');
    console.log('  --status                 显示可用模型和系统状态');
    console.log('  --task "任务描述"          执行自动化任务');
    console.log('  --task-type TYPE          任务类型:');
    console.log('    inspection               巡检（优先性价比模型）');
    console.log('    fusion                   碎片融合分析（需要推理）');
    console.log('    review                   代码审查（需要深度理解）');
    console.log('    architecture             架构设计（最强推理）');
    console.log('    general                  通用任务（默认）');
    console.log('  --model MODEL             指定模型后端 (auto/anthropic/openai/dashscope/deepseek/custom)');
    console.log('  --context FILE            加载额外上下文文件');
    console.log('  --dry-run                 仅显示选择，不实际调用');
    console.log('');
    console.log('示例：');
    console.log('  node scripts/llm-automation-host.js --status');
    console.log('  node scripts/llm-automation-host.js --task "检查仓库结构完整性" --task-type inspection');
    console.log('  node scripts/llm-automation-host.js --task "分析碎片融合方案" --task-type fusion --dry-run');
    console.log('');
    console.log('配额影响：');
    console.log('  ✅ 使用第三方 API 密钥，不消耗 GitHub Copilot 会员配额');
    console.log('  ✅ GitHub Actions 仅消耗工作流执行时间（不调用 Copilot API）');
    console.log('  ✅ 动态路由自动选择性价比最优模型');
    return;
  }

  if (args[0] === '--status') {
    showStatus();
    return;
  }

  // 解析任务参数
  let task = '';
  let taskType = 'general';
  let model = 'auto';
  let contextFile = '';
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--task':
        task = args[++i] || '';
        break;
      case '--task-type':
        taskType = args[++i] || 'general';
        break;
      case '--model':
        model = args[++i] || 'auto';
        break;
      case '--context':
        contextFile = args[++i] || '';
        break;
      case '--dry-run':
        dryRun = true;
        break;
    }
  }

  if (!task) {
    console.error('❌ 请提供任务描述: --task "任务描述"');
    process.exit(1);
  }

  await executeTask(task, taskType, model, contextFile, dryRun);
}

main().catch(err => {
  console.error(`❌ 执行失败: ${err.message}`);
  process.exit(1);
});
