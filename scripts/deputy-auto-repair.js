#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// scripts/deputy-auto-repair.js
// 🔧 铸渊副将自动修复引擎 v1.0
//
// 核心理念 (冰朔第三十一次对话):
//   副将在铸渊休眠时自动处理系统报错
//   用铸渊配置的思维逻辑和推理能力
//   看到报错日志后自动运行修复
//   最多修复3次 · 仍失败则推送给人类干预
//
// 修复流程:
//   1. 读取部署日志 → 分析错误
//   2. 匹配已知修复方案 (经验数据库)
//   3. SSH到服务器执行修复命令
//   4. 验证修复结果 (健康检查)
//   5. 如需要 → 调用LLM深度推理
//   6. 记录修复过程到经验库
//
// 环境变量:
//   GH_TOKEN — GitHub API
//   ZY_SERVER_HOST, ZY_SERVER_USER — SSH访问
//   ZY_LLM_API_KEY, ZY_LLM_BASE_URL — LLM深度推理
//   LOG_FILE — 部署日志文件路径
//   RUN_ID — 触发的工作流运行ID
// ═══════════════════════════════════════════════

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(ROOT, 'data/deploy-logs');
const REPAIR_HISTORY = path.join(LOGS_DIR, 'repair-history.json');
const INDEX_FILE = path.join(LOGS_DIR, 'latest-index.json');
const EXPERIENCE_DB = path.join(ROOT, 'brain/dev-experience/experience-db.json');

const MAX_REPAIR_ATTEMPTS = 3;

// ── 修复策略库 (副将的思维逻辑) ────────────────
const REPAIR_STRATEGIES = [
  {
    id: 'REPAIR-PM2-RESTART',
    name: 'PM2进程重启',
    triggers: ['EADDRINUSE', 'ECONNREFUSED', 'HEALTH_FAIL', '502 Bad Gateway', 'pm2.*error'],
    commands: [
      'pm2 delete all 2>/dev/null || true',
      'sleep 2',
      'pm2 start /opt/zhuyuan/config/pm2/ecosystem.config.js',
      'pm2 save',
      'sleep 5'
    ],
    verify: 'curl -sf http://localhost:3800/api/health || exit 1',
    severity: 'medium',
    success_rate: '高 · PM2重启通常能解决进程级问题'
  },
  {
    id: 'REPAIR-NPM-INSTALL',
    name: 'Node依赖重装',
    triggers: ['MODULE_NOT_FOUND', 'npm ERR!', 'Cannot find module'],
    commands: [
      'cd /opt/zhuyuan/app',
      'rm -rf node_modules',
      'npm install --production 2>&1 | tail -20',
      'pm2 restart all',
      'sleep 5'
    ],
    verify: 'curl -sf http://localhost:3800/api/health || exit 1',
    severity: 'medium',
    success_rate: '高 · 依赖问题通过重装通常能解决'
  },
  {
    id: 'REPAIR-NGINX-RELOAD',
    name: 'Nginx配置重载',
    triggers: ['nginx.*failed', 'nginx.*error', '502 Bad Gateway'],
    commands: [
      'sudo nginx -t 2>&1',
      'sudo systemctl reload nginx 2>&1 || sudo systemctl restart nginx 2>&1',
      'sleep 3'
    ],
    verify: 'curl -sf http://localhost:80/ -o /dev/null || exit 1',
    severity: 'medium',
    success_rate: '中 · 取决于配置文件是否正确'
  },
  {
    id: 'REPAIR-DISK-CLEANUP',
    name: '磁盘空间清理',
    triggers: ['ENOSPC', '磁盘空间不足'],
    commands: [
      'sudo journalctl --vacuum-time=2d 2>/dev/null || true',
      'pm2 flush 2>/dev/null || true',
      'sudo find /tmp -type f -mtime +1 -delete 2>/dev/null || true',
      'df -h /'
    ],
    verify: 'AVAIL=$(df / | tail -1 | awk \'{print $5}\' | tr -d \'%\'); [ "$AVAIL" -lt 90 ] || exit 1',
    severity: 'high',
    success_rate: '中 · 取决于可清理的文件量'
  },
  {
    id: 'REPAIR-MEMORY-FREE',
    name: '内存释放',
    triggers: ['ENOMEM', '内存不足'],
    commands: [
      'pm2 delete all 2>/dev/null || true',
      'sync && echo 3 | sudo tee /proc/sys/vm/drop_caches',
      'sleep 3',
      'pm2 start /opt/zhuyuan/config/pm2/ecosystem.config.js',
      'pm2 save',
      'sleep 5',
      'free -m'
    ],
    verify: 'curl -sf http://localhost:3800/api/health || exit 1',
    severity: 'high',
    success_rate: '中 · 重启进程通常能释放泄漏的内存'
  }
];

