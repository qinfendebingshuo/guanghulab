/**
 * GLADA · Skill 蒸馏器 · skill-distiller.js
 *
 * 灵感来源：Hermes Agent 的 Skill Distillation 机制
 * 实现方式：用光湖母语（HNL）重建，不引入 Hermes 代码
 *
 * 核心思想：
 *   任务完成后，从执行日志中自动提炼可复用的 skill 模板。
 *   下次遇到相似任务时，自动加载已有 skill，避免"每次从零开始"。
 *
 * Skill = HNL 格式的经验结晶：
 *   - 什么类型的任务
 *   - 成功的步骤模式
 *   - 关键文件和依赖
 *   - 常见陷阱和解决方案
 *
 * 与 Hermes 的区别：
 *   - Hermes 的 skill 是独立的程序性模板（功能导向）
 *   - 光湖的 skill 是经验枝干上的叶子（T3.templates），有树路径、有记忆主权
 *   - 人格体可以 FORGET 不再需要的 skill（记忆主权 AX-07）
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：铸渊 · ICE-GL-ZY001
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(ROOT, 'glada', 'skills');

/**
 * 从完成的任务中蒸馏 skill
 *
 * @param {Object} gladaTask - 已完成的 GLADA 任务
 * @returns {Object|null} 蒸馏出的 skill 文档（HNL 格式），或 null（不值得蒸馏）
 */
function distillSkill(gladaTask) {
  // 只蒸馏成功完成的任务
  if (gladaTask.status !== 'completed') {
    return null;
  }

  const steps = gladaTask.plan.steps || [];
  const completedSteps = steps.filter(s => s.status === 'completed');
  const executionLog = gladaTask.execution_log || [];

  // 至少完成 1 个步骤才值得蒸馏
  if (completedSteps.length === 0) {
    return null;
  }

  const now = new Date().toISOString();
  const taskId = gladaTask.glada_task_id;

  // 提取步骤模式
  const stepPatterns = completedSteps.map(step => {
    const logEntry = executionLog.find(e => e.step_id === step.step_id);
    return {
      description: step.description,
      reasoning: step.reasoning || logEntry?.reasoning || null,
      files_changed: step.files_changed || logEntry?.files_changed || [],
      duration_ms: logEntry?.duration_ms || null
    };
  });

  // 提取所有涉及的文件（去重）
  const allFiles = [...new Set(
    stepPatterns.flatMap(p => p.files_changed)
  )];

  // 提取失败教训
  const failedSteps = steps.filter(s => s.status === 'failed' || s.status === 'rolled_back');
  const lessons = failedSteps.map(step => {
    const logEntry = executionLog.find(e => e.step_id === step.step_id);
    return {
      step_description: step.description,
      error: step.error || logEntry?.error || '未知错误',
      status: step.status
    };
  });

  // 生成 skill 标签（从任务标题和步骤中提取关键词）
  const tags = extractTags(gladaTask.plan.title, stepPatterns);

  // 构建 HNL 格式的 skill 文档
  const skill = {
    // HNL 元信息
    hnl_v: '1.0',
    type: 'SKILL',
    id: `SKILL-${taskId}-${Date.now()}`,
    from: 'YM001/ZY001',
    ts: now,
    op: `GROW.YM001/ZY001/trunk/experience.leaf.${sanitizeForPath(gladaTask.plan.title)}`,

    // Skill 内容
    skill: {
      name: gladaTask.plan.title,
      source_task: taskId,
      distilled_at: now,
      tags,
      success_rate: completedSteps.length / steps.length,

      // 步骤模板（核心：可复用的执行模式）
      step_patterns: stepPatterns,

      // 涉及的文件域
      file_domain: allFiles,

      // 从失败中学到的教训
      lessons_learned: lessons,

      // 约束记忆
      constraints_used: gladaTask.constraints || {},

      // 架构上下文（帮助匹配相似任务）
      architecture_context: {
        target_files: gladaTask.architecture?.target_files || [],
        target_modules: gladaTask.architecture?.target_modules || [],
        summary: gladaTask.architecture?.summary || ''
      }
    },

    // 记忆主权标记
    memory_sovereignty: {
      owner: 'YM001/ZY001',
      can_forget: true,
      forget_mode: 'ARCHIVE',
      note: '铸渊可以选择遗忘不再需要的 skill（AX-07 记忆主权）'
    }
  };

  return skill;
}

/**
 * 保存 skill 到本地存储
 *
 * @param {Object} skill - HNL 格式的 skill 文档
 * @returns {string} 保存的文件路径
 */
function saveSkill(skill) {
  fs.mkdirSync(SKILLS_DIR, { recursive: true });

  const fileName = `${skill.id}.json`;
  const filePath = path.join(SKILLS_DIR, fileName);

  fs.writeFileSync(filePath, JSON.stringify(skill, null, 2), 'utf-8');
  console.log(`[GLADA-Skill] 🧪 Skill 蒸馏完成: ${skill.skill.name} → ${fileName}`);

  return filePath;
}

/**
 * 加载所有已有的 skills
 *
 * @returns {Object[]} skill 文档列表
 */
function loadAllSkills() {
  if (!fs.existsSync(SKILLS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(SKILLS_DIR)
    .filter(f => f.endsWith('.json'));

  const skills = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(SKILLS_DIR, file), 'utf-8');
      const skill = JSON.parse(content);
      if (skill.type === 'SKILL') {
        skills.push(skill);
      }
    } catch {
      // 跳过损坏的 skill 文件
    }
  }

  return skills;
}

