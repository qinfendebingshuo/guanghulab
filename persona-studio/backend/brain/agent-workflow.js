/**
 * persona-studio · 铸渊代理开发工作流引擎（壳-核分离架构）
 *
 * 架构设计：
 *   核 = 铸渊核心大脑（Core Brain）
 *       ↳ 加载开发者记忆、画像、项目历史、知识库、模式库
 *       ↳ 深度分析开发者真实意图
 *       ↳ 生成结构化开发计划
 *   壳 = 铸渊代理（Agent Executor）
 *       ↳ 接收核心大脑推送的开发计划
 *       ↳ 逐步执行代码生成
 *       ↳ 广播进度给前端
 *       ↳ 完成后回传核心大脑做自进化
 *
 * 流程：
 *   用户点击「我要开发」
 *     → Agent 唤醒核心大脑
 *     → 核心大脑：加载全部上下文 → 分析意图 → 生成开发计划
 *     → Agent：接收计划 → 逐步执行 → 广播进度
 *     → 核心大脑：知识提取 + 模式更新 + 画像学习 + 进化日志
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ── 常量 ──
// 传入 LLM 的对话文本最大字符数（防止超出模型上下文窗口）
const MAX_CONVERSATION_CHARS = 4000;

// ── 核心大脑模块 ──
const memoryManager = require('./memory-manager');
const personaEngine = require('./persona-engine');
const memoryInjector = require('./memory-injector');
const knowledgeExtractor = require('./knowledge-extractor');
const patternAnalyzer = require('./pattern-analyzer');
const profileLearner = require('./profile-learner');
const evolutionLogger = require('./evolution-logger');

const WORKSPACE_DIR = path.join(__dirname, '..', '..', 'workspace');
const REGISTRY_PATH = path.join(__dirname, '..', '..', 'brain', 'registry.json');
const HUMAN_REGISTRY_PATH = path.join(__dirname, '..', '..', 'brain', 'human-registry.json');

/* ================================================================
   工具函数
   ================================================================ */

/**
 * 调用用户提供的 LLM API（OpenAI 兼容格式）
 */
function callLLM({ apiBase, apiKey, model, messages, maxTokens, temperature, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const base = apiBase.replace(/\/+$/, '');
    const chatUrl = new URL(base + '/chat/completions');
    const isHttps = chatUrl.protocol === 'https:';
    const mod = isHttps ? https : http;

    const body = JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens || 4000,
      temperature: temperature != null ? temperature : 0.3
    });

    const options = {
      hostname: chatUrl.hostname,
      port: chatUrl.port || (isHttps ? 443 : 80),
      path: chatUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: timeoutMs || 60000
    };

    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0] && json.choices[0].message) {
            resolve(json.choices[0].message.content);
          } else if (json.error) {
            reject(new Error(json.error.message || 'API error'));
          } else {
            reject(new Error('Unexpected API response'));
          }
        } catch (_e) {
          reject(new Error('Failed to parse API response'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(body);
    req.end();
  });
}

/**
 * 从注册表查找开发者信息
 */
function lookupDeveloper(devId) {
  if (!devId || devId === 'GUEST') {
    return { dev_id: 'GUEST', name: '访客', role: 'guest' };
  }
  try {
    var reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    if (reg.developers && reg.developers[devId]) {
      return Object.assign({ dev_id: devId }, reg.developers[devId]);
    }
  } catch (_e) { /* ignore */ }
  try {
    var hReg = JSON.parse(fs.readFileSync(HUMAN_REGISTRY_PATH, 'utf-8'));
    if (hReg.developers) {
      var found = hReg.developers.find(function (d) { return d.exp_id === devId; });
      if (found) return { dev_id: devId, name: found.name, role: found.role };
    }
  } catch (_e) { /* ignore */ }
  return { dev_id: devId, name: devId, role: 'developer' };
}

/* ================================================================
   Phase 1: 唤醒铸渊核心大脑（Core Brain Wake）
   ================================================================ */

