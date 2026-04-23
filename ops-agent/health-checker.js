/**
 * ═══════════════════════════════════════════════════════════
 * 🔍 铸渊运维守卫 · 健康检查引擎
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-OPS-HC-001
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * 更新: 2026-04-23 · 修复 MCP 跨服务器检测 + 告警冷却
 *
 * 三层巡检:
 *   - 快速巡检(5分钟): 端口存活检测
 *   - 深度巡检(1小时): 内存/磁盘/PM2重启次数/错误日志
 *   - 全量体检(每天): 完整健康报告
 */

'use strict';

const http = require('http');
const { execSync } = require('child_process');
const os = require('os');

// ── 服务器 IP 配置（环境变量覆盖）─────────

const SVR_002_HOST = process.env.ZY_SVR_002_HOST || '127.0.0.1';  // 面孔服务器（本机）
const SVR_005_HOST = process.env.ZY_SVR_005_HOST || '127.0.0.1';  // 大脑服务器（需配置真实 IP）

// ── 监控目标列表 ─────────────────────

const SERVICES = [
  { name: '铸渊主权服务器', host: SVR_002_HOST, port: 3800, path: '/api/health', critical: true, timeout: 8000 },
  { name: 'MCP大脑服务器', host: SVR_005_HOST, port: 3100, path: '/health', critical: true, timeout: 15000 },
  { name: 'GLADA自主开发Agent', host: SVR_002_HOST, port: 3900, path: '/api/glada/health', critical: false, timeout: 8000 },
  { name: '智库节点API', host: SVR_002_HOST, port: 4000, path: '/api/health', critical: false, timeout: 8000 },
  { name: '铸渊运维守卫', host: SVR_002_HOST, port: 3950, path: '/health', critical: false, timeout: 8000 },
];

const PM2_PROCESSES = [
  'zhuyuan-server',
  'zhuyuan-preview',
  'novel-api',
  'age-os-mcp',
  'age-os-agents',
  'glada-agent',
];

// ── 告警冷却机制（避免重复发邮件）───────

const alertCooldown = new Map();  // key: service name, value: { lastAlert: timestamp, count: number }
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;  // 30分钟内同一服务不重复告警
const MAX_ALERTS_PER_DAY = 6;  // 每个服务每天最多6次告警

/**
 * 检查是否应该发送告警（冷却期内不重复发）
 * @param {string} serviceName
 * @returns {boolean}
 */
function shouldAlert(serviceName) {
  const now = Date.now();
  const record = alertCooldown.get(serviceName);

  if (!record) {
    alertCooldown.set(serviceName, { lastAlert: now, count: 1, dayStart: now });
    return true;
  }

  // 超过24小时重置计数
  if (now - record.dayStart > 24 * 60 * 60 * 1000) {
    alertCooldown.set(serviceName, { lastAlert: now, count: 1, dayStart: now });
    return true;
  }

  // 每天超过最大次数，不再发
  if (record.count >= MAX_ALERTS_PER_DAY) {
    return false;
  }

  // 冷却期内不重复发
  if (now - record.lastAlert < ALERT_COOLDOWN_MS) {
    return false;
  }

  record.lastAlert = now;
  record.count++;
  return true;
}

/**
 * 获取告警冷却状态（调试用）
 */
function getAlertCooldownStatus() {
  const status = {};
  for (const [name, record] of alertCooldown.entries()) {
    status[name] = {
      lastAlert: new Date(record.lastAlert).toISOString(),
      alertsToday: record.count,
      maxPerDay: MAX_ALERTS_PER_DAY,
      cooldownRemaining: Math.max(0, ALERT_COOLDOWN_MS - (Date.now() - record.lastAlert))
    };
  }
  return status;
}

// ── HTTP 健康检查 ────────────────────

function probeService(name, host, port, probePath, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get({
      hostname: host,
      port,
      path: probePath,
      timeout: timeoutMs
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        const latency = Date.now() - start;
        let data = null;
        try { data = JSON.parse(body); } catch { /* ignore */ }
        resolve({
          name,
          host,
          port,
          status: 'online',
          statusCode: res.statusCode,
          latency,
          data,
          timestamp: new Date().toISOString()
        });
      });
    });
    req.on('error', (err) => {
      resolve({
        name,
        host,
        port,
        status: 'offline',
        statusCode: 0,
        latency: Date.now() - start,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({
        name,
        host,
        port,
        status: 'timeout',
        statusCode: 0,
        latency: timeoutMs,
        error: `连接超时(${timeoutMs}ms)`,
        timestamp: new Date().toISOString()
      });
    });
  });
}

