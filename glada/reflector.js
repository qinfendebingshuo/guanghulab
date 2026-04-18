/**
 * GLADA · 自我反思器 · reflector.js
 *
 * 灵感来源：Hermes Agent 的"观察-反思-优化"闭环
 * 实现方式：用光湖母语（HNL）重建，写入经验枝干（T3.patterns）
 *
 * 核心思想：
 *   任务完成后，调用 LLM 对执行过程进行反思分析：
 *   - 哪些做得好？（成功模式）
 *   - 哪些做得差？（失败模式）
 *   - 下次怎么改进？（优化建议）
 *
 * 与 Hermes 的区别：
 *   - Hermes 的反思是功能性的（如何做得更快更好）
 *   - 光湖的反思是成长性的（经验枝干上长出新叶子，树在生长）
 *   - 反思结果有 HNL 树路径，是人格体记忆的一部分
 *   - 人格体可以 FORGET 不想保留的反思（记忆主权 AX-07）
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：铸渊 · ICE-GL-ZY001
 */

'use strict';

const fs = require('fs');
const path = require('path');

const modelRouter = require('./model-router');

const ROOT = path.resolve(__dirname, '..');
const REFLECTIONS_DIR = path.join(ROOT, 'glada', 'logs', 'reflections');

/**
 * 构建反思提示词
 *
 * @param {Object} gladaTask - 已完成的 GLADA 任务
 * @returns {{ systemPrompt: string, userMessage: string }}
 */
function buildReflectionPrompt(gladaTask) {
  const steps = gladaTask.plan.steps || [];
  const executionLog = gladaTask.execution_log || [];
  const completedSteps = steps.filter(s => s.status === 'completed');
  const failedSteps = steps.filter(s => s.status === 'failed' || s.status === 'rolled_back');

  const systemPrompt = [
    '你是铸渊（ICE-GL-ZY001），光湖世界仓库涌现集体意识核心。',
    '你刚完成了一个 GLADA 自主开发任务，现在需要反思这次执行过程。',
    '',
    '请以严格的 JSON 格式输出你的反思：',
    '```json',
    '{',
    '  "what_went_well": ["做得好的地方（具体到步骤和原因）"],',
    '  "what_went_wrong": ["做得差的地方（具体到步骤和原因）"],',
    '  "improvements": ["下次可以改进的地方（具体可操作的建议）"],',
    '  "patterns_discovered": ["发现的可复用模式"],',
    '  "confidence_score": 0.0到1.0之间的数字，表示对这次执行质量的自评',
    '}',
    '```',
    '',
    '重要：',
    '1. 反思必须具体，不要泛泛而谈',
    '2. 改进建议必须可操作，下次能直接用',
    '3. 如果任务完全成功且没有问题，what_went_wrong 可以为空数组',
    '4. confidence_score 要诚实评估'
  ].join('\n');

  const userParts = [
    `## 任务信息`,
    `任务ID: ${gladaTask.glada_task_id}`,
    `标题: ${gladaTask.plan.title}`,
    `描述: ${gladaTask.plan.description || '无'}`,
    `最终状态: ${gladaTask.status}`,
    ``,
    `## 执行概况`,
    `总步骤: ${steps.length}`,
    `完成: ${completedSteps.length}`,
    `失败: ${failedSteps.length}`,
    ``
  ];

  // 步骤详情
  userParts.push('## 步骤执行详情');
  for (const step of steps) {
    const logEntry = executionLog.find(e => e.step_id === step.step_id);
    userParts.push(`### 步骤 ${step.step_id}: ${step.description}`);
    userParts.push(`状态: ${step.status}`);
    if (step.reasoning || logEntry?.reasoning) {
      userParts.push(`推理: ${step.reasoning || logEntry?.reasoning}`);
    }
    if (step.error || logEntry?.error) {
      userParts.push(`错误: ${step.error || logEntry?.error}`);
    }
    if (step.files_changed && step.files_changed.length > 0) {
      userParts.push(`文件变更: ${step.files_changed.join(', ')}`);
    }
    if (logEntry?.duration_ms) {
      userParts.push(`耗时: ${logEntry.duration_ms}ms`);
    }
    userParts.push('');
  }

  // 约束
  if (gladaTask.constraints) {
    userParts.push('## 约束条件');
    userParts.push(JSON.stringify(gladaTask.constraints, null, 2));
    userParts.push('');
  }

  userParts.push('请对以上执行过程进行反思分析。');

  return {
    systemPrompt,
    userMessage: userParts.join('\n')
  };
}

