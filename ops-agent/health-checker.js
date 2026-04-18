/**
 * ═══════════════════════════════════════════════════════════
 * 🔍 铸渊运维守卫 · 健康检查引擎
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-OPS-HC-001
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
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

// ── 监控目标列表 ───────────────────────────

const SERVICES = [
  { name: '铸渊主权服务器', port: 3800, path: '/api/health', critical: true },
  { name: 'MCP大脑服务器', port: 3100, path: '/health', critical: true },
  { name: 'GLADA自主开发Agent', port: 3900, path: '/api/glada/health', critical: false },
  { name: '智库节点API', port: 4000, path: '/api/health', critical: false },
  { name: '铸渊运维守卫', port: 3950, path: '/health', critical: false },
];

const PM2_PROCESSES = [
  'zhuyuan-server',
  'zhuyuan-preview',
  'novel-api',
  'age-os-mcp',
  'age-os-agents',
  'glada-agent',
];

// ── HTTP 健康检查 ──────────────────────────

function probeService(name, port, probePath, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get({
      hostname: '127.0.0.1',
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

// ── PM2 进程状态 ──────────────────────────

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

// ── 系统资源 ──────────────────────────────

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

// ── Nginx 状态 ───────────────────────────

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

// ── 快速巡检（5分钟一次） ────────────────

async function quickCheck() {
  const results = await Promise.all(
    SERVICES.map(s => probeService(s.name, s.port, s.path))
  );

  const issues = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const s = SERVICES[i];
    if (r.status !== 'online') {
      issues.push({
        service: s.name,
        port: s.port,
        status: r.status,
        error: r.error,
        critical: s.critical,
        severity: s.critical ? 'high' : 'medium'
      });
    }
  }

  return {
    type: 'quick',
    timestamp: new Date().toISOString(),
    services: results,
    issues,
    healthy: issues.filter(i => i.critical).length === 0,
    summary: issues.length === 0
      ? '✅ 所有服务正常运行'
      : `⚠️ ${issues.length}个服务异常: ${issues.map(i => i.service).join(', ')}`
  };
}

// ── 深度巡检（1小时一次） ─────────────────

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
        severity: 'high'
      });
    }
    if (proc.restarts > 10) {
      issues.push({
        service: `PM2:${proc.name}`,
        status: 'unstable',
        error: `频繁重启(${proc.restarts}次)`,
        critical: false,
        severity: 'medium'
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
      severity: 'high'
    });
  }
  if (resources.disk.used_pct > 85) {
    issues.push({
      service: '磁盘空间',
      status: 'warning',
      error: `磁盘使用率 ${resources.disk.used_pct}% (>85%)`,
      critical: true,
      severity: resources.disk.used_pct > 95 ? 'critical' : 'high'
    });
  }

  // Nginx 状态
  if (nginx.status !== 'active') {
    issues.push({
      service: 'Nginx',
      status: nginx.status,
      error: 'Nginx 未运行',
      critical: true,
      severity: 'critical'
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
    healthy: issues.filter(i => i.critical).length === 0,
    summary: issues.length === 0
      ? '✅ 深度巡检通过 · 所有服务和资源正常'
      : `⚠️ 发现${issues.length}个问题: ${issues.map(i => `${i.service}(${i.error})`).join('; ')}`
  };
}

// ── 全量体检（每天一次） ─────────────────

async function fullReport() {
  const deep = await deepCheck();
  return {
    type: 'daily_report',
    report_id: `RPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    ...deep,
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
  fullReport
};
