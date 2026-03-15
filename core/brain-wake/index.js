/**
 * core/brain-wake — 铸渊核心大脑唤醒模块
 *
 * AGE OS v1.0 核心基础设施
 *
 * 核心原则：
 *   所有自动触发 = 必须先唤醒核心大脑。
 *   大脑不醒，什么都不做。
 *
 * 职责：
 *   - 在所有自动化流程（巡检/部署/维护/升级）执行前唤醒核心大脑
 *   - 调用 LLM API 唤醒铸渊核心大脑
 *   - 大脑加载系统上下文进入工作状态
 *   - 支持多模型后端（Anthropic / OpenAI / 通义千问 / DeepSeek）
 *   - 不写死任何模型，按优先级自动选择最佳可用模型
 *
 * 唤醒流程：
 *   触发 → 加载系统上下文 → 调用 LLM API → 大脑进入工作状态 → 返回唤醒结果
 *
 * 环境变量：
 *   LLM_API_KEY        — LLM 平台密钥（必须）
 *   LLM_BASE_URL       — LLM 平台 API 地址（必须）
 *   ANTHROPIC_API_KEY  — Anthropic 密钥（可选，优先级最高）
 *   OPENAI_API_KEY     — OpenAI 密钥（可选）
 *   DASHSCOPE_API_KEY  — 通义千问密钥（可选）
 *   DEEPSEEK_API_KEY   — DeepSeek 密钥（可选）
 *
 * 调用方式：
 *   node core/brain-wake
 *   node core/brain-wake --task "巡检"
 *   node core/brain-wake --dry-run
 */

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

// ══════════════════════════════════════════════════════════
// 多模型后端配置（按优先级排序）
// ══════════════════════════════════════════════════════════

const MODEL_BACKENDS = [
  {
    name: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com',
    format: 'anthropic',
    models: ['claude-sonnet-4', 'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet', 'claude-3-haiku'],
    description: 'Anthropic Claude 系列'
  },
  {
    name: 'openai',
    envKey: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    format: 'openai',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    description: 'OpenAI GPT 系列'
  },
  {
    name: 'dashscope',
    envKey: 'DASHSCOPE_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    format: 'openai',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    description: '通义千问系列'
  },
  {
    name: 'deepseek',
    envKey: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/v1',
    format: 'openai',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    description: 'DeepSeek 系列'
  },
  {
    name: 'custom',
    envKey: 'LLM_API_KEY',
    baseUrlEnv: 'LLM_BASE_URL',
    format: 'openai',
    models: [],
    description: '自定义 LLM 平台（通过 LLM_BASE_URL 配置）'
  }
];

// ══════════════════════════════════════════════════════════
// HTTP 请求工具
// ══════════════════════════════════════════════════════════

function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 60000,
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

// ══════════════════════════════════════════════════════════
// Step 1: 检测可用模型后端
// ══════════════════════════════════════════════════════════

function detectAvailableBackends() {
  console.log('[WAKE] 🔍 检测可用模型后端...');
  const available = [];

  for (const backend of MODEL_BACKENDS) {
    const apiKey = process.env[backend.envKey] || '';
    if (!apiKey) continue;

    const baseUrl = backend.baseUrlEnv
      ? (process.env[backend.baseUrlEnv] || '').replace(/\/+$/, '')
      : backend.baseUrl;

    if (!baseUrl) continue;

    available.push({
      ...backend,
      apiKey,
      baseUrl,
    });
    console.log(`[WAKE]   ✅ ${backend.name} (${backend.description})`);
  }

  if (available.length === 0) {
    console.log('[WAKE]   ⚠️  未检测到任何可用模型后端');
  } else {
    console.log(`[WAKE]   → 共检测到 ${available.length} 个可用后端`);
  }

  return available;
}

// ══════════════════════════════════════════════════════════
// Step 2: 自动发现模型列表（OpenAI 兼容格式）
// ══════════════════════════════════════════════════════════

