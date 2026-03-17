/**
 * scripts/agent-checkin.js
 * 人格体每日签到脚本
 *
 * 逻辑：
 * 1. 读取 agent-registry.json 获取所有注册小兵列表
 * 2. 对每个小兵，查询 GitHub Actions API 获取该 workflow 今日最新一次 run 的结果
 * 3. 结果为 success 且时间在今天 10:00 之前 → 标记为 ✅ 已签到
 * 4. 结果为 failure 或无今日 run → 标记为 ❌ 未签到
 * 5. 更新 checkin-board.json 的所有记录
 * 6. 生成 summary（总数/已签到/缺席/缺席名单）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const BRAIN_DIR = path.join(ROOT, '.github/persona-brain');
const REGISTRY_PATH = path.join(BRAIN_DIR, 'agent-registry.json');
const BOARD_PATH = path.join(BRAIN_DIR, 'checkin-board.json');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY || 'qinfendebingshuo/guanghulab';

const today = new Date().toISOString().split('T')[0];
const todayStart = new Date(today + 'T00:00:00Z');

console.log(`📋 人格体每日签到开始 · ${today}`);

// ── GitHub API helper ─────────────────────────────────────────────────────

function githubApi(urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: urlPath,
      method: 'GET',
      headers: {
        'User-Agent': 'zhuyuan-agent-checkin',
        'Accept': 'application/vnd.github.v3+json',
      },
    };
    if (GITHUB_TOKEN) {
      options.headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', (err) => {
      console.error(`  ⚠️ API 请求失败: ${err.message}`);
      resolve(null);
    });
    req.end();
  });
}

// ── 获取 workflow 今日最新 run ────────────────────────────────────────────

async function getLatestRun(workflowFile) {
  const urlPath = `/repos/${REPO}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=1&created=${encodeURIComponent('>=' + today)}`;
  const data = await githubApi(urlPath);
  if (!data || !data.workflow_runs || data.workflow_runs.length === 0) {
    return null;
  }
  const run = data.workflow_runs[0];
  return {
    status: run.status,
    conclusion: run.conclusion,
    created_at: run.created_at,
    updated_at: run.updated_at,
  };
}

// ── 主签到流程 ────────────────────────────────────────────────────────────

async function main() {
  // 1. 读取注册表
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error('❌ agent-registry.json 不存在');
    process.exit(1);
  }
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

  // 2. 构建签到记录
  const records = [];
  let checkedIn = 0;
  const missingAgents = [];

  for (const agent of registry.agents) {
    console.log(`  🔍 检查 ${agent.id} (${agent.workflow})...`);
    const run = await getLatestRun(agent.workflow);

    const record = {
      agent_id: agent.id,
      agent_name: agent.name,
      status: 'pending',
      checkin_time: null,
      last_run: null,
      last_run_result: null,
      note: '',
    };

    if (run && run.conclusion === 'success') {
      record.status = '✅ 已签到';
      record.checkin_time = run.updated_at;
      record.last_run = run.updated_at;
      record.last_run_result = 'success';
      checkedIn++;
      console.log(`    ✅ 已签到 (${run.updated_at})`);
    } else if (run) {
      record.status = '❌ 未签到';
      record.last_run = run.updated_at;
      record.last_run_result = run.conclusion || run.status;
      record.note = `最近运行结果: ${run.conclusion || run.status}`;
      missingAgents.push(agent.id);
      console.log(`    ❌ 未签到 (结果: ${run.conclusion || run.status})`);
    } else {
      record.status = '❌ 未签到';
      record.note = '今日无运行记录';
      missingAgents.push(agent.id);
      console.log(`    ❌ 未签到 (今日无运行记录)`);
    }

    records.push(record);
  }

  // 3. 构建签到板
  const board = {
    board_version: 'v1.0',
    checkin_deadline: '10:00+08:00',
    inspection_time: '12:00+08:00',
    date: today,
    records: records,
    summary: {
      total: records.length,
      checked_in: checkedIn,
      missing: records.length - checkedIn,
      missing_agents: missingAgents,
    },
  };

  // 4. 写入签到板
  fs.writeFileSync(BOARD_PATH, JSON.stringify(board, null, 2));

  console.log(`\n📊 签到汇总：`);
  console.log(`  总数: ${board.summary.total}`);
  console.log(`  已签到: ${board.summary.checked_in}`);
  console.log(`  缺席: ${board.summary.missing}`);
  if (missingAgents.length > 0) {
    console.log(`  缺席名单: ${missingAgents.join(', ')}`);
  }
  console.log(`\n✅ 签到记录已写入 checkin-board.json`);
}

main().catch((err) => {
  console.error('❌ 签到脚本异常:', err.message);
  process.exit(1);
});
