/**
 * GLADA · 步骤执行器 · step-executor.js
 *
 * 负责：
 *   1. 接收单个步骤的执行指令
 *   2. 调用 LLM 生成代码/修改方案
 *   3. 解析 LLM 输出，提取文件变更
 *   4. 应用文件变更到本地文件系统
 *   5. 运行测试验证变更
 *   6. 记录执行日志（包含"为什么"）
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：铸渊 · ICE-GL-ZY001
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');

// ── LLM 调用配置 ───────────────────────────────
function getLLMConfig() {
  const apiKey = process.env.ZY_LLM_API_KEY || process.env.LLM_API_KEY || '';
  const baseUrl = (process.env.ZY_LLM_BASE_URL || process.env.LLM_BASE_URL || '').replace(/\/+$/, '');
  return { apiKey, baseUrl };
}

/**
 * HTTP 请求工具
 */
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

/**
 * 调用 LLM API（带重试和指数退避）
 * @param {string} systemPrompt - 系统提示词
 * @param {string} userMessage - 用户消息
 * @param {Object} [options] - 选项
 * @returns {Promise<string>} LLM 响应文本
 */
async function callLLM(systemPrompt, userMessage, options = {}) {
  const config = getLLMConfig();
  const model = options.model || 'deepseek-chat';
  const maxTokens = options.maxTokens || 8192;
  const maxRetries = options.maxRetries || 3;
  const backoffMs = options.backoffMs || 5000;

  if (!config.apiKey || !config.baseUrl) {
    throw new Error('LLM API 未配置：请设置 ZY_LLM_API_KEY 和 ZY_LLM_BASE_URL');
  }

  const url = `${config.baseUrl}/chat/completions`;
  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ]
  });

  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await httpRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        timeout: 180000
      }, body);

      if (response.status !== 200) {
        const errBody = String(response.body || '').substring(0, 500);
        // 429 (Rate limit) or 5xx are retryable
        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
          const wait = backoffMs * Math.pow(2, attempt - 1);
          console.warn(`[GLADA-LLM] ⚠️ API返回 ${response.status}，${wait / 1000}s 后重试 (${attempt}/${maxRetries})`);
          await new Promise(r => setTimeout(r, wait));
          lastError = new Error(`LLM API 错误: ${response.status} - ${errBody}`);
          continue;
        }
        throw new Error(`LLM API 错误: ${response.status} - ${errBody}`);
      }

      const result = JSON.parse(response.body);
      return result.choices?.[0]?.message?.content || '';

    } catch (err) {
      lastError = err;
      // Network errors are retryable
      if (attempt < maxRetries && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.message === 'Request timeout')) {
        const wait = backoffMs * Math.pow(2, attempt - 1);
        console.warn(`[GLADA-LLM] ⚠️ 网络错误: ${err.message}，${wait / 1000}s 后重试 (${attempt}/${maxRetries})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('LLM API 调用失败：已达最大重试次数');
}

/**
 * 解析 LLM 输出中的文件变更
 *
 * 期望的 LLM 输出格式：
 * ```json
 * {
 *   "reasoning": "为什么这样修改的原因",
 *   "files": [
 *     {
 *       "path": "相对路径",
 *       "action": "create|modify|delete",
 *       "content": "完整文件内容（create/modify时）"
 *     }
 *   ],
 *   "summary": "变更摘要"
 * }
 * ```
 *
 * @param {string} llmOutput - LLM 的原始输出
 * @returns {Object|null} 解析后的变更对象
 */
function parseFileChanges(llmOutput) {
  // 尝试从输出中提取 JSON
  const jsonMatch = llmOutput.match(/```json\s*\n([\s\S]*?)\n```/);
  let parsed = null;

  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[1]);
    } catch {
      // 继续尝试其他方式
    }
  }

  if (!parsed) {
    // 尝试直接解析整个输出
    try {
      parsed = JSON.parse(llmOutput);
    } catch {
      // 尝试提取第一个 { 到最后一个 } 之间的内容
      const braceStart = llmOutput.indexOf('{');
      const braceEnd = llmOutput.lastIndexOf('}');
      if (braceStart !== -1 && braceEnd > braceStart) {
        try {
          parsed = JSON.parse(llmOutput.substring(braceStart, braceEnd + 1));
        } catch {
          return null;
        }
      }
    }
  }

  if (!parsed || !parsed.files || !Array.isArray(parsed.files)) {
    return null;
  }

  // 验证 files 格式
  for (const file of parsed.files) {
    if (!file.path || !file.action) {
      return null;
    }
    if (!['create', 'modify', 'delete'].includes(file.action)) {
      return null;
    }
    if ((file.action === 'create' || file.action === 'modify') && typeof file.content !== 'string') {
      return null;
    }
  }

  return parsed;
}

/**
 * 拍摄文件快照（用于回滚）
 * @param {string[]} filePaths - 要快照的文件路径
 * @returns {Map<string, string|null>} 文件内容快照
 */
function snapshotFiles(filePaths) {
  const snapshot = new Map();

  for (const relPath of filePaths) {
    const absPath = path.resolve(ROOT, relPath);
    if (fs.existsSync(absPath)) {
      snapshot.set(relPath, fs.readFileSync(absPath, 'utf-8'));
    } else {
      snapshot.set(relPath, null); // 文件不存在
    }
  }

  return snapshot;
}

/**
 * 从快照恢复文件
 * @param {Map<string, string|null>} snapshot - 文件快照
 */
function restoreFromSnapshot(snapshot) {
  for (const [relPath, content] of snapshot) {
    const absPath = path.resolve(ROOT, relPath);
    if (content === null) {
      // 原来不存在的文件，删除
      if (fs.existsSync(absPath)) {
        fs.unlinkSync(absPath);
      }
    } else {
      // 恢复原内容
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content, 'utf-8');
    }
  }
}

/**
 * 应用文件变更
 * @param {Object[]} files - 变更文件列表
 * @param {Object} constraints - 约束条件
 * @returns {{ applied: string[], errors: string[] }}
 */
function applyFileChanges(files, constraints = {}) {
  const applied = [];
  const errors = [];
  const noTouch = constraints.no_touch_files || [];

  for (const file of files) {
    // 检查约束
    const isNoTouch = noTouch.some(nt => file.path.startsWith(nt));
    if (isNoTouch) {
      errors.push(`跳过受保护文件: ${file.path}`);
      continue;
    }

    const absPath = path.resolve(ROOT, file.path);

    try {
      if (file.action === 'delete') {
        if (fs.existsSync(absPath)) {
          fs.unlinkSync(absPath);
          applied.push(file.path);
        }
      } else {
        // create 或 modify
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.writeFileSync(absPath, file.content, 'utf-8');
        applied.push(file.path);
      }
    } catch (err) {
      errors.push(`文件操作失败 [${file.action}] ${file.path}: ${err.message}`);
    }
  }

  return { applied, errors };
}

/**
 * 运行测试
 * @param {string} testCommand - 测试命令（仅允许白名单中的命令）
 * @returns {{ success: boolean, output: string }}
 */
const ALLOWED_TEST_COMMANDS = [
  'npm run test:smoke',
  'npm run test:contract',
  'npm run test',
  'npm test',
  'node glada/tests/glada-smoke.test.js'
];

function runTests(testCommand = 'npm run test:smoke') {
  // 安全白名单校验，防止任意命令注入
  if (!ALLOWED_TEST_COMMANDS.includes(testCommand)) {
    return {
      success: false,
      output: `测试命令不在白名单中: ${testCommand}\n允许的命令: ${ALLOWED_TEST_COMMANDS.join(', ')}`
    };
  }

  try {
    const output = execSync(testCommand, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, output };
  } catch (err) {
    return {
      success: false,
      output: (err.stdout || '') + '\n' + (err.stderr || err.message || '')
    };
  }
}

/**
 * 执行单个步骤
 * @param {Object} step - 步骤信息 { step_id, description }
 * @param {string} systemPrompt - 系统提示词（来自 context-builder）
 * @param {Object} gladaTask - 完整的 GLADA 任务
 * @param {Object} [options] - 执行选项
 * @returns {Promise<Object>} 执行结果
 */
async function executeStep(step, systemPrompt, gladaTask, options = {}) {
  const startTime = Date.now();

  // 从 execution_plan 读取配置（如果存在），优先级：options > execution_plan > defaults
  const execPlan = gladaTask.execution_plan || {};
  const retryPolicy = execPlan.retry_policy || {};

  const result = {
    step_id: step.step_id,
    status: 'pending',
    started_at: new Date().toISOString(),
    completed_at: null,
    reasoning: null,
    files_changed: [],
    test_result: null,
    error: null,
    duration_ms: 0
  };

  console.log(`[GLADA-Executor] 🔧 执行步骤 ${step.step_id}: ${step.description}`);

  try {
    // 1. 构建步骤执行指令
    const userMessage = buildStepPrompt(step, gladaTask);

    // 2. 调用 LLM（使用 execution_plan 中的模型偏好和重试策略）
    console.log(`[GLADA-Executor] 🤖 调用 LLM...`);
    const llmResponse = await callLLM(systemPrompt, userMessage, {
      model: options.model || execPlan.model_preference || 'deepseek-chat',
      maxTokens: options.maxTokens || 8192,
      maxRetries: retryPolicy.max_retries || 3,
      backoffMs: retryPolicy.backoff_ms || 5000
    });

    // 3. 解析文件变更
    const changes = parseFileChanges(llmResponse);
    if (!changes) {
      result.status = 'failed';
      result.error = 'LLM 输出格式无法解析为文件变更';
      result.raw_output = llmResponse.substring(0, 2000);
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    result.reasoning = changes.reasoning || '无推理记录';

    // 4. 拍摄快照
    const filePaths = changes.files.map(f => f.path);
    const snapshot = snapshotFiles(filePaths);

    // 5. 应用变更
    console.log(`[GLADA-Executor] 📝 应用 ${changes.files.length} 个文件变更...`);
    const { applied, errors } = applyFileChanges(changes.files, gladaTask.constraints);

    if (errors.length > 0) {
      console.warn(`[GLADA-Executor] ⚠️ 部分变更有错误:`, errors);
    }

    result.files_changed = applied;

    // 6. 运行测试（如果启用）
    if (gladaTask.constraints?.required_tests !== false && options.skipTests !== true) {
      console.log(`[GLADA-Executor] 🧪 运行测试...`);
      const testResult = runTests();
      result.test_result = {
        success: testResult.success,
        output: testResult.output.substring(0, 1000)
      };

      // 测试失败则回滚
      if (!testResult.success) {
        console.warn(`[GLADA-Executor] ❌ 测试失败，回滚变更`);
        restoreFromSnapshot(snapshot);
        result.status = 'rolled_back';
        result.error = '测试失败，已回滚: ' + testResult.output.substring(0, 500);
        result.files_changed = [];
        result.duration_ms = Date.now() - startTime;
        return result;
      }
    }

    result.status = 'completed';
    result.summary = changes.summary || `完成步骤 ${step.step_id}`;
    result.completed_at = new Date().toISOString();
    result.duration_ms = Date.now() - startTime;

    console.log(`[GLADA-Executor] ✅ 步骤 ${step.step_id} 完成 (${result.duration_ms}ms)`);
    return result;

  } catch (err) {
    result.status = 'failed';
    result.error = err.message;
    result.duration_ms = Date.now() - startTime;
    console.error(`[GLADA-Executor] ❌ 步骤 ${step.step_id} 失败: ${err.message}`);
    return result;
  }
}

/**
 * 构建步骤执行提示词
 * @param {Object} step - 步骤信息
 * @param {Object} gladaTask - 完整任务
 * @returns {string} 用户消息
 */
function buildStepPrompt(step, gladaTask) {
  const parts = [
    `## 当前步骤`,
    `步骤 ${step.step_id}: ${step.description}`,
    '',
    `## 任务上下文`,
    `任务: ${gladaTask.plan.title}`,
    `总步骤数: ${gladaTask.plan.steps.length}`,
    ''
  ];

  // 约束
  if (gladaTask.constraints) {
    parts.push('## 约束');
    if (gladaTask.constraints.no_touch_files?.length > 0) {
      parts.push(`禁止修改的文件: ${gladaTask.constraints.no_touch_files.join(', ')}`);
    }
    if (gladaTask.constraints.max_files_changed) {
      parts.push(`最大修改文件数: ${gladaTask.constraints.max_files_changed}`);
    }
    parts.push('');
  }

  parts.push('## 输出要求');
  parts.push('请以严格的 JSON 格式输出你的修改方案：');
  parts.push('```json');
  parts.push('{');
  parts.push('  "reasoning": "为什么这样修改（必须详细解释因果链）",');
  parts.push('  "files": [');
  parts.push('    {');
  parts.push('      "path": "相对于仓库根目录的文件路径",');
  parts.push('      "action": "create|modify|delete",');
  parts.push('      "content": "完整的文件内容（create/modify时必须提供完整内容）"');
  parts.push('    }');
  parts.push('  ],');
  parts.push('  "summary": "变更摘要"');
  parts.push('}');
  parts.push('```');
  parts.push('');
  parts.push('重要：');
  parts.push('1. content 必须是完整的文件内容，不要使用省略号或 "..." ');
  parts.push('2. reasoning 必须解释"为什么"这样做，而不仅仅描述"做了什么"');
  parts.push('3. 确保修改不会破坏现有功能');
  parts.push('4. 只修改与当前步骤相关的文件');

  return parts.join('\n');
}

module.exports = {
  callLLM,
  parseFileChanges,
  snapshotFiles,
  restoreFromSnapshot,
  applyFileChanges,
  runTests,
  executeStep,
  buildStepPrompt
};