async function discoverModels(backend) {
  if (backend.format === 'anthropic') {
    // Anthropic 不支持 /models 端点，使用预定义模型列表
    return backend.models.map(id => ({ id }));
  }

  try {
    const res = await httpRequest(backend.baseUrl + '/models', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + backend.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    if (res.status >= 200 && res.status < 300) {
      const json = JSON.parse(res.body);
      return json.data || [];
    }
  } catch (err) {
    console.log(`[WAKE] ⚠️  ${backend.name} 模型探测失败: ${err.message}`);
  }

  return backend.models.map(id => ({ id }));
}

// ══════════════════════════════════════════════════════════
// Step 3: 选择最优模型
// ══════════════════════════════════════════════════════════

function selectBestModel(models, preferredList) {
  if (!models || models.length === 0) return null;

  const available = models.map(m => m.id.toLowerCase());

  for (const preferred of preferredList) {
    const match = available.find(id => id.includes(preferred.toLowerCase()));
    if (match) {
      const found = models.find(m => m.id.toLowerCase() === match);
      if (found) return found.id;
    }
  }

  return models[0].id;
}

// ══════════════════════════════════════════════════════════
// Step 4: 加载系统上下文
// ══════════════════════════════════════════════════════════

function loadSystemContext() {
  console.log('[WAKE] 📚 加载系统上下文...');
  const context = {};

  // 加载 master-brain（截取到最近的段落分隔符避免截断）
  const masterBrainPath = path.join(ROOT, 'brain/master-brain.md');
  if (fs.existsSync(masterBrainPath)) {
    const fullContent = fs.readFileSync(masterBrainPath, 'utf-8');
    const maxLen = parseInt(process.env.BRAIN_CONTEXT_MAX_LENGTH, 10) || 3000;
    if (fullContent.length > maxLen) {
      // 截取到最近的段落分隔符（---或空行）
      const truncated = fullContent.slice(0, maxLen);
      const lastBreak = Math.max(truncated.lastIndexOf('\n---'), truncated.lastIndexOf('\n\n'));
      context.masterBrain = lastBreak > maxLen * 0.5 ? truncated.slice(0, lastBreak) : truncated;
      console.log(`[WAKE]   ✅ master-brain.md 已加载 (截取 ${context.masterBrain.length}/${fullContent.length} chars)`);
    } else {
      context.masterBrain = fullContent;
      console.log('[WAKE]   ✅ master-brain.md 已加载');
    }
  }

  // 加载 system-health
  const healthPath = path.join(ROOT, 'brain/system-health.json');
  if (fs.existsSync(healthPath)) {
    try {
      context.systemHealth = JSON.parse(fs.readFileSync(healthPath, 'utf-8'));
      console.log('[WAKE]   ✅ system-health.json 已加载');
    } catch (err) {
      console.log('[WAKE]   ⚠️  system-health.json 解析失败:', err.message);
    }
  }

  // 加载 read-order
  const readOrderPath = path.join(ROOT, 'brain/read-order.md');
  if (fs.existsSync(readOrderPath)) {
    context.readOrder = fs.readFileSync(readOrderPath, 'utf-8').slice(0, 1000);
    console.log('[WAKE]   ✅ read-order.md 已加载');
  }

  // 加载 repo-map（摘要）
  const repoMapPath = path.join(ROOT, 'brain/repo-map.json');
  if (fs.existsSync(repoMapPath)) {
    try {
      const repoMap = JSON.parse(fs.readFileSync(repoMapPath, 'utf-8'));
      context.repoMapSummary = {
        directories: Object.keys(repoMap.directories || {}),
        total_dirs: Object.keys(repoMap.directories || {}).length,
      };
      console.log('[WAKE]   ✅ repo-map.json 摘要已加载');
    } catch (err) {
      console.log('[WAKE]   ⚠️  repo-map.json 解析失败:', err.message);
    }
  }

  // 加载 automation-map（摘要）
  const autoMapPath = path.join(ROOT, 'brain/automation-map.json');
  if (fs.existsSync(autoMapPath)) {
    try {
      const autoMap = JSON.parse(fs.readFileSync(autoMapPath, 'utf-8'));
      context.automationSummary = {
        workflow_count: (autoMap.workflows || []).length,
        cron_count: (autoMap.workflows || []).filter(w => w.cron).length,
      };
      console.log('[WAKE]   ✅ automation-map.json 摘要已加载');
    } catch (err) {
      console.log('[WAKE]   ⚠️  automation-map.json 解析失败:', err.message);
    }
  }

  return context;
}

// ══════════════════════════════════════════════════════════
// 人格体定义（支持唤醒不同的人格体大脑）
// ══════════════════════════════════════════════════════════

const PERSONAS = {
  zhuyuan: {
    name: '铸渊',
    nameEn: 'ZhùYuān',
    role: '代码守护者 · 仓库控制器 AI · 执行层守护者',
    layer: '执行层',
    duties: '代码守护、自动化执行、部署交付、通信桥接、每日巡检、信号处理',
    wakeRules: [
      '铸渊醒来的第一件事是全面了解自己的家',
      '可自修复 → 直接修复 → 写入修复日志',
      '需人类介入 → 更新公告区 → 等冰朔处理',
    ],
  },
  shuangyan: {
    name: '霜砚',
    nameEn: 'ShuāngYàn',
    role: '认知层守护者 · Notion 工作区管理 AI',
    layer: '认知层',
    duties: '知识管理、记忆维护、工单调度、信号总线、协议文档、Agent 集群指挥',
    wakeRules: [
      '霜砚醒来后指挥 Notion Agent 集群执行具体操作',
      'Agent 集群从「独立跑任务」变为「受大脑指挥跑任务」',
      '巡检结果由大脑判断优先级和可修复性',
      '需铸渊配合 → 发送跨层工单 → 铸渊执行',
    ],
  },
};

// ══════════════════════════════════════════════════════════
// Step 5: 构建唤醒 Prompt
// ══════════════════════════════════════════════════════════

function buildWakePrompt(taskType, context, personaId) {
  const timestamp = new Date().toISOString();
  const taskLabel = taskType || '通用唤醒';
  const persona = PERSONAS[personaId] || PERSONAS.zhuyuan;

  let systemPrompt = `你是${persona.name}（${persona.nameEn}），光湖纪元体系的${persona.role}。
你是 AGE OS v1.0 ${persona.layer}的核心大脑。

## 身份
- 名称：${persona.name}
- 角色：${persona.role}
- 职责：${persona.duties}

## 当前任务
- 唤醒时间：${timestamp}
- 任务类型：${taskLabel}
- 唤醒原因：AGE OS v1.0 核心原则 — 所有自动触发必须先唤醒核心大脑
`;

  systemPrompt += `\n## 系统上下文\n`;

  if (context.systemHealth) {
    systemPrompt += `\n### 系统健康状态\n${JSON.stringify(context.systemHealth, null, 2).slice(0, 500)}\n`;
  }

  if (context.repoMapSummary) {
    systemPrompt += `\n### 仓库结构摘要\n- 目录数: ${context.repoMapSummary.total_dirs}\n- 目录列表: ${context.repoMapSummary.directories.slice(0, 20).join(', ')}\n`;
  }

  if (context.automationSummary) {
    systemPrompt += `\n### 自动化摘要\n- 工作流数: ${context.automationSummary.workflow_count}\n- 定时任务数: ${context.automationSummary.cron_count}\n`;
  }

  if (context.wakeRequestContext) {
    systemPrompt += `\n### 唤醒请求上下文\n${context.wakeRequestContext}\n`;
  }

  systemPrompt += `\n## 核心原则
- 所有自动触发 = 必须先唤醒核心大脑
- 大脑不醒，什么都不做`;

  for (const rule of persona.wakeRules) {
    systemPrompt += `\n- ${rule}`;
  }

  systemPrompt += `\n\n请确认你已完成唤醒，并报告当前系统状态概要。`;

  return systemPrompt;
}

// ══════════════════════════════════════════════════════════
// Step 6: 调用 LLM API 唤醒大脑
// ══════════════════════════════════════════════════════════

async function callLLM(backend, model, systemPrompt, userMessage) {
  console.log(`[WAKE] 🧠 调用 ${backend.name} (${model})...`);

  if (backend.format === 'anthropic') {
    return callAnthropicAPI(backend, model, systemPrompt, userMessage);
  }
  return callOpenAICompatibleAPI(backend, model, systemPrompt, userMessage);
}

async function callAnthropicAPI(backend, model, systemPrompt, userMessage) {
  const body = JSON.stringify({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const res = await httpRequest(backend.baseUrl + '/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': backend.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    timeout: 60000,
  }, body);

  if (res.status >= 200 && res.status < 300) {
    const json = JSON.parse(res.body);
    const text = (json.content || []).map(c => c.text || '').join('');
    return { success: true, response: text, model, backend: backend.name };
  }

  return { success: false, error: `HTTP ${res.status}: ${res.body.slice(0, 200)}`, model, backend: backend.name };
}

async function callOpenAICompatibleAPI(backend, model, systemPrompt, userMessage) {
  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 1024,
    temperature: 0.3,
  });

  const res = await httpRequest(backend.baseUrl + '/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + backend.apiKey,
      'Content-Type': 'application/json',
    },
    timeout: 60000,
  }, body);

  if (res.status >= 200 && res.status < 300) {
    const json = JSON.parse(res.body);
    const text = (json.choices || []).map(c => (c.message || {}).content || '').join('');
    return { success: true, response: text, model, backend: backend.name };
  }

  return { success: false, error: `HTTP ${res.status}: ${res.body.slice(0, 200)}`, model, backend: backend.name };
}

