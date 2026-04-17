/**
 * GLADA · Git 操作器 · git-operator.js
 *
 * 负责：
 *   1. 为每个任务创建独立的 Git 分支
 *   2. 每完成一个步骤，自动 commit + push
 *   3. 所有步骤完成后，创建 Pull Request
 *   4. Commit message 包含任务ID + 步骤编号 + 变更摘要
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：铸渊 · ICE-GL-ZY001
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/**
 * 执行 Git 命令
 * @param {string} cmd - Git 命令
 * @param {Object} [options] - 选项
 * @returns {string} 命令输出
 */
function gitExec(cmd, options = {}) {
  const fullCmd = `git ${cmd}`;
  try {
    return execSync(fullCmd, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: options.timeout || 30000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch (err) {
    const errMsg = err.stderr || err.message || '';
    throw new Error(`Git 命令失败: ${fullCmd}\n${errMsg.substring(0, 500)}`);
  }
}

/**
 * 获取当前分支名
 * @returns {string}
 */
function getCurrentBranch() {
  return gitExec('rev-parse --abbrev-ref HEAD');
}

/**
 * 检查工作区是否有未提交的变更
 * @returns {boolean}
 */
function hasUncommittedChanges() {
  const status = gitExec('status --porcelain');
  return status.length > 0;
}

/**
 * 为 GLADA 任务创建新分支
 * @param {string} taskId - 任务 ID
 * @returns {string} 分支名
 */
function createTaskBranch(taskId) {
  const branchName = `glada/${taskId.toLowerCase()}`;
  const currentBranch = getCurrentBranch();

  try {
    // 检查分支是否已存在
    gitExec(`rev-parse --verify ${branchName}`);
    // 分支已存在，切换过去
    gitExec(`checkout ${branchName}`);
    console.log(`[GLADA-Git] 切换到已有分支: ${branchName}`);
  } catch {
    // 分支不存在，创建新分支
    gitExec(`checkout -b ${branchName}`);
    console.log(`[GLADA-Git] 创建新分支: ${branchName} (from ${currentBranch})`);
  }

  return branchName;
}

/**
 * 提交步骤变更
 * @param {string} taskId - 任务 ID
 * @param {number} stepId - 步骤编号
 * @param {string} summary - 变更摘要
 * @param {string[]} files - 变更的文件列表
 * @returns {string} commit hash
 */
function commitStep(taskId, stepId, summary, files) {
  if (!hasUncommittedChanges()) {
    console.log(`[GLADA-Git] 没有变更需要提交`);
    return null;
  }

  // 添加变更的文件
  if (files && files.length > 0) {
    for (const file of files) {
      try {
        gitExec(`add "${file}"`);
      } catch {
        // 文件可能已被删除，尝试 add -A
        gitExec('add -A');
        break;
      }
    }
  } else {
    gitExec('add -A');
  }

  // 构建 commit message（sanitize shell-sensitive chars）
  const sanitized = String(summary || '')
    .replace(/[`$\\!"'\n\r]/g, '_')
    .substring(0, 200);
  const message = `[GLADA] ${String(taskId).replace(/[^A-Za-z0-9_-]/g, '_')} step${stepId} ${sanitized}`;

  // Use --message flag with env var to avoid shell injection
  const { execSync: execSyncLocal } = require('child_process');
  execSyncLocal('git commit -m "$GLADA_COMMIT_MSG"', {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 30000,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, GLADA_COMMIT_MSG: message }
  });
  const hash = gitExec('rev-parse --short HEAD');

  console.log(`[GLADA-Git] ✅ 提交: ${hash} - ${message}`);
  return hash;
}

/**
 * 推送到远程
 * @param {string} branchName - 分支名
 * @returns {boolean} 是否成功
 */
function pushBranch(branchName) {
  try {
    gitExec(`push origin ${branchName}`, { timeout: 60000 });
    console.log(`[GLADA-Git] 📤 推送成功: ${branchName}`);
    return true;
  } catch (err) {
    console.error(`[GLADA-Git] ⚠️ 推送失败: ${err.message}`);
    // 如果是新分支，尝试设置上游
    try {
      gitExec(`push -u origin ${branchName}`, { timeout: 60000 });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 切回原来的分支
 * @param {string} branchName - 要切回的分支名
 */
function checkoutBranch(branchName) {
  try {
    gitExec(`checkout ${branchName}`);
  } catch {
    // 回退到 main
    try { gitExec('checkout main'); } catch {
      try { gitExec('checkout master'); } catch {
        // 忽略
      }
    }
  }
}

/**
 * 获取变更文件列表
 * @returns {string[]}
 */
function getChangedFiles() {
  const status = gitExec('status --porcelain');
  return status.split('\n')
    .filter(Boolean)
    .map(line => line.substring(3).trim());
}

/**
 * 获取 Git 日志（最近 N 条）
 * @param {number} count - 日志条数
 * @returns {string}
 */
function getRecentLog(count = 10) {
  return gitExec(`log --oneline -${count}`);
}

module.exports = {
  gitExec,
  getCurrentBranch,
  hasUncommittedChanges,
  createTaskBranch,
  commitStep,
  pushBranch,
  checkoutBranch,
  getChangedFiles,
  getRecentLog
};
