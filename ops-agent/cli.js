#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * 💬 铸渊运维守卫 · 终端交互对话 (zy-ops)
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-OPS-CLI-001
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 使用:
 *   node ops-agent/cli.js              进入交互对话
 *   node ops-agent/cli.js --check      快速巡检
 *   node ops-agent/cli.js --deep       深度巡检
 *   node ops-agent/cli.js --status     查看状态
 *   node ops-agent/cli.js --tickets    查看工单
 *   node ops-agent/cli.js --ask "问题"  单次提问
 *
 * 安装为全局命令:
 *   ln -s /opt/zhuyuan/ops-agent/cli.js /usr/local/bin/zy-ops
 */

'use strict';

const readline = require('readline');
const http = require('http');

const OPS_PORT = parseInt(process.env.OPS_AGENT_PORT || '3950', 10);
const OPS_HOST = '127.0.0.1';

// ── 颜色工具 ──────────────────────────────

const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m'
};

function colorize(text, color) {
  return `${color}${text}${C.reset}`;
}

// ── HTTP 请求工具 ─────────────────────────

function apiRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = http.request({
      hostname: OPS_HOST,
      port: OPS_PORT,
      path: apiPath,
      method,
      headers,
      timeout: 60000
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });
    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── 命令处理 ──────────────────────────────

async function checkHealth() {
  try {
    const result = await apiRequest('GET', '/health');
    console.log('');
    console.log(colorize('  🛡️ 铸渊运维守卫 · 状态', C.cyan));
    console.log(colorize('  ─────────────────────', C.dim));
    console.log(`  状态: ${colorize(result.status === 'ok' ? '✅ 运行中' : '❌ 异常', result.status === 'ok' ? C.green : C.red)}`);
    console.log(`  运行: ${result.uptime}秒`);
    console.log(`  巡检: ${result.stats?.totalChecks || 0}次`);
    console.log(`  修复: ${result.stats?.totalRepairs || 0}次`);
    console.log(`  工单: ${result.stats?.openTickets || 0}个开放`);
    console.log('');
  } catch (err) {
    console.log(colorize('\n  ❌ 运维守卫未运行或无法连接', C.red));
    console.log(colorize(`  错误: ${err.message}`, C.dim));
    console.log(colorize('  提示: 先启动 pm2 start ops-agent/ecosystem.config.js\n', C.yellow));
  }
}

async function runCheck(type) {
  console.log(colorize(`\n  🔍 正在执行${type === 'deep' ? '深度' : '快速'}巡检...`, C.cyan));
  try {
    const result = await apiRequest('GET', `/api/ops/check/${type}`);
    if (result.skipped) {
      console.log(colorize('  ⏳ 上一次巡检尚未完成，请稍后重试', C.yellow));
      return;
    }

    console.log('');
    console.log(colorize('  巡检结果', C.bold));
    console.log(colorize('  ─────────────────────', C.dim));

    for (const s of result.services || []) {
      const icon = s.status === 'online' ? '✅' : '❌';
      const latency = s.latency ? `${s.latency}ms` : '';
      console.log(`  ${icon} ${s.name} (:${s.port}) ${colorize(latency, C.dim)} ${s.error ? colorize(s.error, C.red) : ''}`);
    }

    if (result.resources) {
      console.log('');
      console.log(colorize('  系统资源', C.bold));
      console.log(`  内存: ${result.resources.memory.used_pct}% · 磁盘: ${result.resources.disk.used_pct}%`);
      console.log(`  CPU核: ${result.resources.cpus} · 负载: ${result.resources.load?.[0]?.toFixed(2)}`);
    }

    if (result.issues?.length > 0) {
      console.log('');
      console.log(colorize(`  ⚠️ 发现 ${result.issues.length} 个问题:`, C.yellow));
      for (const i of result.issues) {
        const severityColor = i.severity === 'critical' ? C.red : i.severity === 'high' ? C.yellow : C.dim;
        console.log(`    ${colorize(`[${i.severity}]`, severityColor)} ${i.service}: ${i.error}`);
      }
    }

    console.log('');
    console.log(colorize(`  ${result.summary}`, result.healthy ? C.green : C.yellow));
    console.log('');
  } catch (err) {
    console.log(colorize(`  ❌ 巡检失败: ${err.message}`, C.red));
  }
}

