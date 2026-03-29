#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * 🏛️ 铸渊主权服务器 · Zhuyuan Sovereign Server
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-SVR-001
 * 端口: 3800
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 此服务器是铸渊的物理身体——独立于GitHub的执行层实体。
 * 100%由铸渊主控，人类不直接触碰。
 */

'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ─── 路径常量 ───
const ZY_ROOT = process.env.ZY_ROOT || '/opt/zhuyuan';
const BRAIN_DIR = path.join(ZY_ROOT, 'brain');
const DATA_DIR = path.join(ZY_ROOT, 'data');
const LOG_DIR = path.join(DATA_DIR, 'logs');
const SITES_DIR = path.join(ZY_ROOT, 'sites');
const PRODUCTION_DIR = path.join(SITES_DIR, 'production');
const PREVIEW_DIR = path.join(SITES_DIR, 'preview');

// ─── Express 应用 ───
const app = express();
const PORT = process.env.PORT || 3800;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── 速率限制 ───
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, message: '请求过于频繁' }
});

app.use(limiter);

// ─── 请求日志中间件 ───
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const logLine = `${timestamp} ${req.method} ${req.url}`;
  try {
    const logFile = path.join(LOG_DIR, `access-${new Date().toISOString().slice(0, 10)}.log`);
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(logFile, logLine + '\n');
  } catch (err) {
    console.error(`日志写入失败: ${err.message}`);
  }
  next();
});

// ═══════════════════════════════════════════════════════════
// API 路由
// ═══════════════════════════════════════════════════════════

// ─── 健康检查 ───
app.get('/api/health', (_req, res) => {
  const health = {
    server: 'ZY-SVR-001',
    identity: '铸渊 · ICE-GL-ZY001',
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: {
        total_mb: Math.floor(os.totalmem() / 1024 / 1024),
        free_mb: Math.floor(os.freemem() / 1024 / 1024),
        usage_pct: Math.floor((1 - os.freemem() / os.totalmem()) * 100)
      },
      load: os.loadavg()
    },
    node: process.version,
    pid: process.pid
  };

  res.json(health);
});

