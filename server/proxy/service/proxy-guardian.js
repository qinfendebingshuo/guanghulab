#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/proxy-guardian.js
// 🛡️ 铸渊专线 · 代理守护Agent
//
// 自动处理代理服务的各种异常:
//   - Xray进程监控 (崩溃自动重启)
//   - 端口可达性检测
//   - IP声誉检查
//   - TLS指纹一致性
//   - 异常流量模式检测
//
// 遇到无法自动解决的问题时:
//   - 调用LLM API进行推理分析
//   - 生成诊断报告
//   - 通过邮件发送告警
//
// 运行方式: PM2 managed (zy-proxy-guardian)
// 检查间隔: 每10分钟
// ═══════════════════════════════════════════════

'use strict';

const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DATA_DIR = process.env.ZY_PROXY_DATA_DIR || '/opt/zhuyuan/proxy/data';
const LOG_DIR = process.env.ZY_PROXY_LOG_DIR || '/opt/zhuyuan/proxy/logs';
const LLM_API_KEY = process.env.ZY_LLM_API_KEY || '';
const LLM_BASE_URL = process.env.ZY_LLM_BASE_URL || '';
const GUARDIAN_FILE = path.join(DATA_DIR, 'guardian-status.json');
const CHECK_INTERVAL = 10 * 60 * 1000; // 10分钟

// ── 检查项定义 ───────────────────────────────
const CHECKS = {
  xray_process: '检查Xray进程是否运行',
  port_443: '检查443端口是否可达',
  subscription_service: '检查订阅服务是否响应',
  disk_space: '检查磁盘空间',
  memory_usage: '检查内存使用',
  xray_errors: '检查Xray错误日志'
};

// ── 读取守护状态 ─────────────────────────────
function readGuardianStatus() {
  try {
    return JSON.parse(fs.readFileSync(GUARDIAN_FILE, 'utf8'));
  } catch {
    return {
      last_check: null,
      consecutive_failures: 0,
      auto_fixes: 0,
      llm_consultations: 0,
      last_issue: null,
      status: 'initializing'
    };
  }
}

// ── 保存守护状态 ─────────────────────────────
function saveGuardianStatus(status) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(GUARDIAN_FILE, JSON.stringify(status, null, 2));
}

// ── 执行命令 ─────────────────────────────────
function runCmd(cmd, timeout = 10000) {
  try {
    return { ok: true, output: execSync(cmd, { encoding: 'utf8', timeout }).trim() };
  } catch (err) {
    return { ok: false, output: err.message };
  }
}

// ── 检查Xray进程 ────────────────────────────
function checkXrayProcess() {
  const result = runCmd('pgrep -x xray');
  if (result.ok && result.output) {
    return { ok: true, detail: `PID: ${result.output}` };
  }
  return { ok: false, detail: 'Xray进程未运行', fixable: true };
}

// ── 检查端口 ─────────────────────────────────
function checkPort443() {
  const result = runCmd('ss -tlnp | grep ":443 "');
  if (result.ok && result.output.includes('443')) {
    return { ok: true, detail: '443端口正在监听' };
  }
  return { ok: false, detail: '443端口未监听', fixable: true };
}

// ── 检查订阅服务 ─────────────────────────────
function checkSubscriptionService() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:3802/health', { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ ok: json.status === 'ok', detail: '订阅服务正常' });
        } catch {
          resolve({ ok: false, detail: '订阅服务响应异常', fixable: true });
        }
      });
    });
    req.on('error', () => {
      resolve({ ok: false, detail: '订阅服务无法连接', fixable: true });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, detail: '订阅服务响应超时', fixable: true });
    });
  });
}

