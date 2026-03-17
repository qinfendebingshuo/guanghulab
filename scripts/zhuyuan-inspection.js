/**
 * scripts/zhuyuan-inspection.js
 * 铸渊每日巡检脚本
 *
 * 逻辑：
 * 1. 读取当日 checkin-board.json
 * 2. 找出所有 status: ❌ 未签到 的小兵
 * 3. 对每个未签到小兵：
 *    - 查看 workflow 最近 3 次 run 的失败原因
 *    - 判断 self_repair: true/false
 *    - 能自修复 → 尝试修复（重新触发 workflow）→ 写入修复日志
 *    - 不能自修复 → 写入「需要之之干预」清单
 * 4. 生成巡检报告
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const BRAIN_DIR = path.join(ROOT, '.github/persona-brain');
const BOARD_PATH = path.join(BRAIN_DIR, 'checkin-board.json');
const REGISTRY_PATH = path.join(BRAIN_DIR, 'agent-registry.json');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY || 'qinfendebingshuo/guanghulab';

const today = new Date().toISOString().split('T')[0];

console.log(`🔍 铸渊每日巡检开始 · ${today}`);

// ── GitHub API helper ─────────────────────────────────────────────────────

function githubApi(urlPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: urlPath,
      method: method,
      headers: {
        'User-Agent': 'zhuyuan-inspection',
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
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, data: null });
        }
      });
    });
    req.on('error', (err) => {
      console.error(`  ⚠️ API 请求失败: ${err.message}`);
      resolve({ statusCode: 0, data: null });
    });
    req.end();
  });
}

// ── 获取最近 N 次 run ────────────────────────────────────────────────────

async function getRecentRuns(workflowFile, count = 3) {
  const urlPath = `/repos/${REPO}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=${count}`;
  const result = await githubApi(urlPath);
  if (!result.data || !result.data.workflow_runs) return [];
  return result.data.workflow_runs.map(run => ({
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    created_at: run.created_at,
    html_url: run.html_url,
  }));
}

// ── 重新触发 workflow ─────────────────────────────────────────────────────

async function retriggerWorkflow(workflowFile) {
  const urlPath = `/repos/${REPO}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;
  const postData = JSON.stringify({ ref: 'main' });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: urlPath,
      method: 'POST',
      headers: {
        'User-Agent': 'zhuyuan-inspection',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    if (GITHUB_TOKEN) {
      options.headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve(res.statusCode === 204);
      });
    });
    req.on('error', () => resolve(false));
    req.write(postData);
    req.end();
  });
}

// ── 主巡检流程 ────────────────────────────────────────────────────────────

async function main() {
  // 1. 读取签到板和注册表
  if (!fs.existsSync(BOARD_PATH)) {
    console.error('❌ checkin-board.json 不存在');
    process.exit(1);
  }
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error('❌ agent-registry.json 不存在');
    process.exit(1);
  }

  const board = JSON.parse(fs.readFileSync(BOARD_PATH, 'utf8'));
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

  // 建立 agent_id → registry entry 的映射
  const registryMap = {};
  for (const agent of registry.agents) {
    registryMap[agent.id] = agent;
  }

  // 2. 找出未签到小兵
  const missingRecords = board.records.filter(r => r.status === '❌ 未签到');
  const checkedInRecords = board.records.filter(r => r.status === '✅ 已签到');

  console.log(`\n📊 签到情况: 已签到 ${checkedInRecords.length} / 未签到 ${missingRecords.length} / 总计 ${board.records.length}`);

  const autoRepaired = [];
  const interventionRequired = [];

  // 3. 对每个未签到小兵进行诊断
  for (const record of missingRecords) {
    const agent = registryMap[record.agent_id];
    if (!agent) {
      console.log(`  ⚠️ ${record.agent_id} 未在注册表中找到`);
      continue;
    }

    console.log(`\n  🔍 诊断 ${agent.id} (${agent.workflow})...`);

    // 获取最近 3 次运行
    const recentRuns = await getRecentRuns(agent.workflow, 3);
    const failureReasons = recentRuns
      .filter(r => r.conclusion && r.conclusion !== 'success')
      .map(r => `${r.conclusion} (${r.created_at})`);

    if (failureReasons.length > 0) {
      console.log(`    最近失败记录: ${failureReasons.join(', ')}`);
    } else if (recentRuns.length === 0) {
      console.log(`    无运行记录`);
    }

    // 判断是否能自修复
    if (agent.self_repair) {
      console.log(`    🔧 尝试自修复 (重新触发 workflow)...`);
      const success = await retriggerWorkflow(agent.workflow);
      if (success) {
        console.log(`    ✅ 已重新触发 workflow`);
        autoRepaired.push({
          agent_id: agent.id,
          agent_name: agent.name,
          workflow: agent.workflow,
          action: '重新触发 workflow_dispatch',
          result: '已触发',
        });
      } else {
        console.log(`    ⚠️ 重新触发失败（可能不支持 workflow_dispatch）`);
        interventionRequired.push({
          agent_id: agent.id,
          agent_name: agent.name,
          workflow: agent.workflow,
          reason: '自修复失败：workflow_dispatch 触发失败',
          recent_failures: failureReasons,
        });
      }
    } else {
      console.log(`    📌 self_repair=false, 需要之之干预`);
      interventionRequired.push({
        agent_id: agent.id,
        agent_name: agent.name,
        workflow: agent.workflow,
        reason: '不支持自修复',
        recent_failures: failureReasons,
      });
    }
  }

  // 4. 生成巡检报告
  const report = {
    title: `[铸渊巡检] ${today} 每日巡检报告`,
    type: '巡检报告',
    date: today,
    checked_in: checkedInRecords.map(r => ({
      agent_id: r.agent_id,
      agent_name: r.agent_name,
    })),
    missing_agents: missingRecords.map(r => ({
      agent_id: r.agent_id,
      agent_name: r.agent_name,
    })),
    auto_repaired: autoRepaired,
    intervention_required: interventionRequired,
    summary: {
      total: board.records.length,
      checked_in: checkedInRecords.length,
      missing: missingRecords.length,
      auto_repaired: autoRepaired.length,
      needs_intervention: interventionRequired.length,
    },
    push_targets: ['零点原核', '明天见频道'],
  };

  // 保存巡检报告
  const reportPath = path.join(BRAIN_DIR, 'inspection-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n📋 巡检报告已生成:`);
  console.log(`  已签到: ${report.summary.checked_in}`);
  console.log(`  未签到: ${report.summary.missing}`);
  console.log(`  已自修复: ${report.summary.auto_repaired}`);
  console.log(`  需要干预: ${report.summary.needs_intervention}`);
  console.log(`\n✅ 巡检报告已保存到 inspection-report.json`);
}

main().catch((err) => {
  console.error('❌ 巡检脚本异常:', err.message);
  process.exit(1);
});
