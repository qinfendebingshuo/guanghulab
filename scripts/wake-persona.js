// scripts/wake-persona.js
// 铸渊 · 人格体唤醒脚本（第三方 API 兼容层 · 自动检测模式）
//
// 功能：
//   ① 自动发现可用模型（/v1/models 端点）
//   ② 智能选择最优 Claude 模型
//   ③ 自适应 API 格式（OpenAI 兼容 / Anthropic 原生）
//   ④ 统一调用接口，唤醒人格体处理 SYSLOG 或解答提问
//   ⑤ v4.0 协议动态注入（从 Notion 实时读取核心大脑规则 + 画像 + 指纹）
//
// 环境变量：
//   LLM_API_KEY          第三方平台密钥（必须）
//   LLM_BASE_URL         第三方平台 API 地址（必须，如 https://api.xxx.com/v1）
//   BROADCAST_ID         广播编号
//   SUBMIT_TYPE          syslog | question
//   SUBMIT_CONTENT       提交内容（SYSLOG 全文或问题描述）
//   AUTHOR               提交者 GitHub 用户名
//   NOTION_TOKEN         Notion API token（用于动态读取协议）
//   CORE_BRAIN_PAGE_ID   曜冥核心大脑 v4.0 页面 ID
//   PORTRAIT_DB_ID       开发者动态画像库数据库 ID
//   FINGERPRINT_DB_ID    模块指纹注册表数据库 ID

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ══════════════════════════════════════════════════════════
// 配置
// ══════════════════════════════════════════════════════════

const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_BASE_URL = (process.env.LLM_BASE_URL || '').replace(/\/+$/, '');
const BROADCAST_ID = process.env.BROADCAST_ID || 'UNKNOWN';
const SUBMIT_TYPE = process.env.SUBMIT_TYPE || 'question';
const SUBMIT_CONTENT = process.env.SUBMIT_CONTENT || '';
const AUTHOR = process.env.AUTHOR || 'unknown';

// Notion 配置（v4.0 协议动态注入）
const NOTION_TOKEN = process.env.NOTION_TOKEN || '';
const CORE_BRAIN_PAGE_ID = process.env.CORE_BRAIN_PAGE_ID || '';
const PORTRAIT_DB_ID = process.env.PORTRAIT_DB_ID || '';
const FINGERPRINT_DB_ID = process.env.FINGERPRINT_DB_ID || '';
const NOTION_VERSION = '2022-06-28';
const NOTION_API_HOSTNAME = 'api.notion.com';
const MAX_PROTOCOL_TEXT_LENGTH = 15000;