/**
 * 唤醒核心大脑，加载全部上下文，分析开发者意图，生成开发计划。
 *
 * 核心大脑聚合以下信息源：
 *   ① 开发者身份（来自 registry）
 *   ② 对话记忆（来自 memory-manager）
 *   ③ 用户画像（来自 profile-learner：技术水平、沟通风格、设计偏好）
 *   ④ 项目历史（来自 memory-manager）
 *   ⑤ 知识库（来自 knowledge-extractor）
 *   ⑥ 模式库（来自 pattern-analyzer）
 *   ⑦ 记忆摘要（来自 memory-injector）
 */
async function wakeCoreBrain(devId, conversation, apiBase, apiKey, model) {
  var devInfo = lookupDeveloper(devId);
  var isGuest = devId === 'GUEST';

  // ── ① 加载开发者记忆 ──
  var memory = { conversations: [], last_topic: null };
  if (!isGuest) {
    try { memory = memoryManager.loadMemory(devId); } catch (_e) { /* new user */ }
  }

  // ── ② 加载用户画像 ──
  var profile = null;
  if (!isGuest) {
    try { profile = profileLearner.loadProfile(devId); } catch (_e) { /* ignore */ }
  }

  // ── ③ 加载项目历史 ──
  var projects = { projects: [] };
  if (!isGuest) {
    try { projects = memoryManager.loadProjects(devId); } catch (_e) { /* ignore */ }
  }

  // ── ④ 查询知识库 ──
  var conversationText = conversation
    .map(function (m) { return m.content || ''; })
    .join(' ');
  var relevantKnowledge = [];
  try { relevantKnowledge = knowledgeExtractor.queryKnowledge(conversationText, 5); } catch (_e) { /* ignore */ }

  // ── ⑤ 查询模式库 ──
  var relevantPatterns = [];
  try { relevantPatterns = patternAnalyzer.queryPatterns(conversationText); } catch (_e) { /* ignore */ }

  // ── ⑥ 构建核心大脑认知上下文 ──
  var brainContext = buildBrainContext(devInfo, memory, profile, projects, relevantKnowledge, relevantPatterns);

  // ── ⑦ 使用 LLM 深度分析意图 + 生成开发计划 ──
  var developmentPlan;
  if (apiBase && apiKey && model) {
    developmentPlan = await analyzeIntentWithLLM(brainContext, conversation, apiBase, apiKey, model);
  } else {
    developmentPlan = analyzeIntentLocally(brainContext, conversation);
  }

  return { brainContext: brainContext, developmentPlan: developmentPlan };
}

/**
 * 构建核心大脑认知上下文（聚合全部信息源）
 */
function buildBrainContext(devInfo, memory, profile, projects, knowledge, patterns) {
  return {
    developer: {
      id: devInfo.dev_id,
      name: devInfo.name || devInfo.dev_id,
      role: devInfo.role || 'developer',
      is_guest: devInfo.dev_id === 'GUEST'
    },
    memory: {
      total_conversations: (memory.conversations || []).length,
      last_topic: memory.last_topic || null,
      has_history: (memory.conversations || []).length > 0
    },
    profile: {
      tech_level: (profile && profile.tech_assessment && profile.tech_assessment.level) || null,
      known_skills: (profile && profile.tech_assessment && profile.tech_assessment.known_skills) || [],
      communication_style: (profile && profile.communication_style && profile.communication_style.verbosity) || null,
      design_preference: (profile && profile.design_preferences && profile.design_preferences.color_scheme) || null,
      style_keywords: (profile && profile.design_preferences && profile.design_preferences.style_keywords) || [],
      mood: (profile && profile.emotional_profile && profile.emotional_profile.current_mood) || 'neutral'
    },
    projects: {
      total: (projects.projects || []).length,
      recent: (projects.projects || []).slice(-3).map(function (p) {
        return { name: p.name, status: p.status, files: (p.files || []).length };
      })
    },
    knowledge: knowledge.map(function (k) {
      return { type: k.type, title: k.title, category: k.category };
    }),
    patterns: patterns.slice(0, 3).map(function (p) {
      return {
        name: p.name,
        frequency: p.frequency,
        success_rate: p.success_rate,
        tech_stack: p.common_tech_stack || []
      };
    })
  };
}

