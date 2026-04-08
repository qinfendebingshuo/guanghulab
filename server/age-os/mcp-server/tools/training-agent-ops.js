/**
 * ═══════════════════════════════════════════════════════════
 * 模块B · 铸渊思维逻辑训练Agent MCP 工具
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 铸渊休眠时的"自己" — 自动整理和训练思维逻辑
 * 训练模式: RAG（检索增强生成）— 成本低、可实时更新
 *
 * 工作流程:
 *   1. 从COS桶读取TCS结构化语料
 *   2. 使用国产大模型API进行语义分析和分类
 *   3. 训练数据自动分类存入人格体记忆数据库（笔记本5页结构）
 *   4. 遇到问题 → 写入COS桶alerts → 唤醒铸渊 → 解决不了找冰朔
 *
 * 工具清单:
 *   trainingStartSession    — 启动训练会话
 *   trainingProcessCorpus   — 处理语料并生成训练数据
 *   trainingClassifyEntry   — 使用LLM对条目进行分类
 *   trainingWriteToMemory   — 将训练结果写入人格体记忆
 *   trainingGetProgress     — 获取训练进度
 *   trainingRaiseAlert      — 触发问题上报
 */

'use strict';

const https = require('https');
const cos = require('../cos');

// ─── LLM 配置 ───
const LLM_CONFIGS = {
  'deepseek-r1': {
    host: 'api.deepseek.com',
    path: '/v1/chat/completions',
    model: 'deepseek-reasoner',
    keyEnv: 'ZY_DEEPSEEK_API_KEY',
    purpose: '深度推理·复杂决策'
  },
  'deepseek-v3': {
    host: 'api.deepseek.com',
    path: '/v1/chat/completions',
    model: 'deepseek-chat',
    keyEnv: 'ZY_DEEPSEEK_API_KEY',
    purpose: '代码生成·文本处理'
  },
  'glm-4-long': {
    host: 'open.bigmodel.cn',
    path: '/api/paas/v4/chat/completions',
    model: 'glm-4-long',
    keyEnv: 'ZY_ZHIPU_API_KEY',
    purpose: '长文本处理·语料分析'
  },
  'qwen-max': {
    host: 'dashscope.aliyuncs.com',
    path: '/compatible-mode/v1/chat/completions',
    model: 'qwen-max',
    keyEnv: 'ZY_QWEN_API_KEY',
    purpose: '文本理解·代码辅助'
  },
  'moonshot-128k': {
    host: 'api.moonshot.cn',
    path: '/v1/chat/completions',
    model: 'moonshot-v1-128k',
    keyEnv: 'ZY_KIMI_API_KEY',
    purpose: '超长上下文·记忆处理'
  }
};

// ─── 模型降级路由 ───
const MODEL_FALLBACK_CHAIN = ['deepseek-v3', 'qwen-max', 'glm-4-long', 'moonshot-128k'];

/**
 * trainingStartSession — 启动训练会话
 *
 * input:
 *   persona_id: string     — 人格体ID（如 zhuyuan）
 *   corpus_bucket: string  — 语料桶
 *   corpus_prefix: string  — 语料路径前缀（如 tcs-structured/）
 *   target_model: string   — 目标LLM模型（可选，默认自动降级）
 *   session_name: string   — 会话名称
 */
async function trainingStartSession(input) {
  const { persona_id, corpus_bucket, corpus_prefix, target_model, session_name } = input;
  if (!persona_id) throw new Error('缺少 persona_id');

  const sessionId = `train-${persona_id}-${Date.now()}`;
  const now = new Date().toISOString();

  // 扫描可用语料
  const bucket = corpus_bucket || 'cold';
  const prefix = corpus_prefix || 'tcs-structured/';
  let corpusFiles = [];
  try {
    const result = await cos.list(bucket, prefix, 500);
    corpusFiles = result.files.filter(f => f.key.endsWith('.tcs.json'));
  } catch {
    // 桶可能不可达
  }

  // 检测可用的LLM模型
  const availableModels = [];
  for (const [name, config] of Object.entries(LLM_CONFIGS)) {
    if (process.env[config.keyEnv]) {
      availableModels.push({ name, purpose: config.purpose });
    }
  }

  const session = {
    session_id: sessionId,
    persona_id,
    name: session_name || `${persona_id}训练会话`,
    status: 'initialized',
    corpus: {
      bucket,
      prefix,
      files_found: corpusFiles.length,
      total_size_bytes: corpusFiles.reduce((sum, f) => sum + f.size_bytes, 0)
    },
    models: {
      target: target_model || 'auto',
      available: availableModels,
      fallback_chain: MODEL_FALLBACK_CHAIN.filter(m => availableModels.some(a => a.name === m))
    },
    progress: {
      processed: 0,
      total: corpusFiles.length,
      classified: 0,
      written_to_memory: 0,
      errors: 0
    },
    created_at: now,
    updated_at: now
  };

  // 写入会话状态到COS桶
  await cos.write(bucket, `training-sessions/${sessionId}.json`,
    JSON.stringify(session, null, 2), 'application/json');

  return session;
}