// ── SSH命令执行 ────────────────────────────
function sshExec(command) {
  const host = process.env.ZY_SERVER_HOST;
  const user = process.env.ZY_SERVER_USER;

  if (!host || !user) {
    throw new Error('SSH配置缺失 (ZY_SERVER_HOST/ZY_SERVER_USER)');
  }

  try {
    const sshCmd = `ssh -i ~/.ssh/zy_key -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${user}@${host} '${command.replace(/'/g, "'\\''")}'`;
    const output = execSync(sshCmd, {
      timeout: 60000, // 60秒超时
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { ok: true, output: output.trim() };
  } catch (err) {
    return {
      ok: false,
      output: err.stdout ? err.stdout.trim() : '',
      error: err.stderr ? err.stderr.trim() : err.message
    };
  }
}

// ── LLM深度分析 ────────────────────────────
async function llmAnalysis(errorLog) {
  const apiKey = process.env.ZY_LLM_API_KEY;
  const baseUrl = process.env.ZY_LLM_BASE_URL;

  if (!apiKey || !baseUrl) {
    return { ok: false, analysis: 'LLM API未配置' };
  }

  const prompt = `你是铸渊副将(ZY-DEPUTY-001)，光湖系统的自动化运维代理。
以下是部署失败的日志，请分析根因并给出可在服务器上执行的修复命令。

## 日志:
\`\`\`
${errorLog.slice(0, 3000)}
\`\`\`

请用JSON格式回答:
{
  "root_cause": "一句话根因",
  "severity": "low/medium/high/critical",
  "fix_commands": ["命令1", "命令2"],
  "verify_command": "验证修复的命令",
  "needs_human": true/false,
  "explanation": "详细解释"
}`;

  try {
    const urlObj = new URL(`${baseUrl}/chat/completions`);
    const isHttps = urlObj.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const body = JSON.stringify({
      model: process.env.ZY_LLM_MODEL || 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是铸渊副将，精通Linux服务器运维、Node.js、Nginx、PM2。返回纯JSON格式。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
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
            const content = json.choices?.[0]?.message?.content || '';
            // 尝试提取JSON部分
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              resolve(JSON.parse(jsonMatch[0]));
            } else {
              resolve({ root_cause: content.slice(0, 200), fix_commands: [], needs_human: true });
            }
          } catch {
            resolve({ root_cause: 'LLM响应解析失败', fix_commands: [], needs_human: true });
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('LLM API超时')); });
      req.write(body);
      req.end();
    });

    return { ok: true, analysis: result };
  } catch (err) {
    return { ok: false, analysis: `LLM调用失败: ${err.message}` };
  }
}