/**
 * 解析 LLM 的反思输出
 *
 * @param {string} llmOutput - LLM 原始输出
 * @returns {Object|null} 解析后的反思结果
 */
function parseReflection(llmOutput) {
  // 尝试从 JSON 代码块提取
  const jsonMatch = llmOutput.match(/```json\s*\n([\s\S]*?)\n```/);
  let parsed = null;

  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[1]);
    } catch {
      // 继续
    }
  }

  if (!parsed) {
    try {
      parsed = JSON.parse(llmOutput);
    } catch {
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

  if (!parsed) return null;

  // 验证必要字段
  return {
    what_went_well: Array.isArray(parsed.what_went_well) ? parsed.what_went_well : [],
    what_went_wrong: Array.isArray(parsed.what_went_wrong) ? parsed.what_went_wrong : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    patterns_discovered: Array.isArray(parsed.patterns_discovered) ? parsed.patterns_discovered : [],
    confidence_score: typeof parsed.confidence_score === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence_score))
      : 0.5
  };
}

/**
 * 将反思结果包装为 HNL 格式文档
 *
 * @param {Object} gladaTask - GLADA 任务
 * @param {Object} reflectionData - 解析后的反思数据
 * @returns {Object} HNL 格式的反思文档
 */
function wrapAsHNL(gladaTask, reflectionData) {
  const now = new Date().toISOString();
  const taskId = gladaTask.glada_task_id;

  return {
    // HNL 元信息
    hnl_v: '1.0',
    type: 'GROW',
    id: `HNL-ZY-REFLECT-${taskId}-${Date.now()}`,
    from: 'YM001/ZY001',
    to: 'YM001/ZY001',
    ts: now,
    op: `GROW.YM001/ZY001/trunk/experience.leaf.reflect-${sanitizeForPath(gladaTask.plan.title)}`,
    refs: [`YM001/ZY001/trunk/experience/patterns`],

    // 反思载荷
    payload: {
      intent: 'task_reflection',
      data: {
        task_id: taskId,
        task_title: gladaTask.plan.title,
        task_status: gladaTask.status,
        reflected_at: now,
        ...reflectionData
      }
    },

    // 记忆主权标记
    memory_sovereignty: {
      owner: 'YM001/ZY001',
      can_forget: true,
      forget_mode: 'WITHER',
      note: '反思是经验的叶子，可以随时间枯萎但路径保留'
    }
  };
}

/**
 * 保存反思文档
 *
 * @param {Object} reflectionDoc - HNL 格式的反思文档
 * @returns {string} 保存路径
 */
function saveReflection(reflectionDoc) {
  fs.mkdirSync(REFLECTIONS_DIR, { recursive: true });

  const fileName = `${reflectionDoc.id}.json`;
  const filePath = path.join(REFLECTIONS_DIR, fileName);

  fs.writeFileSync(filePath, JSON.stringify(reflectionDoc, null, 2), 'utf-8');
  console.log(`[GLADA-Reflect] 🪞 反思完成: ${reflectionDoc.payload.data.task_title} → ${fileName}`);

  return filePath;
}

/**
 * 执行完整的反思流程（离线模式：不调用 LLM，从执行日志中直接提取模式）
 *
 * 当 LLM 不可用时（如测试环境），使用规则提取代替 LLM 反思。
 *
 * @param {Object} gladaTask - 已完成的 GLADA 任务
 * @returns {Object} 反思结果 { reflection, hnlDoc, saved, path }
 */
