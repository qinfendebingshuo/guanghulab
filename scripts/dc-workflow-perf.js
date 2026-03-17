/**
 * scripts/dc-workflow-perf.js
 * DC-02 · Workflow 性能采集器
 *
 * 采集时机：每日自检结束时附带写入
 * 存储位置：data/dc-reports/workflow-perf-YYYY-MM-DD.json
 *
 * 采集方式：
 *   调用 GitHub API GET /repos/{owner}/{repo}/actions/runs
 *   拉取当日运行记录，聚合写入标准格式。
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const ROOT   = path.resolve(__dirname, '..');
const DC_DIR = path.join(ROOT, 'data/dc-reports');
const WF_DIR = path.join(ROOT, '.github/workflows');

const OWNER = 'qinfendebingshuo';
const REPO  = 'guanghulab';

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
const now   = new Date();
const today = new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString().split('T')[0];

// ━━━ GitHub API 请求 ━━━

function githubGet(apiPath) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      method: 'GET',
      headers: {
        'User-Agent': 'dc-workflow-perf',
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 30000
    };

    if (token) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// ━━━ 从 GitHub API 拉取当日 workflow runs ━━━

async function fetchTodayRuns() {
  const runs = [];
  let page = 1;
  const maxPages = 5;

  while (page <= maxPages) {
    try {
      const resp = await githubGet(
        `/repos/${OWNER}/${REPO}/actions/runs?created=%3E%3D${today}T00:00:00Z&per_page=100&page=${page}`
      );

      if (resp.statusCode !== 200) {
        console.log(`  ⚠️ GitHub API 返回 ${resp.statusCode}，停止分页`);
        break;
      }

      const data = resp.body;
      if (!data.workflow_runs || data.workflow_runs.length === 0) break;

      runs.push(...data.workflow_runs);

      if (runs.length >= data.total_count) break;
      page++;
    } catch (err) {
      console.log(`  ⚠️ GitHub API 请求失败: ${err.message}`);
      break;
    }
  }

  return runs;
}

// ━━━ 本地 workflow 文件分析 ━━━

function countLocalWorkflows() {
  try {
    return fs.readdirSync(WF_DIR)
      .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      .length;
  } catch {
    return 0;
  }
}

function extractTriggerType(run) {
  return run.event || 'unknown';
}

function extractDependencies(workflowName) {
  // 尝试从 workflow 文件内容中提取 needs 依赖
  const deps = [];
  try {
    const files = fs.readdirSync(WF_DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(WF_DIR, file), 'utf8');
      const nameMatch = content.match(/^name\s*:\s*["']?(.+?)["']?\s*$/m);
      const name = nameMatch ? nameMatch[1].trim() : file;

      if (name === workflowName || file === workflowName) {
        // 提取 needs 字段
        const needsMatches = content.match(/needs\s*:\s*\[?([^\]\n]+)\]?/g);
        if (needsMatches) {
          for (const m of needsMatches) {
            const needs = m.replace(/needs\s*:\s*\[?\s*/, '').replace(/\]?\s*$/, '');
            deps.push(...needs.split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean));
          }
        }

        // 提取 workflow_run 依赖
        if (content.includes('workflow_run:')) {
          const wfRunMatch = content.match(/workflows\s*:\s*\[([^\]]+)\]/);
          if (wfRunMatch) {
            deps.push(...wfRunMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean));
          }
        }
        break;
      }
    }
  } catch {
    // 文件读取失败
  }
  return [...new Set(deps)];
}

// ━━━ 聚合 runs → 按 workflow 分组统计 ━━━

function aggregateRuns(runs) {
  const wfMap = {};
  let failedToday = 0;

  for (const run of runs) {
    const name = run.name || run.workflow_id?.toString() || 'unknown';
    if (!wfMap[name]) {
      wfMap[name] = {
        name: name,
        trigger: extractTriggerType(run),
        runs_today: 0,
        durations: [],
        successes: 0,
        failures: 0,
        dependencies: extractDependencies(name)
      };
    }

    wfMap[name].runs_today++;

    // 计算运行时长（秒）
    if (run.created_at && run.updated_at) {
      const start = new Date(run.created_at).getTime();
      const end   = new Date(run.updated_at).getTime();
      const durationSec = Math.round((end - start) / 1000);
      if (durationSec > 0) {
        wfMap[name].durations.push(durationSec);
      }
    }

    if (run.conclusion === 'success') {
      wfMap[name].successes++;
    } else if (run.conclusion === 'failure') {
      wfMap[name].failures++;
      failedToday++;
    }
  }

  const workflows = Object.values(wfMap).map(wf => {
    const totalRuns = wf.successes + wf.failures;
    return {
      name: wf.name,
      trigger: wf.trigger,
      runs_today: wf.runs_today,
      avg_duration_sec: wf.durations.length > 0
        ? Math.round(wf.durations.reduce((a, b) => a + b, 0) / wf.durations.length)
        : 0,
      success_rate: totalRuns > 0
        ? parseFloat((wf.successes / totalRuns).toFixed(2))
        : null,
      dependencies: wf.dependencies
    };
  });

  return { workflows, failedToday };
}

// ━━━ 统计可并行 workflow 数量 ━━━

function countParallelCapable() {
  let parallelCount = 0;
  try {
    const files = fs.readdirSync(WF_DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(WF_DIR, file), 'utf8');
      // 没有 workflow_run 触发且没有 needs 依赖的 job 视为可并行
      if (!content.includes('workflow_run:') && !/needs\s*:/.test(content)) {
        parallelCount++;
      }
    }
  } catch {
    // 读取失败
  }
  return parallelCount;
}

// ━━━ 主流程 ━━━

async function main() {
  console.log(`⚙️ DC-02 · Workflow 性能采集器 · ${today}`);

  fs.mkdirSync(DC_DIR, { recursive: true });

  const totalWorkflows = countLocalWorkflows();
  console.log(`  → 本地 workflow 文件数: ${totalWorkflows}`);

  const runs = await fetchTodayRuns();
  console.log(`  → 当日 workflow runs: ${runs.length}`);

  const { workflows, failedToday } = aggregateRuns(runs);
  const parallelCapable = countParallelCapable();

  const report = {
    date: today,
    workflows: workflows,
    total_workflows: totalWorkflows,
    failed_today: failedToday,
    parallel_capable: parallelCapable,
    _meta: {
      generated_by: 'dc-workflow-perf.js',
      generated_at: now.toISOString(),
      runs_fetched: runs.length
    }
  };

  const outputFile = path.join(DC_DIR, `workflow-perf-${today}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
  console.log(`  ✅ DC-02 报告已写入: ${path.relative(ROOT, outputFile)}`);
}

main().catch(err => {
  console.error('❌ DC-02 采集失败:', err.message);
  process.exit(1);
});