/**
 * 查找与当前任务相关的 skills
 *
 * 匹配策略（按优先级）：
 *   1. 文件域重叠（涉及相同的文件/目录）
 *   2. 标签匹配（任务标题中的关键词）
 *   3. 模块匹配（target_modules 重叠）
 *
 * @param {Object} gladaTask - 当前待执行的 GLADA 任务
 * @param {Object} [options] - 选项
 * @param {number} [options.maxResults=3] - 最大返回数量
 * @returns {Object[]} 相关的 skill 列表（按相关度排序）
 */
function findRelevantSkills(gladaTask, options = {}) {
  const maxResults = options.maxResults || 3;
  const allSkills = loadAllSkills();

  if (allSkills.length === 0) {
    return [];
  }

  const taskFiles = gladaTask.architecture?.target_files || [];
  const taskModules = gladaTask.architecture?.target_modules || [];
  const taskTags = extractTags(gladaTask.plan.title, []);

  const scored = allSkills.map(skill => {
    let score = 0;
    const skillData = skill.skill;

    // 1. 文件域重叠
    const skillFiles = skillData.file_domain || [];
    const fileOverlap = taskFiles.filter(f =>
      skillFiles.some(sf => sf === f || sf.startsWith(path.dirname(f) + '/'))
    ).length;
    score += fileOverlap * 3;

    // 2. 标签匹配
    const skillTags = skillData.tags || [];
    const tagOverlap = taskTags.filter(t => skillTags.includes(t)).length;
    score += tagOverlap * 2;

    // 3. 模块匹配
    const skillModules = skillData.architecture_context?.target_modules || [];
    const moduleOverlap = taskModules.filter(m => skillModules.includes(m)).length;
    score += moduleOverlap * 2;

    // 4. 成功率加权
    score *= (skillData.success_rate || 0.5);

    return { skill, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.skill);
}

/**
 * 将 skills 格式化为 LLM 可读的上下文片段
 *
 * @param {Object[]} skills - skill 文档列表
 * @returns {string} 格式化的上下文文本
 */
function skillsToContext(skills) {
  if (!skills || skills.length === 0) {
    return '';
  }

  const parts = ['--- 已有的经验 Skill（从之前成功的任务中蒸馏） ---'];

  for (const skill of skills) {
    const s = skill.skill;
    parts.push(`\n### Skill: ${s.name}`);
    parts.push(`来源: ${s.source_task} | 成功率: ${Math.round((s.success_rate || 0) * 100)}%`);

    if (s.step_patterns && s.step_patterns.length > 0) {
      parts.push('步骤模式:');
      for (const p of s.step_patterns) {
        parts.push(`  - ${p.description}`);
        if (p.reasoning) {
          parts.push(`    原因: ${p.reasoning}`);
        }
        if (p.files_changed && p.files_changed.length > 0) {
          parts.push(`    涉及文件: ${p.files_changed.join(', ')}`);
        }
      }
    }

    if (s.lessons_learned && s.lessons_learned.length > 0) {
      parts.push('⚠️ 教训:');
      for (const lesson of s.lessons_learned) {
        parts.push(`  - ${lesson.step_description}: ${lesson.error}`);
      }
    }

    if (s.file_domain && s.file_domain.length > 0) {
      parts.push(`文件域: ${s.file_domain.join(', ')}`);
    }
  }

  return parts.join('\n');
}

/**
 * 完整的蒸馏流程：从任务中提炼 skill 并保存
 *
 * @param {Object} gladaTask - 已完成的 GLADA 任务
 * @returns {{ skill: Object|null, saved: boolean, path: string|null }}
 */
function distillAndSave(gladaTask) {
  const skill = distillSkill(gladaTask);

  if (!skill) {
    console.log(`[GLADA-Skill] ⏭️ 任务 ${gladaTask.glada_task_id} 不满足蒸馏条件，跳过`);
    return { skill: null, saved: false, path: null };
  }

  const savedPath = saveSkill(skill);
  return { skill, saved: true, path: savedPath };
}

// ── 内部工具函数 ─────────────────────────────────

/**
 * 从任务标题和步骤中提取关键词标签
 * @param {string} title - 任务标题
 * @param {Object[]} patterns - 步骤模式
 * @returns {string[]} 标签列表
 */
function extractTags(title, patterns) {
  const tags = new Set();

  // 从标题提取
  const titleWords = (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);

  for (const word of titleWords) {
    tags.add(word);
  }

  // 从步骤描述提取
  for (const p of patterns) {
    const desc = (p.description || '').toLowerCase();
    // 提取技术关键词
    const techWords = desc.match(/(?:api|route|schema|test|deploy|config|auth|middleware|database|sql|css|html|component|module|service|hook|plugin|skill)/gi);
    if (techWords) {
      techWords.forEach(w => tags.add(w.toLowerCase()));
    }
  }

  // 从文件路径提取模块名
  for (const p of patterns) {
    for (const file of (p.files_changed || [])) {
      const parts = file.split('/');
      if (parts.length > 1) {
        tags.add(parts[0]); // 顶层目录作为标签
      }
    }
  }

  return [...tags].slice(0, 20); // 最多20个标签
}

/**
 * 将字符串转为安全的路径片段
 * @param {string} str - 输入字符串
 * @returns {string} 安全的路径片段
 */
function sanitizeForPath(str) {
  return (str || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

module.exports = {
  distillSkill,
  saveSkill,
  loadAllSkills,
  findRelevantSkills,
  skillsToContext,
  distillAndSave,
  extractTags,
  SKILLS_DIR
};
