/**
 * ═══════════════════════════════════════════════════════════
 * ZY-MIRROR-AGENT · 镜鉴 Agent · 数据源配置
 * ═══════════════════════════════════════════════════════════
 *
 * 第三方书库数据源注册表
 * 当前接入：番茄小说（FQWeb API） + 七猫小说（7mao-downloader API）
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const path = require('path');

/**
 * 镜面 Agent 全局配置
 */
const MIRROR_CONFIG = {
  // Agent 身份
  agent_id: 'ZY-MIRROR-AGENT',
  agent_name: '镜鉴',
  version: '1.0.0',

  // 定时执行间隔（毫秒）— 默认每 6 小时扫描一次
  scan_interval_ms: 6 * 60 * 60 * 1000,

  // 数据目录
  data_dir: process.env.ZY_MIRROR_DATA_DIR || path.join(__dirname, 'data'),
  snapshot_dir: path.join(process.env.ZY_MIRROR_DATA_DIR || path.join(__dirname, 'data'), 'snapshots'),
  ticket_dir: path.join(process.env.ZY_MIRROR_DATA_DIR || path.join(__dirname, 'data'), 'tickets'),
  memory_dir: path.join(process.env.ZY_MIRROR_DATA_DIR || path.join(__dirname, 'data'), 'memory'),

  // LLM 评估模型配置
  llm: {
    // 优先使用 DeepSeek（国内部署友好），回退到 Claude
    primary: {
      provider: 'deepseek',
      model: 'deepseek-chat',
      api_url: process.env.ZY_DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
      api_key: process.env.ZY_DEEPSEEK_API_KEY || ''
    },
    fallback: {
      provider: 'claude',
      model: 'claude-sonnet-4-20250514',
      api_url: process.env.ZY_CLAUDE_API_URL || 'https://api.anthropic.com/v1/messages',
      api_key: process.env.ZY_CLAUDE_API_KEY || ''
    }
  },

  // 工单编号前缀
  ticket_prefix: 'MIRROR',

  // 边界：Agent 只能修改这些路径
  allowed_paths: [
    '/opt/zhiku/data/index/',
    '/opt/zhiku/data/books/',
    '/opt/zhiku/data/mirror-agent/'
  ],

  // 边界：Agent 绝不能触碰的路径
  forbidden_paths: [
    '/opt/zhiku/server/',
    '/etc/nginx/',
    '/root/',
    '~/.ssh/'
  ]
};

/**
 * 第三方书库数据源注册表
 *
 * 每个数据源定义：
 *   id          — 唯一标识
 *   name        — 中文名称
 *   type        — 数据源类型 (api / github_release / static)
 *   search_url  — 搜索接口 URL 模板（{query} 和 {page} 为占位符）
 *   detail_url  — 书籍详情接口 URL 模板（{book_id} 为占位符）
 *   version_url — 版本/更新检查 URL（用于 diff 快照）
 *   github_repo — GitHub 仓库地址（用于跟踪上游更新）
 *   enabled     — 是否启用
 *   notes       — 说明
 */
const DATA_SOURCES = [
  {
    id: 'fanqie-fqweb',
    name: '番茄小说 · FQWeb',
    type: 'api',
    search_url: '{base_url}/search?query={query}&page={page}',
    detail_url: '{base_url}/info?bookId={book_id}',
    chapter_url: '{base_url}/content?bookId={book_id}&itemId={chapter_id}',
    catalog_url: '{base_url}/catalog?bookId={book_id}',
    version_url: '{base_url}/version',
    base_url: process.env.ZY_FANQIE_API_URL || 'http://127.0.0.1:9999',
    github_repo: 'https://github.com/benefit77/FanQieWeb',
    deploy_notes: 'Kotlin JAR 服务 · 默认端口 9999 · 需 JRE 17+',
    enabled: true,
    priority: 1,
    notes: '番茄小说 Web 服务 · 搜索/详情/目录/章节内容全接口'
  },
  {
    id: 'fanqie-api-server',
    name: '番茄小说 · API Server (Flask)',
    type: 'api',
    search_url: '{base_url}/search?keyword={query}',
    detail_url: '{base_url}/book/{book_id}',
    chapter_url: '{base_url}/chapter/{chapter_id}',
    catalog_url: '{base_url}/catalog/{book_id}',
    base_url: process.env.ZY_FANQIE_FLASK_URL || 'http://127.0.0.1:5000',
    github_repo: 'https://github.com/huijian222/fanqienovel-API-server',
    deploy_notes: 'Python Flask · pip install · 默认端口 5000',
    enabled: false,
    priority: 2,
    notes: '番茄小说 Flask API 服务 · 备用源'
  },
  {
    id: 'qimao-downloader',
    name: '七猫小说 · SwiftCat Downloader',
    type: 'api',
    search_url: '{base_url}/search?keyword={query}',
    detail_url: '{base_url}/book/{book_id}',
    chapter_url: '{base_url}/chapter/{book_id}/{chapter_id}',
    catalog_url: '{base_url}/catalog/{book_id}',
    base_url: process.env.ZY_QIMAO_API_URL || 'http://127.0.0.1:7700',
    github_repo: 'https://github.com/shing-yu/7mao-novel-downloader',
    github_repo_new: 'https://github.com/shing-yu/swiftcat-downloader',
    deploy_notes: 'Python · pip install · 或 Flutter 桌面版',
    enabled: true,
    priority: 1,
    notes: '七猫小说下载器 · 支持搜索/下载/导出 TXT/EPUB'
  }
];

/**
 * 获取所有启用的数据源
 */
function getEnabledSources() {
  return DATA_SOURCES.filter(s => s.enabled).sort((a, b) => a.priority - b.priority);
}

/**
 * 根据 ID 获取数据源
 */
function getSourceById(id) {
  return DATA_SOURCES.find(s => s.id === id) || null;
}

module.exports = {
  MIRROR_CONFIG,
  DATA_SOURCES,
  getEnabledSources,
  getSourceById
};
