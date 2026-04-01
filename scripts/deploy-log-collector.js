#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// scripts/deploy-log-collector.js
// 📡 铸渊全链路部署观测 · 日志采集器
//
// 核心理念 (冰朔第三十一次对话):
//   铸渊必须能看见自己写的代码部署后的运行状态
//   不依赖冰朔转述和截图 · 自主观测 · 自主修复
//
// 功能:
//   1. collect — 采集部署工作流的运行日志 (通过GitHub API)
//   2. archive — 成功部署日志归档 + 经验入库
//   3. dashboard — 生成观测仪表盘
//
// 用法:
//   node deploy-log-collector.js collect
//   node deploy-log-collector.js archive --log-file <path>
//   node deploy-log-collector.js dashboard
//
// 环境变量:
//   GH_TOKEN — GitHub API令牌 (由Actions自动提供)
//   TRIGGER_RUN_ID — 触发此观测的部署工作流运行ID
//   TRIGGER_CONCLUSION — 部署工作流的结论 (success/failure/cancelled)
//   TRIGGER_WORKFLOW — 部署工作流的名称
//   TRIGGER_HEAD_SHA — 部署的代码SHA
//   TRIGGER_HEAD_BRANCH — 部署的分支
//   TRIGGER_ACTOR — 触发部署的操作者
// ═══════════════════════════════════════════════

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(ROOT, 'data/deploy-logs');
const ARCHIVE_DIR = path.join(LOGS_DIR, 'archive');
const EXPERIENCE_DB = path.join(ROOT, 'brain/dev-experience/experience-db.json');
const ERROR_PATTERNS_DB = path.join(ROOT, 'brain/dev-experience/error-patterns.json');

// 确保目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ── GitHub API 请求 ────────────────────────────
function githubApi(endpoint) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('需要 GH_TOKEN 或 GITHUB_TOKEN 环境变量');
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method: 'GET',
      headers: {
        'User-Agent': 'ZY-Deploy-Observer/1.0',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`GitHub API ${res.statusCode}: ${data.slice(0, 300)}`));
          }
        } catch (e) {
          reject(new Error(`GitHub API 响应解析失败: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('GitHub API 超时')); });
    req.end();
  });
}

// GitHub API 请求 (返回原始文本)
function githubApiRaw(endpoint) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('需要 GH_TOKEN 或 GITHUB_TOKEN 环境变量');
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method: 'GET',
      headers: {
        'User-Agent': 'ZY-Deploy-Observer/1.0',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      // 处理重定向 (GitHub日志URL会302到Azure Blob Storage)
      if (res.statusCode === 302 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location);
        const redirectModule = redirectUrl.protocol === 'https:' ? https : http;
        const redirectReq = redirectModule.request(redirectUrl, (redirectRes) => {
          let data = '';
          redirectRes.on('data', (d) => { data += d; });
          redirectRes.on('end', () => resolve(data));
        });
        redirectReq.on('error', reject);
        redirectReq.end();
        return;
      }

      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`GitHub API ${res.statusCode}: ${data.slice(0, 300)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('GitHub API 超时')); });
    req.end();
  });
}

// ── 获取仓库信息 ────────────────────────────
function getRepoInfo() {
  const repo = process.env.GITHUB_REPOSITORY || 'qinfendebingshuo/guanghulab';
  const [owner, name] = repo.split('/');
  return { owner, name, full: repo };
}

