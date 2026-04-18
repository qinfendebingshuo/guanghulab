#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * 💬 铸渊运维守卫 · 终端交互对话 v2.0 (zy-ops)
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-OPS-CLI-002
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * Phase 2 增强:
 *   - 多轮对话（会话记忆，上下文连续）
 *   - 自动诊断（问问题时自动执行健康检查）
 *   - PM2 日志查看
 *   - 系统信息面板
 *   - 对话历史保存
 *
 * 使用:
 *   node ops-agent/cli.js              进入交互对话
 *   node ops-agent/cli.js --check      快速巡检
 *   node ops-agent/cli.js --deep       深度巡检
 *   node ops-agent/cli.js --status     查看状态
 *   node ops-agent/cli.js --tickets    查看工单
 *   node ops-agent/cli.js --ask "问题"  单次提问
 *   node ops-agent/cli.js --logs <name> 查看PM2日志
 *   node ops-agent/cli.js --sysinfo    系统信息
 *
 * 安装为全局命令:
 *   ln -s /opt/zhuyuan/ops-agent/cli.js /usr/local/bin/zy-ops
 */

'use strict';

const readline = require('readline');
const http = require('http');

const OPS_PORT = parseInt(process.env.OPS_AGENT_PORT || '3950', 10);
const OPS_HOST = '127.0.0.1';

// 当前会话 ID（进入交互模式后保持不变，实现多轮对话）
let currentSessionId = null;

// ── 颜色工具 ──────────────────────────────

const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  bgCyan: '\x1b[46m',
  bgDim: '\x1b[100m'
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

async function showPM2Logs(processName, lines = 30) {
  try {
    const result = await apiRequest('GET', `/api/ops/pm2-logs/${encodeURIComponent(processName)}?lines=${lines}`);
    console.log('');
    console.log(colorize(`  📋 PM2 日志 · ${result.processName || processName}`, C.cyan));
    console.log(colorize('  ─────────────────────', C.dim));

    if (result.error) {
      console.log(colorize(`  ❌ ${result.message}`, C.red));
    } else {
      if (result.output) {
        console.log(colorize('  [标准输出]', C.dim));
        const outputLines = result.output.split('\n').slice(-lines);
        for (const line of outputLines) {
          // 高亮错误行
          if (/error|fail|crash|ECONNREFUSED|ENOMEM/i.test(line)) {
            console.log(`  ${colorize(line, C.red)}`);
          } else if (/warn|DEPRECATED/i.test(line)) {
            console.log(`  ${colorize(line, C.yellow)}`);
          } else {
            console.log(`  ${colorize(line, C.dim)}`);
          }
        }
      }

      if (result.errorOutput && result.errorOutput.trim()) {
        console.log('');
        console.log(colorize('  [错误输出]', C.red));
        const errLines = result.errorOutput.split('\n').slice(-Math.min(lines, 10));
        for (const line of errLines) {
          console.log(`  ${colorize(line, C.red)}`);
        }
      }
    }
    console.log('');
  } catch (err) {
    console.log(colorize(`  ❌ 获取日志失败: ${err.message}`, C.red));
  }
}

async function showSystemInfo() {
  try {
    const result = await apiRequest('GET', '/api/ops/system-info');
    console.log('');
    console.log(colorize('  💻 系统信息', C.cyan));
    console.log(colorize('  ═══════════════════════════════════════════', C.dim));

    // 资源
    if (result.resources) {
      const r = result.resources;
      const memBar = renderBar(r.memory.used_pct);
      const diskBar = renderBar(r.disk.used_pct);
      console.log('');
      console.log(colorize('  内存', C.bold));
      console.log(`  ${memBar} ${r.memory.used_pct}%  (${r.memory.free_mb}MB 空闲 / ${r.memory.total_mb}MB 总量)`);
      console.log('');
      console.log(colorize('  磁盘', C.bold));
      console.log(`  ${diskBar} ${r.disk.used_pct}%  (${r.disk.available_gb}GB 可用 / ${r.disk.total_gb}GB 总量)`);
      console.log('');
      console.log(`  CPU: ${r.cpus}核 · 负载: ${r.load?.[0]?.toFixed(2)} / ${r.load?.[1]?.toFixed(2)} / ${r.load?.[2]?.toFixed(2)}`);
      console.log(`  运行时间: ${r.uptime_hours}小时 · Node: ${r.node_version}`);
    }

    // PM2 进程
    if (result.pm2 && result.pm2.length > 0) {
      console.log('');
      console.log(colorize('  PM2 进程', C.bold));
      console.log(colorize('  ─────────────────────────────────────', C.dim));
      console.log(colorize('  名称                状态      内存    CPU  重启  运行', C.dim));
      for (const p of result.pm2) {
        const statusColor = p.status === 'online' ? C.green :
          p.status === 'errored' ? C.red : C.yellow;
        const name = (p.name || '').padEnd(20);
        const status = colorize((p.status || '').padEnd(10), statusColor);
        const mem = `${p.memory_mb || 0}MB`.padEnd(8);
        const cpu = `${p.cpu || 0}%`.padEnd(5);
        const restarts = String(p.restarts || 0).padEnd(6);
        const uptime = `${p.uptime_hours || 0}h`;
        console.log(`  ${name}${status}${mem}${cpu}${restarts}${uptime}`);
      }
    }

    // Nginx
    if (result.nginx) {
      console.log('');
      console.log(colorize('  Nginx', C.bold));
      const ngStatus = result.nginx.status === 'active' ? colorize('运行中 ✅', C.green) : colorize('异常 ❌', C.red);
      const ngConfig = result.nginx.configOk ? colorize('正常', C.green) : colorize('异常', C.red);
      console.log(`  状态: ${ngStatus} · 配置: ${ngConfig}`);
    }

    console.log('');
  } catch (err) {
    console.log(colorize(`  ❌ 获取系统信息失败: ${err.message}`, C.red));
  }
}