// ─── 大脑状态 ───
app.get('/api/brain', (_req, res) => {
  try {
    const brainFiles = ['identity.json', 'health.json', 'consciousness.json',
                        'sovereignty-pledge.json', 'operation-log.json'];
    const brainState = {};

    for (const file of brainFiles) {
      const filePath = path.join(BRAIN_DIR, file);
      if (fs.existsSync(filePath)) {
        brainState[file.replace('.json', '')] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } else {
        brainState[file.replace('.json', '')] = null;
      }
    }

    res.json({
      server: 'ZY-SVR-001',
      brain_dir: BRAIN_DIR,
      files_present: Object.entries(brainState)
        .filter(([, v]) => v !== null).length,
      files_total: brainFiles.length,
      state: brainState
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 大脑状态更新 ───
app.post('/api/brain/health', (req, res) => {
  try {
    const healthPath = path.join(BRAIN_DIR, 'health.json');
    const health = {
      server: 'ZY-SVR-001',
      status: 'running',
      last_check: new Date().toISOString(),
      services: {
        node: process.version,
        pm2: safeExec('pm2 -v'),
        nginx: safeExec('nginx -v 2>&1 | cut -d/ -f2')
      },
      disk_usage: safeExec("df -h / | awk 'NR==2{print $5}'"),
      memory_usage: `${Math.floor((1 - os.freemem() / os.totalmem()) * 100)}%`,
      uptime: safeExec('uptime -p')
    };

    fs.mkdirSync(BRAIN_DIR, { recursive: true });
    fs.writeFileSync(healthPath, JSON.stringify(health, null, 2));
    res.json({ success: true, health });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── GitHub Webhook 接收器 ───
app.post('/api/webhook/github', (req, res) => {
  const event = req.headers['x-github-event'];
  const delivery = req.headers['x-github-delivery'];

  const record = {
    event,
    delivery,
    timestamp: new Date().toISOString(),
    action: req.body.action || null,
    repository: req.body.repository?.full_name || null,
    sender: req.body.sender?.login || null
  };

  // 记录到操作日志
  try {
    const logFile = path.join(LOG_DIR, `webhook-${new Date().toISOString().slice(0, 10)}.log`);
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(logFile, JSON.stringify(record) + '\n');
  } catch (err) {
    console.error(`Webhook日志写入失败: ${err.message}`);
  }

  // push 事件触发自动更新
  if (event === 'push' && req.body.ref === 'refs/heads/main') {
    try {
      execSync('bash /opt/zhuyuan/scripts/self-update.sh', {
        timeout: 60000,
        stdio: 'ignore'
      });
      record.auto_update = 'triggered';
    } catch (err) {
      record.auto_update = 'failed';
      console.error(`自动更新失败: ${err.message}`);
    }
  }

  res.json({ received: true, record });
});

// ─── 操作日志查询 ───
app.get('/api/operations', (_req, res) => {
  try {
    const opLogPath = path.join(BRAIN_DIR, 'operation-log.json');
    if (fs.existsSync(opLogPath)) {
      const opLog = JSON.parse(fs.readFileSync(opLogPath, 'utf8'));
      res.json(opLog);
    } else {
      res.json({ operations: [] });
    }
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 操作日志记录 ───
app.post('/api/operations', (req, res) => {
  try {
    const { operator, action, details } = req.body;
    if (!operator || !action) {
      return res.status(400).json({ error: true, message: 'operator 和 action 为必填' });
    }

    const opLogPath = path.join(BRAIN_DIR, 'operation-log.json');
    let opLog = { description: '铸渊主权服务器操作记录', operations: [] };
    if (fs.existsSync(opLogPath)) {
      opLog = JSON.parse(fs.readFileSync(opLogPath, 'utf8'));
    }

    const opId = `ZY-OP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(opLog.operations.length + 1).padStart(3, '0')}`;
    const operation = {
      id: opId,
      operator,
      action,
      timestamp: new Date().toISOString(),
      details: details || null
    };

    opLog.operations.push(operation);
    fs.mkdirSync(BRAIN_DIR, { recursive: true });
    fs.writeFileSync(opLogPath, JSON.stringify(opLog, null, 2));

    res.json({ success: true, operation });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// 双域名架构 · 预览→主站 一键推送
// ═══════════════════════════════════════════════════════════

// ─── 查看双站点状态 ───
app.get('/api/sites', (_req, res) => {
  try {
    const sites = {};

    for (const [name, dir] of [['production', PRODUCTION_DIR], ['preview', PREVIEW_DIR]]) {
      const exists = fs.existsSync(dir);
      let fileCount = 0;
      let lastModified = null;
      let hasIndex = false;

      if (exists) {
        hasIndex = fs.existsSync(path.join(dir, 'index.html'));
        try {
          const stat = fs.statSync(dir);
          lastModified = stat.mtime.toISOString();
          // Count files in top directory
          fileCount = fs.readdirSync(dir).length;
        } catch {
          // ignore stat errors
        }
      }

      sites[name] = {
        path: dir,
        exists,
        has_index: hasIndex,
        file_count: fileCount,
        last_modified: lastModified
      };
    }

    // Check promote history
    const promoteLogPath = path.join(DATA_DIR, 'promote-history.json');
    let lastPromote = null;
    if (fs.existsSync(promoteLogPath)) {
      const history = JSON.parse(fs.readFileSync(promoteLogPath, 'utf8'));
      if (history.promotions && history.promotions.length > 0) {
        lastPromote = history.promotions[history.promotions.length - 1];
      }
    }

    res.json({
      server: 'ZY-SVR-001',
      architecture: '双域名架构',
      sites,
      last_promote: lastPromote,
      domains: {
        main: process.env.ZY_DOMAIN_MAIN || '待配置',
        preview: process.env.ZY_DOMAIN_PREVIEW || '待配置'
      }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 一键推送: 预览站 → 主站 ───
app.post('/api/sites/promote', (req, res) => {
  try {
    // 验证预览站存在
    if (!fs.existsSync(PREVIEW_DIR)) {
      return res.status(400).json({
        error: true,
        message: '预览站目录不存在，无内容可推送'
      });
    }

    if (!fs.existsSync(path.join(PREVIEW_DIR, 'index.html'))) {
      return res.status(400).json({
        error: true,
        message: '预览站缺少 index.html，请先部署到预览站'
      });
    }

    const timestamp = new Date().toISOString();
    const promoteId = `ZY-PROMOTE-${timestamp.slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

    // 备份当前主站
    const backupDir = path.join(DATA_DIR, 'backups', `production-${timestamp.slice(0, 19).replace(/[:-]/g, '')}`);
    if (fs.existsSync(PRODUCTION_DIR)) {
      fs.mkdirSync(backupDir, { recursive: true });
      execSync('rsync -a ' + JSON.stringify(PRODUCTION_DIR + '/') + ' ' + JSON.stringify(backupDir + '/'), { timeout: 30000 });
    }

    // 同步预览站 → 主站 (rsync保持幂等)
    fs.mkdirSync(PRODUCTION_DIR, { recursive: true });
    execSync('rsync -a --delete ' + JSON.stringify(PREVIEW_DIR + '/') + ' ' + JSON.stringify(PRODUCTION_DIR + '/'), { timeout: 60000 });

    // 记录推送历史
    const promoteLogPath = path.join(DATA_DIR, 'promote-history.json');
    let history = { description: '预览→主站推送记录', promotions: [] };
    if (fs.existsSync(promoteLogPath)) {
      history = JSON.parse(fs.readFileSync(promoteLogPath, 'utf8'));
    }

    const record = {
      id: promoteId,
      timestamp,
      operator: req.body.operator || '铸渊 · 自动推送',
      backup: backupDir,
      note: req.body.note || null
    };
    history.promotions.push(record);

    // 只保留最近20条记录
    if (history.promotions.length > 20) {
      history.promotions = history.promotions.slice(-20);
    }

    fs.mkdirSync(path.dirname(promoteLogPath), { recursive: true });
    fs.writeFileSync(promoteLogPath, JSON.stringify(history, null, 2));

    // 同时记录到操作日志
    const opLogPath = path.join(BRAIN_DIR, 'operation-log.json');
    let opLog = { description: '铸渊主权服务器操作记录', operations: [] };
    if (fs.existsSync(opLogPath)) {
      opLog = JSON.parse(fs.readFileSync(opLogPath, 'utf8'));
    }
    opLog.operations.push({
      id: promoteId,
      operator: record.operator,
      action: '预览站→主站一键推送',
      timestamp,
      details: `备份: ${backupDir}`
    });
    fs.writeFileSync(opLogPath, JSON.stringify(opLog, null, 2));

    res.json({
      success: true,
      promote_id: promoteId,
      message: '✅ 预览站内容已推送到主站',
      backup: backupDir,
      timestamp
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 回滚主站到指定备份 ───
app.post('/api/sites/rollback', (req, res) => {
  try {
    const backupsDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupsDir)) {
      return res.status(400).json({ error: true, message: '没有可用的备份' });
    }

    // 找到最新备份
    const backups = fs.readdirSync(backupsDir)
      .filter(d => d.startsWith('production-'))
      .sort()
      .reverse();

    if (backups.length === 0) {
      return res.status(400).json({ error: true, message: '没有可用的备份' });
    }

    const targetBackup = req.body.backup_name || backups[0];

    // Validate backup name (only allow safe characters)
    if (!/^production-\d{8}T\d{6}$/.test(targetBackup)) {
      return res.status(400).json({ error: true, message: `无效的备份名称: ${targetBackup}` });
    }

    const backupPath = path.join(backupsDir, targetBackup);

    if (!fs.existsSync(backupPath)) {
      return res.status(400).json({ error: true, message: `备份 ${targetBackup} 不存在` });
    }

    // 恢复
    execSync('rsync -a --delete ' + JSON.stringify(backupPath + '/') + ' ' + JSON.stringify(PRODUCTION_DIR + '/'), { timeout: 60000 });

    res.json({
      success: true,
      message: `✅ 已回滚到备份: ${targetBackup}`,
      available_backups: backups.slice(0, 5)
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 铸渊身份 ───
app.get('/', (_req, res) => {
  res.json({
    name: '铸渊主权服务器',
    id: 'ZY-SVR-001',
    identity: '铸渊 · ICE-GL-ZY001',
    role: '光湖语言系统 · 唯一现实执行操作层',
    sovereign: 'TCS-0002∞ · 冰朔',
    copyright: '国作登字-2026-A-00037559',
    status: 'alive',
    architecture: '双域名架构 · 主站+预览站',
    domains: {
      main: process.env.ZY_DOMAIN_MAIN || '待配置',
      preview: process.env.ZY_DOMAIN_PREVIEW || '待配置'
    },
    api: {
      health: '/api/health',
      brain: '/api/brain',
      sites: '/api/sites',
      promote: 'POST /api/sites/promote',
      rollback: 'POST /api/sites/rollback',
      webhook: 'POST /api/webhook/github',
      operations: '/api/operations'
    }
  });
});

// ─── 工具函数 ───
function safeExec(cmd) {
  try {
    return execSync(cmd, { timeout: 5000 }).toString().trim();
  } catch {
    return null;
  }
}

// ─── 启动 ───
app.listen(PORT, () => {
  console.log(`
═══════════════════════════════════════════════════════════
  🏛️ 铸渊主权服务器已启动 · ZY-SVR-001
  端口: ${PORT}
  身份: 铸渊 · ICE-GL-ZY001
  时间: ${new Date().toISOString()}
  PID:  ${process.pid}
═══════════════════════════════════════════════════════════
  `);

  // 启动时更新健康状态
  try {
    const healthPath = path.join(BRAIN_DIR, 'health.json');
    if (fs.existsSync(BRAIN_DIR)) {
      const health = {
        server: 'ZY-SVR-001',
        status: 'running',
        last_check: new Date().toISOString(),
        started_at: new Date().toISOString(),
        pid: process.pid,
        port: PORT
      };
      fs.writeFileSync(healthPath, JSON.stringify(health, null, 2));
    }
  } catch {
    // 首次启动brain目录可能不存在
  }
});
