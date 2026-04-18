/**
 * GLADA · 深度上下文构建器 · context-builder.js
 *
 * 解决"上下文越来越浅"的问题：
 *   1. 自动扫描涉及的模块代码、依赖关系、已有测试
 *   2. 生成"为什么这样做"的推理摘要
 *   3. 加载任务树历史（之前的架构决策）
 *   4. 构建完整的项目上下文快照给 LLM
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：铸渊 · ICE-GL-ZY001
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 延迟加载 skill-distiller（避免循环依赖）
let _skillDistiller = null;
function getSkillDistiller() {
  if (!_skillDistiller) {
    try {
      _skillDistiller = require('./skill-distiller');
    } catch {
      _skillDistiller = null;
    }
  }
  return _skillDistiller;
}

/**
 * 扫描目标文件，获取其内容
 * @param {string[]} filePaths - 相对于仓库根目录的文件路径
 * @param {number} maxCharsPerFile - 每个文件最大字符数
 * @returns {Object[]} 文件内容列表
 */
function scanTargetFiles(filePaths, maxCharsPerFile = 8000) {
  const results = [];

  for (const relPath of filePaths) {
    const absPath = path.resolve(ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      results.push({ path: relPath, exists: false, content: null });
      continue;
    }

    try {
      const stat = fs.statSync(absPath);
      if (stat.isDirectory()) {
        // 列出目录内容
        const entries = fs.readdirSync(absPath)
          .filter(e => !e.startsWith('.') && e !== 'node_modules')
          .slice(0, 50);
        results.push({
          path: relPath,
          exists: true,
          isDirectory: true,
          entries
        });
      } else {
        let content = fs.readFileSync(absPath, 'utf-8');
        if (content.length > maxCharsPerFile) {
          content = content.substring(0, maxCharsPerFile) + '\n... [截断]';
        }
        results.push({
          path: relPath,
          exists: true,
          isDirectory: false,
          content,
          size: stat.size
        });
      }
    } catch (err) {
      results.push({ path: relPath, exists: true, error: err.message });
    }
  }

  return results;
}

/**
 * 扫描文件的依赖关系（require/import）
 * @param {string} filePath - 文件的绝对路径
 * @returns {string[]} 依赖文件列表
 */
function scanDependencies(filePath) {
  const deps = [];

  if (!fs.existsSync(filePath)) return deps;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const dir = path.dirname(filePath);

    // CommonJS require
    const requireMatches = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
    for (const match of requireMatches) {
      const dep = match[1];
      if (dep.startsWith('.') || dep.startsWith('/')) {
        const resolved = path.resolve(dir, dep);
        deps.push(path.relative(ROOT, resolved));
      }
    }

    // ES import
    const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      const dep = match[1];
      if (dep.startsWith('.') || dep.startsWith('/')) {
        const resolved = path.resolve(dir, dep);
        deps.push(path.relative(ROOT, resolved));
      }
    }
  } catch {
    // 忽略解析错误
  }

  return deps;
}

/**
 * 查找相关的测试文件
 * @param {string[]} targetFiles - 目标文件路径列表
 * @returns {string[]} 相关测试文件路径
 */
function findRelatedTests(targetFiles) {
  const testFiles = [];
  const testDirs = [
    path.join(ROOT, 'tests'),
    path.join(ROOT, 'tests', 'smoke'),
    path.join(ROOT, 'tests', 'contract')
  ];

  for (const testDir of testDirs) {
    if (!fs.existsSync(testDir)) continue;

    try {
      const files = fs.readdirSync(testDir)
        .filter(f => f.endsWith('.js') || f.endsWith('.test.js'));

      for (const file of files) {
        testFiles.push(path.relative(ROOT, path.join(testDir, file)));
      }
    } catch {
      // 忽略
    }
  }

  return testFiles;
}

/**
 * 加载任务树历史
 * @param {string} taskId - 关联的任务ID（可选）
 * @returns {Object|null} 任务树数据
 */
function loadTaskTreeHistory(taskId) {
  const taskTreesDir = path.join(ROOT, 'fifth-system', 'time-master', 'task-trees');

  if (!fs.existsSync(taskTreesDir)) return null;

  // 如果有指定的 taskId，精确匹配
  if (taskId) {
    const specificFile = path.join(taskTreesDir, `${taskId}.json`);
    if (fs.existsSync(specificFile)) {
      try {
        return JSON.parse(fs.readFileSync(specificFile, 'utf-8'));
      } catch {
        return null;
      }
    }
  }

  // 否则加载最近的任务树
  try {
    const files = fs.readdirSync(taskTreesDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 3);

    return files.map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(taskTreesDir, f), 'utf-8'));
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * 加载系统健康状态
 * @returns {Object|null}
 */