// ── PM2 进程状态 ──────────────────

function getPM2Status() {
  try {
    const raw = execSync('pm2 jlist 2>/dev/null', { encoding: 'utf-8', timeout: 10000 });
    const processes = JSON.parse(raw);
    return processes.map(p => ({
      name: p.name,
      pm_id: p.pm_id,
      status: p.pm2_env?.status || 'unknown',
      restarts: p.pm2_env?.restart_time || 0,
      uptime: p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0,
      memory: p.monit?.memory || 0,
      cpu: p.monit?.cpu || 0,
      pid: p.pid
    }));
  } catch (err) {
    return [{ name: 'pm2', status: 'error', error: err.message }];
  }
}

// ── 系统资源 ──────────────────────

function getSystemResources() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedPct = Math.round((1 - freeMem / totalMem) * 100);

  let diskInfo = { total: 0, used: 0, available: 0, usePct: 0 };
  try {
    const dfOut = execSync('df -B1 / 2>/dev/null | tail -1', { encoding: 'utf-8', timeout: 5000 });
    const parts = dfOut.trim().split(/\s+/);
    if (parts.length >= 5) {
      diskInfo = {
        total: parseInt(parts[1]) || 0,
        used: parseInt(parts[2]) || 0,
        available: parseInt(parts[3]) || 0,
        usePct: parseInt(parts[4]) || 0
      };
    }
  } catch { /* ignore */ }

  return {
    memory: {
      total_mb: Math.round(totalMem / 1024 / 1024),
      free_mb: Math.round(freeMem / 1024 / 1024),
      used_pct: usedPct
    },
    disk: {
      total_gb: Math.round(diskInfo.total / 1024 / 1024 / 1024),
      used_gb: Math.round(diskInfo.used / 1024 / 1024 / 1024),
      available_gb: Math.round(diskInfo.available / 1024 / 1024 / 1024),
      used_pct: diskInfo.usePct
    },
    load: os.loadavg(),
    cpus: os.cpus().length,
    uptime_hours: Math.round(os.uptime() / 3600),
    hostname: os.hostname(),
    platform: os.platform(),
    node_version: process.version
  };
}

// ── Nginx 状态 ─────────────────────

function getNginxStatus() {
  try {
    const status = execSync('systemctl is-active nginx 2>/dev/null', { encoding: 'utf-8', timeout: 5000 }).trim();
    let configOk = false;
    try {
      execSync('nginx -t 2>&1', { encoding: 'utf-8', timeout: 5000 });
      configOk = true;
    } catch { /* config test failed */ }
    return { status, configOk };
  } catch {
    return { status: 'unknown', configOk: false };
  }
}

// ── 快速巡检（5分钟一次）────────────

async function quickCheck() {
  const results = await Promise.all(
    SERVICES.map(s => probeService(s.name, s.host, s.port, s.path, s.timeout))
  );

  const issues = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const s = SERVICES[i];
    if (r.status !== 'online') {
      issues.push({
        service: s.name,
        host: s.host,
        port: s.port,
        status: r.status,
        error: r.error,
        critical: s.critical,
        severity: s.critical ? 'high' : 'medium',
        shouldNotify: shouldAlert(s.name)
      });
    }
  }

  return {
    type: 'quick',
    timestamp: new Date().toISOString(),
    services: results,
    issues,
    // 只返回需要通知的问题（过滤掉冷却期内的）
    notifiableIssues: issues.filter(i => i.shouldNotify),
    healthy: issues.filter(i => i.critical).length === 0,
    summary: issues.length === 0
      ? '✅ 所有服务正常运行'
      : `⚠️ ${issues.length}个服务异常: ${issues.map(i => i.service).join(', ')}`
  };
}

// ── 深度巡检（1小时一次）───────────

