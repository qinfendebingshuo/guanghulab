/**
 * ═══════════════════════════════════════════════════════════
 * AGE OS · MCP 工具: GitHub 操作
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 提供 6 个 GitHub MCP 工具:
 *   githubReadFile      — 读取仓库文件内容
 *   githubListDir       — 列出目录内容
 *   githubWriteFile     — 创建/更新文件
 *   githubGetCommits    — 获取最近提交
 *   githubGetIssues     — 获取 Issues 列表
 *   githubTriggerDeploy — 触发部署工作流
 */

'use strict';

const github = require('../github-client');

const CONTENT_PREVIEW_LENGTH = 500;

/**
 * githubReadFile — 读取仓库文件内容
 *
 * input:
 *   path: string  — 文件路径（相对仓库根目录）
 *   ref: string   — 分支/标签/SHA（可选，默认 main）
 */
async function githubReadFile(input) {
  const { path, ref } = input;
  if (!path) throw new Error('缺少 path');

  const file = await github.readFile(path, ref);
  return {
    path: file.path,
    size: file.size,
    sha: file.sha,
    content: file.content,
    content_preview: file.content.substring(0, CONTENT_PREVIEW_LENGTH) + (file.content.length > CONTENT_PREVIEW_LENGTH ? '...' : '')
  };
}

/**
 * githubListDir — 列出目录内容
 *
 * input:
 *   path: string — 目录路径（可选，空字符串=根目录）
 *   ref: string  — 分支/标签/SHA（可选）
 */
async function githubListDir(input) {
  const { path, ref } = input;
  return github.listDirectory(path || '', ref);
}

/**
 * githubWriteFile — 创建或更新仓库文件
 *
 * input:
 *   path: string    — 文件路径
 *   content: string — 文件内容
 *   message: string — 提交信息（可选）
 *   sha: string     — 更新时需要当前文件 SHA（可选）
 *   branch: string  — 目标分支（可选）
 */
async function githubWriteFile(input) {
  const { path, content, message, sha, branch } = input;
  if (!path) throw new Error('缺少 path');
  if (content === undefined || content === null) throw new Error('缺少 content');

  return github.writeFile(path, content, message, sha, branch);
}

/**
 * githubGetCommits — 获取最近提交
 *
 * input:
 *   count: number  — 获取数量（可选，默认10，最大100）
 *   branch: string — 分支名（可选）
 */
async function githubGetCommits(input) {
  const { count, branch } = input;
  const commits = await github.getRecentCommits(count, branch);
  return {
    count: commits.length,
    commits
  };
}

/**
 * githubGetIssues — 获取 Issues 列表
 *
 * input:
 *   state: string    — open / closed / all（可选，默认 open）
 *   count: number    — 获取数量（可选，默认10）
 *   labels: string[] — 标签过滤（可选）
 *   type: string     — issue / pr / all（可选，默认 all）
 */
async function githubGetIssues(input) {
  const { state, count, labels, type } = input;

  if (type === 'pr') {
    const prs = await github.getPullRequests(state, count);
    return { count: prs.length, type: 'pull_requests', items: prs };
  }

  const issues = await github.getIssues(state, count, labels);

  if (type === 'issue') {
    const filtered = issues.filter(i => !i.is_pull_request);
    return { count: filtered.length, type: 'issues', items: filtered };
  }

  return { count: issues.length, type: 'all', items: issues };
}

/**
 * githubTriggerDeploy — 触发部署工作流
 *
 * input:
 *   workflow: string — 工作流文件名（如 deploy-to-zhuyuan-server.yml）
 *   ref: string      — 触发分支（可选，默认 main）
 *   inputs: object   — 工作流输入参数（可选）
 */
async function githubTriggerDeploy(input) {
  const { workflow, ref, inputs } = input;
  if (!workflow) throw new Error('缺少 workflow');

  return github.triggerWorkflow(workflow, ref, inputs);
}

module.exports = {
  githubReadFile,
  githubListDir,
  githubWriteFile,
  githubGetCommits,
  githubGetIssues,
  githubTriggerDeploy
};
