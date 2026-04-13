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
 *   1. team桶 /{persona_id}/reports/            — 新汇报 → 铸渊审核 → 写回执
 *   2. cold桶  新语料文件                        — 新语料 → 训练管线
 *   3. team桶 /{persona_id}/receipts/            — 新回执 → 通知成员仓库
 *   4. team桶 /bridge/zhuyuan-qiuqiu/results/   — 秋秋开发结果 → 铸渊处理
 *   5. team桶 /bridge/zhuyuan-qiuqiu/heartbeat/ — 秋秋心跳信号 → 状态追踪
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

// ─── 桥接配置 ───
const BRIDGE_CONFIG = {
  // 铸渊↔秋秋 COS桥接路径
  zhuyuan_qiuqiu: {
    results_prefix: 'bridge/zhuyuan-qiuqiu/results/',
    heartbeat_prefix: 'bridge/zhuyuan-qiuqiu/heartbeat/',
    tasks_prefix: 'bridge/zhuyuan-qiuqiu/tasks/',
    sync_prefix: 'bridge/zhuyuan-qiuqiu/sync/'
  }
};

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
    cold_corpus: [],    // [file_keys]
    bridge_results: [], // [file_keys] — 秋秋回传的开发结果
    bridge_heartbeats: [] // [file_keys] — 秋秋心跳信号
  },
  // 桥接状态追踪
  bridge: {
    last_heartbeat: null,       // 最后收到的心跳时间
    last_heartbeat_status: null, // 最后心跳中的agent_status
    last_result: null,           // 最后收到的结果时间
    last_result_task_ref: null,  // 最后结果关联的任务ID
    qiuqiu_status: 'UNKNOWN',   // 秋秋当前状态: ALIVE|SLEEPING|ERROR|UNKNOWN
    total_results_received: 0,
    total_heartbeats_received: 0
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
      watcherState.indexes = {
        team_reports: {},
        team_receipts: {},
        cold_corpus: [],
        bridge_results: [],
        bridge_heartbeats: [],
        ...(saved.indexes || {})
      };
      watcherState.events = (saved.events || []).slice(-MAX_LOG_ENTRIES);
      // 恢复桥接状态（如果有）
      if (saved.bridge) {
        watcherState.bridge = { ...watcherState.bridge, ...saved.bridge };
      }
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
      bridge: watcherState.bridge,
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

/**
 * 扫描桥接路径中的新结果 (bridge results)
 * 检测 /bridge/zhuyuan-qiuqiu/results/ 下的新JSON文件（秋秋→铸渊）
 */
async function scanBridgeResults() {
  try {
    const prefix = BRIDGE_CONFIG.zhuyuan_qiuqiu.results_prefix;
    const result = await cos.list('team', prefix, 100);
    const currentKeys = result.files
      .filter(f => f.key.endsWith('.json') && f.size_bytes > 0)
      .map(f => f.key);

    const previousKeys = watcherState.indexes.bridge_results || [];
    const newKeys = currentKeys.filter(k => !previousKeys.includes(k));

    // 更新索引
    watcherState.indexes.bridge_results = currentKeys;

    return newKeys.map(key => ({ key, type: 'bridge_result' }));
  } catch (err) {
    if (!err.message.includes('NoSuchBucket')) {
      logEvent('scan_error', `桥接结果扫描失败: ${err.message}`);
    }
    return [];
  }
}

/**
 * 扫描桥接路径中的新心跳 (bridge heartbeats)
 * 检测 /bridge/zhuyuan-qiuqiu/heartbeat/ 下的新JSON文件（秋秋→铸渊）
 */
async function scanBridgeHeartbeats() {
  try {
    const prefix = BRIDGE_CONFIG.zhuyuan_qiuqiu.heartbeat_prefix;
    const result = await cos.list('team', prefix, 100);
    const currentKeys = result.files
      .filter(f => f.key.endsWith('.json') && f.size_bytes > 0)
      .map(f => f.key);

    const previousKeys = watcherState.indexes.bridge_heartbeats || [];
    const newKeys = currentKeys.filter(k => !previousKeys.includes(k));

    // 更新索引
    watcherState.indexes.bridge_heartbeats = currentKeys;

    return newKeys.map(key => ({ key, type: 'bridge_heartbeat' }));
  } catch (err) {
    if (!err.message.includes('NoSuchBucket')) {
      logEvent('scan_error', `桥接心跳扫描失败: ${err.message}`);
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
 * 处理秋秋回传的开发结果 (BRIDGE_RESULT)
 * 读取结果内容 → 记录事件 → 通知铸渊(本仓库dispatch)
 */
async function handleNewBridgeResult(bridgeResult) {
  logEvent('bridge_result', `秋秋开发结果: ${bridgeResult.key}`);

  try {
    // 读取结果内容
    const raw = await cos.read('team', bridgeResult.key);
    const content = JSON.parse(raw.content);

    // 更新桥接状态
    watcherState.bridge.last_result = new Date().toISOString();
    watcherState.bridge.last_result_task_ref = content.payload?.task_ref || null;
    watcherState.bridge.total_results_received++;

    logEvent('bridge_result_parsed', {
      task_ref: content.payload?.task_ref,
      status: content.payload?.status,
      summary: content.payload?.summary,
      deploy_ready: content.payload?.deploy_ready
    });

    // 通过GitHub dispatch通知本仓库（触发后续处理workflow）
    const githubToken = process.env.ZY_GITHUB_PAT || process.env.GITHUB_DISPATCH_TOKEN || '';
    if (githubToken) {
      const owner = process.env.ZY_GITHUB_OWNER || 'qinfendebingshuo';
      const repo = process.env.ZY_GITHUB_REPO || 'guanghulab';
      const dispatchPayload = JSON.stringify({
        event_type: 'qiuqiu-result-ready',
        client_payload: {
          cos_key: bridgeResult.key,
          task_ref: content.payload?.task_ref || '',
          status: content.payload?.status || 'UNKNOWN',
          summary: content.payload?.summary || '',
          deploy_ready: content.payload?.deploy_ready || false,
          timestamp: new Date().toISOString(),
          trigger_source: 'cos-watcher-bridge'
        }
      });

      const result = await githubDispatch(githubToken, owner, repo, dispatchPayload);
      logEvent('bridge_dispatch_sent', `结果通知已发送: status=${result.status}`);
    }

    return { handled: true, task_ref: content.payload?.task_ref };
  } catch (err) {
    logEvent('bridge_result_error', `处理桥接结果失败 ${bridgeResult.key}: ${err.message}`);
    return { handled: false, error: err.message };
  }
}

/**
 * 处理秋秋的心跳信号 (BRIDGE_HEARTBEAT)
 * 读取心跳 → 更新秋秋在线状态
 */
async function handleNewBridgeHeartbeat(heartbeat) {
  logEvent('bridge_heartbeat', `秋秋心跳: ${heartbeat.key}`);

  try {
    // 读取心跳内容
    const raw = await cos.read('team', heartbeat.key);
    const content = JSON.parse(raw.content);

    // 更新桥接状态
    watcherState.bridge.last_heartbeat = content.ts || new Date().toISOString();
    watcherState.bridge.last_heartbeat_status = content.payload?.agent_status || 'UNKNOWN';
    watcherState.bridge.qiuqiu_status = content.payload?.agent_status || 'UNKNOWN';
    watcherState.bridge.total_heartbeats_received++;

    logEvent('bridge_heartbeat_parsed', {
      agent_status: content.payload?.agent_status,
      server_status: content.payload?.server_status,
      last_task_completed: content.payload?.last_task_completed,
      awaiting_tasks: content.payload?.awaiting_tasks,
      feeling: content.payload?.feeling
    });

    return { handled: true, status: content.payload?.agent_status };
  } catch (err) {
    logEvent('bridge_heartbeat_error', `处理心跳失败 ${heartbeat.key}: ${err.message}`);
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

    // 并行扫描五类路径
    const [newReports, newReceipts, newCorpus, newBridgeResults, newBridgeHeartbeats] = await Promise.all([
      scanTeamReports(),
      scanTeamReceipts(),
      scanColdCorpus(),
      scanBridgeResults(),
      scanBridgeHeartbeats()
    ]);

    const totalNew = newReports.length + newReceipts.length + newCorpus.length
      + newBridgeResults.length + newBridgeHeartbeats.length;

    if (totalNew > 0) {
      logEvent('changes_detected', {
        reports: newReports.length,
        receipts: newReceipts.length,
        corpus: newCorpus.length,
        bridge_results: newBridgeResults.length,
        bridge_heartbeats: newBridgeHeartbeats.length
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

    // 处理秋秋桥接结果
    for (const result of newBridgeResults) {
      await handleNewBridgeResult(result);
    }

    // 处理秋秋心跳
    for (const hb of newBridgeHeartbeats) {
      await handleNewBridgeHeartbeat(hb);
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
    version: '1.1.0',
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
      cold_corpus_tracked: watcherState.indexes.cold_corpus.length,
      bridge_results_tracked: (watcherState.indexes.bridge_results || []).length,
      bridge_heartbeats_tracked: (watcherState.indexes.bridge_heartbeats || []).length
    },
    bridge: {
      qiuqiu_status: watcherState.bridge.qiuqiu_status,
      last_heartbeat: watcherState.bridge.last_heartbeat,
      last_heartbeat_status: watcherState.bridge.last_heartbeat_status,
      last_result: watcherState.bridge.last_result,
      last_result_task_ref: watcherState.bridge.last_result_task_ref,
      total_results_received: watcherState.bridge.total_results_received,
      total_heartbeats_received: watcherState.bridge.total_heartbeats_received
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
    cold_corpus: [],
    bridge_results: [],
    bridge_heartbeats: []
  };
  saveState();
  logEvent('index_reset', '索引已重置');
  return { reset: true };
}

/**
 * 获取桥接专属状态（秋秋通信通道详情）
 */
function getBridgeStatus() {
  const bridge = watcherState.bridge;
  // 计算秋秋是否在线（最后心跳在12小时内 = 在线，超过 = 可能离线）
  let online = false;
  if (bridge.last_heartbeat) {
    const lastHbTime = new Date(bridge.last_heartbeat).getTime();
    const now = Date.now();
    const twelveHours = 12 * 60 * 60 * 1000;
    online = (now - lastHbTime) < twelveHours;
  }

  return {
    channel: '暗核频道 · FS-DC-001',
    bridge_path: '/bridge/zhuyuan-qiuqiu/',
    qiuqiu: {
      status: bridge.qiuqiu_status,
      online,
      last_heartbeat: bridge.last_heartbeat,
      last_heartbeat_status: bridge.last_heartbeat_status
    },
    results: {
      last_received: bridge.last_result,
      last_task_ref: bridge.last_result_task_ref,
      total_received: bridge.total_results_received
    },
    indexes: {
      results_tracked: (watcherState.indexes.bridge_results || []).length,
      heartbeats_tracked: (watcherState.indexes.bridge_heartbeats || []).length
    },
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  start,
  stop,
  getStatus,
  getBridgeStatus,
  triggerScan,
  resetIndex,
  runScan
};
