#!/usr/bin/env node
/**
 * OPS Agent · 预飞检查 · install-check.js
 *
 * 部署后立即运行，检查所有前置条件是否满足：
 *   1. Node.js 版本
 *   2. 依赖安装（express, node-cron, nodemailer）
 *   3. OPS Agent 模块加载
 *   4. 环境变量（LLM密钥、SMTP）
 *   5. 目录权限（data/）
 *   6. 端口可用
 *
 * 用法：
 *   node ops-agent/install-check.js
 *   npm run preflight          (从 ops-agent/ 目录)
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：铸渊 · ICE-GL-ZY001
 */

'use strict';

const fs = require('fs');
const path = require('path');
const net = require('net');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
let warningChecks = 0;

function pass(name, detail) {
  totalChecks++; passedChecks++;
  console.log(`  ✅ ${name}${detail ? ': ' + detail : ''}`);
}
function fail(name, detail) {
  totalChecks++; failedChecks++;
  console.log(`  ❌ ${name}${detail ? ': ' + detail : ''}`);
}
function warn(name, detail) {
  totalChecks++; warningChecks++;
  console.log(`  ⚠️ ${name}${detail ? ': ' + detail : ''}`);
}

// Load env files (same chain as ecosystem.config.js)
const envFiles = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '.env.app'),
  '/opt/zhuyuan/app/.env.app',
  path.join(__dirname, '.env.ops-agent'),
];
for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        let value = trimmed.substring(idx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

async function main() {
  console.log('═'.repeat(50));
  console.log('🔍 OPS Agent 预飞检查 · Pre-flight Diagnostics');
  console.log('═'.repeat(50));

  // ── 1. Node.js 版本 ──
  console.log('\n📦 运行环境:');
  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split('.')[0], 10);
  if (major >= 20) {
    pass('Node.js 版本', `v${nodeVersion} (>= 20 ✓)`);
  } else {
    fail('Node.js 版本', `v${nodeVersion} (需要 >= 20)`);
  }

  // ── 2. 依赖检查 ──
  console.log('\n📦 依赖检查:');
  const deps = ['express', 'node-cron', 'nodemailer'];
  for (const dep of deps) {
    try {
      require(dep);
      pass(dep, '已安装');
    } catch {
      fail(dep, `未安装 · 请运行: cd ops-agent && npm install`);
    }
  }

  // ── 3. OPS Agent 模块加载 ──
  console.log('\n🛡️ OPS Agent 模块:');
  const modules = [
    'health-checker', 'llm-client', 'memory',
    'repair-engine', 'notifier'
  ];
  for (const mod of modules) {
    try {
      require(`./${mod}`);
      pass(mod, '加载成功');
    } catch (err) {
      fail(mod, `加载失败: ${err.message}`);
    }
  }

  // ── 4. 环境变量 ──
  console.log('\n🔑 环境变量:');
  const apiKey = process.env.ZY_LLM_API_KEY || process.env.ZY_DEEPSEEK_API_KEY || '';
  const baseUrl = process.env.ZY_LLM_BASE_URL || '';

  if (apiKey && apiKey.length > 5) {
    pass('LLM API密钥', `已配置 (${apiKey.length}字符 · ***已脱敏***)`);
  } else {
    warn('LLM API密钥', '未配置（ZY_LLM_API_KEY/ZY_DEEPSEEK_API_KEY 缺失·对话功能仅限模式匹配）');
  }

  if (baseUrl) {
    pass('ZY_LLM_BASE_URL', baseUrl);
  } else {
    warn('ZY_LLM_BASE_URL', '未配置（将使用默认 DeepSeek 端点）');
  }

  const port = process.env.OPS_AGENT_PORT || '3950';
  pass('OPS_AGENT_PORT', port);

  // SMTP
  const smtpUser = process.env.ZY_SMTP_USER || '';
  const smtpPass = process.env.ZY_SMTP_PASS || '';
  if (smtpUser && smtpPass) {
    pass('ZY_SMTP_USER', `已配置 (${smtpUser.substring(0, 3)}***)`);
    pass('ZY_SMTP_PASS', '已配置 (***已脱敏***)');
  } else {
    warn('邮件通知 SMTP', '未配置（ZY_SMTP_USER/ZY_SMTP_PASS 缺失·告警仅写入本地日志）');
  }

  // ── 5. 目录检查 ──
  console.log('\n📁 目录检查:');
  const requiredDirs = [
    path.join(__dirname, 'data'),
    path.join(__dirname, 'web'),
  ];

  for (const dir of requiredDirs) {
    const relDir = path.relative(__dirname, dir);
    if (fs.existsSync(dir)) {
      try {
        const testFile = path.join(dir, '.write-test');
        fs.writeFileSync(testFile, 'test', 'utf-8');
        fs.unlinkSync(testFile);
        pass(relDir, '存在 + 可写');
      } catch {
        if (relDir === 'web') {
          pass(relDir, '存在（只读·静态资源目录）');
        } else {
          warn(relDir, '存在但不可写');
        }
      }
    } else {
      try {
        fs.mkdirSync(dir, { recursive: true });
        pass(relDir, '已创建');
      } catch (err) {
        if (relDir === 'web') {
          warn(relDir, '不存在（运维面板不可用·不影响核心功能）');
        } else {
          fail(relDir, `创建失败: ${err.message}`);
        }
      }
    }
  }

  // 日志目录
  const logDir = '/opt/zhuyuan/data/logs';
  if (fs.existsSync(logDir)) {
    pass('日志目录', `${logDir} 存在`);
  } else {
    try {
      fs.mkdirSync(logDir, { recursive: true });
      pass('日志目录', `${logDir} 已创建`);
    } catch {
      warn('日志目录', `${logDir} 不存在且无法创建（日志将写入默认路径）`);
    }
  }

  // ── 6. 端口检查 ──
  console.log('\n🔌 端口检查:');
  const portNum = parseInt(port, 10);
  try {
    const portAvailable = await checkPort(portNum);
    if (portAvailable) {
      pass(`端口 ${portNum}`, '可用');
    } else {
      warn(`端口 ${portNum}`, '已被占用（可能 OPS Agent 已在运行）');
    }
  } catch {
    warn(`端口 ${portNum}`, '检查失败');
  }

  // ── 7. 功能验证 ──
  console.log('\n🔧 功能验证:');
  try {
    const llm = require('./llm-client');
    const patterns = llm.diagnoseByPattern('ECONNREFUSED on port 3800');
    if (patterns.length > 0) {
      pass('模式匹配引擎', `${llm.ERROR_PATTERNS.length} 个错误模式已加载`);
    } else {
      warn('模式匹配引擎', '模式匹配未命中预期结果');
    }
  } catch (err) {
    warn('模式匹配引擎', `验证失败: ${err.message}`);
  }

  try {
    const memory = require('./memory');
    const ctx = memory.buildMemoryContext();
    if (typeof ctx === 'string' && ctx.includes('运维守卫记忆')) {
      pass('记忆系统', '上下文构建正常');
    } else {
      warn('记忆系统', '上下文格式异常');
    }
  } catch (err) {
    warn('记忆系统', `验证失败: ${err.message}`);
  }

  try {
    const hc = require('./health-checker');
    if (Array.isArray(hc.SERVICES) && hc.SERVICES.length > 0) {
      pass('健康检查引擎', `${hc.SERVICES.length} 个监控目标已注册`);
    } else {
      warn('健康检查引擎', '监控目标为空');
    }
  } catch (err) {
    warn('健康检查引擎', `验证失败: ${err.message}`);
  }

  try {
    const re = require('./repair-engine');
    if (re.sanitizeProcessName('zhuyuan-server') === 'zhuyuan-server' &&
        re.sanitizeProcessName('rm -rf /') === null) {
      pass('自修复引擎', '白名单校验正常');
    } else {
      fail('自修复引擎', '白名单校验异常');
    }
  } catch (err) {
    warn('自修复引擎', `验证失败: ${err.message}`);
  }

  // ── 汇总 ──
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📊 检查结果: ${passedChecks} 通过, ${warningChecks} 警告, ${failedChecks} 失败`);
  console.log(`${'═'.repeat(50)}`);

  if (failedChecks === 0) {
    console.log('✅ OPS Agent 预飞检查通过！系统可以启动。');
    console.log('   启动命令: pm2 start ops-agent/ecosystem.config.js');
    console.log('');
  } else {
    console.log('❌ OPS Agent 预飞检查未通过，请修复上述问题后再启动。');
    console.log('');
    process.exit(1);
  }
}

/**
 * 检查端口是否可用
 */
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

main().catch(err => {
  console.error(`预飞检查异常: ${err.message}`);
  process.exit(1);
});