/**
 * 使用 LLM 深度分析开发者意图并生成开发计划
 * 核心大脑将全部上下文注入 system prompt，让 LLM 理解开发者的真正需求
 */
async function analyzeIntentWithLLM(brainContext, conversation, apiBase, apiKey, model) {
  var conversationText = conversation.map(function (m) {
    var role = m.role === 'user' ? '用户' : '铸渊';
    return role + ': ' + m.content;
  }).join('\n');

  // 构建核心大脑系统提示词（注入全部上下文）
  var systemParts = [
    '你是铸渊核心大脑的意图分析引擎。',
    '你的任务是深度理解开发者的真实需求，生成精确的开发计划。',
    '',
    '## 开发者档案',
    '- 身份：' + brainContext.developer.name + '（' + brainContext.developer.id + '）',
    '- 角色：' + brainContext.developer.role
  ];

  if (brainContext.developer.is_guest) {
    systemParts.push('- ⚠️ 访客用户（无历史记忆）');
  } else {
    systemParts.push('- 历史对话：' + brainContext.memory.total_conversations + ' 条');
  }

  if (brainContext.memory.last_topic) {
    systemParts.push('- 上次话题：' + brainContext.memory.last_topic);
  }
  if (brainContext.profile.tech_level) {
    systemParts.push('- 技术水平：' + brainContext.profile.tech_level);
  }
  if (brainContext.profile.known_skills.length > 0) {
    systemParts.push('- 已知技能：' + brainContext.profile.known_skills.join(', '));
  }
  if (brainContext.profile.communication_style) {
    systemParts.push('- 沟通风格：' + brainContext.profile.communication_style);
  }
  if (brainContext.profile.design_preference) {
    systemParts.push('- 设计偏好：' + brainContext.profile.design_preference);
  }
  if (brainContext.profile.style_keywords.length > 0) {
    systemParts.push('- 风格关键词：' + brainContext.profile.style_keywords.join('、'));
  }

  if (brainContext.projects.total > 0) {
    systemParts.push('');
    systemParts.push('## 历史项目（共 ' + brainContext.projects.total + ' 个）');
    brainContext.projects.recent.forEach(function (p) {
      systemParts.push('- ' + p.name + '（' + p.status + '，' + p.files + ' 个文件）');
    });
  }

  if (brainContext.knowledge.length > 0) {
    systemParts.push('');
    systemParts.push('## 相关知识库');
    brainContext.knowledge.forEach(function (k) {
      systemParts.push('- [' + k.type + '] ' + k.title);
    });
  }

  if (brainContext.patterns.length > 0) {
    systemParts.push('');
    systemParts.push('## 高频开发模式');
    brainContext.patterns.forEach(function (p) {
      systemParts.push('- ' + p.name + '（' + p.frequency + '次，成功率' + p.success_rate + '%，技术栈：' + p.tech_stack.join('/') + '）');
    });
  }

  systemParts.push('');
  systemParts.push('## 输出要求');
  systemParts.push('根据对话内容和开发者档案，输出严格 JSON 格式的开发计划：');
  systemParts.push('{');
  systemParts.push('  "intent_summary": "一句话总结开发者的真实意图",');
  systemParts.push('  "project_name": "英文项目名(kebab-case)",');
  systemParts.push('  "description": "项目描述（考虑开发者的技术水平和偏好）",');
  systemParts.push('  "design_notes": "设计要点（基于开发者的设计偏好和风格关键词）",');
  systemParts.push('  "tech_decisions": "技术决策说明（基于开发者的技能水平选择合适的复杂度）",');
  systemParts.push('  "files": [');
  systemParts.push('    { "filename": "index.html", "description": "详细文件说明", "key_features": ["功能1","功能2"] }');
  systemParts.push('  ]');
  systemParts.push('}');
  systemParts.push('');
  systemParts.push('注意：');
  systemParts.push('- 只生成前端文件（HTML/CSS/JS），最多5个文件');
  systemParts.push('- 必须包含 index.html');
  systemParts.push('- 根据开发者技术水平调整代码复杂度');
  systemParts.push('- 根据开发者设计偏好决定视觉风格');
  systemParts.push('- 如果对话中提到了具体功能需求，务必全部纳入计划');

  try {
    var reply = await callLLM({
      apiBase: apiBase,
      apiKey: apiKey,
      model: model,
      messages: [
        { role: 'system', content: systemParts.join('\n') },
        { role: 'user', content: '以下是和开发者的完整对话，请分析意图并生成开发计划：\n\n' + conversationText.substring(0, MAX_CONVERSATION_CHARS) }
      ],
      maxTokens: 2000,
      temperature: 0.2,
      timeoutMs: 45000
    });

    var jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      var plan = JSON.parse(jsonMatch[0]);
      if (plan.files && !plan.files.some(function (f) { return f.filename === 'index.html'; })) {
        plan.files.unshift({ filename: 'index.html', description: '主页面', key_features: ['入口页面'] });
      }
      if (plan.files) {
        plan.files = plan.files.slice(0, 5);
      }
      plan._source = 'core_brain_llm';
      return plan;
    }
  } catch (_e) {
    // LLM 分析失败，降级到本地分析
  }

  return analyzeIntentLocally(brainContext, conversation);
}

