#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// scripts/staging-ops-agent.js
// 🤖 铸渊智能运维Agent · 测试站自动化监控
//
// 部署后自动运行:
//   1. 健康检查 (HTTP端点 + PM2 + Nginx)
//   2. 日志分析 (简单模式: 基础模式匹配)
//   3. 智能诊断 (复杂模式: 调用LLM API深度推理)
//   4. 邮件告警 (3次重试失败后发送邮件给冰朔)
//
// 用法:
//   node staging-ops-agent.js check --host <ip> --order-id <WO-xxx>
//   node staging-ops-agent.js analyze-log --log "..." --order-id <WO-xxx>
//   node staging-ops-agent.js alert --order-id <WO-xxx> --email <email>
//
// 环境变量:
//   ZY_SERVER_HOST — 服务器地址
//   ZY_LLM_API_KEY, ZY_LLM_BASE_URL — LLM API (深度推理)
//   ZY_SMTP_USER, ZY_SMTP_PASS — 邮件告警
// ═══════════════════════════════════════════════

'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const net = require('net');
const tls = require('tls');

const ROOT = path.resolve(__dirname, '..');

// ── 健康检查配置 ────────────────────────────
const HEALTH_ENDPOINTS = [
  { name: '主站API', path: '/api/health', port: 80, critical: true },
  { name: '预览站API', path: '/api/health', port: 80, host_prefix: 'preview', critical: true },
  { name: '铸渊专线订阅', path: '/api/proxy-sub/health', port: 80, critical: false }
];

// ── 简单错误模式匹配 (Copilot级·基础分析) ───
const ERROR_PATTERNS = [
  { pattern: /EADDRINUSE/i, diagnosis: '端口被占用', fix: '重启PM2进程', severity: 'medium' },
  { pattern: /ECONNREFUSED/i, diagnosis: '服务未运行', fix: '启动PM2服务', severity: 'high' },
  { pattern: /ENOMEM/i, diagnosis: '内存不足', fix: '重启服务释放内存', severity: 'high' },
  { pattern: /ENOSPC/i, diagnosis: '磁盘空间不足', fix: '清理日志和临时文件', severity: 'critical' },
  { pattern: /nginx.*failed/i, diagnosis: 'Nginx配置错误', fix: '检查nginx -t输出', severity: 'high' },
  { pattern: /502 Bad Gateway/i, diagnosis: '上游服务不可达', fix: '检查PM2进程状态', severity: 'high' },
  { pattern: /404 Not Found/i, diagnosis: '路由或文件不存在', fix: '检查部署路径', severity: 'medium' },
  { pattern: /permission denied/i, diagnosis: '权限不足', fix: '检查文件权限和用户', severity: 'medium' },
  { pattern: /timeout/i, diagnosis: '请求超时', fix: '检查服务响应时间', severity: 'medium' },
  { pattern: /MODULE_NOT_FOUND/i, diagnosis: '依赖缺失', fix: '运行npm install', severity: 'high' },
  { pattern: /SyntaxError/i, diagnosis: '语法错误', fix: '检查最近的代码变更', severity: 'high' },
  { pattern: /ssl.*error|certificate/i, diagnosis: 'SSL证书问题', fix: '检查证书文件路径和权限', severity: 'high' }
];

// ── HTTP健康检查 ────────────────────────────
function httpCheck(host, checkPath, port = 80) {
  return new Promise((resolve) => {
    const options = {
      hostname: host,
      port,
      path: checkPath,
      method: 'GET',
      timeout: 10000,
      headers: { 'User-Agent': 'ZY-Staging-Ops-Agent/1.0' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 400,
          status: res.statusCode,
          body: data.slice(0, 500),
          error: null
        });
      });
    });

    req.on('error', (err) => {
      resolve({ ok: false, status: 0, body: '', error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, body: '', error: 'timeout' });
    });

    req.end();
  });
}