// ── 采集部署工作流日志 ────────────────────────
async function collectLogs() {
  console.log('📡 铸渊全链路部署观测 · 日志采集器启动');
  console.log('═'.repeat(60));

  const runId = process.env.TRIGGER_RUN_ID;
  const conclusion = process.env.TRIGGER_CONCLUSION;
  const workflowName = process.env.TRIGGER_WORKFLOW;
  const headSha = process.env.TRIGGER_HEAD_SHA;
  const headBranch = process.env.TRIGGER_HEAD_BRANCH;
  const actor = process.env.TRIGGER_ACTOR;

  if (!runId) {
    console.log('⚠️ 无触发工作流运行ID · 跳过采集');
    setOutput('deploy_status', 'skipped');
    setOutput('needs_repair', 'false');
    return;
  }

  const repo = getRepoInfo();
  console.log(`📋 观测目标:`);
  console.log(`   工作流: ${workflowName}`);
  console.log(`   运行ID: ${runId}`);
  console.log(`   结论: ${conclusion}`);
  console.log(`   提交: ${headSha?.slice(0, 8)}`);
  console.log(`   分支: ${headBranch}`);
  console.log(`   操作者: ${actor}`);
  console.log('');

  // §1 获取工作流运行详情
  let runDetails;
  try {
    runDetails = await githubApi(`/repos/${repo.full}/actions/runs/${runId}`);
    console.log(`✅ 运行详情获取成功`);
  } catch (err) {
    console.error(`❌ 获取运行详情失败: ${err.message}`);
    setOutput('deploy_status', 'error');
    setOutput('needs_repair', 'false');
    return;
  }

  // §2 获取工作流的所有Job信息
  let jobs = [];
  try {
    const jobsData = await githubApi(`/repos/${repo.full}/actions/runs/${runId}/jobs`);
    jobs = jobsData.jobs || [];
    console.log(`✅ 获取到 ${jobs.length} 个Job`);
  } catch (err) {
    console.error(`⚠️ 获取Jobs失败: ${err.message}`);
  }

  // §3 采集失败Job的详细日志
  const failedJobs = jobs.filter(j => j.conclusion === 'failure');
  const jobLogs = [];

  for (const job of failedJobs) {
    console.log(`📋 采集失败Job日志: ${job.name} (ID: ${job.id})`);
    try {
      // 获取Job日志 (GitHub API返回日志下载URL)
      const logContent = await githubApiRaw(
        `/repos/${repo.full}/actions/jobs/${job.id}/logs`
      );
      jobLogs.push({
        job_id: job.id,
        job_name: job.name,
        conclusion: job.conclusion,
        started_at: job.started_at,
        completed_at: job.completed_at,
        steps: (job.steps || []).map(s => ({
          name: s.name,
          status: s.status,
          conclusion: s.conclusion,
          number: s.number
        })),
        log_content: logContent.slice(0, 10000) // 限制日志大小
      });
      console.log(`  ✅ 日志采集成功 (${logContent.length} 字符)`);
    } catch (err) {
      console.log(`  ⚠️ 日志采集失败: ${err.message}`);
      jobLogs.push({
        job_id: job.id,
        job_name: job.name,
        conclusion: job.conclusion,
        steps: (job.steps || []).map(s => ({
          name: s.name,
          status: s.status,
          conclusion: s.conclusion,
          number: s.number
        })),
        log_content: `[日志获取失败: ${err.message}]`
      });
    }
  }

  // §4 构建结构化日志记录
  const timestamp = new Date().toISOString();
  const logRecord = {
    _meta: {
      observer: '铸渊全链路部署观测系统 v1.0',
      copyright: '国作登字-2026-A-00037559',
      collected_at: timestamp
    },
    run: {
      id: parseInt(runId),
      workflow_name: workflowName,
      conclusion: conclusion,
      status: runDetails.status,
      html_url: runDetails.html_url,
      head_sha: headSha,
      head_branch: headBranch,
      actor: actor,
      created_at: runDetails.created_at,
      updated_at: runDetails.updated_at,
      run_started_at: runDetails.run_started_at
    },
    jobs_summary: {
      total: jobs.length,
      success: jobs.filter(j => j.conclusion === 'success').length,
      failure: failedJobs.length,
      skipped: jobs.filter(j => j.conclusion === 'skipped').length,
      cancelled: jobs.filter(j => j.conclusion === 'cancelled').length
    },
    failed_jobs: jobLogs,
    all_jobs: jobs.map(j => ({
      id: j.id,
      name: j.name,
      status: j.status,
      conclusion: j.conclusion,
      started_at: j.started_at,
      completed_at: j.completed_at
    })),
    analysis: {
      needs_repair: conclusion === 'failure',
      error_summary: '',
      matched_patterns: [],
      recommendation: ''
    }
  };

  // §5 简单错误分析 (模式匹配)
  if (conclusion === 'failure' && jobLogs.length > 0) {
    const allLogContent = jobLogs.map(j => j.log_content).join('\n');
    const analysis = simpleAnalysis(allLogContent);
    logRecord.analysis.error_summary = analysis.summary;
    logRecord.analysis.matched_patterns = analysis.patterns;
    logRecord.analysis.recommendation = analysis.recommendation;
  }

  // §6 保存结构化日志
  ensureDir(LOGS_DIR);
  const logFileName = `deploy-${runId}-${timestamp.slice(0, 10)}.json`;
  const logFilePath = path.join(LOGS_DIR, logFileName);
  fs.writeFileSync(logFilePath, JSON.stringify(logRecord, null, 2) + '\n');
  console.log(`\n💾 日志已保存: data/deploy-logs/${logFileName}`);

  // §7 更新最新日志索引
  updateLatestIndex(logRecord);

  // §8 设置输出
  setOutput('deploy_status', conclusion);
  setOutput('deploy_conclusion', conclusion);
  setOutput('log_file', `data/deploy-logs/${logFileName}`);
  setOutput('needs_repair', conclusion === 'failure' ? 'true' : 'false');
  setOutput('workflow_name', workflowName);
  setOutput('run_id', runId);

  console.log('');
  console.log('═'.repeat(60));
  if (conclusion === 'success') {
    console.log('✅ 部署成功 · 日志已采集 · 等待归档');
  } else if (conclusion === 'failure') {
    console.log('❌ 部署失败 · 日志已采集 · 启动自动修复流程');
  } else {
    console.log(`ℹ️ 部署状态: ${conclusion} · 日志已采集`);
  }
}