/**
 * 本地意图分析（无 API 或 API 失败时的降级方案）
 * 使用规则引擎从对话和开发者档案中提取意图
 */
function analyzeIntentLocally(brainContext, conversation) {
  var userText = conversation
    .filter(function (m) { return m.role === 'user'; })
    .map(function (m) { return m.content || ''; })
    .join(' ');

  var projectType = '通用项目';
  if (brainContext.patterns.length > 0) {
    projectType = brainContext.patterns[0].name;
  }

  var designStyle = '现代简约';
  if (brainContext.profile.style_keywords.length > 0) {
    designStyle = brainContext.profile.style_keywords.join(' + ');
  } else if (brainContext.profile.design_preference === 'dark') {
    designStyle = '深色主题·科技感';
  }

  var complexity = 'moderate';
  if (brainContext.profile.tech_level === 'beginner') {
    complexity = 'simple';
  } else if (brainContext.profile.tech_level === 'advanced') {
    complexity = 'advanced';
  }

  return {
    intent_summary: userText.substring(0, 100) || '开发一个网页项目',
    project_name: 'web-project',
    description: userText.substring(0, 200) || '网页项目',
    design_notes: '风格：' + designStyle,
    tech_decisions: '复杂度：' + complexity + '，技术栈：HTML/CSS/JavaScript',
    files: [
      { filename: 'index.html', description: '主页面', key_features: ['响应式布局', '核心功能展示'] },
      { filename: 'style.css', description: '样式文件', key_features: [designStyle] },
      { filename: 'main.js', description: '交互逻辑', key_features: ['用户交互', '动态效果'] }
    ],
    _source: 'core_brain_local'
  };
}

/* ================================================================
   Phase 2: 铸渊代理执行（Agent Execute）
   ================================================================ */

/**
 * Agent 接收核心大脑的开发计划，逐步执行代码生成
 */