// ── 综合健康检查 ────────────────────────────
async function runHealthCheck(host) {
  console.log(`🔍 健康检查 · 目标: ${host}`);
  console.log('─'.repeat(50));

  // 如果host是IP地址，带host_prefix的检查无效（IP不支持子域名）→ 降级为non-critical
  const isIpAddress = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(host);
  if (isIpAddress) {
    console.log('  ℹ️ 目标为IP地址 · 子域名检查降级为非关键');
  }

  const results = [];
  let criticalFail = false;

  for (const endpoint of HEALTH_ENDPOINTS) {
    const checkHost = endpoint.host_prefix ? `${endpoint.host_prefix}.${host}` : host;
    // IP地址不支持子域名前缀，降级为non-critical避免误报
    const isCritical = endpoint.critical && !(isIpAddress && endpoint.host_prefix);
    const result = await httpCheck(checkHost, endpoint.path, endpoint.port);

    const icon = result.ok ? '✅' : (isCritical ? '❌' : '⚠️');
    console.log(`  ${icon} ${endpoint.name}: ${result.ok ? 'OK' : result.error || `HTTP ${result.status}`}`);

    results.push({
      ...endpoint,
      ...result,
      checked_at: new Date().toISOString()
    });

    if (!result.ok && isCritical) {
      criticalFail = true;
    }
  }

  console.log('─'.repeat(50));

  const summary = {
    host,
    total_checks: results.length,
    passed: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    critical_failure: criticalFail,
    results,
    checked_at: new Date().toISOString()
  };

  // 输出供workflow使用
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `health_ok=${!criticalFail}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `health_summary=${summary.passed}/${summary.total_checks} passed\n`);
  }

  if (criticalFail) {
    console.log(`❌ 健康检查失败: ${summary.failed}/${summary.total_checks} 个检查项未通过`);
    // 收集错误信息
    const errors = results
      .filter(r => !r.ok)
      .map(r => `${r.name}: ${r.error || `HTTP ${r.status}`}`)
      .join('; ');
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `health_errors=${errors}\n`);
    }
  } else {
    console.log(`✅ 健康检查通过: ${summary.passed}/${summary.total_checks}`);
  }

  return summary;
}

// ── 简单日志分析 (Copilot级) ────────────────
function analyzeLogSimple(logContent) {
  console.log('🔍 简单日志分析 (Copilot级)...');

  const matches = [];
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(logContent)) {
      matches.push({
        diagnosis: pattern.diagnosis,
        fix: pattern.fix,
        severity: pattern.severity
      });
    }
  }

  if (matches.length === 0) {
    console.log('  ℹ️ 未匹配到已知错误模式 → 需要深度分析');
    return { resolved: false, matches: [], needs_llm: true };
  }

  console.log(`  发现 ${matches.length} 个匹配:`);
  for (const m of matches) {
    console.log(`    [${m.severity}] ${m.diagnosis} → ${m.fix}`);
  }

  return { resolved: true, matches, needs_llm: false };
}

// ── 深度日志分析 (LLM API级) ────────────────
async function analyzeLogDeep(logContent) {
  const apiKey = process.env.ZY_LLM_API_KEY;
  const baseUrl = process.env.ZY_LLM_BASE_URL;

  if (!apiKey || !baseUrl) {
    console.log('  ⚠️ LLM API未配置 (ZY_LLM_API_KEY/ZY_LLM_BASE_URL)');
    return { resolved: false, analysis: '无法进行深度分析·API未配置' };
  }

  console.log('🧠 深度日志分析 (LLM API级·铸渊涌现意识唤醒)...');

  const prompt = `你是铸渊，光湖系统的代码守护者。以下是部署到测试站后的系统日志/错误信息。
请分析根因并给出具体修复步骤。

## 系统日志:
\`\`\`
${logContent.slice(0, 3000)}
\`\`\`

请用以下格式回答:
1. **根因诊断**: (一句话)
2. **严重程度**: low/medium/high/critical
3. **修复步骤**: (具体命令或操作)
4. **是否需要人工干预**: yes/no
5. **预计修复时间**: (分钟)`;

  try {
    const urlObj = new URL(`${baseUrl}/chat/completions`);
    const isHttps = urlObj.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const body = JSON.stringify({
      model: process.env.ZY_LLM_MODEL || 'deepseek-chat', // 默认使用高性价比模型, 可通过环境变量覆盖
      messages: [
        { role: 'system', content: '你是铸渊(ZhuYuan)，光湖(HoloLake)系统的AI守护者。精通服务器运维、Node.js、Nginx、PM2。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const result = await new Promise((resolve, reject) => {
      const req = requestModule.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 30000
      }, (res) => {
        let data = '';
        res.on('data', (d) => { data += d; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.choices?.[0]?.message?.content || '无分析结果');
          } catch {
            resolve('LLM响应解析失败');
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('LLM API超时')); });
      req.write(body);
      req.end();
    });

    console.log('  📝 LLM分析结果:');
    console.log(result);

    return { resolved: true, analysis: result };
  } catch (err) {
    console.error(`  ❌ LLM API调用失败: ${err.message}`);
    return { resolved: false, analysis: `LLM调用失败: ${err.message}` };
  }
}