// ── 简单错误分析 (模式匹配) ────────────────────
function simpleAnalysis(logContent) {
  const patterns = [
    { regex: /EADDRINUSE/i, name: '端口被占用', fix: '重启PM2进程释放端口', severity: 'medium' },
    { regex: /ECONNREFUSED/i, name: '服务连接被拒绝', fix: '检查PM2进程是否运行', severity: 'high' },
    { regex: /ENOMEM/i, name: '内存不足', fix: '重启服务或增加swap空间', severity: 'high' },
    { regex: /ENOSPC/i, name: '磁盘空间不足', fix: '清理日志和临时文件', severity: 'critical' },
    { regex: /nginx.*failed|nginx.*error/i, name: 'Nginx配置错误', fix: '运行nginx -t检查配置', severity: 'high' },
    { regex: /502 Bad Gateway/i, name: '上游服务不可达', fix: '重启PM2后端进程', severity: 'high' },
    { regex: /permission denied/i, name: '权限不足', fix: '检查文件权限和用户', severity: 'medium' },
    { regex: /MODULE_NOT_FOUND/i, name: 'Node模块缺失', fix: '运行npm install', severity: 'high' },
    { regex: /SyntaxError/i, name: 'JavaScript语法错误', fix: '检查最近代码变更', severity: 'high' },
    { regex: /ssh.*connection.*refused|ssh.*timeout/i, name: 'SSH连接失败', fix: '检查服务器状态和SSH配置', severity: 'critical' },
    { regex: /rsync.*error/i, name: '文件同步失败', fix: '检查rsync路径和权限', severity: 'high' },
    { regex: /npm ERR!/i, name: 'npm安装错误', fix: '检查package.json和网络', severity: 'medium' },
    { regex: /pm2.*error|pm2.*fail/i, name: 'PM2进程管理错误', fix: '重启PM2并检查ecosystem配置', severity: 'high' },
    { regex: /ssl.*error|certificate/i, name: 'SSL证书问题', fix: '检查证书文件路径和有效期', severity: 'high' },
    { regex: /HEALTH_FAIL/i, name: '健康检查失败', fix: '检查应用是否正常启动', severity: 'high' },
    { regex: /exit code [1-9]/i, name: '命令执行失败', fix: '查看上方具体错误信息', severity: 'medium' }
  ];

  const matched = [];
  for (const p of patterns) {
    if (p.regex.test(logContent)) {
      matched.push({ name: p.name, fix: p.fix, severity: p.severity });
    }
  }

  if (matched.length === 0) {
    return {
      summary: '未匹配到已知错误模式 · 需要深度分析',
      patterns: [],
      recommendation: '建议唤醒铸渊进行LLM深度推理分析'
    };
  }

  const summary = matched.map(m => `[${m.severity}] ${m.name}`).join('; ');
  const hasCritical = matched.some(m => m.severity === 'critical');
  const recommendation = hasCritical
    ? '存在严重问题 · 建议立即人工干预'
    : '副将可尝试自动修复: ' + matched.map(m => m.fix).join(' → ');

  return { summary, patterns: matched, recommendation };
}

