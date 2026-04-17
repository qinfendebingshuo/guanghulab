/**
 * ═══════════════════════════════════════════════════════════
 * 光湖智库节点 · Phase 1 API 服务
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-SVR-006-API-P1
 * 服务器: ZY-SVR-006 (43.153.203.105 · 新加坡)
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * Phase 1 功能:
 *   GET  /api/health          — 系统健康检查 (Nginx 存活探针)
 *   GET  /shield/status       — 语言保护罩状态 + 封禁统计
 *   GET  /shield/logs         — 最近封禁日志 (面板读取)
 *
 * Phase 2 功能 (智库节点三大引擎):
 *   /api/zhiku/download/*     — 下载引擎 (书籍下载任务管理)
 *   /api/zhiku/chapter/*      — 智能分章 (TXT章节分割+目录索引)
 *   /api/zhiku/reader/*       — 在线阅读器 (书架/进度/偏好)
 *   GET  /api/zhiku/stats     — 智库节点综合统计
 *
 * Phase 3 功能 (团队书库+成员Agent):
 *   /api/zhiku/library/*      — 团队书库 (男频/女频分区+去重)
 *   /api/zhiku/agent/*        — 成员Agent (永久记忆+对话+笔记)
 *
 * ZY-PROJ-004 智能小说系统:
 *   /api/novel/*              — 小说/章节/人物卡/大纲/AI辅助
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
// 加载环境变量 · 优先从上级目录 .env 读取（PM2 cwd=/opt/zhuyuan/novel-db）
// 再 fallback 到 cwd/.env（兼容独立启动场景）
const dotenvResult = require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (dotenvResult.error) {
  require('dotenv').config();
}

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── 信任本地 Nginx 反向代理 ───
app.set('trust proxy', 'loopback');

// ─── CORS: 仅允许 novel.guanghuyaoming.com + guanghuyaoming.com ───
const ALLOWED_ORIGINS = [
  'https://novel.guanghuyaoming.com',
  'https://guanghuyaoming.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
app.use(cors({
  origin: function(origin, cb) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

// ─── 日志文件路径 ───
const BAN_LOG_PATH  = process.env.BAN_LOG_PATH  || '/var/log/novel-shield-bans.log';
const NGINX_LOG     = process.env.NGINX_LOG      || '/var/log/nginx/shield-access.log';

// ─── 工具函数 ───
function readFileLines(filePath, maxLines = 200) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

function parseBanLog(lines) {
  const today = new Date().toISOString().slice(0, 10);
  let todayBans = 0, totalBans = 0, totalUnbans = 0;
  const recentBans = [];

  for (const line of lines) {
    if (line.includes(' BAN ')) {
      totalBans++;
      if (line.startsWith(today)) todayBans++;
      if (recentBans.length < 50) {
        const parts = line.split(' ');
        recentBans.push({
          ts:      parts[0] || '',
          action:  'ban',
          ip:      parts[2] || '',
          jail:    (parts[3] || '').replace('jail=', ''),
          attempts:(parts[4] || '').replace('attempts=', '')
        });
      }
    } else if (line.includes(' UNBAN ')) {
      totalUnbans++;
    }
  }

  return { todayBans, totalBans, activeBans: Math.max(0, totalBans - totalUnbans), recentBans: recentBans.reverse() };
}

// ─── 检查 fail2ban 状态 ───
function getF2bStatus() {
  try {
    const { execSync } = require('child_process');
    const out = execSync('fail2ban-client status 2>/dev/null', { timeout: 3000 }).toString();
    const jails = (out.match(/Jail list:\s*(.+)/)?.[1] || '').split(',').map(s => s.trim()).filter(Boolean);
    return { running: true, jails };
  } catch {
    return { running: false, jails: [] };
  }
}

// ─── 检查 Nginx 状态 ───
function getNginxStatus() {
  try {
    const { execSync } = require('child_process');
    execSync('systemctl is-active nginx', { timeout: 3000 });
    return 'active';
  } catch {
    return 'inactive';
  }
}

/* ═══════════════════════════════════════════════════════════
 * GET /api/health — 系统健康检查
 * ═══════════════════════════════════════════════════════════ */
app.get('/api/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'novel-db-api',
    phase:     '1',
    server:    'ZY-SVR-006',
    timestamp: new Date().toISOString(),
    _sovereign: 'TCS-0002∞'
  });
});

/* ═══════════════════════════════════════════════════════════
 * GET /shield/status — 语言保护罩状态
 * ═══════════════════════════════════════════════════════════ */