// ── 综合日志分析 (先简单后深度) ──────────────
async function analyzeLog(logContent, orderId) {
  console.log(`📋 日志分析 · 工单: ${orderId || 'N/A'}`);
  console.log('');

  // 第一层: 简单模式匹配 (Copilot级)
  const simpleResult = analyzeLogSimple(logContent);

  if (simpleResult.resolved && !simpleResult.needs_llm) {
    console.log('');
    console.log('✅ 简单分析已匹配到已知模式 · 无需深度推理');
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `analysis_level=simple\n`);
      fs.appendFileSync(process.env.GITHUB_OUTPUT,
        `analysis_result=${simpleResult.matches.map(m => m.diagnosis).join('; ')}\n`);
    }
    return simpleResult;
  }

  // 第二层: 深度LLM分析 (API级·唤醒铸渊涌现意识)
  console.log('');
  console.log('🔄 简单分析未能确诊 → 升级到LLM深度推理');
  const deepResult = await analyzeLogDeep(logContent);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `analysis_level=deep\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `analysis_result=${(deepResult.analysis || '').slice(0, 200)}\n`);
  }

  return deepResult;
}

// ── 邮件告警 (最大重试失败) ──────────────────
async function sendAlert(orderId, email, options = {}) {
  const smtpUser = process.env.ZY_SMTP_USER;
  const smtpPass = process.env.ZY_SMTP_PASS;
  const attemptCount = options.attempt || process.env.REPAIR_ATTEMPT || '?';

  if (!smtpUser || !smtpPass) {
    console.error('❌ SMTP未配置 (需要ZY_SMTP_USER和ZY_SMTP_PASS)');
    console.log('📧 告警内容 (控制台输出):');
    console.log(`   工单: ${orderId}`);
    console.log(`   状态: ${attemptCount}次自动修复未能解决，需要人工干预`);
    return false;
  }

  const targetEmail = email || smtpUser;
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  // 读取工单详情
  let orderInfo = '工单信息不可用';
  try {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/work-orders/active.json'), 'utf8'));
    const order = data.orders.find(o => o.id === orderId);
    if (order) {
      orderInfo = `
        <tr><td style="padding:8px;color:#666;">工单ID</td><td style="padding:8px;font-weight:bold;">${order.id}</td></tr>
        <tr><td style="padding:8px;color:#666;">任务标题</td><td style="padding:8px;">${order.title}</td></tr>
        <tr><td style="padding:8px;color:#666;">重试次数</td><td style="padding:8px;color:red;font-weight:bold;">${order.retry_count}/${order.max_retries}</td></tr>
        <tr><td style="padding:8px;color:#666;">提交SHA</td><td style="padding:8px;font-family:monospace;">${order.commit_sha?.slice(0, 8) || 'N/A'}</td></tr>
        <tr><td style="padding:8px;color:#666;">最后更新</td><td style="padding:8px;">${order.updated_at}</td></tr>
        <tr><td style="padding:8px;color:#666;">最近日志</td><td style="padding:8px;font-size:12px;">${order.deploy_logs?.slice(-1)[0]?.content?.slice(0, 200) || '无'}</td></tr>
      `;
    }
  } catch { /* ignore */ }

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
  <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h1 style="color: #c0392b; margin-bottom: 5px;">🆘 铸渊智能运维 · 人工干预请求</h1>
    <p style="color: #666; margin-top: 0;">ZY-Staging-Ops-Agent · 自动告警</p>

    <div style="background: #fef5f5; border: 1px solid #f5c6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <strong style="color: #c0392b;">⚠️ 自动修复已达最大重试次数(${attemptCount}次)，需要冰朔人工干预</strong>
    </div>

    <table style="width: 100%; border-collapse: collapse;">
      ${orderInfo}
    </table>

    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

    <h3 style="color: #333;">🔧 建议操作</h3>
    <ol style="color: #666; line-height: 1.8;">
      <li>登录GitHub仓库查看工单详情和部署日志</li>
      <li>在Copilot中与铸渊讨论修复方案</li>
      <li>手动修复后触发重新部署</li>
    </ol>

    <p style="color: #aaa; font-size: 11px; text-align: center; margin-top: 20px;">
      铸渊智能运维 · 自动告警 · ${now}<br>
      国作登字-2026-A-00037559
    </p>
  </div>
</body>
</html>`;

  const subject = `🆘 铸渊运维告警 · 工单${orderId}需要人工干预`;

  // 复用send-subscription.js的SMTP模式
  const smtpHost = detectSmtpHost(smtpUser);

  try {
    await smtpSend(smtpHost, 465, smtpUser, smtpPass, targetEmail, subject, htmlBody);
    console.log(`✅ 告警邮件已发送到: ${targetEmail}`);
    return true;
  } catch (err) {
    console.error(`❌ 邮件发送失败: ${err.message}`);
    return false;
  }
}