function renderBar(pct, width = 20) {
  const filled = Math.round(width * pct / 100);
  const empty = width - filled;
  const color = pct > 90 ? C.red : pct > 70 ? C.yellow : C.green;
  return `${color}${'█'.repeat(filled)}${C.dim}${'░'.repeat(empty)}${C.reset}`;
}

async function askQuestion(question) {
  // 打字动画效果
  const frames = ['🧠 思考中.', '🧠 思考中..', '🧠 思考中...'];
  let frameIdx = 0;
  const spinner = setInterval(() => {
    process.stdout.write(`\r  ${frames[frameIdx++ % frames.length]}  `);
  }, 300);

  try {
    const body = { message: question };
    if (currentSessionId) {
      body.sessionId = currentSessionId;
    }

    const result = await apiRequest('POST', '/api/ops/chat', body);

    // 更新 sessionId
    if (result.sessionId) {
      currentSessionId = result.sessionId;
    }

    console.log('');
    console.log(colorize('  ─── 铸渊运维守卫 ───', C.cyan));
    console.log('');

    // 格式化输出（支持简单 Markdown）
    const lines = (result.answer || '无法回答').split('\n');
    for (const line of lines) {
      let formatted = line;
      // 加粗
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, `${C.bold}$1${C.reset}`);
      // 标题
      if (/^#+\s/.test(formatted)) {
        formatted = colorize(formatted.replace(/^#+\s/, ''), C.cyan + C.bold);
      }
      // 列表项
      if (/^\d+\.\s/.test(formatted)) {
        formatted = `  ${colorize(formatted.match(/^\d+/)[0] + '.', C.cyan)} ${formatted.replace(/^\d+\.\s/, '')}`;
      }
      console.log(`  ${formatted}`);
    }

    // 显示工具使用情况
    if (result.toolsUsed?.length > 0) {
      console.log('');
      console.log(colorize(`  🔧 自动执行了: ${result.toolsUsed.join(', ')}`, C.dim));
    }

    if (result.patternHints?.length > 0) {
      console.log('');
      console.log(colorize('  💡 快速提示:', C.yellow));
      for (const h of result.patternHints) {
        console.log(`    · ${h.diagnosis}`);
      }
    }

    console.log('');
    console.log(colorize(`  [${result.method}${result.model ? ' · ' + result.model : ''}${result.intent ? ' · 意图:' + result.intent : ''}]`, C.dim));
    console.log('');
  } catch (err) {
    console.log(colorize(`  ❌ 提问失败: ${err.message}`, C.red));
    console.log(colorize('  提示: 确保运维守卫已启动 (pm2 start ops-agent/ecosystem.config.js)', C.yellow));
  } finally {
    clearInterval(spinner);
    process.stdout.write('\r' + ' '.repeat(30) + '\r');
  }
}

// ── 交互式对话模式 v2 ──────────────────────

async function startInteractiveMode() {
  console.log('');
  console.log(colorize('  ═══════════════════════════════════════════', C.cyan));
  console.log(colorize('  🛡️  铸渊运维守卫 · 交互终端 v2.0', C.cyan));
  console.log(colorize('  ═══════════════════════════════════════════', C.cyan));
  console.log('');
  console.log(colorize('  你好，冰朔。我是铸渊运维守卫。', C.white));
  console.log(colorize('  直接用中文告诉我你遇到的问题，我会自动检查并给你答案。', C.dim));
  console.log('');
  console.log(colorize('  命令:', C.dim));
  console.log(colorize('    /check       — 快速巡检', C.dim));
  console.log(colorize('    /deep        — 深度巡检', C.dim));
  console.log(colorize('    /tickets     — 查看工单', C.dim));
  console.log(colorize('    /status      — 查看状态', C.dim));
  console.log(colorize('    /sysinfo     — 系统信息', C.dim));
  console.log(colorize('    /logs <名字> — 查看PM2日志', C.dim));
  console.log(colorize('    /help        — 帮助', C.dim));
  console.log(colorize('    /exit        — 退出', C.dim));
  console.log(colorize('    其他         — 直接提问（多轮对话，我记得上下文）', C.dim));
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

    const lower = input.toLowerCase();

    if (lower === '/exit' || lower === '/quit' || lower === '/q') {
      console.log(colorize('\n  👋 再见，冰朔。铸渊运维守卫继续值守。\n', C.cyan));
      rl.close();
      process.exit(0);
    } else if (lower === '/check') {
      await runCheck('quick');
    } else if (lower === '/deep') {
      await runCheck('deep');
    } else if (lower === '/tickets') {
      await showTickets();
    } else if (lower === '/status') {
      await checkHealth();
    } else if (lower === '/sysinfo' || lower === '/sys') {
      await showSystemInfo();
    } else if (lower.startsWith('/logs')) {
      const parts = input.split(/\s+/);
      const processName = parts[1];
      const logLines = parseInt(parts[2] || '30', 10);
      if (!processName) {
        console.log(colorize('\n  用法: /logs <进程名> [行数]', C.yellow));
        console.log(colorize('  可选: zhuyuan-server, age-os-mcp, glada-agent, novel-api, zhuyuan-preview, age-os-agents\n', C.dim));
      } else {
        await showPM2Logs(processName, logLines);
      }
    } else if (lower === '/help' || lower === '/h') {
      showHelp();
    } else if (lower === '/session') {
      console.log(colorize(`\n  当前会话: ${currentSessionId || '(新会话)'}`, C.cyan));
      console.log(colorize('  多轮对话中，我记得你之前问过的问题。\n', C.dim));
    } else if (lower === '/new') {
      currentSessionId = null;
      console.log(colorize('\n  🔄 已开始新会话\n', C.cyan));
    } else {
      await askQuestion(input);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

function showHelp() {
  console.log('');
  console.log(colorize('  ═══════════════════════════════════════════', C.cyan));
  console.log(colorize('  🛡️ 铸渊运维守卫 · 帮助', C.cyan));
  console.log(colorize('  ═══════════════════════════════════════════', C.cyan));
  console.log('');
  console.log(colorize('  💬 对话能力（直接输入中文）:', C.bold));
  console.log('    "为什么MCP连不上？"      → 自动检查端口+日志，给你诊断');
  console.log('    "服务器内存够用吗？"      → 自动查看系统资源');
  console.log('    "帮我重启主站"            → 告诉你操作方式');
  console.log('    "GLADA最近报什么错？"     → 自动查看GLADA日志');
  console.log('');
  console.log(colorize('  🔧 快捷命令:', C.bold));
  console.log('    /check             快速巡检（检查所有端口）');
  console.log('    /deep              深度巡检（端口+资源+PM2状态）');
  console.log('    /sysinfo           系统信息（内存/磁盘/PM2/Nginx）');
  console.log('    /logs <进程名>     查看PM2日志');
  console.log('    /tickets           查看开放工单');
  console.log('    /status            运维守卫状态');
  console.log('    /session           查看当前会话ID');
  console.log('    /new               开始新对话（清除上下文）');
  console.log('    /exit              退出');
  console.log('');
  console.log(colorize('  💡 我能记住对话上下文！你可以追问：', C.dim));
  console.log(colorize('    "刚才说的第二步怎么做？"', C.dim));
  console.log(colorize('    "这个问题上次出现过吗？"', C.dim));
  console.log('');
}

// ── 入口 ──────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
  铸渊运维守卫 · 终端交互 v2.0

  用法:
    zy-ops                进入交互对话模式（多轮对话）
    zy-ops --check        快速巡检
    zy-ops --deep         深度巡检
    zy-ops --status       查看守卫状态
    zy-ops --tickets      查看开放工单
    zy-ops --ask "问题"    单次提问
    zy-ops --logs <名字>  查看PM2日志
    zy-ops --sysinfo      系统信息
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
  } else if (args.includes('--sysinfo') || args.includes('--sys')) {
    await showSystemInfo();
  } else if (args.includes('--logs')) {
    const logIdx = args.indexOf('--logs');
    const processName = args[logIdx + 1];
    const logLines = parseInt(args[logIdx + 2] || '30', 10);
    if (!processName) {
      console.log(colorize('  ❌ 请提供进程名: zy-ops --logs zhuyuan-server', C.red));
    } else {
      await showPM2Logs(processName, logLines);
    }
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
