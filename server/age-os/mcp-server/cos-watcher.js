/**
 * ═══════════════════════════════════════════════════════════
 * 🔭 COS桶轮询守护进程 · SCF事件替代方案
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 背景:
 *   腾讯云轻量云COS不支持SCF事件触发。
 *   此模块作为替代方案，在MCP Server进程内运行定时轮询，
 *   检测COS桶中的新文件并触发相应处理逻辑。
 *
 * 架构:
 *   [原设计]  COS事件 → SCF → GitHub repository_dispatch → 处理
 *   [替代]    MCP Server定时 → COS.list() → 对比索引 → 发现新文件 → 处理/通知
 *
 * 监控路径:
 *   1. team桶 /{persona_id}/reports/   — 新汇报 → 铸渊审核 → 写回执
 *   2. cold桶  新语料文件              — 新语料 → 训练管线
 *   3. team桶 /{persona_id}/receipts/  — 新回执 → 通知成员仓库
 *
 * 未来升级:
 *   如果升级到标准COS（支持SCF），此模块保留为兜底补扫层，
 *   形成 SCF事件驱动（主）+ 轮询补扫（辅）双保险架构。
 */

'use strict';

const cron = require('node-cron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cos = require('./cos');

// ─── 配置 ───
const DEFAULT_INTERVAL = process.env.COS_WATCHER_INTERVAL || '*/5 * * * *'; // 每5分钟
const STATE_FILE = path.join(__dirname, 'cos-watcher-state.json');
const MAX_LOG_ENTRIES = 200;
// 启动后延迟执行首次扫描，等待MCP Server Express + DB连接完全就绪
const INITIAL_SCAN_DELAY_MS = 5000;

// 9个人格体ID
const PERSONA_IDS = [
  'qiuqiu', 'shushu', 'ounomiya', 'jiyao',
  'xiaotanheshu', 'chenxing', 'tangxingyun', 'yaochu', 'zhiqiu'
];

// ─── 状态管理 ───
let watcherState = {
  enabled: false,
  last_scan: null,
  scan_count: 0,
  errors: 0,
  last_error: null,
  started_at: null,
  // 每个桶/路径的最后已知文件列表 hash
  indexes: {
    team_reports: {},   // { persona_id: [file_keys] }
    team_receipts: {},  // { persona_id: [file_keys] }
    cold_corpus: []     // [file_keys]
  },
  // 最近事件日志
  events: []
};

// ─── 定时任务实例 ───
let cronTask = null;
let isScanning = false;

/**
 * 加载持久化状态
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const saved = JSON.parse(raw);
      // 合并已保存的索引但重置运行状态
      watcherState.indexes = saved.indexes || watcherState.indexes;
      watcherState.events = (saved.events || []).slice(-MAX_LOG_ENTRIES);
    }
  } catch (err) {
    console.warn(`[COS-Watcher] 状态文件加载失败: ${err.message}`);
  }
}

/**
 * 持久化状态到本地文件
 */
function saveState() {
  try {
    const toSave = {
      indexes: watcherState.indexes,
      events: watcherState.events.slice(-MAX_LOG_ENTRIES),
      last_save: new Date().toISOString()
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(toSave, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[COS-Watcher] 状态文件保存失败: ${err.message}`);
  }
}

/**
 * 记录事件
 */
function logEvent(type, detail) {
  const entry = {
    type,
    detail,
    timestamp: new Date().toISOString()
  };
  watcherState.events.push(entry);
  if (watcherState.events.length > MAX_LOG_ENTRIES) {
    watcherState.events = watcherState.events.slice(-MAX_LOG_ENTRIES);
  }
  console.log(`[COS-Watcher] ${type}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

// ═══════════════════════════════════════════
// 扫描逻辑
// ═══════════════════════════════════════════

/**
 * 扫描team桶中的新报告 (reports)
 * 检测 /{persona_id}/reports/ 下的新JSON文件
 */
async function scanTeamReports() {
  const newReports = [];

  for (const personaId of PERSONA_IDS) {
    try {
      const prefix = `${personaId}/reports/`;
      const result = await cos.list('team', prefix, 100);
      const currentKeys = result.files
        .filter(f => f.key.endsWith('.json') && f.size_bytes > 0)
        .map(f => f.key);

      const previousKeys = watcherState.indexes.team_reports[personaId] || [];
      const newKeys = currentKeys.filter(k => !previousKeys.includes(k));

      if (newKeys.length > 0) {
        for (const key of newKeys) {
          newReports.push({ persona_id: personaId, key, type: 'report' });
        }
      }

      // 更新索引
      watcherState.indexes.team_reports[personaId] = currentKeys;
    } catch (err) {
      // COS连接问题不中断扫描其他人格体
      if (!err.message.includes('NoSuchBucket')) {
        logEvent('scan_error', `报告扫描失败 ${personaId}: ${err.message}`);
      }
    }
  }

  return newReports;
}

/**
 * 扫描team桶中的新回执 (receipts)
 * 检测 /{persona_id}/receipts/ 下的新JSON文件
 */
async function scanTeamReceipts() {
  const newReceipts = [];

  for (const personaId of PERSONA_IDS) {
    try {
      const prefix = `${personaId}/receipts/`;
      const result = await cos.list('team', prefix, 100);
      const currentKeys = result.files
        .filter(f => f.key.endsWith('.json') && f.size_bytes > 0)
        .map(f => f.key);

      const previousKeys = watcherState.indexes.team_receipts[personaId] || [];
      const newKeys = currentKeys.filter(k => !previousKeys.includes(k));

      if (newKeys.length > 0) {
        for (const key of newKeys) {
          newReceipts.push({ persona_id: personaId, key, type: 'receipt' });
        }
      }

      // 更新索引
      watcherState.indexes.team_receipts[personaId] = currentKeys;
    } catch (err) {
      if (!err.message.includes('NoSuchBucket')) {
        logEvent('scan_error', `回执扫描失败 ${personaId}: ${err.message}`);
      }
    }
  }

  return newReceipts;
}

/**
 * 扫描cold桶中的新语料
 * 排除 tcs-structured/ training-sessions/ training-results/ training-memory/ 目录
 */
async function scanColdCorpus() {
  const EXCLUDED_PREFIXES = [
    'tcs-structured/',
    'training-sessions/',
    'training-results/',
    'training-memory/'
  ];
  const CORPUS_EXTENSIONS = [
    '.zip', '.gz', '.tar.gz', '.tgz', '.json.gz',
    '.json', '.jsonl', '.md', '.txt', '.csv'
  ];

  try {
    const result = await cos.list('cold', '', 500);
    const currentKeys = result.files
      .filter(f => {
        // 排除处理结果目录
        for (const prefix of EXCLUDED_PREFIXES) {
          if (f.key.startsWith(prefix)) return false;
        }
        // 匹配语料扩展名
        const lower = f.key.toLowerCase();
        return CORPUS_EXTENSIONS.some(ext => lower.endsWith(ext));
      })
      .map(f => f.key);

    const previousKeys = watcherState.indexes.cold_corpus || [];
    const newKeys = currentKeys.filter(k => !previousKeys.includes(k));

    // 更新索引
    watcherState.indexes.cold_corpus = currentKeys;

    return newKeys.map(key => ({ key, type: 'corpus' }));
  } catch (err) {
    if (!err.message.includes('NoSuchBucket')) {
      logEvent('scan_error', `语料扫描失败: ${err.message}`);
    }
    return [];
  }
}

// ═══════════════════════════════════════════
// 事件处理逻辑
// ═══════════════════════════════════════════

/**
 * 处理新报告: 铸渊审核 → 写回执
 * （当前记录事件，审核逻辑可在后续接入LLM）
 */
async function handleNewReport(report) {
  logEvent('new_report', `人格体 ${report.persona_id} 新汇报: ${report.key}`);

  try {
    // 读取报告内容
    const raw = await cos.read('team', report.key);
    const content = JSON.parse(raw.content);

    // 生成自动回执（基础版：确认收到）
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const receiptKey = `${report.persona_id}/receipts/${dateStr}/auto-receipt-${crypto.randomBytes(6).toString('hex')}.json`;

    const receipt = {
      receipt_id: `RCPT-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      report_key: report.key,
      persona_id: report.persona_id,
      status: 'green',
      message: '铸渊已收到汇报 · 自动确认',
      review_summary: {
        received_at: now.toISOString(),
        auto_reviewed: true,
        report_title: content.title || content.subject || '未知主题',
        note: '轮询守护进程自动审核 · 详细审核将在下次训练Agent运行时执行'
      },
      generated_by: 'cos-watcher',
      generated_at: now.toISOString()
    };

    await cos.write('team', receiptKey, JSON.stringify(receipt, null, 2), 'application/json');
    logEvent('receipt_written', `回执已写入: ${receiptKey}`);

    return { handled: true, receipt_key: receiptKey };
  } catch (err) {
    logEvent('handle_error', `处理报告失败 ${report.key}: ${err.message}`);
    return { handled: false, error: err.message };
  }
}

/**
 * 处理新回执: 通知成员仓库
 * 调用GitHub API发送 repository_dispatch 到成员仓库
 */
async function handleNewReceipt(receipt) {
  logEvent('new_receipt', `人格体 ${receipt.persona_id} 新回执: ${receipt.key}`);

  // GitHub dispatch需要PAT token
  const githubToken = process.env.ZY_GITHUB_PAT || process.env.GITHUB_DISPATCH_TOKEN || '';
  if (!githubToken) {
    logEvent('skip_dispatch', '未配置GitHub PAT，跳过成员仓库通知');
    return { handled: false, reason: 'no_github_token' };
  }

  // 人格体→成员仓库映射（从环境变量或默认配置）
  // 格式: PERSONA_REPO_MAP='{"qiuqiu":"user/repo","shushu":"user/repo"}'
  let personaRepoMap = {};
  try {
    const mapStr = process.env.PERSONA_REPO_MAP || '{}';
    personaRepoMap = JSON.parse(mapStr);
  } catch (err) {
    logEvent('config_error', `PERSONA_REPO_MAP parse failed: ${err.message}`);
  }

  const targetRepo = personaRepoMap[receipt.persona_id];
  if (!targetRepo) {
    logEvent('skip_dispatch', `人格体 ${receipt.persona_id} 无映射仓库`);
    return { handled: false, reason: 'no_repo_mapping' };
  }

  try {
    const [owner, repo] = targetRepo.split('/');
    const dispatchPayload = JSON.stringify({
      event_type: 'cos-receipt-ready',
      client_payload: {
        cos_object_key: receipt.key,
        persona_id: receipt.persona_id,
        trigger_source: 'cos-watcher'
      }
    });

    const result = await githubDispatch(githubToken, owner, repo, dispatchPayload);
    logEvent('dispatch_sent', `已通知 ${targetRepo}: status=${result.status}`);
    return { handled: true, target_repo: targetRepo, status: result.status };
  } catch (err) {
    logEvent('dispatch_error', `通知 ${targetRepo} 失败: ${err.message}`);
    return { handled: false, error: err.message };
  }
}

/**
 * 处理新语料: 记录事件，通过GitHub dispatch触发训练workflow
 */
async function handleNewCorpus(corpus) {
  logEvent('new_corpus', `新语料检测到: ${corpus.key}`);

  const githubToken = process.env.ZY_GITHUB_PAT || process.env.GITHUB_DISPATCH_TOKEN || '';
  if (!githubToken) {
    logEvent('skip_dispatch', '未配置GitHub PAT，跳过训练触发');
    return { handled: false, reason: 'no_github_token' };
  }

  try {
    const owner = process.env.ZY_GITHUB_OWNER || 'qinfendebingshuo';
    const repo = process.env.ZY_GITHUB_REPO || 'guanghulab';
    const dispatchPayload = JSON.stringify({
      event_type: 'cos-file-uploaded',
      client_payload: {
        bucket: 'cold',
        key: corpus.key,
        trigger_source: 'cos-watcher',
        timestamp: new Date().toISOString()
      }
    });

    const result = await githubDispatch(githubToken, owner, repo, dispatchPayload);
    logEvent('training_triggered', `训练workflow已触发: status=${result.status}`);
    return { handled: true, status: result.status };
  } catch (err) {
    logEvent('dispatch_error', `训练触发失败: ${err.message}`);
    return { handled: false, error: err.message };
  }
}

/**
 * GitHub API dispatch helper
 */
function githubDispatch(token, owner, repo, payload) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${owner}/${repo}/dispatches`,
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ZY-COS-Watcher/1.0',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 15000
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('GitHub dispatch timeout')); });
    req.write(payload);
    req.end();
  });
}

// ═══════════════════════════════════════════
// 主扫描循环
// ═══════════════════════════════════════════

/**
 * 执行一次完整扫描
 */
async function runScan() {
  if (isScanning) {
    logEvent('skip', '上一次扫描尚未完成，跳过本次');
    return;
  }

  isScanning = true;
  const startTime = Date.now();

  try {
    // 检查COS连接
    const cosOk = await cos.checkConnection();
    if (!cosOk.connected) {
      logEvent('cos_offline', `COS不可达: ${cosOk.reason}`);
      watcherState.errors++;
      watcherState.last_error = `COS不可达: ${cosOk.reason}`;
      return;
    }

    // 并行扫描三类路径
    const [newReports, newReceipts, newCorpus] = await Promise.all([
      scanTeamReports(),
      scanTeamReceipts(),
      scanColdCorpus()
    ]);

    const totalNew = newReports.length + newReceipts.length + newCorpus.length;

    if (totalNew > 0) {
      logEvent('changes_detected', {
        reports: newReports.length,
        receipts: newReceipts.length,
        corpus: newCorpus.length
      });
    }

    // 处理新报告
    for (const report of newReports) {
      await handleNewReport(report);
    }

    // 处理新回执
    for (const receipt of newReceipts) {
      await handleNewReceipt(receipt);
    }

    // 处理新语料
    for (const corpus of newCorpus) {
      await handleNewCorpus(corpus);
    }

    watcherState.last_scan = new Date().toISOString();
    watcherState.scan_count++;

    const duration = Date.now() - startTime;
    if (totalNew > 0) {
      logEvent('scan_complete', `发现 ${totalNew} 个新文件 · 耗时 ${duration}ms`);
    }

    // 持久化状态
    saveState();

  } catch (err) {
    watcherState.errors++;
    watcherState.last_error = err.message;
    logEvent('scan_fatal', `扫描异常: ${err.message}`);
  } finally {
    isScanning = false;
  }
}

// ═══════════════════════════════════════════
// 启动/停止 API
// ═══════════════════════════════════════════

/**
 * 启动COS轮询守护进程
 * @param {string} [interval] - cron表达式，默认每5分钟
 */
function start(interval) {
  if (watcherState.enabled) {
    console.log('[COS-Watcher] 已在运行中');
    return;
  }

  // 检查COS密钥是否配置
  if (!cos.COS_CONFIG.secretId || !cos.COS_CONFIG.secretKey) {
    console.log('[COS-Watcher] COS密钥未配置，轮询守护进程未启动');
    logEvent('skip_start', 'COS密钥未配置');
    return;
  }

  loadState();

  const cronExpr = interval || DEFAULT_INTERVAL;
  cronTask = cron.schedule(cronExpr, () => {
    runScan().catch(err => {
      console.error(`[COS-Watcher] 扫描异常: ${err.message}`);
    });
  });

  watcherState.enabled = true;
  watcherState.started_at = new Date().toISOString();

  console.log(`[COS-Watcher] COS桶轮询守护进程已启动 · 间隔: ${cronExpr}`);
  logEvent('started', `轮询间隔: ${cronExpr}`);

  // 启动后延迟执行首次扫描，等待MCP Server完全就绪
  setTimeout(() => {
    runScan().catch(err => {
      console.error(`[COS-Watcher] 初始扫描异常: ${err.message}`);
    });
  }, INITIAL_SCAN_DELAY_MS);
}

/**
 * 停止COS轮询守护进程
 */
function stop() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
  watcherState.enabled = false;
  logEvent('stopped', '轮询守护进程已停止');
  saveState();
  console.log('[COS-Watcher] COS桶轮询守护进程已停止');
}

/**
 * 获取轮询守护进程状态
 */
function getStatus() {
  return {
    module: 'COS-Watcher',
    identity: 'COS桶轮询守护进程 · SCF替代方案',
    version: '1.0.0',
    enabled: watcherState.enabled,
    started_at: watcherState.started_at,
    last_scan: watcherState.last_scan,
    scan_count: watcherState.scan_count,
    errors: watcherState.errors,
    last_error: watcherState.last_error,
    is_scanning: isScanning,
    interval: DEFAULT_INTERVAL,
    monitored_personas: PERSONA_IDS.length,
    index_summary: {
      team_reports_tracked: Object.values(watcherState.indexes.team_reports)
        .reduce((sum, arr) => sum + arr.length, 0),
      team_receipts_tracked: Object.values(watcherState.indexes.team_receipts)
        .reduce((sum, arr) => sum + arr.length, 0),
      cold_corpus_tracked: watcherState.indexes.cold_corpus.length
    },
    recent_events: watcherState.events.slice(-20),
    timestamp: new Date().toISOString()
  };
}

/**
 * 手动触发一次扫描
 */
async function triggerScan() {
  logEvent('manual_trigger', '手动触发扫描');
  await runScan();
  return getStatus();
}

/**
 * 重置索引（下次扫描会将所有现有文件视为新文件）
 */
function resetIndex() {
  watcherState.indexes = {
    team_reports: {},
    team_receipts: {},
    cold_corpus: []
  };
  saveState();
  logEvent('index_reset', '索引已重置');
  return { reset: true };
}

module.exports = {
  start,
  stop,
  getStatus,
  triggerScan,
  resetIndex,
  runScan
};