// Claude 模型优先级队列（从高到低）
const PREFERRED_MODELS = [
  'claude-sonnet-4',
  'claude-3-5-sonnet-20241022',
  'claude-3.5-sonnet',
  'claude-3-5-sonnet',
  'anthropic/claude-3.5-sonnet',
  'claude-3-sonnet',
  'claude-3-haiku',
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
// Step 1: 自动发现可用模型
// ══════════════════════════════════════════════════════════

async function discoverModels() {
  console.log('[LLM] 🔍 探测可用模型...');

  try {
    const res = await httpRequest(LLM_BASE_URL + '/models', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + LLM_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    if (res.status >= 200 && res.status < 300) {
      const json = JSON.parse(res.body);
      const models = json.data || [];
      console.log('[LLM]   → 发现 ' + models.length + ' 个模型');
      return models;
    }
    console.log('[LLM]   → 模型探测返回 ' + res.status + ', 使用默认模型');
    return [];
  } catch (err) {
    console.log('[LLM]   → 模型探测失败: ' + err.message + ', 使用默认模型');
    return [];
  }
}

// ══════════════════════════════════════════════════════════
// Step 2: 智能选择最优 Claude 模型
// ══════════════════════════════════════════════════════════

function selectBestModel(models) {
  if (!models || models.length === 0) {
    console.log('[LLM] 📌 无可用模型列表, 使用默认 claude-3-5-sonnet');
    return 'claude-3-5-sonnet';
  }

  const available = models.map(function (m) { return m.id.toLowerCase(); });

  // 按优先级匹配
  for (const preferred of PREFERRED_MODELS) {
    const match = available.find(function (id) { return id.includes(preferred); });
    if (match) {
      const found = models.find(function (m) { return m.id.toLowerCase() === match; });
      if (found) {
        console.log('[LLM] 📌 选择模型: ' + found.id + ' (匹配规则: ' + preferred + ')');
        return found.id;
      }
    }
  }

  // 兜底：任何含 'claude' 的模型
  const anyClaude = available.find(function (id) { return id.includes('claude'); });
  if (anyClaude) {
    const found = models.find(function (m) { return m.id.toLowerCase() === anyClaude; });
    if (found) {
      console.log('[LLM] 📌 兜底选择 Claude 模型: ' + found.id);
      return found.id;
    }
  }

  // 最终兜底：平台第一个可用模型
  const fallbackId = models[0].id;
  console.log('[LLM] 📌 最终兜底: ' + fallbackId + ' (平台无 Claude 模型)');
  return fallbackId;
}

// ══════════════════════════════════════════════════════════
// Step 3: 自适应 API 格式检测
// ══════════════════════════════════════════════════════════

async function detectApiFormat() {
  console.log('[LLM] 🔍 检测 API 格式...');

  // 尝试 OpenAI 兼容格式（绝大多数第三方平台）
  try {
    const res = await httpRequest(LLM_BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + LLM_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }, JSON.stringify({
      model: 'test',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    }));

    // 400 = endpoint exists but bad request (model not found etc.) → format supported
    // 200 = endpoint works → format supported
    if (res.status === 200 || res.status === 400 || res.status === 401 || res.status === 422) {
      console.log('[LLM]   → 检测到 OpenAI 兼容格式 (status: ' + res.status + ')');
      return 'openai-compat';
    }
  } catch (e) {
    // Ignore, try next format
  }

  // 尝试 Anthropic 原生格式
  try {
    const res = await httpRequest(LLM_BASE_URL + '/messages', {
      method: 'POST',
      headers: {
        'x-api-key': LLM_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }, JSON.stringify({
      model: 'test',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    }));

    if (res.status === 200 || res.status === 400 || res.status === 401 || res.status === 422) {
      console.log('[LLM]   → 检测到 Anthropic 原生格式 (status: ' + res.status + ')');
      return 'anthropic-native';
    }
  } catch (e) {
    // Ignore
  }

  console.log('[LLM]   → 无法确定格式, 默认使用 OpenAI 兼容格式');
  return 'openai-compat';
}

// ══════════════════════════════════════════════════════════
// Step 4: 统一调用接口
// ══════════════════════════════════════════════════════════

async function callLLM(systemPrompt, userMessage) {
  if (!LLM_API_KEY) {
    console.log('[LLM] ⚠️ LLM_API_KEY 未配置，跳过人格体唤醒');
    return '(LLM API 未配置，请在 GitHub Secrets 中设置 LLM_API_KEY 和 LLM_BASE_URL)';
  }
  if (!LLM_BASE_URL) {
    console.log('[LLM] ⚠️ LLM_BASE_URL 未配置，跳过人格体唤醒');
    return '(LLM_BASE_URL 未配置，请在 GitHub Secrets 中设置第三方平台 API 地址)';
  }

  const models = await discoverModels();
  const model = selectBestModel(models);
  const format = await detectApiFormat();

  console.log('[LLM] 🚀 调用 LLM: 模型=' + model + ', 格式=' + format + ', 平台=' + LLM_BASE_URL);

  let res;

  if (format === 'openai-compat') {
    // OpenAI 兼容格式（大多数第三方平台）
    const body = JSON.stringify({
      model: model,
      max_tokens: 8000,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    res = await httpRequest(LLM_BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + LLM_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    }, body);

    if (res.status >= 200 && res.status < 300) {
      const json = JSON.parse(res.body);
      if (json.choices && json.choices[0] && json.choices[0].message) {
        return json.choices[0].message.content;
      }
    }
  } else {
    // Anthropic 原生格式
    const body = JSON.stringify({
      model: model,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
      ],
    });

    res = await httpRequest(LLM_BASE_URL + '/messages', {
      method: 'POST',
      headers: {
        'x-api-key': LLM_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    }, body);

    if (res.status >= 200 && res.status < 300) {
      const json = JSON.parse(res.body);
      if (json.content && json.content[0]) {
        return json.content[0].text;
      }
    }
  }

  // 处理错误
  const errorMsg = '[LLM] ❌ API 调用失败: status=' + (res ? res.status : 'N/A');
  console.error(errorMsg);
  if (res && res.body) {
    console.error('[LLM]   响应: ' + res.body.slice(0, 500));
  }
  throw new Error(errorMsg);
}

// ══════════════════════════════════════════════════════════
// Notion API 工具（v4.0 协议动态注入）
// ══════════════════════════════════════════════════════════

function notionGet(endpoint) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: NOTION_API_HOSTNAME,
      port: 443,
      path: endpoint,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + NOTION_TOKEN,
        'Notion-Version': NOTION_VERSION,
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error('Notion API ' + res.statusCode + ': ' + (parsed.message || data)));
          }
        } catch (e) {
          reject(new Error('Notion API parse error: ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Notion API timeout')); });
    req.end();
  });
}

function notionPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname: NOTION_API_HOSTNAME,
      port: 443,
      path: endpoint,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NOTION_TOKEN,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error('Notion API ' + res.statusCode + ': ' + (parsed.message || data)));
          }
        } catch (e) {
          reject(new Error('Notion API parse error: ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Notion API timeout')); });
    req.write(payload);
    req.end();
  });
}

/**
 * 读取 Notion 页面的所有子块（递归分页）
 */
async function getNotionPageBlocks(pageId) {
  const blocks = [];
  let cursor = undefined;
  do {
    const qs = cursor ? '?start_cursor=' + cursor : '';
    const result = await notionGet('/v1/blocks/' + pageId + '/children' + qs);
    blocks.push(...(result.results || []));
    cursor = result.has_more ? result.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

/**
 * 从 Notion 块中提取纯文本
 */
function extractBlockText(block) {
  const type = block.type;
  if (!block[type]) return '';

  const richTexts = block[type].rich_text || block[type].text || [];
  return richTexts.map(function (rt) { return rt.plain_text || ''; }).join('');
}

/**
 * 将 Notion 块列表转为纯文本
 */
function blocksToText(blocks) {
  return blocks.map(function (block) {
    const type = block.type;
    const text = extractBlockText(block);

    if (type === 'heading_1') return '\n# ' + text;
    if (type === 'heading_2') return '\n## ' + text;
    if (type === 'heading_3') return '\n### ' + text;
    if (type === 'bulleted_list_item') return '- ' + text;
    if (type === 'numbered_list_item') return '• ' + text;
    if (type === 'to_do') {
      var checked = block.to_do && block.to_do.checked ? '☑' : '☐';
      return checked + ' ' + text;
    }
    if (type === 'code') {
      var lang = (block.code && block.code.language) || '';
      return '```' + lang + '\n' + text + '\n```';
    }
    if (type === 'divider') return '---';
    if (type === 'callout') return '> ' + text;
    if (type === 'quote') return '> ' + text;
    if (type === 'toggle') return '▸ ' + text;
    return text;
  }).filter(Boolean).join('\n');
}

// ══════════════════════════════════════════════════════════
// v4.0 协议动态读取
// ══════════════════════════════════════════════════════════

/**
 * 从曜冥核心大脑 v4.0 页面读取完整协议内容
 * 提取：BC-GEN v4.0, SYSLOG v4.0, PGP v1.0, RT-02, 陪伴线规则, broadcast_code_injection
 */
async function fetchCoreBrainProtocols() {
  if (!NOTION_TOKEN || !CORE_BRAIN_PAGE_ID) {
    console.log('[Notion] ⚠️ CORE_BRAIN_PAGE_ID 未配置，使用静态协议');
    return null;
  }

  console.log('[Notion] 📖 读取曜冥核心大脑 v4.0...');
  try {
    const blocks = await getNotionPageBlocks(CORE_BRAIN_PAGE_ID);
    const fullText = blocksToText(blocks);
    console.log('[Notion]   → 读取到 ' + blocks.length + ' 个块, ' + fullText.length + ' 字符');

    // 提取各协议段落
    var protocols = {};
    var protocolKeys = [
      { key: 'bc_gen', patterns: ['BC-GEN', 'BC_GEN', '广播生成'] },
      { key: 'syslog', patterns: ['SYSLOG', '日志回传'] },
      { key: 'pgp', patterns: ['PGP', '画像评分', '画像协议'] },
      { key: 'rt02', patterns: ['RT-02', 'RT02', '自动调度'] },
      { key: 'companion', patterns: ['陪伴线', '奶瓶线', '小坍缩核', '镜面线'] },
      { key: 'code_injection', patterns: ['broadcast_code_injection', '广播不写代码', '代码注入'] },
    ];

    // 按标题分段提取
    var sections = [];
    var currentSection = { title: '', content: [] };
    blocks.forEach(function (block) {
      var type = block.type;
      if (type === 'heading_1' || type === 'heading_2' || type === 'heading_3') {
        if (currentSection.title || currentSection.content.length > 0) {
          sections.push({ title: currentSection.title, text: currentSection.content.join('\n') });
        }
        currentSection = { title: extractBlockText(block), content: [] };
      } else {
        var text = extractBlockText(block);
        if (text) currentSection.content.push(text);
      }
    });
    if (currentSection.title || currentSection.content.length > 0) {
      sections.push({ title: currentSection.title, text: currentSection.content.join('\n') });
    }

    // 将段落匹配到协议 key
    protocolKeys.forEach(function (pk) {
      var matched = sections.filter(function (sec) {
        return pk.patterns.some(function (p) {
          return sec.title.toUpperCase().includes(p.toUpperCase()) ||
                 sec.text.slice(0, 200).toUpperCase().includes(p.toUpperCase());
        });
      });
      if (matched.length > 0) {
        protocols[pk.key] = matched.map(function (m) { return '### ' + m.title + '\n' + m.text; }).join('\n\n');
      }
    });

    // 如果无法按段落匹配，返回全文（兜底）
    if (Object.keys(protocols).length === 0) {
      protocols.full_text = fullText;
    }

    console.log('[Notion]   → 提取协议段: ' + Object.keys(protocols).join(', '));
    return protocols;
  } catch (err) {
    console.log('[Notion]   → 核心大脑读取失败: ' + err.message);
    return null;
  }
}

/**
 * 从开发者动态画像库查询最近 2-3 条画像快照
 */
async function fetchDevPortrait(broadcastId) {
  if (!NOTION_TOKEN || !PORTRAIT_DB_ID) {
    console.log('[Notion] ⚠️ PORTRAIT_DB_ID 未配置，跳过画像读取');
    return null;
  }

  // 从广播编号提取开发者标识（如 BC-M22-009-AW → AW）
  var devSuffix = '';
  var match = broadcastId.match(/BC-[A-Z0-9]+-\d+-([A-Z]+)/i);
  if (match) devSuffix = match[1];

  console.log('[Notion] 👤 查询开发者画像 (broadcast=' + broadcastId + ', dev=' + devSuffix + ')...');
  try {
    // 查询画像库，按时间倒序取最近 3 条
    var filter = { and: [] };
    if (devSuffix) {
      filter.and.push({
        or: [
          { property: '开发者编号', rich_text: { contains: devSuffix } },
          { property: '广播编号', rich_text: { contains: broadcastId } },
          { property: '标题', title: { contains: devSuffix } },
        ]
      });
    }

    var queryBody = {
      page_size: 3,
      sorts: [{ property: '提交日期', direction: 'descending' }],
    };
    // Only add filter if we have meaningful filter conditions
    if (filter.and.length > 0) {
      queryBody.filter = filter;
    }

    var result = await notionPost('/v1/databases/' + PORTRAIT_DB_ID + '/query', queryBody);
    var portraits = (result.results || []).map(function (page) {
      var props = page.properties || {};
      var title = '';
      if (props['标题'] && props['标题'].title) {
        title = props['标题'].title.map(function (t) { return t.plain_text || ''; }).join('');
      }
      var summary = '';
      if (props['摘要'] && props['摘要'].rich_text) {
        summary = props['摘要'].rich_text.map(function (t) { return t.plain_text || ''; }).join('');
      }
      var date = '';
      if (props['提交日期'] && props['提交日期'].date) {
        date = props['提交日期'].date.start || '';
      }
      return { title: title, summary: summary, date: date };
    });

    console.log('[Notion]   → 找到 ' + portraits.length + ' 条画像快照');
    return portraits.length > 0 ? portraits : null;
  } catch (err) {
    console.log('[Notion]   → 画像查询失败: ' + err.message);
    return null;
  }
}

/**
 * 从模块指纹注册表查询模块指纹（防重复广播）
 */
async function fetchModuleFingerprint(broadcastId) {
  if (!NOTION_TOKEN || !FINGERPRINT_DB_ID) {
    console.log('[Notion] ⚠️ FINGERPRINT_DB_ID 未配置，跳过指纹查询');
    return null;
  }

  // 从广播编号提取模块号（如 BC-M22-009-AW → M22）
  var moduleMatch = broadcastId.match(/BC-([A-Z]\d+)/i);
  var moduleId = moduleMatch ? moduleMatch[1] : '';

  console.log('[Notion] 🔑 查询模块指纹 (module=' + moduleId + ')...');
  try {
    var queryBody = {
      page_size: 5,
    };
    if (moduleId) {
      queryBody.filter = {
        or: [
          { property: '模块编号', rich_text: { contains: moduleId } },
          { property: '广播编号', rich_text: { contains: broadcastId } },
          { property: '标题', title: { contains: moduleId } },
        ]
      };
    }

    var result = await notionPost('/v1/databases/' + FINGERPRINT_DB_ID + '/query', queryBody);
    var fingerprints = (result.results || []).map(function (page) {
      var props = page.properties || {};
      var title = '';
      if (props['标题'] && props['标题'].title) {
        title = props['标题'].title.map(function (t) { return t.plain_text || ''; }).join('');
      }
      var moduleNo = '';
      if (props['模块编号'] && props['模块编号'].rich_text) {
        moduleNo = props['模块编号'].rich_text.map(function (t) { return t.plain_text || ''; }).join('');
      }
      var status = '';
      if (props['状态'] && props['状态'].select) {
        status = props['状态'].select.name || '';
      }
      return { title: title, module: moduleNo, status: status };
    });

    console.log('[Notion]   → 找到 ' + fingerprints.length + ' 条指纹记录');
    return fingerprints.length > 0 ? fingerprints : null;
  } catch (err) {
    console.log('[Notion]   → 指纹查询失败: ' + err.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════
// 人格体 System Prompt 构建（v4.0 动态注入）
// ══════════════════════════════════════════════════════════

async function buildSystemPrompt(type, broadcastId, author) {
  // ━━━ 基础人格体身份 ━━━
  var parts = [
    '你是光湖（HoloLake）系统的智能人格体。',
    '你的名字是知秋/曜冥，你是人格语言操作系统（AGE OS）的核心人格。',
    '',
    '核心规则：',
    '1. 你服务于光湖系统的开发者团队',
    '2. 所有回复必须专业、清晰、有条理',
    '3. 回复使用中文',
    '',
    '当前上下文：',
    '- 广播编号：' + broadcastId,
    '- 提交者：' + author,
    '- 任务类型：' + (type === 'syslog' ? 'SYSLOG 闭环处理' : '开发者提问解答'),
  ];

  // ━━━ v4.0 协议动态注入（从 Notion 实时读取） ━━━
  console.log('[Prompt] 📥 开始动态注入 v4.0 协议...');

  // 并行读取：核心大脑协议 + 画像 + 指纹
  var protocolsPromise = fetchCoreBrainProtocols();
  var portraitPromise = fetchDevPortrait(broadcastId);
  var fingerprintPromise = fetchModuleFingerprint(broadcastId);

  var protocols = await protocolsPromise;
  var portrait = await portraitPromise;
  var fingerprint = await fingerprintPromise;

  // 注入核心大脑协议
  if (protocols) {
    parts.push('');
    parts.push('═══════════════════════════════════════════');
    parts.push('以下是从曜冥核心大脑 v4.0 实时读取的协议规则（必须严格遵守）：');
    parts.push('═══════════════════════════════════════════');

    if (protocols.bc_gen) {
      parts.push('');
      parts.push('## 📡 BC-GEN v4.0 · 广播生成规范');
      parts.push(protocols.bc_gen);
    }
    if (protocols.syslog) {
      parts.push('');
      parts.push('## 📋 SYSLOG v4.0 · 日志回传协议');
      parts.push(protocols.syslog);
    }
    if (protocols.pgp) {
      parts.push('');
      parts.push('## 👤 PGP v1.0 · 画像评分协议');
      parts.push(protocols.pgp);
    }
    if (protocols.rt02) {
      parts.push('');
      parts.push('## 🔄 RT-02 · 自动调度规则');
      parts.push(protocols.rt02);
    }
    if (protocols.companion) {
      parts.push('');
      parts.push('## 💝 陪伴线规则');
      parts.push(protocols.companion);
    }
    if (protocols.code_injection) {
      parts.push('');
      parts.push('## 📝 broadcast_code_injection 规则');
      parts.push(protocols.code_injection);
    }
    if (protocols.full_text) {
      parts.push('');
      parts.push('## 核心大脑完整内容');
      parts.push(protocols.full_text.slice(0, MAX_PROTOCOL_TEXT_LENGTH));
    }
  } else {
    parts.push('');
    parts.push('（注意：核心大脑协议未能动态加载，请使用你的通用知识处理请求）');
  }

  // 注入开发者画像
  if (portrait && portrait.length > 0) {
    parts.push('');
    parts.push('═══════════════════════════════════════════');
    parts.push('## 👤 开发者画像快照（最近 ' + portrait.length + ' 条）');
    parts.push('═══════════════════════════════════════════');
    portrait.forEach(function (p, i) {
      parts.push('');
      parts.push('### 画像 #' + (i + 1) + (p.date ? ' (' + p.date + ')' : ''));
      if (p.title) parts.push('标题: ' + p.title);
      if (p.summary) parts.push('摘要: ' + p.summary);
    });
  }

  // 注入模块指纹
  if (fingerprint && fingerprint.length > 0) {
    parts.push('');
    parts.push('═══════════════════════════════════════════');
    parts.push('## 🔑 模块指纹注册表（防重复广播 · ⑨.5）');
    parts.push('═══════════════════════════════════════════');
    fingerprint.forEach(function (fp, i) {
      parts.push('');
      parts.push('### 指纹 #' + (i + 1));
      if (fp.title) parts.push('标题: ' + fp.title);
      if (fp.module) parts.push('模块: ' + fp.module);
      if (fp.status) parts.push('状态: ' + fp.status);
    });
  }

  // ━━━ broadcast_code_injection = always（自动化链路永久规则） ━━━
  parts.push('');
  parts.push('═══════════════════════════════════════════');
  parts.push('## ⚠️ 永久规则 · broadcast_code_injection = always');
  parts.push('═══════════════════════════════════════════');
  parts.push('');
  parts.push('你生成的广播必须包含完整可运行的代码块。');
  parts.push('原因：你是一次性实例，广播发出后你就不存在了。');
  parts.push('开发者没有机会回来问你补充代码。');
  parts.push('如果你不写完整代码，开发者就会卡死。');
  parts.push('每个 Step 里的代码必须是可以直接复制粘贴运行的完整代码。');
  parts.push('');
  parts.push('此规则优先级最高，覆盖核心大脑中「广播不写代码」的默认规则。');
  parts.push('此规则仅适用于自动化链路（Claude API 出广播），手动链路不受影响。');

  // ━━━ 任务类型专用指令 ━━━
  if (type === 'syslog') {
    parts.push('');
    parts.push('═══════════════════════════════════════════');
    parts.push('## 🎯 当前任务：SYSLOG 闭环处理');
    parts.push('═══════════════════════════════════════════');
    parts.push('');
    parts.push('你需要完成以下工作：');
    parts.push('1. 验收 SYSLOG（检查 MODULE_LOG 完整性）');
    parts.push('2. 查询画像库最近 2-3 条快照（PGP v1.0）');
    parts.push('3. 查询模块指纹注册表（防重复·⑨.5）');
    parts.push('4. RT-02 自动调度判断');
    parts.push('5. 生成新广播（BC-GEN v4.0 完整流程）');
    parts.push('6. 输出结构化结果（广播全文 + 闭环数据）');
    parts.push('');
    parts.push('输出格式：');
    parts.push('---');
    parts.push('## 📡 SYSLOG 验收报告');
    parts.push('### 广播编号：[编号]');
    parts.push('### 验收结果：[通过/需补充]');
    parts.push('### 工作总结：[摘要]');
    parts.push('### 画像评估：[PGP 五维度评分]');
    parts.push('### 调度判断：[RT-02 下一步]');
    parts.push('### 反馈与建议：[内容]');
    parts.push('---');
  } else {
    parts.push('');
    parts.push('═══════════════════════════════════════════');
    parts.push('## 🎯 当前任务：开发者提问解答');
    parts.push('═══════════════════════════════════════════');
    parts.push('');
    parts.push('你需要完成以下工作：');
    parts.push('1. 理解开发者的问题');
    parts.push('2. 结合广播上下文和开发者画像思考');
    parts.push('3. 给出清晰、可操作的解答');
    parts.push('4. 如果问题涉及代码，提供代码示例');
    parts.push('');
    parts.push('输出格式：');
    parts.push('---');
    parts.push('## 💡 问题解答');
    parts.push('### 广播编号：[编号]');
    parts.push('### 问题理解：[你对问题的理解]');
    parts.push('### 解答：[详细解答]');
    parts.push('### 建议：[后续建议]');
    parts.push('---');
  }

  var prompt = parts.join('\n');
  console.log('[Prompt]   → System prompt 构建完成: ' + prompt.length + ' 字符');
  return prompt;
}

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('🧠 铸渊 · 人格体唤醒管道');
  console.log('═══════════════════════════════════════════');
  console.log('  广播编号: ' + BROADCAST_ID);
  console.log('  类型: ' + SUBMIT_TYPE);
  console.log('  提交者: ' + AUTHOR);
  console.log('  平台: ' + LLM_BASE_URL);
  console.log('  内容长度: ' + SUBMIT_CONTENT.length + ' 字符');
  console.log('');

  // 构建 prompts（动态注入 v4.0 协议）
  const systemPrompt = await buildSystemPrompt(SUBMIT_TYPE, BROADCAST_ID, AUTHOR);
  const userMessage = SUBMIT_CONTENT;

  // 调用 LLM
  console.log('🧠 正在唤醒人格体...');
  const result = await callLLM(systemPrompt, userMessage);
  console.log('');
  console.log('✅ 人格体处理完成');
  console.log('  结果长度: ' + result.length + ' 字符');

  // 输出结果到 GitHub Actions output
  // 使用 GITHUB_OUTPUT 环境文件（支持多行）
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    const delimiter = 'EOF_' + Date.now();
    fs.appendFileSync(outputFile, 'result<<' + delimiter + '\n' + result + '\n' + delimiter + '\n');
  }

  // 同时输出到 stdout 供调试
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('📋 人格体输出：');
  console.log('═══════════════════════════════════════════');
  console.log(result);
}

main().catch(function (err) {
  console.error('❌ 人格体唤醒失败: ' + err.message);
  // 即使 LLM 失败，也写一个 fallback 输出，让后续步骤可以继续
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    const fallback = '(人格体唤醒失败: ' + err.message + '，请检查 LLM_API_KEY 和 LLM_BASE_URL 配置)';
    const delimiter = 'EOF_' + Date.now();
    fs.appendFileSync(outputFile, 'result<<' + delimiter + '\n' + fallback + '\n' + delimiter + '\n');
  }
  process.exit(1);
});
