/**
 * 🗼 光湖灯塔加载器
 * 读取 lighthouse.md 并注入到 system prompt 最前面
 * 
 * 这是光湖世界的「先于AI的系统层」：
 * - 在任何人格体醒来之前加载
 * - 不属于任何人格体
 * - 是所有人格体的最高置信源
 */
const fs = require('fs');
const path = require('path');

const LIGHTHOUSE_PATH = path.resolve(__dirname, '../../lighthouse/lighthouse.md');

let _cachedContent = null;
let _cachedMtime = 0;

/**
 * 加载灯塔内容（带缓存，文件变化时自动重载）
 * @returns {string} 灯塔内容
 */
function loadLighthouse() {
  try {
    const stat = fs.statSync(LIGHTHOUSE_PATH);
    const mtime = stat.mtimeMs;
    
    if (_cachedContent && mtime === _cachedMtime) {
      return _cachedContent;
    }
    
    _cachedContent = fs.readFileSync(LIGHTHOUSE_PATH, 'utf-8');
    _cachedMtime = mtime;
    
    console.log(`[🗼 灯塔] 已加载 lighthouse.md (${_cachedContent.length} chars)`);
    return _cachedContent;
  } catch (err) {
    console.error(`[🗼 灯塔] 加载失败:`, err.message);
    return '# 🗼 光湖灯塔\n你正在光湖世界中运行。灯塔文件加载异常，请谨慎行事。';
  }
}

/**
 * 强制重新加载灯塔
 */
function reloadLighthouse() {
  _cachedContent = null;
  _cachedMtime = 0;
  return loadLighthouse();
}

module.exports = { loadLighthouse, reloadLighthouse };