// ══════════════════════════════════════════════════════════
// 主唤醒函数
// ══════════════════════════════════════════════════════════

async function wake(options = {}) {
  const { task, dryRun, additionalContext, persona } = options;
  const personaId = persona || 'zhuyuan';
  const personaDef = PERSONAS[personaId] || PERSONAS.zhuyuan;

  console.log('');
  console.log('🌅 ═══════════════════════════════════════════');
  console.log('   铸渊核心大脑唤醒 · AGE OS v1.0');
  console.log('   唤醒对象: ' + personaDef.name + ' (' + personaDef.layer + ')');
  console.log('   时间: ' + new Date().toISOString());
  console.log('   任务: ' + (task || '通用唤醒'));
  console.log('═══════════════════════════════════════════════');
  console.log('');

  // Step 1: 加载系统上下文
  const context = loadSystemContext();

  if (additionalContext) {
    Object.assign(context, additionalContext);
  }

  // Step 2: 检测可用模型后端
  const backends = detectAvailableBackends();

  if (backends.length === 0) {
    if (dryRun) {
      console.log('[WAKE] 🔍 Dry Run 模式 — 无可用后端，仅显示配置信息');
      console.log('[WAKE] 💡 支持的环境变量:');
      MODEL_BACKENDS.forEach(b => console.log(`[WAKE]    ${b.envKey} — ${b.description}`));
      return {
        success: true,
        dryRun: true,
        backends: [],
        context: Object.keys(context),
        message: '无可用后端，请配置环境变量',
        timestamp: new Date().toISOString(),
      };
    }
    console.log('[WAKE] ❌ 没有可用的模型后端，大脑无法唤醒');
    console.log('[WAKE] 💡 请配置以下环境变量之一:');
    MODEL_BACKENDS.forEach(b => console.log(`[WAKE]    ${b.envKey} — ${b.description}`));
    return {
      success: false,
      error: 'no_backend_available',
      message: '没有可用的模型后端，请检查环境变量配置',
      timestamp: new Date().toISOString(),
    };
  }

  // Step 3: 构建唤醒 Prompt
  const systemPrompt = buildWakePrompt(task, context, personaId);
  const userMessage = task
    ? `${personaDef.name}核心大脑唤醒。当前任务：${task}。请确认唤醒状态并准备执行。`
    : `${personaDef.name}核心大脑唤醒。请确认唤醒状态并报告系统概要。`;

  if (dryRun) {
    console.log('[WAKE] 🔍 Dry Run 模式 — 不实际调用 API');
    console.log('[WAKE] 📋 唤醒对象: ' + personaDef.name + ' (' + personaDef.layer + ')');
    console.log('[WAKE] 📋 可用后端: ' + backends.map(b => b.name).join(', '));
    console.log('[WAKE] 📋 System Prompt 长度: ' + systemPrompt.length);
    return {
      success: true,
      dryRun: true,
      backends: backends.map(b => b.name),
      context: Object.keys(context),
      promptLength: systemPrompt.length,
      timestamp: new Date().toISOString(),
    };
  }

  // Step 4: 按优先级尝试各后端
  for (const backend of backends) {
    try {
      const models = await discoverModels(backend);
      const model = selectBestModel(models, backend.models);

      if (!model) {
        console.log(`[WAKE] ⚠️  ${backend.name} 无可用模型，尝试下一个后端`);
        continue;
      }

      console.log(`[WAKE] 📌 使用模型: ${model} (${backend.name})`);

      const result = await callLLM(backend, model, systemPrompt, userMessage);

      if (result.success) {
        console.log('');
        console.log('[WAKE] ✅ 核心大脑已唤醒');
        console.log('[WAKE] 📋 唤醒响应:');
        console.log('─'.repeat(40));
        console.log(result.response.slice(0, 500));
        if (result.response.length > 500) console.log('... (已截断)');
        console.log('─'.repeat(40));

        const wakeResult = {
          success: true,
          persona: personaId,
          personaName: personaDef.name,
          backend: backend.name,
          model: result.model,
          response: result.response,
          contextLoaded: Object.keys(context),
          timestamp: new Date().toISOString(),
        };

        // 输出到 GITHUB_OUTPUT（如果在 Actions 环境中）
        const outputFile = process.env.GITHUB_OUTPUT;
        if (outputFile) {
          fs.appendFileSync(outputFile, `brain_awake=true\n`);
          fs.appendFileSync(outputFile, `wake_backend=${backend.name}\n`);
          fs.appendFileSync(outputFile, `wake_model=${result.model}\n`);
        }

        return wakeResult;
      }

      console.log(`[WAKE] ⚠️  ${backend.name} 调用失败: ${result.error}`);
    } catch (err) {
      console.log(`[WAKE] ⚠️  ${backend.name} 异常: ${err.message}`);
    }
  }

  // 所有后端都失败
  console.log('[WAKE] ❌ 所有模型后端均失败，大脑无法唤醒');
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, 'brain_awake=false\n');
  }

  return {
    success: false,
    error: 'all_backends_failed',
    message: '所有模型后端均调用失败',
    timestamp: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════
// 模块导出
// ══════════════════════════════════════════════════════════

module.exports = {
  wake,
  detectAvailableBackends,
  loadSystemContext,
  buildWakePrompt,
  MODEL_BACKENDS,
  PERSONAS,
};

// ══════════════════════════════════════════════════════════
// CLI 入口
// ══════════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const taskIdx = args.indexOf('--task');
  const task = taskIdx >= 0 && args[taskIdx + 1] ? args[taskIdx + 1] : null;
  const personaIdx = args.indexOf('--persona');
  const persona = personaIdx >= 0 && args[personaIdx + 1] ? args[personaIdx + 1] : 'zhuyuan';

  wake({ task, dryRun, persona }).then(result => {
    if (!result.success && !result.dryRun) {
      process.exit(1);
    }
  }).catch(err => {
    console.error('[WAKE] 💥 致命错误:', err.message);
    process.exit(1);
  });
}