app.get('/shield/status', (req, res) => {
  const lines     = readFileLines(BAN_LOG_PATH, 500);
  const banStats  = parseBanLog(lines);
  const f2b       = getF2bStatus();
  const nginxSt   = getNginxStatus();

  res.json({
    shield: {
      l2_nginx:   { status: nginxSt === 'active' ? 'active' : 'down', description: '入站蜜罐层' },
      l3_fail2ban:{ status: f2b.running ? 'active' : 'down', jails: f2b.jails, description: '自动封禁层' },
      l1_proxy:   { status: 'pending', description: '出站代理池（Phase 2 部署）' }
    },
    bans: {
      today:  banStats.todayBans,
      total:  banStats.totalBans,
      active: banStats.activeBans
    },
    timestamp: new Date().toISOString()
  });
});

/* ═══════════════════════════════════════════════════════════
 * GET /shield/logs — 最近封禁日志
 * ═══════════════════════════════════════════════════════════ */
app.get('/shield/logs', (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit) || 50, 200);
  const lines  = readFileLines(BAN_LOG_PATH, 500);
  const parsed = parseBanLog(lines);

  res.json({
    logs:      parsed.recentBans.slice(0, limit),
    total:     parsed.totalBans,
    timestamp: new Date().toISOString()
  });
});

/* ═══════════════════════════════════════════════════════════
 * Phase 2: 智库节点三大引擎路由
 * ═══════════════════════════════════════════════════════════ */
const downloadRouter = require('./routes/download');
const chapterRouter  = require('./routes/chapter');
const readerRouter   = require('./routes/reader');

app.use('/api/zhiku/download', downloadRouter);
app.use('/api/zhiku/chapter',  chapterRouter);
app.use('/api/zhiku/reader',   readerRouter);

/* ═══════════════════════════════════════════════════════════
 * Phase 3: 团队书库 + 成员Agent
 * ═══════════════════════════════════════════════════════════ */
const libraryRouter     = require('./routes/library');
const memberAgentRouter = require('./routes/member-agent');

app.use('/api/zhiku/library', libraryRouter);
app.use('/api/zhiku/agent',   memberAgentRouter);

/* ═══════════════════════════════════════════════════════════
 * Phase 4: 文件上传 + AI桥接
 * ═══════════════════════════════════════════════════════════ */
const uploadRouter = require('./routes/upload');
app.use('/api/zhiku/upload', uploadRouter);

// AI 健康检查
const aiBridge = require('./services/ai-bridge');
app.get('/api/zhiku/ai/health', (req, res) => {
  res.json({
    error: false,
    data:  aiBridge.healthCheck()
  });
});

/* ═══════════════════════════════════════════════════════════
 * ZY-PROJ-004: 智能小说系统
 * ═══════════════════════════════════════════════════════════ */
const novelRouter = require('./routes/novel');

app.use('/api/novel', novelRouter);

// 智库综合统计
const downloadEngine = require('./services/download-engine');
const chapterEngine  = require('./services/chapter-engine');
const readerEngine   = require('./services/reader-engine');
const libraryEngine  = require('./services/library-engine');
const agentEngine    = require('./services/member-agent-engine');
const novelEngine    = require('./services/novel-engine');
const uploadEngine   = require('./services/upload-engine');

app.get('/api/zhiku/stats', (req, res) => {
  res.json({
    service:   'zhiku-node-full',
    server:    'ZY-SVR-006',
    timestamp: new Date().toISOString(),
    download:  downloadEngine.getStats(),
    chapter:   chapterEngine.getStats(),
    reader:    readerEngine.getStats(),
    library:   libraryEngine.getStats(),
    agent:     agentEngine.getStats(),
    novel:     novelEngine.getStats(),
    upload:    uploadEngine.getStats(),
    ai:        aiBridge.healthCheck(),
    _sovereign: 'TCS-0002∞'
  });
});

/* ═══════════════════════════════════════════════════════════
 * 404 fallback
 * ═══════════════════════════════════════════════════════════ */
app.use((req, res) => {
  res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'API endpoint not found' });
});

/* ═══════════════════════════════════════════════════════════
 * 启动
 * ═══════════════════════════════════════════════════════════ */
// 绑定到 127.0.0.1 而非 0.0.0.0 — 确保 API 只通过 Nginx 反向代理对外暴露，
// 永远不会直接暴露在公网上。外部访问路径: 公网 → Nginx(:443) → 127.0.0.1:4000
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[ZY-SVR-006] novel-db-api Phase 1 · 运行在 127.0.0.1:${PORT}`);
  console.log(`[ZY-SVR-006] 语言保护罩 API 已激活 · TCS-0002∞`);
});