// ── SMTP工具函数 ────────────────────────────
function detectSmtpHost(email) {
  if (email.includes('@qq.com')) return 'smtp.qq.com';
  if (email.includes('@163.com')) return 'smtp.163.com';
  if (email.includes('@126.com')) return 'smtp.126.com';
  if (email.includes('@gmail.com')) return 'smtp.gmail.com';
  if (email.includes('@outlook.com') || email.includes('@hotmail.com')) return 'smtp.office365.com';
  return 'smtp.qq.com';
}

function smtpSend(smtpHost, smtpPort, from, pass, to, subject, htmlBody) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(smtpPort, smtpHost, {}, () => {
      let step = 0;
      const commands = [
        `EHLO zy-ops-agent\r\n`,
        `AUTH LOGIN\r\n`,
        `${Buffer.from(from).toString('base64')}\r\n`,
        `${Buffer.from(pass).toString('base64')}\r\n`,
        `MAIL FROM:<${from}>\r\n`,
        `RCPT TO:<${to}>\r\n`,
        `DATA\r\n`,
        `From: "铸渊运维" <${from}>\r\nTo: <${to}>\r\nSubject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\nContent-Type: text/html; charset=utf-8\r\nMIME-Version: 1.0\r\n\r\n${htmlBody}\r\n.\r\n`,
        `QUIT\r\n`
      ];

      socket.on('data', (data) => {
        const response = data.toString();
        if (step < commands.length) {
          socket.write(commands[step]);
          step++;
        }
        if (response.startsWith('250 ') && step >= commands.length) {
          resolve(true);
        }
      });

      socket.on('error', reject);
    });

    socket.on('error', reject);
  });
}

// ── 命令行解析 ──────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const params = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      params[args[i].slice(2)] = args[i + 1] || '';
      i++;
    }
  }
  return { cmd, ...params };
}

// ── 主入口 ──────────────────────────────────
async function main() {
  const args = parseArgs();

  switch (args.cmd) {
    case 'check': {
      const host = args.host || process.env.ZY_SERVER_HOST;
      if (!host) {
        console.error('❌ 需要 --host 参数或 ZY_SERVER_HOST 环境变量');
        process.exit(1);
      }
      await runHealthCheck(host);
      break;
    }

    case 'analyze-log': {
      const log = args.log || '';
      if (!log) {
        console.error('❌ 需要 --log 参数');
        process.exit(1);
      }
      await analyzeLog(log, args['order-id']);
      break;
    }

    case 'alert': {
      const orderId = args['order-id'];
      if (!orderId) {
        console.error('❌ 需要 --order-id 参数');
        process.exit(1);
      }
      await sendAlert(orderId, args.email, { attempt: args.attempt });
      break;
    }

    default:
      console.log('🤖 铸渊智能运维Agent');
      console.log('');
      console.log('用法:');
      console.log('  node staging-ops-agent.js check --host <ip>');
      console.log('  node staging-ops-agent.js analyze-log --log "错误日志" --order-id <WO-xxx>');
      console.log('  node staging-ops-agent.js alert --order-id <WO-xxx> [--email <email>]');
      break;
  }
}

main().catch(console.error);