async function agentExecute(developmentPlan, devId, apiBase, apiKey, model, broadcastFn) {
  var projectName = 'project-' + Date.now();
  var files = {};
  var filePlan = developmentPlan.files || [];
  var hasUserApi = apiBase && apiKey && model;

  for (var i = 0; i < filePlan.length; i++) {
    var fileSpec = filePlan[i];

    broadcastFn({
      type: 'progress',
      step: 3,
      message: '💻 铸渊代理 · 生成文件 (' + (i + 1) + '/' + filePlan.length + '): ' + fileSpec.filename,
      status: 'building',
      status_text: '生成 ' + fileSpec.filename
    });

    if (hasUserApi) {
      try {
        var code = await generateFileWithLLM(developmentPlan, fileSpec, filePlan, apiBase, apiKey, model);
        files[fileSpec.filename] = code;
      } catch (_e) {
        files[fileSpec.filename] = generatePlaceholder(fileSpec, developmentPlan);
      }
    } else {
      files[fileSpec.filename] = generatePlaceholder(fileSpec, developmentPlan);
    }
  }

  // 写入 workspace
  var projectDir = path.join(WORKSPACE_DIR, devId, projectName);
  fs.mkdirSync(projectDir, { recursive: true });

  var fileList = [];
  var entries = Object.entries(files);
  for (var j = 0; j < entries.length; j++) {
    var safeName = path.basename(entries[j][0]);
    // 安全检查：防止路径遍历和隐藏文件
    if (!safeName || safeName.startsWith('.') || /[/\\]/.test(entries[j][0])) continue;
    fs.writeFileSync(path.join(projectDir, safeName), entries[j][1], 'utf-8');
    fileList.push(safeName);
  }

  // 生成 README
  var readmePath = path.join(projectDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, [
      '# ' + (developmentPlan.project_name || projectName),
      '',
      developmentPlan.description || '',
      '',
      '## 铸渊核心大脑分析',
      '- 意图：' + (developmentPlan.intent_summary || ''),
      '- 设计：' + (developmentPlan.design_notes || ''),
      '- 技术：' + (developmentPlan.tech_decisions || ''),
      '',
      '由光湖 Persona Studio · 铸渊核心大脑 + 铸渊代理 协同开发',
      '生成时间：' + new Date().toISOString()
    ].join('\n'), 'utf-8');
    fileList.push('README.md');
  }

  return { projectName: projectName, files: fileList };
}

/**
 * 使用 LLM 生成单个文件（Agent 执行层）
 * 注入核心大脑的开发计划上下文，确保代码与意图一致
 */