async function deepCheck() {
  const quick = await quickCheck();
  const pm2Status = getPM2Status();
  const resources = getSystemResources();
  const nginx = getNginxStatus();

  const issues = [...quick.issues];

  // 检查 PM2 进程异常
  for (const proc of pm2Status) {
    if (proc.status === 'errored' || proc.status === 'stopped') {
      issues.push({
        service: `PM2:${proc.name}`,
        status: proc.status,
        error: `进程${proc.status === 'errored' ? '出错' : '已停止'}`,
        critical: PM2_PROCESSES.includes(proc.name),
        severity: 'high',
        shouldNotify: shouldAlert(`PM2:${proc.name}`)
      });
    }
    if (proc.restarts > 10) {
      issues.push({
        service: `PM2:${proc.name}`,
        status: 'unstable',
        error: `频繁重启(${proc.restarts}次)`,
        critical: false,
        severity: 'medium',
        shouldNotify: shouldAlert(`PM2:${proc.name}:restarts`)
      });
    }
  }

  // 检查资源告警
  if (resources.memory.used_pct > 90) {
    issues.push({
      service: '系统内存',
      status: 'warning',
      error: `内存使用率 ${resources.memory.used_pct}% (>90%)`,
      critical: true,
      severity: 'high',
      shouldNotify: shouldAlert('系统内存')
    });
  }
  if (resources.disk.used_pct > 85) {
    issues.push({
      service: '磁盘空间',
      status: 'warning',
      error: `磁盘使用率 ${resources.disk.used_pct}% (>85%)`,
      critical: true,
      severity: resources.disk.used_pct > 95 ? 'critical' : 'high',
      shouldNotify: shouldAlert('磁盘空间')
    });
  }

  // Nginx 状态
  if (nginx.status !== 'active') {
    issues.push({
      service: 'Nginx',
      status: nginx.status,
      error: 'Nginx 未运行',
      critical: true,
      severity: 'critical',
      shouldNotify: shouldAlert('Nginx')
    });
  }

  return {
    type: 'deep',
    timestamp: new Date().toISOString(),
    services: quick.services,
    pm2: pm2Status,
    resources,
    nginx,
    issues,
    notifiableIssues: issues.filter(i => i.shouldNotify),
    healthy: issues.filter(i => i.critical).length === 0,
    summary: issues.length === 0
      ? '✅ 深度巡检通过 · 所有服务和资源正常'
      : `⚠️ 发现${issues.length}个问题: ${issues.map(i => `${i.service}(${i.error})`).join('; ')}`
  };
}

// ── 全量体检（每天一次）───────────

async function fullReport() {
  const deep = await deepCheck();
  return {
    type: 'daily_report',
    report_id: `RPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    ...deep,
    alertCooldownStatus: getAlertCooldownStatus(),
    recommendations: generateRecommendations(deep)
  };
}

function generateRecommendations(checkResult) {
  const recs = [];
  for (const issue of checkResult.issues) {
    if (issue.service.includes('内存') && issue.status === 'warning') {
      recs.push('建议: 检查是否有进程内存泄漏，考虑增加 max_memory_restart 配置');
    }
    if (issue.service.includes('磁盘')) {
      recs.push('建议: 运行 pm2 flush 清理日志，检查 /tmp 和 data/logs/ 目录');
    }
    if (issue.error?.includes('频繁重启')) {
      recs.push(`建议: ${issue.service} 频繁重启，需要检查错误日志定位根因`);
    }
    if (issue.service === 'Nginx') {
      recs.push('紧急: Nginx 异常，所有外部访问将受影响');
    }
    if (issue.service === 'MCP大脑服务器' && issue.status === 'timeout') {
      recs.push('提示: MCP服务器在远程机器(ZY-SVR-005)，请检查: 1)大脑服务器是否运行 2)网络连接是否正常 3)防火墙端口是否开放');
    }
  }
  if (recs.length === 0) {
    recs.push('系统运行良好，无需额外操作');
  }
  return recs;
}

module.exports = {
  SERVICES,
  PM2_PROCESSES,
  probeService,
  getPM2Status,
  getSystemResources,
  getNginxStatus,
  quickCheck,
  deepCheck,
  fullReport,
  shouldAlert,
  getAlertCooldownStatus,
};