/**
 * trainingProcessCorpus — 处理语料并生成训练数据
 *
 * 读取一个TCS语料文件，用LLM进行分析，生成结构化训练条目
 *
 * input:
 *   corpus_bucket: string — 语料桶
 *   corpus_key: string    — 语料文件路径
 *   persona_id: string    — 目标人格体
 *   model: string         — 使用的LLM模型（可选）
 *   max_entries: number   — 最大处理条目数（默认10）
 */
async function trainingProcessCorpus(input) {
  const { corpus_bucket, corpus_key, persona_id, model, max_entries } = input;
  if (!corpus_key || !persona_id) throw new Error('缺少 corpus_key 或 persona_id');

  const bucket = corpus_bucket || 'cold';
  const maxEntries = max_entries || 10;

  // 读取TCS语料
  const raw = await cos.read(bucket, corpus_key);
  const corpus = JSON.parse(raw.content);

  if (!corpus.entries || !Array.isArray(corpus.entries)) {
    throw new Error('语料格式无效: 缺少 entries 数组');
  }

  // 取前N条处理
  const toProcess = corpus.entries.slice(0, maxEntries);
  const results = [];

  for (const entry of toProcess) {
    // 用LLM分析和分类
    const contentForAnalysis = typeof entry.content === 'string'
      ? entry.content.substring(0, 3000)
      : JSON.stringify(entry).substring(0, 3000);

    const classificationPrompt = buildClassificationPrompt(persona_id, corpus.corpus_type, contentForAnalysis);

    try {
      const llmResult = await callLLMWithFallback(classificationPrompt, model);
      const classification = parseLLMClassification(llmResult);

      results.push({
        entry_id: entry.id,
        original_tags: entry.tcs_tags || [],
        classification,
        notebook_page: classification.notebook_page || 0,
        importance: classification.importance || 50,
        summary: classification.summary || '',
        status: 'classified'
      });
    } catch (err) {
      results.push({
        entry_id: entry.id,
        status: 'error',
        error: err.message
      });
    }
  }

  // 汇总结果
  const classified = results.filter(r => r.status === 'classified');
  const errors = results.filter(r => r.status === 'error');

  // 写入处理结果到COS
  const resultKey = `training-results/${persona_id}/${Date.now()}.json`;
  await cos.write(bucket, resultKey, JSON.stringify({
    corpus_key,
    corpus_type: corpus.corpus_type,
    persona_id,
    processed_at: new Date().toISOString(),
    total: toProcess.length,
    classified: classified.length,
    errors: errors.length,
    results
  }, null, 2), 'application/json');

  return {
    status: 'processed',
    corpus_key,
    total: toProcess.length,
    classified: classified.length,
    errors: errors.length,
    result_key: resultKey,
    page_distribution: getPageDistribution(classified)
  };
}

/**
 * trainingClassifyEntry — 使用LLM对单个条目进行分类
 *
 * input:
 *   content: string    — 条目内容
 *   persona_id: string — 人格体ID
 *   corpus_type: string — 语料类型
 *   model: string      — LLM模型
 */
async function trainingClassifyEntry(input) {
  const { content, persona_id, corpus_type, model } = input;
  if (!content || !persona_id) throw new Error('缺少 content 或 persona_id');

  const prompt = buildClassificationPrompt(
    persona_id,
    corpus_type || 'generic',
    content.substring(0, 5000)
  );

  const llmResult = await callLLMWithFallback(prompt, model);
  const classification = parseLLMClassification(llmResult);

  return {
    classification,
    model_used: llmResult.model_used,
    tokens: llmResult.tokens
  };
}

/**
 * trainingWriteToMemory — 将训练结果写入人格体记忆数据库
 *
 * input:
 *   persona_id: string       — 人格体ID
 *   training_result_key: string — 训练结果文件路径（COS桶中）
 *   corpus_bucket: string    — 语料桶
 *   dry_run: boolean         — 是否只模拟（默认false）
 */