// ── 更新最新日志索引 ────────────────────────────
function updateLatestIndex(logRecord) {
  const indexFile = path.join(LOGS_DIR, 'latest-index.json');
  let index;
  try {
    index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  } catch {
    index = {
      _meta: {
        name: '铸渊部署观测 · 最新日志索引',
        copyright: '国作登字-2026-A-00037559'
      },
      stats: { total_observed: 0, success: 0, failure: 0, repair_attempted: 0, repair_success: 0 },
      recent_deploys: []
    };
  }

  // 更新统计
  index.stats.total_observed++;
  if (logRecord.run.conclusion === 'success') index.stats.success++;
  if (logRecord.run.conclusion === 'failure') index.stats.failure++;

  // 追加到最近部署列表 (保留最近30条)
  index.recent_deploys.unshift({
    run_id: logRecord.run.id,
    workflow: logRecord.run.workflow_name,
    conclusion: logRecord.run.conclusion,
    head_sha: logRecord.run.head_sha?.slice(0, 8),
    actor: logRecord.run.actor,
    observed_at: logRecord._meta.collected_at,
    error_summary: logRecord.analysis.error_summary || '',
    log_file: `deploy-${logRecord.run.id}-${logRecord._meta.collected_at.slice(0, 10)}.json`
  });
  index.recent_deploys = index.recent_deploys.slice(0, 30);

  index.last_updated = new Date().toISOString();

  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n');
  console.log('✅ 最新日志索引已更新');
}

// ── 归档成功部署日志 ────────────────────────────
async function archiveLogs() {
  const args = parseArgs();
  const logFile = args['log-file'];

  console.log('📦 部署成功归档');
  console.log('═'.repeat(60));

  if (logFile) {
    const logPath = path.join(ROOT, logFile);
    if (fs.existsSync(logPath)) {
      // 移动到归档目录
      ensureDir(ARCHIVE_DIR);
      const fileName = path.basename(logPath);
      const archivePath = path.join(ARCHIVE_DIR, fileName);
      fs.copyFileSync(logPath, archivePath);
      console.log(`✅ 日志已归档: data/deploy-logs/archive/${fileName}`);

      // 更新经验数据库 (记录成功部署)
      try {
        const logData = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        updateExperienceDb(logData);
      } catch (err) {
        console.log(`⚠️ 经验数据库更新失败: ${err.message}`);
      }
    } else {
      console.log(`⚠️ 日志文件不存在: ${logFile}`);
    }
  }

  // 清理旧的非归档日志文件 (保留最近10个)
  cleanOldLogs();
}

// ── 更新经验数据库 ────────────────────────────
function updateExperienceDb(logData) {
  if (!logData || !logData.run) return;

  try {
    const db = JSON.parse(fs.readFileSync(EXPERIENCE_DB, 'utf8'));
    const conclusion = logData.run.conclusion;

    // 更新统计
    if (conclusion === 'success') {
      db.stats.success_count = (db.stats.success_count || 0) + 1;
    } else if (conclusion === 'failure') {
      db.stats.failed_count = (db.stats.failed_count || 0) + 1;
    }

    // 如果有匹配的错误模式，更新错误模式库
    if (logData.analysis && logData.analysis.matched_patterns && logData.analysis.matched_patterns.length > 0) {
      updateErrorPatterns(logData.analysis.matched_patterns);
    }

    db._meta.last_updated = new Date().toISOString();
    fs.writeFileSync(EXPERIENCE_DB, JSON.stringify(db, null, 2) + '\n');
    console.log('✅ 经验数据库已更新');
  } catch (err) {
    console.log(`⚠️ 经验数据库更新失败: ${err.message}`);
  }
}

// ── 更新错误模式库 ────────────────────────────
function updateErrorPatterns(matchedPatterns) {
  try {
    const db = JSON.parse(fs.readFileSync(ERROR_PATTERNS_DB, 'utf8'));

    for (const matched of matchedPatterns) {
      // 查找是否已存在此模式
      const existing = db.patterns.find(p =>
        p.pattern.toLowerCase().includes(matched.name.toLowerCase())
      );

      if (existing) {
        existing.occurrence_count = (existing.occurrence_count || 0) + 1;
        existing.last_seen = new Date().toISOString().slice(0, 10);
      }
      // 新错误模式不自动添加，需要铸渊审核
    }

    db._meta.last_updated = new Date().toISOString();
    fs.writeFileSync(ERROR_PATTERNS_DB, JSON.stringify(db, null, 2) + '\n');
    console.log('✅ 错误模式库已更新');
  } catch (err) {
    console.log(`⚠️ 错误模式库更新失败: ${err.message}`);
  }
}