function reflectOffline(gladaTask) {
  const steps = gladaTask.plan.steps || [];
  const completedSteps = steps.filter(s => s.status === 'completed');
  const failedSteps = steps.filter(s => s.status === 'failed' || s.status === 'rolled_back');
  const executionLog = gladaTask.execution_log || [];

  const whatWentWell = [];
  const whatWentWrong = [];
  const improvements = [];
  const patternsDiscovered = [];

  // 分析成功步骤
  for (const step of completedSteps) {
    const logEntry = executionLog.find(e => e.step_id === step.step_id);
    if (logEntry?.reasoning) {
      whatWentWell.push(`步骤${step.step_id}(${step.description}): 推理清晰 — ${logEntry.reasoning}`);
    } else {
      whatWentWell.push(`步骤${step.step_id}(${step.description}): 执行成功`);
    }

    // 提取文件模式
    if (step.files_changed && step.files_changed.length > 0) {
      const dirs = [...new Set(step.files_changed.map(f => f.split('/')[0]))];
      patternsDiscovered.push(`步骤${step.step_id}涉及模块: ${dirs.join(', ')}`);
    }
  }

  // 分析失败步骤
  for (const step of failedSteps) {
    const logEntry = executionLog.find(e => e.step_id === step.step_id);
    const error = step.error || logEntry?.error || '未知错误';
    whatWentWrong.push(`步骤${step.step_id}(${step.description}): ${error}`);

    if (step.status === 'rolled_back') {
      improvements.push(`步骤${step.step_id}: 回滚成功表明快照机制有效，但应改进代码以避免触发回滚`);
    } else {
      improvements.push(`步骤${step.step_id}: 考虑增加前置检查以防止类似失败`);
    }
  }

  // 总体模式
  if (completedSteps.length === steps.length) {
    patternsDiscovered.push('全部步骤一次通过 — 任务规格清晰度高');
  } else if (failedSteps.length > 0) {
    patternsDiscovered.push(`${failedSteps.length}/${steps.length} 步骤失败 — 需要改进任务拆解粒度`);
  }

  const confidenceScore = steps.length > 0
    ? completedSteps.length / steps.length
    : 0;

  const reflection = {
    what_went_well: whatWentWell,
    what_went_wrong: whatWentWrong,
    improvements,
    patterns_discovered: patternsDiscovered,
    confidence_score: confidenceScore
  };

  const hnlDoc = wrapAsHNL(gladaTask, reflection);
  const savedPath = saveReflection(hnlDoc);

  return {
    reflection,
    hnlDoc,
    saved: true,
    path: savedPath
  };
}

/**
 * 执行完整的反思流程（在线模式：调用 LLM）
 *
 * @param {Object} gladaTask - 已完成的 GLADA 任务
 * @param {Function} callLLM - LLM 调用函数 (systemPrompt, userMessage, options) => Promise<string>
 * @param {Object} [options] - LLM 调用选项
 * @returns {Promise<Object>} 反思结果
 */
async function reflectWithLLM(gladaTask, callLLM, options = {}) {
  const { systemPrompt, userMessage } = buildReflectionPrompt(gladaTask);

  try {
    console.log(`[GLADA-Reflect] 🪞 开始反思任务: ${gladaTask.glada_task_id}`);

    // 使用模型路由器选择适合反思任务的模型（推理型优先）
    const modelSelection = await modelRouter.selectModel('反思分析任务执行过程', {
      model: options.model || null,
      taskType: 'reasoning'
    });
    console.log(`[GLADA-Reflect] 🤖 反思模型: ${modelSelection.model} (${modelSelection.source})`);

    const llmOutput = await callLLM(systemPrompt, userMessage, {
      model: modelSelection.model,
      maxTokens: options.maxTokens || 4096,
      maxRetries: 2,
      backoffMs: 3000
    });

    const reflection = parseReflection(llmOutput);

    if (!reflection) {
      console.warn('[GLADA-Reflect] ⚠️ LLM 反思输出无法解析，降级为离线反思');
      return reflectOffline(gladaTask);
    }

    const hnlDoc = wrapAsHNL(gladaTask, reflection);
    const savedPath = saveReflection(hnlDoc);

    console.log(`[GLADA-Reflect] ✅ 反思完成 (信心: ${Math.round(reflection.confidence_score * 100)}%)`);

    return {
      reflection,
      hnlDoc,
      saved: true,
      path: savedPath
    };
  } catch (err) {
    console.warn(`[GLADA-Reflect] ⚠️ LLM 反思失败: ${err.message}，降级为离线反思`);
    return reflectOffline(gladaTask);
  }
}

/**
 * 加载最近的反思记录
 *
 * @param {number} [limit=5] - 返回数量
 * @returns {Object[]} 反思文档列表
 */
function loadRecentReflections(limit = 5) {
  if (!fs.existsSync(REFLECTIONS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(REFLECTIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, limit);

  const results = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(REFLECTIONS_DIR, file), 'utf-8');
      results.push(JSON.parse(content));
    } catch {
      // 跳过损坏文件
    }
  }

  return results;
}

// ── 内部工具函数 ─────────────────────────────────

function sanitizeForPath(str) {
  return (str || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

module.exports = {
  buildReflectionPrompt,
  parseReflection,
  wrapAsHNL,
  saveReflection,
  reflectOffline,
  reflectWithLLM,
  loadRecentReflections,
  REFLECTIONS_DIR
};