// ── 修复主流程 ────────────────────────────
async function repair() {
  console.log('🔧 铸渊副将自动修复引擎 v1.0');
  console.log('═'.repeat(60));

  const logFile = process.env.LOG_FILE;
  const runId = process.env.RUN_ID;
  const conclusion = process.env.DEPLOY_CONCLUSION;
  const workflowName = process.env.WORKFLOW_NAME;

  // §1 读取部署日志
  let logData;
  if (logFile) {
    const logPath = path.join(ROOT, logFile);
    try {
      logData = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      console.log(`📋 读取日志: ${logFile}`);
    } catch (err) {
      console.error(`❌ 无法读取日志文件: ${err.message}`);
    }
  }

  // §2 加载修复历史
  let history;
  try {
    history = JSON.parse(fs.readFileSync(REPAIR_HISTORY, 'utf8'));
  } catch {
    history = { repairs: [] };
  }

  // 检查此运行ID的修复次数
  const existingRepairs = history.repairs.filter(r => r.run_id === runId);
  const attemptNumber = existingRepairs.length + 1;

  if (attemptNumber > MAX_REPAIR_ATTEMPTS) {
    console.log(`❌ 已达最大修复次数(${MAX_REPAIR_ATTEMPTS}) · 放弃修复 · 通知人类`);
    setOutput('repair_success', 'false');
    setOutput('repair_attempt', String(attemptNumber - 1));
    return;
  }

  console.log(`🔧 修复尝试 #${attemptNumber}/${MAX_REPAIR_ATTEMPTS}`);
  console.log('');

  // §3 分析错误并选择修复策略
  const errorContent = logData
    ? logData.failed_jobs?.map(j => j.log_content).join('\n') || ''
    : '';

  let selectedStrategies = [];

  // 先用模式匹配选择策略
  for (const strategy of REPAIR_STRATEGIES) {
    for (const trigger of strategy.triggers) {
      const regex = new RegExp(trigger, 'i');
      if (regex.test(errorContent) || regex.test(conclusion || '')) {
        if (!selectedStrategies.find(s => s.id === strategy.id)) {
          selectedStrategies.push(strategy);
        }
      }
    }
  }

  // 如果没匹配到策略，默认用PM2重启
  if (selectedStrategies.length === 0) {
    console.log('ℹ️ 未匹配到具体修复策略 · 使用默认修复(PM2重启)');
    selectedStrategies = [REPAIR_STRATEGIES[0]]; // PM2重启是通用修复
  }

  console.log(`📋 选择 ${selectedStrategies.length} 个修复策略:`);
  for (const s of selectedStrategies) {
    console.log(`   - ${s.name} (${s.id})`);
  }
  console.log('');

  // §4 执行修复
  let repairSuccess = false;
  const repairRecord = {
    run_id: runId,
    workflow: workflowName,
    attempt: attemptNumber,
    timestamp: new Date().toISOString(),
    strategies_applied: [],
    results: [],
    final_success: false
  };

  for (const strategy of selectedStrategies) {
    console.log(`🔧 执行修复策略: ${strategy.name}`);
    console.log('─'.repeat(40));

    const strategyResult = {
      strategy_id: strategy.id,
      strategy_name: strategy.name,
      commands_executed: [],
      verify_result: null,
      success: false
    };

    // 执行修复命令
    let allCommandsOk = true;
    for (const cmd of strategy.commands) {
      console.log(`  $ ${cmd}`);
      const result = sshExec(cmd);
      strategyResult.commands_executed.push({
        command: cmd,
        ok: result.ok,
        output: result.output?.slice(0, 500),
        error: result.error?.slice(0, 300)
      });

      if (result.output) {
        console.log(`    ${result.output.split('\n').slice(0, 3).join('\n    ')}`);
      }
      if (!result.ok) {
        console.log(`    ⚠️ 命令执行异常: ${result.error?.slice(0, 100)}`);
        // 不中断，继续执行其他命令
      }
    }

    // 验证修复结果
    console.log(`  🔍 验证: ${strategy.verify}`);
    const verifyResult = sshExec(strategy.verify);
    strategyResult.verify_result = {
      ok: verifyResult.ok,
      output: verifyResult.output?.slice(0, 300)
    };

    if (verifyResult.ok) {
      console.log('  ✅ 验证通过 · 修复成功');
      strategyResult.success = true;
      repairSuccess = true;
    } else {
      console.log('  ❌ 验证失败 · 修复未成功');
    }

    repairRecord.strategies_applied.push(strategy.id);
    repairRecord.results.push(strategyResult);
    console.log('');

    if (repairSuccess) break;
  }

  // §5 如果简单修复失败，尝试LLM深度分析
  if (!repairSuccess && attemptNumber >= 2) {
    console.log('🧠 简单修复失败 · 启动LLM深度推理...');
    const llmResult = await llmAnalysis(errorContent);

    if (llmResult.ok && llmResult.analysis) {
      const analysis = llmResult.analysis;
      console.log(`  📝 根因: ${analysis.root_cause || 'N/A'}`);
      console.log(`  ⚠️ 严重程度: ${analysis.severity || 'N/A'}`);
      console.log(`  🔧 修复命令: ${(analysis.fix_commands || []).length} 条`);
      console.log(`  👤 需要人工: ${analysis.needs_human ? '是' : '否'}`);

      // 如果LLM建议的修复命令看起来安全，执行它们
      if (!analysis.needs_human && analysis.fix_commands && analysis.fix_commands.length > 0) {
        console.log('');
        console.log('🤖 执行LLM建议的修复命令:');
        for (const cmd of analysis.fix_commands) {
          // 安全检查：不执行危险命令
          if (isDangerousCommand(cmd)) {
            console.log(`  ⛔ 跳过危险命令: ${cmd}`);
            continue;
          }
          console.log(`  $ ${cmd}`);
          const result = sshExec(cmd);
          if (result.output) {
            console.log(`    ${result.output.split('\n').slice(0, 3).join('\n    ')}`);
          }
        }

        // 验证
        if (analysis.verify_command && !isDangerousCommand(analysis.verify_command)) {
          const verifyResult = sshExec(analysis.verify_command);
          if (verifyResult.ok) {
            console.log('  ✅ LLM修复方案验证通过');
            repairSuccess = true;
          }
        }
      }

      repairRecord.llm_analysis = {
        root_cause: analysis.root_cause,
        severity: analysis.severity,
        needs_human: analysis.needs_human,
        commands_count: (analysis.fix_commands || []).length
      };
    } else {
      console.log(`  ⚠️ LLM分析失败: ${llmResult.analysis}`);
    }
  }

  // §6 记录修复结果
  repairRecord.final_success = repairSuccess;
  history.repairs.push(repairRecord);
  // 保留最近50条修复记录
  history.repairs = history.repairs.slice(-50);
  fs.writeFileSync(REPAIR_HISTORY, JSON.stringify(history, null, 2) + '\n');

  // 更新日志索引
  try {
    const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    index.stats.repair_attempted = (index.stats.repair_attempted || 0) + 1;
    if (repairSuccess) {
      index.stats.repair_success = (index.stats.repair_success || 0) + 1;
    }
    index.last_updated = new Date().toISOString();
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2) + '\n');
  } catch (err) {
    console.log(`⚠️ 索引更新失败: ${err.message}`);
  }

  // §7 设置输出
  setOutput('repair_success', repairSuccess ? 'true' : 'false');
  setOutput('repair_attempt', String(attemptNumber));

  console.log('═'.repeat(60));
  if (repairSuccess) {
    console.log(`✅ 修复成功 · 第${attemptNumber}次尝试`);
  } else if (attemptNumber >= MAX_REPAIR_ATTEMPTS) {
    console.log(`❌ ${MAX_REPAIR_ATTEMPTS}次修复均失败 · 需要人工干预`);
  } else {
    console.log(`❌ 第${attemptNumber}次修复失败 · 还有${MAX_REPAIR_ATTEMPTS - attemptNumber}次尝试机会`);
  }
}