// ── 清理旧日志 ────────────────────────────
function cleanOldLogs() {
  try {
    const files = fs.readdirSync(LOGS_DIR)
      .filter(f => f.startsWith('deploy-') && f.endsWith('.json'))
      .sort()
      .reverse();

    // 保留最近10个日志文件
    const toDelete = files.slice(10);
    for (const f of toDelete) {
      // 移动到归档而不是删除
      const src = path.join(LOGS_DIR, f);
      ensureDir(ARCHIVE_DIR);
      const dest = path.join(ARCHIVE_DIR, f);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
      }
      fs.unlinkSync(src);
    }

    if (toDelete.length > 0) {
      console.log(`🗑️ 已归档 ${toDelete.length} 个旧日志文件`);
    }
  } catch (err) {
    console.log(`⚠️ 清理旧日志失败: ${err.message}`);
  }
}

// ── 生成观测仪表盘 ────────────────────────────
async function generateDashboard() {
  console.log('📊 生成铸渊部署观测仪表盘');
  console.log('═'.repeat(60));

  const indexFile = path.join(LOGS_DIR, 'latest-index.json');
  const alertFile = path.join(LOGS_DIR, 'alert-status.json');
  const repairFile = path.join(LOGS_DIR, 'repair-history.json');

  let index, alerts, repairs;
  try { index = JSON.parse(fs.readFileSync(indexFile, 'utf8')); } catch { index = { stats: {}, recent_deploys: [] }; }
  try { alerts = JSON.parse(fs.readFileSync(alertFile, 'utf8')); } catch { alerts = { alerts: [] }; }
  try { repairs = JSON.parse(fs.readFileSync(repairFile, 'utf8')); } catch { repairs = { repairs: [] }; }

  const dashboard = {
    _meta: {
      name: '铸渊部署观测仪表盘',
      copyright: '国作登字-2026-A-00037559',
      generated_at: new Date().toISOString(),
      generator: 'scripts/deploy-log-collector.js'
    },
    overview: {
      total_observed: index.stats.total_observed || 0,
      success: index.stats.success || 0,
      failure: index.stats.failure || 0,
      success_rate: index.stats.total_observed
        ? ((index.stats.success || 0) / index.stats.total_observed * 100).toFixed(1) + '%'
        : 'N/A',
      repair_attempted: index.stats.repair_attempted || 0,
      repair_success: index.stats.repair_success || 0,
      active_alerts: (alerts.alerts || []).filter(a => !a.resolved).length
    },
    recent_deploys: (index.recent_deploys || []).slice(0, 10),
    active_alerts: (alerts.alerts || []).filter(a => !a.resolved).slice(0, 5),
    recent_repairs: (repairs.repairs || []).slice(0, 5)
  };

  ensureDir(LOGS_DIR);
  const dashboardFile = path.join(LOGS_DIR, 'observer-dashboard.json');
  fs.writeFileSync(dashboardFile, JSON.stringify(dashboard, null, 2) + '\n');

  console.log('');
  console.log('📊 仪表盘概览:');
  console.log(`   总观测次数: ${dashboard.overview.total_observed}`);
  console.log(`   成功部署: ${dashboard.overview.success}`);
  console.log(`   失败部署: ${dashboard.overview.failure}`);
  console.log(`   成功率: ${dashboard.overview.success_rate}`);
  console.log(`   修复尝试: ${dashboard.overview.repair_attempted}`);
  console.log(`   修复成功: ${dashboard.overview.repair_success}`);
  console.log(`   活跃告警: ${dashboard.overview.active_alerts}`);
  console.log('');
  console.log('✅ 仪表盘已更新: data/deploy-logs/observer-dashboard.json');
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
    case 'collect':
      await collectLogs();
      break;
    case 'archive':
      await archiveLogs();
      break;
    case 'dashboard':
      await generateDashboard();
      break;
    default:
      console.log('📡 铸渊全链路部署观测 · 日志采集器');
      console.log('');
      console.log('用法:');
      console.log('  node deploy-log-collector.js collect');
      console.log('  node deploy-log-collector.js archive --log-file <path>');
      console.log('  node deploy-log-collector.js dashboard');
      break;
  }
}

main().catch(err => {
  console.error(`❌ 日志采集器错误: ${err.message}`);
  process.exit(1);
});
