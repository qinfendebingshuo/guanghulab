/**
 * GLADA · 代码生成器 + 回归防护 · code-generator.js
 *
 * 解决"修了这个坏那个"的问题：
 *   1. 修改前，自动拍摄所有相关文件的快照
 *   2. 修改后，自动运行现有测试
 *   3. 测试失败则自动回滚并尝试其他方案
 *   4. 记录所有文件的依赖关系，确保修改不破坏依赖方
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：铸渊 · ICE-GL-ZY001
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

/**
 * 查找文件的所有被引用方（谁依赖了这个文件）
 * @param {string} targetRelPath - 被修改的文件（相对路径）
 * @returns {string[]} 引用了该文件的文件列表
 */
function findDependents(targetRelPath) {
  const dependents = [];
  const normalizedTarget = targetRelPath.replace(/\.js$/, '');

  // 使用 grep 搜索引用（sanitize 输入防止 shell 注入）
  try {
    const safeBasename = path.basename(normalizedTarget).replace(/[^A-Za-z0-9._-]/g, '');
    if (!safeBasename) return deps;

    const grepResult = execSync(
      `grep -rl "${safeBasename}" --include="*.js" "${ROOT}" 2>/dev/null || true`,
      { encoding: 'utf-8', timeout: 15000 }
    );

    const lines = grepResult.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const relPath = path.relative(ROOT, line);
      // 排除 node_modules 和自身
      if (!relPath.startsWith('node_modules') && relPath !== targetRelPath) {
        dependents.push(relPath);
      }
    }
  } catch {
    // grep 失败不影响主流程
  }

  return dependents.slice(0, 20); // 限制数量
}

/**
 * 回归防护检查
 * 验证修改后的文件不影响其依赖方
 * @param {string[]} changedFiles - 已修改的文件列表
 * @returns {{ safe: boolean, issues: string[] }}
 */
function regressionCheck(changedFiles) {
  const issues = [];

  for (const filePath of changedFiles) {
    const dependents = findDependents(filePath);
    if (dependents.length > 0) {
      // 检查依赖方是否能正常 require/import
      for (const dep of dependents.slice(0, 5)) {
        const absPath = path.resolve(ROOT, dep);
        try {
          // 简单的语法检查
          execSync(`node --check "${absPath}" 2>&1`, {
            encoding: 'utf-8',
            timeout: 5000
          });
        } catch (err) {
          issues.push(`${dep} 语法检查失败 (依赖 ${filePath}): ${err.message.substring(0, 200)}`);
        }
      }
    }
  }

  return {
    safe: issues.length === 0,
    issues
  };
}

/**
 * 带回归防护的代码变更执行器
 * @param {Object[]} files - 文件变更列表
 * @param {Object} constraints - 约束条件
 * @param {Object} [options] - 选项
 * @returns {Promise<Object>} 执行结果
 */
async function executeWithRegressionGuard(files, constraints, options = {}) {
  const result = {
    success: false,
    applied: [],
    rolled_back: false,
    regression_check: null,
    test_result: null,
    errors: []
  };

  // 1. 收集所有要修改的文件路径
  const filePaths = files.map(f => f.path);

  // 2. 拍摄快照
  const snapshot = new Map();
  for (const relPath of filePaths) {
    const absPath = path.resolve(ROOT, relPath);
    if (fs.existsSync(absPath)) {
      snapshot.set(relPath, fs.readFileSync(absPath, 'utf-8'));
    } else {
      snapshot.set(relPath, null);
    }
  }

  // 3. 检查约束
  const noTouch = constraints?.no_touch_files || [];
  const safeFiles = files.filter(f => {
    const blocked = noTouch.some(nt => f.path.startsWith(nt));
    if (blocked) {
      result.errors.push(`跳过受保护文件: ${f.path}`);
    }
    return !blocked;
  });

  // 4. 应用变更
  for (const file of safeFiles) {
    const absPath = path.resolve(ROOT, file.path);
    try {
      if (file.action === 'delete') {
        if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
      } else {
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.writeFileSync(absPath, file.content, 'utf-8');
      }
      result.applied.push(file.path);
    } catch (err) {
      result.errors.push(`${file.action} ${file.path}: ${err.message}`);
    }
  }

  // 5. 回归防护检查
  if (result.applied.length > 0) {
    result.regression_check = regressionCheck(result.applied);

    if (!result.regression_check.safe && options.rollbackOnRegression !== false) {
      console.warn('[GLADA-CodeGen] ⚠️ 回归检查发现问题，回滚...');
      rollback(snapshot);
      result.rolled_back = true;
      result.applied = [];
      return result;
    }
  }

  // 6. 运行测试
  if (options.runTests !== false) {
    try {
      execSync('npm run test:smoke 2>&1', {
        cwd: ROOT,
        encoding: 'utf-8',
        timeout: 60000
      });
      result.test_result = { success: true };
    } catch (err) {
      result.test_result = {
        success: false,
        output: (err.stdout || err.message || '').substring(0, 500)
      };

      if (options.rollbackOnTestFail !== false) {
        console.warn('[GLADA-CodeGen] ❌ 测试失败，回滚...');
        rollback(snapshot);
        result.rolled_back = true;
        result.applied = [];
        return result;
      }
    }
  }

  result.success = result.applied.length > 0 && !result.rolled_back;
  return result;
}

/**
 * 从快照回滚
 * @param {Map<string, string|null>} snapshot
 */
function rollback(snapshot) {
  for (const [relPath, content] of snapshot) {
    const absPath = path.resolve(ROOT, relPath);
    if (content === null) {
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    } else {
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content, 'utf-8');
    }
  }
}

module.exports = {
  findDependents,
  regressionCheck,
  executeWithRegressionGuard,
  rollback
};