async function generateFileWithLLM(plan, fileSpec, allFiles, apiBase, apiKey, model) {
  var prompt = [
    '你是铸渊代理的代码生成模块。根据核心大脑的开发计划生成代码。',
    '',
    '## 项目信息',
    '- 项目：' + (plan.project_name || 'web-project'),
    '- 描述：' + (plan.description || ''),
    '- 意图：' + (plan.intent_summary || ''),
    '- 设计要点：' + (plan.design_notes || ''),
    '- 技术决策：' + (plan.tech_decisions || ''),
    '',
    '## 当前文件',
    '- 文件名：' + fileSpec.filename,
    '- 说明：' + (fileSpec.description || ''),
    '- 核心功能：' + (fileSpec.key_features || []).join('、'),
    '',
    '## 项目全部文件',
    allFiles.map(function (f) { return '- ' + f.filename + '（' + (f.description || '') + '）'; }).join('\n'),
    '',
    '请直接输出文件内容，不要用 ``` 代码块包裹，不要加任何额外说明。',
    '确保代码完整、可运行、符合核心大脑的设计要求。',
    '如果是 HTML 文件，要正确引用同项目中的 CSS 和 JS 文件。'
  ].join('\n');

  var reply = await callLLM({
    apiBase: apiBase,
    apiKey: apiKey,
    model: model,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 4000,
    temperature: 0.3,
    timeoutMs: 60000
  });

  var clean = reply.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```\S*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return clean;
}

/**
 * 生成占位内容（无 API 或单文件失败时的降级方案）
 */
function generatePlaceholder(fileSpec, plan) {
  var desc = plan.description || plan.intent_summary || plan.project_name || '项目';
  var designNotes = plan.design_notes || '现代简约';

  if (fileSpec.filename === 'index.html') {
    return [
      '<!DOCTYPE html>',
      '<html lang="zh-CN">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '  <title>' + (plan.project_name || '项目') + '</title>',
      '  <link rel="stylesheet" href="style.css">',
      '</head>',
      '<body>',
      '  <div class="container">',
      '    <h1>🌊 ' + desc + '</h1>',
      '    <p>由光湖 Persona Studio · 铸渊核心大脑 + 铸渊代理 协同开发</p>',
      '    <p class="design-note">设计风格：' + designNotes + '</p>',
      '  </div>',
      '  <script src="main.js"></script>',
      '</body>',
      '</html>'
    ].join('\n');
  }
  if (fileSpec.filename.endsWith('.css')) {
    return [
      '/* Generated by Persona Studio · Core Brain + Agent */',
      '* { margin: 0; padding: 0; box-sizing: border-box; }',
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }',
      '.container { text-align: center; padding: 2rem; max-width: 800px; }',
      'h1 { font-size: 2rem; margin-bottom: 1rem; background: linear-gradient(135deg, #60a5fa, #22d3ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }',
      '.design-note { color: #64748b; font-size: 0.875rem; margin-top: 1rem; }'
    ].join('\n');
  }
  if (fileSpec.filename.endsWith('.js')) {
    return '// Generated by Persona Studio · Core Brain + Agent\nconsole.log("' + (plan.project_name || 'Project') + ' initialized by 铸渊代理");\n';
  }
  return '/* Generated by Persona Studio */\n';
}

/* ================================================================
   Phase 3: 核心大脑自进化（Post-Build Evolution）
   ================================================================ */

/**
 * 开发完成后，核心大脑进行自进化：
 *   ① 知识提取 → 更新 knowledge-base.json
 *   ② 模式识别 → 更新 pattern-library.json
 *   ③ 画像学习 → 更新 profile.json
 *   ④ 进化日志 → 更新 evolution-log.json
 */
function coreBrainPostEvolution(devId, conversation, result, brainContext, startTime, success) {
  try {
    var buildTimeMs = Date.now() - startTime;

    // ① 知识提取
    try {
      knowledgeExtractor.autoExtractKnowledge(devId, conversation, result.projectName);
    } catch (_e) { /* non-fatal */ }

    // ② 模式识别
    var patterns = [];
    try {
      patterns = patternAnalyzer.analyzeAndUpdatePatterns(
        devId, conversation, result.files, buildTimeMs, success
      );
    } catch (_e) { /* non-fatal */ }

    // ③ 画像学习（从最后一条用户消息学习）
    if (devId !== 'GUEST') {
      try {
        var lastUser = conversation.filter(function (m) { return m.role === 'user'; }).pop();
        if (lastUser) {
          profileLearner.updateProfile(devId, lastUser.content, result.summary || '');
        }
      } catch (_e) { /* non-fatal */ }
    }

    // ④ 进化日志
    evolutionLogger.logEvent('agent_build_complete', '铸渊代理开发完成: ' + result.projectName, {
      dev_id: devId,
      project: result.projectName,
      files_count: (result.files || []).length,
      build_time_ms: buildTimeMs,
      success: success,
      brain_source: brainContext.developer.is_guest ? 'local' : 'llm',
      patterns_detected: patterns,
      developer_tech_level: brainContext.profile.tech_level,
      developer_projects_total: brainContext.projects.total
    });
  } catch (err) {
    console.error('Core brain post-evolution error:', err.message);
  }
}

/* ================================================================
   主工作流入口
   ================================================================ */

/**
 * 运行铸渊代理开发工作流（壳-核分离）
 *
 * @param {object} params
 * @param {string} params.dev_id       - 开发编号（EXP-XXX 或 GUEST）
 * @param {Array}  params.conversation - 对话历史
 * @param {string} params.api_base     - 用户 API Base URL
 * @param {string} params.api_key      - 用户 API Key
 * @param {string} params.model        - 用户选择的模型
 * @param {Function} params.broadcast  - WebSocket 广播函数
 * @returns {Promise<{projectName, files, summary}>}
 */
async function runWorkflow({ dev_id, conversation, api_base, api_key, model, broadcast }) {
  var emitProgress = broadcast || function () {};
  var startTime = Date.now();
  var brainContext = null;

  // ════════════════════════════════════════════
  //  Phase 1: 唤醒铸渊核心大脑
  // ════════════════════════════════════════════
  emitProgress({
    type: 'progress',
    step: 1,
    total_steps: 5,
    message: '🧠 正在唤醒铸渊核心大脑...',
    status: 'building',
    status_text: '唤醒核心大脑'
  });

  var coreBrainResult;
  try {
    coreBrainResult = await wakeCoreBrain(dev_id, conversation, api_base, api_key, model);
    brainContext = coreBrainResult.brainContext;
  } catch (_err) {
    brainContext = buildBrainContext(
      lookupDeveloper(dev_id),
      { conversations: [], last_topic: null },
      null, { projects: [] }, [], []
    );
    coreBrainResult = {
      brainContext: brainContext,
      developmentPlan: analyzeIntentLocally(brainContext, conversation)
    };
  }

  var plan = coreBrainResult.developmentPlan;

  emitProgress({
    type: 'progress',
    step: 1,
    message: '✅ 核心大脑已唤醒 · 意图分析完成：' + (plan.intent_summary || '').substring(0, 50),
    status: 'building',
    status_text: '意图已分析'
  });

  // ════════════════════════════════════════════
  //  Phase 1.5: 核心大脑推送开发计划
  // ════════════════════════════════════════════
  emitProgress({
    type: 'progress',
    step: 2,
    total_steps: 5,
    message: '📐 核心大脑 → 代理：推送开发计划（' + (plan.files || []).length + ' 个文件）',
    status: 'building',
    status_text: '计划已推送'
  });

  if (plan.design_notes) {
    emitProgress({
      type: 'progress',
      step: 2,
      message: '🎨 设计指令：' + plan.design_notes,
      status: 'building',
      status_text: '设计已确认'
    });
  }

  // ════════════════════════════════════════════
  //  Phase 2: 铸渊代理执行开发
  // ════════════════════════════════════════════
  emitProgress({
    type: 'progress',
    step: 3,
    total_steps: 5,
    message: '💻 铸渊代理 · 开始执行核心大脑的开发计划...',
    status: 'building',
    status_text: '代理执行中'
  });

  var agentResult = await agentExecute(plan, dev_id, api_base, api_key, model, emitProgress);

  emitProgress({
    type: 'progress',
    step: 3,
    message: '✅ 代理执行完成：' + agentResult.files.length + ' 个文件已生成',
    status: 'building',
    status_text: '代码已生成'
  });

  // ════════════════════════════════════════════
  //  Phase 2.5: 预览部署
  // ════════════════════════════════════════════
  emitProgress({
    type: 'progress',
    step: 4,
    total_steps: 5,
    message: '🚀 铸渊代理 · 部署预览...',
    status: 'building',
    status_text: '部署预览'
  });

  // ════════════════════════════════════════════
  //  Phase 3: 核心大脑自进化
  // ════════════════════════════════════════════
  var finalResult = {
    projectName: agentResult.projectName,
    files: agentResult.files,
    summary: '项目 ' + agentResult.projectName + ' 由铸渊核心大脑分析意图 + 铸渊代理执行开发完成，包含 ' + agentResult.files.length + ' 个文件。\n意图：' + (plan.intent_summary || '') + '\n设计：' + (plan.design_notes || '')
  };

  coreBrainPostEvolution(dev_id, conversation, finalResult, brainContext, startTime, true);

  emitProgress({
    type: 'progress',
    step: 5,
    total_steps: 5,
    message: '✨ 铸渊核心大脑 · 自进化完成 · 知识与模式已更新',
    status: 'building',
    status_text: '即将完成'
  });

  return finalResult;
}

module.exports = {
  runWorkflow
};
