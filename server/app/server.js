#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * 🏛️ 铸渊主权服务器 · Zhuyuan Sovereign Server
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-SVR-002
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

// ─── 加载模块 ───
let cosBridge, smartRouter, chatEngine;
try {
  cosBridge = require('./modules/cos-bridge');
  smartRouter = require('./modules/smart-router');
  chatEngine = require('./modules/chat-engine');
} catch (err) {
  console.error(`模块加载警告: ${err.message}`);
}

// ═══════════════════════════════════════════════════════════
// API 路由
// ═══════════════════════════════════════════════════════════

// ─── 健康检查 ───
app.get('/api/health', (_req, res) => {
  const health = {
    server: 'ZY-SVR-002',
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
      server: 'ZY-SVR-002',
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
      server: 'ZY-SVR-002',
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
// 人格体聊天 · Persona Chat API
// ═══════════════════════════════════════════════════════════

// ─── 人格体对话 ───
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId } = req.body;
    if (!message) {
      return res.status(400).json({ error: true, message: '消息不能为空' });
    }

    const sessionId = userId || `guest-${req.ip.replace(/[.:]/g, '-')}`;

    if (chatEngine) {
      const result = await chatEngine.chat(sessionId, message);
      res.json({
        success: true,
        ...result,
        sessionId
      });
    } else {
      res.json({
        success: true,
        message: '💫 铸渊正在唤醒中...聊天引擎尚未加载。',
        model: 'offline',
        tier: 'free',
        sessionId
      });
    }
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 聊天统计 ───
app.get('/api/chat/stats', (_req, res) => {
  if (chatEngine) {
    res.json(chatEngine.getChatStats());
  } else {
    res.json({ activeUsers: 0, modelUsage: {}, pricing: {} });
  }
});

// ═══════════════════════════════════════════════════════════
// COS 存储 · Cloud Object Storage API
// ═══════════════════════════════════════════════════════════

// ─── COS 状态 ───
app.get('/api/cos/status', async (_req, res) => {
  if (cosBridge) {
    try {
      const status = await cosBridge.checkConnection();
      res.json({ server: 'ZY-SVR-002', cos: status });
    } catch (err) {
      res.json({
        server: 'ZY-SVR-002',
        cos: { connected: false, error: err.message, config: cosBridge.getConfig() }
      });
    }
  } else {
    res.json({ server: 'ZY-SVR-002', cos: { connected: false, reason: 'COS模块未加载' } });
  }
});

// ─── COS 配置信息 ───
app.get('/api/cos/config', (_req, res) => {
  if (cosBridge) {
    res.json(cosBridge.getConfig());
  } else {
    res.json({ configured: false });
  }
});

// ─── 用户作品同步（团队内测用户 → COS） ───
app.post('/api/cos/sync-works', async (req, res) => {
  if (!cosBridge) return res.status(503).json({ error: true, message: 'COS模块未加载' });
  try {
    const { userId, works } = req.body;
    if (!userId || !works) return res.status(400).json({ error: true, message: '缺少userId或works' });
    await cosBridge.saveUserWorks(userId, works);
    res.json({ success: true, message: '作品已同步到COS', userId });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 用户作品加载（团队内测用户 ← COS） ───
app.get('/api/cos/load-works', async (req, res) => {
  if (!cosBridge) return res.status(503).json({ error: true, message: 'COS模块未加载' });
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: true, message: '缺少userId' });
    const data = await cosBridge.loadUserWorks(userId);
    res.json({ success: true, ...data });
  } catch (err) {
    res.json({ success: true, user_id: req.query.userId, works: [] });
  }
});

// ═══════════════════════════════════════════════════════════
// 智能模型分流 · Smart Model Router API
// ═══════════════════════════════════════════════════════════

// ─── 模型使用统计 ───
app.get('/api/model/stats', (_req, res) => {
  if (smartRouter) {
    res.json(smartRouter.getUsageStats());
  } else {
    res.json({ totalCalls: 0 });
  }
});

// ─── 模型定价表 ───
app.get('/api/model/pricing', (_req, res) => {
  if (smartRouter) {
    res.json(smartRouter.getPricingTable());
  } else {
    res.json({});
  }
});

// ─── 模型路由预测（不实际调用） ───
app.post('/api/model/predict', (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: true, message: '消息不能为空' });
  }
  if (smartRouter) {
    const prediction = smartRouter.routeModel(message);
    res.json(prediction);
  } else {
    res.json({ model: 'unknown', reason: '路由模块未加载' });
  }
});

