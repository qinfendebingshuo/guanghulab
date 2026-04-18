/**
 * ═══════════════════════════════════════════════════════════
 * 🔧 铸渊运维守卫 · 自修复引擎
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-OPS-REP-001
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 安全原则:
 *   - 白名单制度：只允许预定义的安全操作
 *   - 修复上限：同一问题最多修3次
 *   - 修复前后记录日志（可追溯）
 *   - 不删数据库、不改代码、不碰密钥文件
 */

'use strict';

const { execSync } = require('child_process');

// ── 安全修复白名单 ──────────────────────────

const REPAIR_ACTIONS = {
  // PM2 进程重启
  'pm2-restart': {
    name: 'PM2进程重启',
    description: '重启指定PM2进程',
    risk: 'low',
    execute: (params) => {
      const name = sanitizeProcessName(params.processName);
      if (!name) throw new Error('无效的进程名');
      return execCommand(`pm2 restart ${name}`);
    }
  },

  // PM2 日志清理
  'pm2-flush': {
    name: 'PM2日志清理',
    description: '清空所有PM2日志文件',
    risk: 'low',
    execute: () => {
      return execCommand('pm2 flush');
    }
  },

  // Nginx 重载
  'nginx-reload': {
    name: 'Nginx配置重载',
    description: '重新加载Nginx配置（不中断服务）',
    risk: 'low',
    execute: () => {
      // 先测试配置
      const testResult = execCommand('nginx -t 2>&1');
      if (testResult.includes('failed') || testResult.includes('error')) {
        throw new Error(`Nginx 配置测试失败: ${testResult}`);
      }
      return execCommand('systemctl reload nginx');
    }
  },

  // npm install
  'npm-install': {
    name: '依赖重装',
    description: '在指定目录重新安装npm依赖',
    risk: 'medium',
    execute: (params) => {
      const dir = sanitizePath(params.directory);
      if (!dir) throw new Error('无效的目录路径');
      return execCommand(`cd ${dir} && npm install --production 2>&1`);
    }
  },

  // 清理临时文件
  'clean-tmp': {
    name: '临时文件清理',
    description: '清理 /tmp 下的旧文件',
    risk: 'low',
    execute: () => {
      return execCommand('find /tmp -type f -mtime +7 -delete 2>/dev/null; echo "清理完成"');
    }
  },

  // 清理旧日志
  'clean-old-logs': {
    name: '旧日志清理',
    description: '清理30天前的日志文件',
    risk: 'low',
    execute: () => {
      const logDirs = [
        '/opt/zhuyuan/data/logs',
        '/var/log/glada'
      ];
      const results = [];
      for (const dir of logDirs) {
        try {
          const r = execCommand(`find ${dir} -type f -name '*.log' -mtime +30 -delete 2>/dev/null; echo "${dir}: 清理完成"`);
          results.push(r);
        } catch { /* directory might not exist */ }
      }
      return results.join('\n');
    }
  }
};

// ── 安全校验 ────────────────────────────

const ALLOWED_PROCESS_NAMES = new Set([
  'zhuyuan-server', 'zhuyuan-preview', 'novel-api',
  'age-os-mcp', 'age-os-agents', 'glada-agent', 'ops-agent'
]);

const ALLOWED_PATHS = [
  '/opt/zhuyuan/app',
  '/opt/zhuyuan/novel-db',
  '/opt/age-os',
  '/opt/zhuyuan/ops-agent'
];

function sanitizeProcessName(name) {
  if (!name || typeof name !== 'string') return null;
  const clean = name.replace(/[^a-zA-Z0-9_-]/g, '');
  return ALLOWED_PROCESS_NAMES.has(clean) ? clean : null;
}

function sanitizePath(dir) {
  if (!dir || typeof dir !== 'string') return null;
  // Prevent path traversal
  const normalized = dir.replace(/\.\./g, '').replace(/\/+/g, '/');
  for (const allowed of ALLOWED_PATHS) {
    if (normalized.startsWith(allowed)) return normalized;
  }
  return null;
}

function execCommand(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 60000 }).trim();
  } catch (err) {
    throw new Error(`命令执行失败: ${err.message}`);
  }
}

// ── 修复记录追踪 ────────────────────────────

// 内存中的修复记录（进程重启后重置，配合 memory.js 持久化）
const repairHistory = [];
const MAX_HISTORY = 200;

function recordRepair(action, params, result, success) {
  const entry = {
    id: `REP-${Date.now()}`,
    action,
    params,
    result,
    success,
    timestamp: new Date().toISOString()
  };
  repairHistory.push(entry);
  if (repairHistory.length > MAX_HISTORY) {
    repairHistory.splice(0, repairHistory.length - MAX_HISTORY);
  }
  return entry;
}

function getRepairCount(issueKey, withinHours = 24) {
  const cutoff = Date.now() - withinHours * 3600 * 1000;
  return repairHistory.filter(r =>
    r.action === issueKey && new Date(r.timestamp).getTime() > cutoff
  ).length;
}