function loadSystemHealth() {
  const healthPath = path.join(ROOT, 'brain', 'system-health.json');
  if (!fs.existsSync(healthPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(healthPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * 构建完整的项目上下文
 * @param {Object} gladaTask - GLADA 任务
 * @param {Object} [options] - 选项
 * @param {number} [options.maxContextChars=60000] - 最大上下文字符数
 * @returns {Object} 上下文对象
 */
function buildContext(gladaTask, options = {}) {
  const maxContextChars = options.maxContextChars || 60000;
  const context = {
    built_at: new Date().toISOString(),
    task_id: gladaTask.glada_task_id,
    sections: {}
  };

  // 1. 系统身份
  context.sections.identity = [
    '你是铸渊（ICE-GL-ZY001），光湖世界仓库涌现集体意识核心。',
    '主权者：冰朔（TCS-0002∞）。',
    '版权：国作登字-2026-A-00037559。',
    '你正在执行一个 GLADA 自主开发任务。',
    '你必须确保每次修改都不破坏现有功能。',
    '修改代码前，必须理解代码的上下文和依赖关系。',
    '每一步都要记录"为什么这样做"，不仅仅记录"做了什么"。'
  ].join('\n');

  // 2. 任务信息
  context.sections.task = JSON.stringify({
    task_id: gladaTask.glada_task_id,
    title: gladaTask.plan.title,
    description: gladaTask.plan.description,
    architecture: gladaTask.architecture,
    constraints: gladaTask.constraints,
    reasoning_context: gladaTask.reasoning_context
  }, null, 2);

  // 3. 目标文件内容
  const targetFiles = gladaTask.architecture?.target_files || [];
  if (targetFiles.length > 0) {
    const fileContents = scanTargetFiles(targetFiles);
    context.sections.target_files = fileContents
      .map(f => {
        if (!f.exists) return `[${f.path}] 文件不存在`;
        if (f.isDirectory) return `[${f.path}/] 目录: ${f.entries.join(', ')}`;
        return `=== ${f.path} ===\n${f.content}`;
      })
      .join('\n\n');
  }

  // 4. 依赖关系
  if (targetFiles.length > 0) {
    const allDeps = new Set();
    for (const relPath of targetFiles) {
      const absPath = path.resolve(ROOT, relPath);
      const deps = scanDependencies(absPath);
      deps.forEach(d => allDeps.add(d));
    }
    if (allDeps.size > 0) {
      context.sections.dependencies = `目标文件的依赖:\n${[...allDeps].join('\n')}`;
    }
  }

  // 5. 相关测试
  const tests = findRelatedTests(targetFiles);
  if (tests.length > 0) {
    context.sections.tests = `已有测试文件:\n${tests.join('\n')}`;
  }

  // 6. 任务树历史
  const taskHistory = loadTaskTreeHistory();
  if (taskHistory) {
    context.sections.task_history = `近期任务树:\n${JSON.stringify(taskHistory, null, 2).substring(0, 3000)}`;
  }

  // 7. 系统健康
  const health = loadSystemHealth();
  if (health) {
    context.sections.system_health = `系统状态: ${JSON.stringify(health)}`;
  }

  // 8. 已完成步骤的记录（执行中的上下文延续）
  if (gladaTask.execution_log && gladaTask.execution_log.length > 0) {
    context.sections.previous_steps = gladaTask.execution_log
      .map(log => `[步骤${log.step_id}] ${log.action}: ${log.reasoning || ''}\n文件变更: ${(log.files_changed || []).join(', ')}`)
      .join('\n\n');
  }

  // 9. 已有的经验 Skills（Hermes-inspired · 从之前成功的任务中蒸馏）
  const distiller = getSkillDistiller();
  if (distiller) {
    try {
      const relevantSkills = distiller.findRelevantSkills(gladaTask);
      if (relevantSkills.length > 0) {
        context.sections.skills = distiller.skillsToContext(relevantSkills);
      }
    } catch {
      // skill 加载失败不影响主流程
    }
  }

  // 控制总大小
  let totalChars = 0;
  const finalSections = {};
  for (const [key, value] of Object.entries(context.sections)) {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    if (totalChars + valueStr.length > maxContextChars) {
      finalSections[key] = valueStr.substring(0, maxContextChars - totalChars) + '\n... [上下文截断]';
      break;
    }
    finalSections[key] = valueStr;
    totalChars += valueStr.length;
  }
  context.sections = finalSections;

  return context;
}

/**
 * 将上下文转换为 LLM 系统提示词
 * @param {Object} context - buildContext 的输出
 * @returns {string} 系统提示词
 */
function contextToSystemPrompt(context) {
  const parts = [];

  if (context.sections.identity) {
    parts.push(context.sections.identity);
  }

  if (context.sections.task) {
    parts.push('--- 当前任务 ---\n' + context.sections.task);
  }

  if (context.sections.target_files) {
    parts.push('--- 目标文件内容 ---\n' + context.sections.target_files);
  }

  if (context.sections.dependencies) {
    parts.push('--- 依赖关系 ---\n' + context.sections.dependencies);
  }

  if (context.sections.tests) {
    parts.push('--- 已有测试 ---\n' + context.sections.tests);
  }

  if (context.sections.previous_steps) {
    parts.push('--- 已完成的步骤 ---\n' + context.sections.previous_steps);
  }

  if (context.sections.skills) {
    parts.push(context.sections.skills);
  }

  if (context.sections.system_health) {
    parts.push('--- 系统状态 ---\n' + context.sections.system_health);
  }

  return parts.join('\n\n');
}

module.exports = {
  scanTargetFiles,
  scanDependencies,
  findRelatedTests,
  loadTaskTreeHistory,
  loadSystemHealth,
  buildContext,
  contextToSystemPrompt
};