// ═══════════════════════════════════════════════════════════
// 系统信息 · System Info API (供前端公告区使用)
// ═══════════════════════════════════════════════════════════

app.get('/api/system/bulletin', (_req, res) => {
  res.json({
    system: {
      name: '光湖灯塔 · AGE OS',
      version: 'v40.0',
      era: '曜冥纪元',
      copyright: '国作登字-2026-A-00037559'
    },
    updates: [
      { version: 'v40.0', date: '2026-04-02', title: 'COS双桶存储上线', desc: '核心人格体大脑数据库 + 语料库正式接入腾讯云COS' },
      { version: 'v39.0', date: '2026-04-01', title: '全链路部署观测系统', desc: '部署日志采集 + 自动修复引擎 + 第九军团观星台' },
      { version: 'v38.0', date: '2026-04-01', title: 'HLDP通用协作语言', desc: 'Notion↔GitHub双侧通信协议 + 铸渊方言编程语言' }
    ],
    agents: {
      total_workflows: 18,
      total_modules: 52,
      armies: 9,
      active: ['听潮', '锻心', '织脉', '映阁', '守夜', '试镜']
    },
    industries: {
      writing: {
        name: '网文行业 · 码字工作台',
        status: 'beta',
        team: '光湖人类主控团队',
        modules: ['码字工作台', 'AI辅助创作', '大纲生成']
      }
    },
    server: {
      identity: 'ZY-SVR-002',
      uptime: Math.floor(process.uptime()),
      node: process.version
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 留言板 · Feedback API
// ═══════════════════════════════════════════════════════════

const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');

app.get('/api/feedback', (_req, res) => {
  try {
    if (fs.existsSync(FEEDBACK_FILE)) {
      const data = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
      res.json({ success: true, feedback: data.items || [] });
    } else {
      res.json({ success: true, feedback: [] });
    }
  } catch (err) {
    console.error(`留言板读取失败: ${err.message}`);
    res.status(500).json({ error: true, message: '服务器错误，请稍后重试' });
  }
});

app.post('/api/feedback', (req, res) => {
  try {
    const { name, message, userId } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: true, message: '留言内容不能为空' });
    }

    let data = { items: [] };
    if (fs.existsSync(FEEDBACK_FILE)) {
      data = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
    }

    const item = {
      id: `FB-${Date.now().toString(36)}`,
      name: (typeof name === 'string' ? name.substring(0, 50) : '') || '匿名来客',
      message: message.substring(0, 500),
      userId: typeof userId === 'string' ? userId.substring(0, 50) : null,
      status: 'pending',
      timestamp: new Date().toISOString(),
      reply: null
    };

    data.items.unshift(item);

    // Keep only latest 100
    if (data.items.length > 100) {
      data.items = data.items.slice(0, 100);
    }

    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(data, null, 2));

    res.json({ success: true, feedback: item });
  } catch (err) {
    console.error(`留言提交失败: ${err.message}`);
    res.status(500).json({ error: true, message: '服务器错误，请稍后重试' });
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
      server: 'ZY-SVR-002',
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
    id: 'ZY-SVR-002',
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
    cos: {
      core_bucket: 'zy-core-bucket-1317346199',
      corpus_bucket: 'zy-corpus-bucket-1317346199',
      configured: !!(process.env.ZY_OSS_KEY && process.env.ZY_OSS_SECRET)
    },
    api: {
      health: '/api/health',
      brain: '/api/brain',
      chat: 'POST /api/chat',
      chat_stats: '/api/chat/stats',
      cos_status: '/api/cos/status',
      cos_config: '/api/cos/config',
      model_stats: '/api/model/stats',
      model_pricing: '/api/model/pricing',
      model_predict: 'POST /api/model/predict',
      bulletin: '/api/system/bulletin',
      feedback: '/api/feedback',
      feedback_submit: 'POST /api/feedback',
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
  🏛️ 铸渊主权服务器已启动 · ZY-SVR-002
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
        server: 'ZY-SVR-002',
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