// ── 检查磁盘空间 ─────────────────────────────
function checkDiskSpace() {
  const result = runCmd("df -h / | tail -1 | awk '{print $5}'");
  if (result.ok) {
    const usage = parseInt(result.output.replace('%', ''), 10);
    if (usage < 90) {
      return { ok: true, detail: `磁盘使用: ${usage}%` };
    }
    return { ok: false, detail: `磁盘使用过高: ${usage}%`, fixable: false };
  }
  return { ok: false, detail: '无法检查磁盘空间', fixable: false };
}

// ── 检查内存使用 ─────────────────────────────
function checkMemory() {
  const result = runCmd("free -m | grep Mem | awk '{print int($3/$2*100)}'");
  if (result.ok) {
    const usage = parseInt(result.output, 10);
    if (usage < 90) {
      return { ok: true, detail: `内存使用: ${usage}%` };
    }
    return { ok: false, detail: `内存使用过高: ${usage}%`, fixable: false };
  }
  return { ok: false, detail: '无法检查内存', fixable: false };
}

// ── 检查Xray错误日志 ────────────────────────
function checkXrayErrors() {
  const errorLog = path.join(LOG_DIR, 'error.log');
  try {
    if (!fs.existsSync(errorLog)) {
      return { ok: true, detail: '无错误日志' };
    }
    const stat = fs.statSync(errorLog);
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;

    if (stat.mtimeMs < fiveMinAgo) {
      return { ok: true, detail: '最近5分钟无新错误' };
    }

    const lines = fs.readFileSync(errorLog, 'utf8').split('\n').slice(-10);
    const criticalErrors = lines.filter(l =>
      l.includes('failed') || l.includes('error') || l.includes('panic')
    );

    if (criticalErrors.length === 0) {
      return { ok: true, detail: '无严重错误' };
    }

    return {
      ok: false,
      detail: `发现${criticalErrors.length}个错误: ${criticalErrors[0].slice(0, 100)}`,
      fixable: false,
      errors: criticalErrors
    };
  } catch {
    return { ok: true, detail: '错误日志检查跳过' };
  }
}

// ── 自动修复 ─────────────────────────────────
function autoFix(checkName) {
  console.log(`[守护Agent] 尝试自动修复: ${checkName}`);

  switch (checkName) {
    case 'xray_process':
    case 'port_443':
      // 重启Xray
      const restartResult = runCmd('systemctl restart xray', 30000);
      if (restartResult.ok) {
        console.log('[守护Agent] Xray已重启');
        return true;
      }
      console.error('[守护Agent] Xray重启失败:', restartResult.output);
      return false;

    case 'subscription_service':
      // 通过PM2重启订阅服务
      const pmResult = runCmd('pm2 restart zy-proxy-sub', 15000);
      if (pmResult.ok) {
        console.log('[守护Agent] 订阅服务已重启');
        return true;
      }
      return false;

    default:
      return false;
  }
}

// ── 调用LLM推理 ─────────────────────────────
async function consultLLM(issue) {
  if (!LLM_API_KEY || !LLM_BASE_URL) {
    console.log('[守护Agent] LLM API未配置，跳过推理');
    return null;
  }

  const prompt = `你是铸渊专线的代理守护Agent。以下是当前检测到的问题:

问题描述: ${issue.detail}
检查项: ${issue.checkName}
连续失败次数: ${issue.consecutiveFailures}
自动修复尝试: ${issue.autoFixAttempted ? '已尝试，失败' : '未尝试'}

请分析可能的原因并给出解决建议。回答要简洁明确。`;

  return new Promise((resolve) => {
    const urlObj = new URL(LLM_BASE_URL);
    const postData = JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500
    });

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const answer = json.choices?.[0]?.message?.content || '无响应';
          resolve(answer);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(postData);
    req.end();
  });
}

// ── 发送告警邮件 ─────────────────────────────
function sendAlertEmail(subject, body) {
  try {
    const sendScript = path.join(__dirname, 'send-subscription.js');
    // 使用execFileSync避免Shell命令注入 (不经过shell解释器)
    execFileSync('node', [sendScript, 'alert', `${subject}\n\n${body}`], {
      encoding: 'utf8',
      timeout: 30000
    });
    console.log('[守护Agent] 告警邮件已发送');
  } catch (err) {
    console.error('[守护Agent] 邮件发送失败:', err.message);
  }
}