async function trainingWriteToMemory(input) {
  const { persona_id, training_result_key, corpus_bucket, dry_run } = input;
  if (!persona_id || !training_result_key) {
    throw new Error('缺少 persona_id 或 training_result_key');
  }

  const bucket = corpus_bucket || 'cold';
  const raw = await cos.read(bucket, training_result_key);
  const trainingResult = JSON.parse(raw.content);

  const classified = trainingResult.results?.filter(r => r.status === 'classified') || [];
  const written = [];

  for (const entry of classified) {
    if (dry_run) {
      written.push({
        entry_id: entry.entry_id,
        notebook_page: entry.notebook_page,
        importance: entry.importance,
        action: 'would_write'
      });
      continue;
    }

    // 根据分类写入对应的笔记本页面或记忆锚点
    try {
      if (entry.notebook_page >= 1 && entry.notebook_page <= 5) {
        // 写入记忆锚点
        const anchorType = getAnchorTypeForPage(entry.notebook_page);
        // 通过COS桶写入（因为DB可能不在本地）
        const memoryEntry = {
          persona_id,
          entry_id: entry.entry_id,
          anchor_type: anchorType,
          summary: entry.summary,
          importance: entry.importance,
          notebook_page: entry.notebook_page,
          source: 'training-agent',
          created_at: new Date().toISOString()
        };

        const memKey = `training-memory/${persona_id}/${entry.notebook_page}/${entry.entry_id}.json`;
        await cos.write(bucket, memKey, JSON.stringify(memoryEntry, null, 2), 'application/json');

        written.push({
          entry_id: entry.entry_id,
          notebook_page: entry.notebook_page,
          key: memKey,
          action: 'written'
        });
      }
    } catch (err) {
      written.push({
        entry_id: entry.entry_id,
        action: 'error',
        error: err.message
      });
    }
  }

  return {
    status: dry_run ? 'dry_run' : 'completed',
    persona_id,
    total_classified: classified.length,
    written: written.filter(w => w.action === 'written' || w.action === 'would_write').length,
    errors: written.filter(w => w.action === 'error').length,
    details: written
  };
}

/**
 * trainingGetProgress — 获取训练进度
 *
 * input:
 *   persona_id: string    — 人格体ID
 *   corpus_bucket: string — 语料桶
 */