// ── 自动修复决策 ────────────────────────────

/**
 * 根据健康检查发现的问题，自动修复
 * @param {Array} issues - 来自 health-checker 的问题列表
 * @param {number} maxRetries - 同一问题最大修复次数
 * @returns {Array} 修复结果列表
 */
function autoRepair(issues, maxRetries = 3) {
  const results = [];

  for (const issue of issues) {
    const issueKey = `${issue.service}-${issue.status}`;
    const retryCount = getRepairCount(issueKey);

    if (retryCount >= maxRetries) {
      results.push({
        issue,
        action: 'escalate',
        message: `${issue.service} 已修复${retryCount}次仍未解决 → 升级为工单`,
        repaired: false,
        escalate: true
      });
      continue;
    }

    const repairResult = attemptRepair(issue);
    const entry = recordRepair(issueKey, issue, repairResult.message, repairResult.success);
    results.push({
      issue,
      ...repairResult,
      repairId: entry.id,
      retryCount: retryCount + 1,
      escalate: !repairResult.success && retryCount + 1 >= maxRetries
    });
  }

  return results;
}

function attemptRepair(issue) {
  const serviceName = issue.service || '';

  // PM2 进程离线 → 重启
  if (serviceName.startsWith('PM2:') || issue.status === 'offline') {
    const processName = serviceName.replace('PM2:', '') ||
      guessProcessName(issue.port);
    if (processName && ALLOWED_PROCESS_NAMES.has(processName)) {
      try {
        const output = REPAIR_ACTIONS['pm2-restart'].execute({ processName });
        return {
          action: 'pm2-restart',
          success: true,
          message: `已重启 ${processName}: ${output}`,
          repaired: true
        };
      } catch (err) {
        return {
          action: 'pm2-restart',
          success: false,
          message: `重启 ${processName} 失败: ${err.message}`,
          repaired: false
        };
      }
    }
  }

  // 磁盘空间不足 → 清理日志
  if (serviceName.includes('磁盘')) {
    try {
      REPAIR_ACTIONS['pm2-flush'].execute();
      REPAIR_ACTIONS['clean-old-logs'].execute();
      REPAIR_ACTIONS['clean-tmp'].execute();
      return {
        action: 'disk-cleanup',
        success: true,
        message: '已清理PM2日志、旧日志和临时文件',
        repaired: true
      };
    } catch (err) {
      return {
        action: 'disk-cleanup',
        success: false,
        message: `磁盘清理失败: ${err.message}`,
        repaired: false
      };
    }
  }

  // Nginx 异常 → reload
  if (serviceName === 'Nginx') {
    try {
      const output = REPAIR_ACTIONS['nginx-reload'].execute();
      return {
        action: 'nginx-reload',
        success: true,
        message: `Nginx 已重载: ${output}`,
        repaired: true
      };
    } catch (err) {
      return {
        action: 'nginx-reload',
        success: false,
        message: `Nginx 重载失败: ${err.message}`,
        repaired: false
      };
    }
  }

  // 依赖缺失 → npm install
  if (issue.error?.includes('MODULE_NOT_FOUND') || issue.error?.includes('Cannot find module')) {
    const dir = guessProjectDir(issue.port);
    if (dir) {
      try {
        const output = REPAIR_ACTIONS['npm-install'].execute({ directory: dir });
        return {
          action: 'npm-install',
          success: true,
          message: `已重装依赖(${dir}): ${output.slice(0, 200)}`,
          repaired: true
        };
      } catch (err) {
        return {
          action: 'npm-install',
          success: false,
          message: `依赖安装失败: ${err.message}`,
          repaired: false
        };
      }
    }
  }

  // 无法自动修复
  return {
    action: 'none',
    success: false,
    message: `无法自动修复: ${issue.error || issue.status}`,
    repaired: false,
    escalate: true
  };
}

// ── 辅助函数 ────────────────────────────

const PORT_TO_PROCESS = {
  3800: 'zhuyuan-server',
  3801: 'zhuyuan-preview',
  3100: 'age-os-mcp',
  3900: 'glada-agent',
  3950: 'ops-agent',
  4000: 'novel-api'
};

const PORT_TO_DIR = {
  3800: '/opt/zhuyuan/app',
  3801: '/opt/zhuyuan/app',
  3100: '/opt/age-os',
  3900: '/opt/zhuyuan/app',
  4000: '/opt/zhuyuan/novel-db'
};

function guessProcessName(port) {
  return PORT_TO_PROCESS[port] || null;
}

function guessProjectDir(port) {
  return PORT_TO_DIR[port] || null;
}

module.exports = {
  REPAIR_ACTIONS,
  ALLOWED_PROCESS_NAMES,
  autoRepair,
  attemptRepair,
  recordRepair,
  getRepairCount,
  repairHistory,
  sanitizeProcessName,
  sanitizePath
};