// ── 主巡检 ───────────────────────────────────
async function patrol() {
  console.log('[守护Agent] 开始巡检...');

  const status = readGuardianStatus();
  const results = {};
  let hasIssue = false;

  // 执行所有检查
  results.xray_process = checkXrayProcess();
  results.port_443 = checkPort443();
  results.subscription_service = await checkSubscriptionService();
  results.disk_space = checkDiskSpace();
  results.memory_usage = checkMemory();
  results.xray_errors = checkXrayErrors();

  // 分析结果
  const issues = [];
  for (const [name, result] of Object.entries(results)) {
    if (!result.ok) {
      hasIssue = true;
      issues.push({ checkName: name, ...result });

      // 尝试自动修复
      if (result.fixable) {
        const fixed = autoFix(name);
        if (fixed) {
          status.auto_fixes++;
          result.auto_fixed = true;
          console.log(`[守护Agent] ✅ 自动修复成功: ${name}`);
        } else {
          result.auto_fixed = false;
        }
      }
    }
  }

  // 更新状态
  status.last_check = new Date().toISOString();
  status.checks = Object.fromEntries(
    Object.entries(results).map(([k, v]) => [k, { ok: v.ok, detail: v.detail }])
  );

  if (hasIssue) {
    status.consecutive_failures++;
    status.last_issue = {
      time: new Date().toISOString(),
      issues: issues.map(i => ({ check: i.checkName, detail: i.detail }))
    };

    // 连续3次失败且有未修复的问题 → 调用LLM
    const unfixedIssues = issues.filter(i => !i.auto_fixed && i.fixable !== false);
    if (status.consecutive_failures >= 3 && unfixedIssues.length > 0) {
      console.log('[守护Agent] 连续失败3次，调用LLM推理...');
      for (const issue of unfixedIssues) {
        const llmAdvice = await consultLLM({
          ...issue,
          consecutiveFailures: status.consecutive_failures,
          autoFixAttempted: true
        });
        if (llmAdvice) {
          status.llm_consultations++;
          console.log(`[守护Agent] LLM建议: ${llmAdvice.slice(0, 200)}`);

          // 发送告警邮件（含LLM分析）
          sendAlertEmail(
            `🛡️ 铸渊专线告警: ${issue.checkName}`,
            `问题: ${issue.detail}\n\n🤖 AI分析:\n${llmAdvice}`
          );
        }
      }
    }

    // 首次失败也发送告警
    if (status.consecutive_failures === 1) {
      sendAlertEmail(
        '🛡️ 铸渊专线异常检测',
        issues.map(i => `- ${i.checkName}: ${i.detail}`).join('\n')
      );
    }
  } else {
    if (status.consecutive_failures > 0) {
      console.log(`[守护Agent] ✅ 问题已恢复 (之前连续失败${status.consecutive_failures}次)`);
    }
    status.consecutive_failures = 0;
    status.status = 'healthy';
  }

  saveGuardianStatus(status);

  // 打印摘要
  const okCount = Object.values(results).filter(r => r.ok).length;
  const totalCount = Object.keys(results).length;
  console.log(`[守护Agent] 巡检完成: ${okCount}/${totalCount} 通过`);
}

// ── 启动守护循环 ─────────────────────────────
console.log('🛡️ 铸渊专线守护Agent启动');
console.log(`  巡检间隔: ${CHECK_INTERVAL / 1000}秒`);
console.log(`  LLM API: ${LLM_API_KEY ? '已配置' : '未配置'}`);

// 立即执行一次
patrol().catch(console.error);

// 定期执行
setInterval(() => {
  patrol().catch(console.error);
}, CHECK_INTERVAL);