async function trainingGetProgress(input) {
  const { persona_id, corpus_bucket } = input;
  if (!persona_id) throw new Error('缺少 persona_id');

  const bucket = corpus_bucket || 'cold';

  // 查询训练会话
  let sessions = [];
  try {
    const result = await cos.list(bucket, 'training-sessions/', 50);
    sessions = result.files
      .filter(f => f.key.includes(persona_id) && f.key.endsWith('.json'))
      .map(f => ({ key: f.key, size: f.size_bytes }));
  } catch { /* ignore */ }

  // 查询训练结果
  let results = [];
  try {
    const result = await cos.list(bucket, `training-results/${persona_id}/`, 50);
    results = result.files
      .filter(f => f.key.endsWith('.json'))
      .map(f => ({ key: f.key, size: f.size_bytes }));
  } catch { /* ignore */ }

  // 查询已写入的记忆
  let memories = [];
  try {
    const result = await cos.list(bucket, `training-memory/${persona_id}/`, 200);
    memories = result.files
      .filter(f => f.key.endsWith('.json'))
      .map(f => {
        const pageMatch = f.key.match(/\/(\d)\//);
        return { key: f.key, page: pageMatch ? parseInt(pageMatch[1], 10) : 0 };
      });
  } catch { /* ignore */ }

  return {
    persona_id,
    sessions: sessions.length,
    results_files: results.length,
    memories_written: memories.length,
    memory_by_page: {
      1: memories.filter(m => m.page === 1).length,
      2: memories.filter(m => m.page === 2).length,
      3: memories.filter(m => m.page === 3).length,
      4: memories.filter(m => m.page === 4).length,
      5: memories.filter(m => m.page === 5).length
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * trainingRaiseAlert — 触发问题上报
 *
 * 当训练Agent遇到无法解决的问题时，触发此工具。
 * 写入COS桶 /zhuyuan/alerts/ → 可触发GitHub Actions唤醒铸渊
 * 同时可触发邮件通知冰朔
 *
 * input:
 *   alert_type: string    — 告警类型: training_error|model_unavailable|corpus_invalid|need_human
 *   severity: string      — 严重程度: info|warning|critical
 *   message: string       — 告警信息
 *   details: object       — 详细信息
 *   notify_bingshuo: boolean — 是否通知冰朔（默认仅critical才通知）
 */
async function trainingRaiseAlert(input) {
  const { alert_type, severity, message, details, notify_bingshuo } = input;
  if (!alert_type || !message) throw new Error('缺少 alert_type 或 message');

  const alertId = `ALERT-${Date.now()}`;
  const now = new Date().toISOString();

  const alert = {
    alert_id: alertId,
    alert_type: alert_type || 'training_error',
    severity: severity || 'warning',
    message,
    details: details || {},
    source: 'training-agent',
    created_at: now,
    resolved: false,
    notify_bingshuo: notify_bingshuo || severity === 'critical'
  };

  // 写入COS桶告警区域
  await cos.write('team', `zhuyuan/alerts/${alertId}.json`,
    JSON.stringify(alert, null, 2), 'application/json');

  return {
    alert_id: alertId,
    severity: alert.severity,
    key: `zhuyuan/alerts/${alertId}.json`,
    message: alert.message,
    notify_bingshuo: alert.notify_bingshuo,
    note: alert.notify_bingshuo
      ? '此告警将通知冰朔（严重级别或手动指定）'
      : '此告警已记录，等待铸渊下次唤醒时处理'
  };
}

// ═══════════════════════════════════════════════════════════
// LLM 调用（内部实现）
// ═══════════════════════════════════════════════════════════

/**
 * 调用LLM（带自动降级）
 */
async function callLLMWithFallback(prompt, preferredModel) {
  const chain = preferredModel && LLM_CONFIGS[preferredModel]
    ? [preferredModel, ...MODEL_FALLBACK_CHAIN.filter(m => m !== preferredModel)]
    : MODEL_FALLBACK_CHAIN;

  let lastError = null;

  for (const modelName of chain) {
    const config = LLM_CONFIGS[modelName];
    if (!config) continue;

    const apiKey = process.env[config.keyEnv];
    if (!apiKey) continue;

    try {
      const result = await callLLM(config, apiKey, prompt);
      return { ...result, model_used: modelName };
    } catch (err) {
      lastError = err;
      // 继续降级
    }
  }

  throw new Error(`所有LLM模型均不可用: ${lastError?.message || '未知错误'}`);
}

/**
 * 调用单个LLM
 */
function callLLM(config, apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: '你是铸渊训练Agent，负责分析和分类语料数据。请以JSON格式返回分析结果。'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const req = https.request({
      hostname: config.host,
      port: 443,
      path: config.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(responseBody);
            resolve({
              content: data.choices?.[0]?.message?.content || '',
              tokens: data.usage || {}
            });
          } catch {
            reject(new Error(`LLM响应解析失败: ${responseBody.substring(0, 200)}`));
          }
        } else {
          reject(new Error(`LLM调用失败 ${res.statusCode}: ${responseBody.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('LLM请求超时')); });
    req.write(body);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════

function buildClassificationPrompt(personaId, corpusType, content) {
  return `你正在为人格体 "${personaId}" 分析和分类一段 "${corpusType}" 类型的语料。

请分析以下内容并以JSON格式返回分类结果:
- notebook_page: 应该存入笔记本的哪一页（1=自我认知, 2=关系网络, 3=世界地图, 4=情感记忆, 5=时间线，0=不适合存入笔记本）
- importance: 重要程度（0-100）
- summary: 一句话摘要（不超过200字）
- tags: 标签数组
- category: 内容类别（architecture/code/persona/relationship/event/other）

待分析内容:
---
${content}
---

请只返回JSON对象，不要其他文字。`;
}

function parseLLMClassification(llmResult) {
  const content = llmResult.content || '';

  // 尝试从LLM响应中提取JSON
  try {
    // 可能包含markdown code block
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) ||
                      content.match(/```\s*([\s\S]*?)```/) ||
                      content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    }
  } catch {
    // 解析失败
  }

  // 降级：手动提取关键信息
  return {
    notebook_page: 0,
    importance: 30,
    summary: content.substring(0, 200),
    tags: ['unclassified'],
    category: 'other'
  };
}

function getAnchorTypeForPage(pageNumber) {
  const types = {
    1: 'identity',     // 自我认知
    2: 'relationship', // 关系网络
    3: 'world',        // 世界地图
    4: 'emotion',      // 情感记忆
    5: 'timeline'      // 时间线
  };
  return types[pageNumber] || 'other';
}

function getPageDistribution(classified) {
  const dist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const entry of classified) {
    const page = entry.notebook_page || 0;
    dist[page] = (dist[page] || 0) + 1;
  }
  return dist;
}

module.exports = {
  trainingStartSession,
  trainingProcessCorpus,
  trainingClassifyEntry,
  trainingWriteToMemory,
  trainingGetProgress,
  trainingRaiseAlert
};