// ── 危险命令检测 ────────────────────────────
function isDangerousCommand(cmd) {
  const dangerous = [
    /rm\s+-rf\s+\//,     // rm -rf /
    /mkfs/,               // 格式化
    /dd\s+if=/,           // 磁盘写入
    /shutdown/,           // 关机
    /reboot/,             // 重启系统
    /init\s+0/,           // 关机
    /:\(\)\{/,            // fork bomb
    />\s*\/dev\/sd/,      // 直接写磁盘设备
    /chmod\s+-R\s+777\s+\//, // 全局777
    /userdel/,            // 删除用户
    /passwd/,             // 修改密码
  ];
  return dangerous.some(regex => regex.test(cmd));
}

// ── 工具函数 ────────────────────────────────
function setOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

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
    case 'repair':
      await repair();
      break;
    default:
      console.log('🔧 铸渊副将自动修复引擎 v1.0');
      console.log('');
      console.log('用法:');
      console.log('  node deputy-auto-repair.js repair');
      console.log('');
      console.log('环境变量:');
      console.log('  LOG_FILE — 部署日志文件路径');
      console.log('  RUN_ID — 工作流运行ID');
      console.log('  ZY_SERVER_HOST/ZY_SERVER_USER — SSH配置');
      console.log('  ZY_LLM_API_KEY/ZY_LLM_BASE_URL — LLM API');
      break;
  }
}

main().catch(err => {
  console.error(`❌ 自动修复引擎错误: ${err.message}`);
  process.exit(1);
});