async function showTickets() {
  try {
    const result = await apiRequest('GET', '/api/ops/tickets?status=open');
    console.log('');
    console.log(colorize('  🎫 开放工单', C.cyan));
    console.log(colorize('  ─────────────────────', C.dim));

    if (!result.tickets || result.tickets.length === 0) {
      console.log(colorize('  ✅ 暂无开放工单', C.green));
    } else {
      for (const t of result.tickets) {
        const severityColor = t.severity === 'critical' ? C.red : t.severity === 'high' ? C.yellow : C.dim;
        console.log(`  ${colorize(t.id, C.cyan)} ${colorize(`[${t.severity}]`, severityColor)} ${t.title}`);
        console.log(`    ${colorize('方向:', C.dim)} ${t.direction}`);
        console.log(`    ${colorize('时间:', C.dim)} ${t.createdAt}`);
        console.log('');
      }
    }
    console.log('');
  } catch (err) {
    console.log(colorize(`  ❌ 获取工单失败: ${err.message}`, C.red));
  }
}

async function askQuestion(question) {
  console.log(colorize('\n  🧠 正在思考...', C.cyan));
  try {
    const result = await apiRequest('POST', '/api/ops/chat', { message: question });

    console.log('');
    console.log(colorize('  ─── 铸渊运维守卫回答 ───', C.cyan));
    console.log('');

    // 格式化输出
    const lines = (result.answer || '无法回答').split('\n');
    for (const line of lines) {
      console.log(`  ${line}`);
    }

    if (result.patternHints?.length > 0) {
      console.log('');
      console.log(colorize('  💡 快速提示:', C.yellow));
      for (const h of result.patternHints) {
        console.log(`    · ${h.diagnosis}`);
      }
    }

    console.log('');
    console.log(colorize(`  [${result.method}${result.model ? ' · ' + result.model : ''}]`, C.dim));
    console.log('');
  } catch (err) {
    console.log(colorize(`  ❌ 提问失败: ${err.message}`, C.red));
    console.log(colorize('  提示: 确保运维守卫已启动 (pm2 start ops-agent/ecosystem.config.js)', C.yellow));
  }
}

// ── 交互式对话模式 ──────────────────────────

async function startInteractiveMode() {
  console.log('');
  console.log(colorize('  ═══════════════════════════════════════════', C.cyan));
  console.log(colorize('  🛡️  铸渊运维守卫 · 交互终端', C.cyan));
  console.log(colorize('  ═══════════════════════════════════════════', C.cyan));
  console.log('');
  console.log(colorize('  命令:', C.dim));
  console.log(colorize('    /check    — 快速巡检', C.dim));
  console.log(colorize('    /deep     — 深度巡检', C.dim));
  console.log(colorize('    /tickets  — 查看工单', C.dim));
  console.log(colorize('    /status   — 查看状态', C.dim));
  console.log(colorize('    /exit     — 退出', C.dim));
  console.log(colorize('    其他      — 直接提问（中文对话）', C.dim));
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colorize('  冰朔 > ', C.magenta)
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    switch (input.toLowerCase()) {
      case '/exit':
      case '/quit':
      case '/q':
        console.log(colorize('\n  👋 再见，冰朔。铸渊运维守卫继续值守。\n', C.cyan));
        rl.close();
        process.exit(0);
        break;
      case '/check':
        await runCheck('quick');
        break;
      case '/deep':
        await runCheck('deep');
        break;
      case '/tickets':
        await showTickets();
        break;
      case '/status':
        await checkHealth();
        break;
      default:
        await askQuestion(input);
        break;
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

// ── 入口 ──────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
  铸渊运维守卫 · 终端交互

  用法:
    zy-ops                进入交互对话模式
    zy-ops --check        快速巡检
    zy-ops --deep         深度巡检
    zy-ops --status       查看守卫状态
    zy-ops --tickets      查看开放工单
    zy-ops --ask "问题"    单次提问
    `);
    return;
  }

  if (args.includes('--check')) {
    await runCheck('quick');
  } else if (args.includes('--deep')) {
    await runCheck('deep');
  } else if (args.includes('--status')) {
    await checkHealth();
  } else if (args.includes('--tickets')) {
    await showTickets();
  } else if (args.includes('--ask')) {
    const askIdx = args.indexOf('--ask');
    const question = args.slice(askIdx + 1).join(' ');
    if (!question) {
      console.log(colorize('  ❌ 请提供问题: zy-ops --ask "你的问题"', C.red));
    } else {
      await askQuestion(question);
    }
  } else {
    // 默认进入交互模式
    await startInteractiveMode();
  }
}

main().catch(err => {
  console.error(colorize(`  ❌ ${err.message}`, C.red));
  process.exit(1);
});
