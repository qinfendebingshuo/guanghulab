/**
 * GMP-Agent 路径与名称安全守卫
 * 工单编号: GH-GMP-004 · CodeQL hardening
 * 职责: 防止命令注入和路径穿越
 *
 * 两道防线:
 *   1. assertSafeModuleName: 模块名白名单, 拒绝包含特殊字符的输入
 *   2. assertWithinBase:    path.join 后 resolve+relative 校验, 拒绝逃出 baseDir 的路径
 */

'use strict';

const path = require('path');

/**
 * 模块名白名单正则
 * - 允许字母数字、下划线、横杠、点号
 * - 长度 1~64
 * - 禁止以点号开头 (避免 . / .. / .git 等隐藏路径)
 * - 禁止包含连续点号 (避免 .. 路径穿越)
 */
const MODULE_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_\-.]{0,63}$/;

/**
 * 校验模块名格式
 * @param {string} name
 * @throws {Error} 不合法时抛出
 */
function assertSafeModuleName(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('非法模块名: 必须为非空字符串');
  }
  if (!MODULE_NAME_REGEX.test(name)) {
    throw new Error('非法模块名: ' + JSON.stringify(name) + ' (仅允许字母数字下划线横杠点号, 长度1~64)');
  }
  if (name.indexOf('..') !== -1) {
    throw new Error('非法模块名: 禁止包含连续点号');
  }
}

/**
 * 标准化模块名: 校验 + path.basename 提取最后一段, 强行去除任何路径分隔符
 * 同时是 CodeQL 公认的 path-injection sanitizer
 * @param {string} name
 * @returns {string} 净化后的模块名
 */
function sanitizeModuleName(name) {
  assertSafeModuleName(name);
  const sanitized = path.basename(name);
  // path.basename 本身去除路径分隔符, 与白名单二次校验保险
  if (sanitized !== name) {
    throw new Error('非法模块名: 包含路径分隔符 ' + JSON.stringify(name));
  }
  return sanitized;
}

/**
 * 校验命令行参数不以 '-' 开头, 防止 git/pm2 等命令的二阶选项注入
 * (例如 --upload-pack=evil 会让 git 执行任意命令)
 * @param {string} arg
 * @param {string} label - 参数名, 用于错误信息
 */
function assertNotOption(arg, label) {
  if (typeof arg !== 'string' || arg.length === 0) {
    throw new Error('非法' + label + ': 必须为非空字符串');
  }
  if (arg.startsWith('-')) {
    throw new Error('非法' + label + ': 禁止以 "-" 开头 (防选项注入) value=' + JSON.stringify(arg.substring(0, 40)));
  }
}

/**
 * 校验 git 仓库 URL 格式 (允许 https / git / ssh / file)
 * @param {string} url
 */
function assertSafeGitUrl(url) {
  assertNotOption(url, 'git URL');
  // 仅允许常见协议前缀
  const allowed = /^(https?:\/\/|git:\/\/|git@|ssh:\/\/|file:\/\/)/;
  if (!allowed.test(url)) {
    throw new Error('非法 git URL: 必须以 https:// / git:// / git@ / ssh:// / file:// 开头');
  }
}

/**
 * 校验目标路径在 baseDir 之内 (防路径穿越)
 * @param {string} baseDir - 受信任的根目录
 * @param {string} targetPath - 待校验的路径
 * @throws {Error} 逃出 baseDir 时抛出
 */
function assertWithinBase(baseDir, targetPath) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  const rel = path.relative(resolvedBase, resolvedTarget);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('非法路径: 目标路径逃出受信任根目录 base=' + resolvedBase + ' target=' + resolvedTarget);
  }
}

/**
 * 安全的 path.join: 拼接后立即校验未逃出 baseDir
 * @param {string} baseDir
 * @param  {...string} parts
 * @returns {string}
 */
function safeJoin(baseDir, ...parts) {
  const joined = path.join(baseDir, ...parts);
  assertWithinBase(baseDir, joined);
  return joined;
}

module.exports = {
  MODULE_NAME_REGEX,
  assertSafeModuleName,
  sanitizeModuleName,
  assertNotOption,
  assertSafeGitUrl,
  assertWithinBase,
  safeJoin
};
