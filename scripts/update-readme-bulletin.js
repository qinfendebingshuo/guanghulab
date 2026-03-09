/**
 * 光湖系统公告区自动更新脚本
 * 
 * 读取 memory.json 事件 + GitHub Actions 最近工作流运行记录，
 * 自动更新 README.md 中 <!-- BULLETIN_START --> 和 <!-- BULLETIN_END --> 之间的公告区域。
 *
 * 环境变量:
 *   GITHUB_TOKEN       - GitHub API token (Actions 自动提供)
 *   GITHUB_REPOSITORY  - owner/repo (Actions 自动提供)
 *
 * 用法:
 *   node scripts/update-readme-bulletin.js
 */

const fs = require('fs');
const path = require('path');

const README_PATH = path.join(__dirname, '..', 'README.md');
const MEMORY_PATH = path.join(__dirname, '..', '.github', 'brain', 'memory.json');
const BULLETIN_START = '<!-- BULLETIN_START -->';
const BULLETIN_END = '<!-- BULLETIN_END -->';
const MAX_ENTRIES = 20;
const MAX_GIT_LOG_COMMITS = 30;

/* ── 开发者名册 ─────────────────────────── */
const DEV_MAP = {
  'DEV-001': '🛠️ 页页',
  'DEV-002': '🐱 肥猫',
  'DEV-003': '🎨 燕樊',
  'DEV-004': '🤖 之之',
  'DEV-005': '🍓 小草莓',
  'DEV-009': '🌸 花尔',
  'DEV-010': '🍊 桔子',
  'DEV-011': '✍️ 匆匆那年',
  'DEV-012': '🌟 Awen',
};

const ACTOR_MAP = {
  'qinfendebingshuo': '冰朔',
  'copilot-swe-agent[bot]': '铸渊 (Copilot)',
};

/* ── 模块路径映射 ─────────────────────────── */
const MODULE_PREFIXES = [
  'm01-login', 'm03-personality', 'm05-user-center', 'm06-ticket',
  'm07-dialogue-ui', 'm10-cloud', 'm11-module', 'm12-kanban',
  'm15-cloud-drive', 'm18-health-check', 'dingtalk-bot',
  'backend-integration', 'status-board', 'backend', 'frontend',
  'notification', 'docs', 'scripts', 'ticket-system', 'cloud-drive',
];

/* ── 工具函数 ─────────────────────────── */

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type) => (parts.find(p => p.type === type) || {}).value || '';
  return `${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

function statusIcon(result) {
  if (!result) return '🔵';
  const r = result.toLowerCase();
  if (r === 'passed' || r === 'success' || r === 'completed') return '✅';
  if (r === 'failed' || r === 'failure') return '❌';
  if (r === 'cancelled') return '⏹️';
  return '🔵';
}

function resolveActor(actor) {
  if (!actor) return '系统';
  return ACTOR_MAP[actor] || actor;
}

/* ── 从 memory.json 读取事件 ─────────────────────────── */

function loadMemoryEvents() {
  if (!fs.existsSync(MEMORY_PATH)) return [];
  const memory = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
  const events = memory.events || [];
  return events.map(ev => {
    const ts = ev.timestamp || ev.date || '';
    const actor = resolveActor(ev.actor || ev.by);
    const type = ev.type || 'event';

    let icon, detail;
    switch (type) {
      case 'daily_check':
        icon = statusIcon(ev.result);
        detail = `铸渊每日巡检 ${ev.result === 'passed' ? '通过' : '异常'}`;
        break;
      case 'ci_run':
        icon = statusIcon(ev.result);
        detail = `CI 构建 ${ev.result === 'passed' ? '通过' : ev.result === 'unknown' ? '状态未知' : '失败'}`;
        break;
      case 'psp_inspection':
        icon = ev.description?.includes('通过') ? '✅' : '⚠️';
        detail = ev.description || 'PSP 巡检';
        break;
      case 'system_build':
        icon = '🚀';
        detail = ev.title || '系统构建';
        break;
      case 'brain_upgrade':
        icon = '🧠';
        detail = ev.title || ev.description || '大脑升级';
        break;
      case 'module_upload':
        icon = statusIcon(ev.result);
        detail = `模块上传: ${ev.module || '未知模块'}`;
        break;
      default:
        icon = '📋';
        detail = ev.title || ev.description || type;
    }

    return { ts, icon, actor, detail, sortKey: new Date(ts || '2000-01-01').getTime() };
  });
}

/* ── 从 GitHub Actions API 获取最近工作流运行 ─────────────────────────── */

async function fetchRecentWorkflowRuns() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.log('⚠️  GITHUB_TOKEN 或 GITHUB_REPOSITORY 未设置，跳过 API 查询');
    return [];
  }

  const url = `https://api.github.com/repos/${repo}/actions/runs?per_page=15&status=completed`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!res.ok) {
      console.log(`⚠️  GitHub API 响应 ${res.status}，跳过工作流数据`);
      return [];
    }
    const data = await res.json();
    const runs = data.workflow_runs || [];

    return runs.map(run => {
      const actor = resolveActor(run.actor?.login);
      const conclusion = run.conclusion || 'unknown';
      const icon = statusIcon(conclusion);
      const wfName = run.name || '工作流';
      const branch = run.head_branch || 'main';
      const detail = `${wfName} · ${branch} · ${conclusion === 'success' ? '成功' : conclusion === 'failure' ? '失败' : conclusion}`;

      return {
        ts: run.updated_at || run.created_at,
        icon,
        actor,
        detail,
        sortKey: new Date(run.updated_at || run.created_at).getTime(),
      };
    });
  } catch (err) {
    console.log(`⚠️  获取工作流数据失败: ${err.message}`);
    return [];
  }
}

/* ── 从最近的 git 记录检测模块推送 ─────────────────────────── */

function detectRecentModulePushes() {
  const { execSync } = require('child_process');
  const entries = [];

  try {
    const log = execSync(
      `git log --oneline --name-only --since="7 days ago" -${MAX_GIT_LOG_COMMITS} 2>/dev/null || true`,
      { encoding: 'utf8', cwd: path.join(__dirname, '..') }
    );

    const lines = log.split('\n');
    let currentCommit = null;
    let currentActor = null;
    const moduleChanges = new Map();

    for (const line of lines) {
      const commitMatch = line.match(/^([a-f0-9]+)\s+(.*)$/);
      if (commitMatch) {
        currentCommit = commitMatch[1];
        continue;
      }

      if (!line.trim()) continue;

      for (const prefix of MODULE_PREFIXES) {
        if (line.startsWith(prefix + '/') || line === prefix) {
          if (!moduleChanges.has(prefix)) {
            moduleChanges.set(prefix, currentCommit);
          }
          break;
        }
      }
    }

    for (const [mod, commit] of moduleChanges) {
      try {
        const info = execSync(
          `git log -1 --format="%aI|%an" ${commit} 2>/dev/null || true`,
          { encoding: 'utf8', cwd: path.join(__dirname, '..') }
        ).trim();
        const [ts, author] = info.split('|');
        entries.push({
          ts,
          icon: '📦',
          actor: resolveActor(author) || author,
          detail: `模块更新: \`${mod}/\``,
          sortKey: new Date(ts).getTime(),
        });
      } catch (err) {
        console.log(`⚠️  读取模块 ${mod} 提交信息失败: ${err.message}`);
      }
    }
  } catch (err) {
    console.log(`⚠️  Git 日志读取失败: ${err.message}`);
  }

  return entries;
}

/* ── 生成公告表格 ─────────────────────────── */

function buildBulletinTable(entries) {
  entries.sort((a, b) => b.sortKey - a.sortKey);

  const seen = new Set();
  const unique = [];
  for (const e of entries) {
    const key = `${e.detail}|${formatTime(e.ts)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(e);
    }
  }

  const display = unique.slice(0, MAX_ENTRIES);

  if (display.length === 0) {
    return '| 时间 | 事件 | 详情 |\n|------|------|------|\n| 🕐 暂无记录 | — | 公告系统已就绪 |';
  }

  const rows = display.map(e =>
    `| ${formatTime(e.ts)} | ${e.icon} ${e.actor} | ${e.detail} |`
  );

  return `| 时间 | 事件 | 详情 |\n|------|------|------|\n${rows.join('\n')}`;
}

/* ── 更新 README.md ─────────────────────────── */

function updateReadme(bulletinContent) {
  if (!fs.existsSync(README_PATH)) {
    console.error('❌ README.md 不存在');
    process.exit(1);
  }

  const readme = fs.readFileSync(README_PATH, 'utf8');
  const startIdx = readme.indexOf(BULLETIN_START);
  const endIdx = readme.indexOf(BULLETIN_END);

  if (startIdx === -1 || endIdx === -1) {
    console.error('❌ README.md 中未找到公告区标记 (BULLETIN_START / BULLETIN_END)');
    process.exit(1);
  }

  const before = readme.substring(0, startIdx + BULLETIN_START.length);
  const after = readme.substring(endIdx);
  const updated = `${before}\n${bulletinContent}\n${after}`;

  if (updated === readme) {
    console.log('ℹ️  公告区内容无变化，跳过写入');
    return false;
  }

  fs.writeFileSync(README_PATH, updated, 'utf8');
  console.log('✅ README.md 公告区已更新');
  return true;
}

/* ── 主流程 ─────────────────────────── */

async function main() {
  console.log('🌊 光湖系统公告区更新脚本启动...\n');

  const memoryEvents = loadMemoryEvents();
  console.log(`📋 memory.json 事件: ${memoryEvents.length} 条`);

  const workflowEvents = await fetchRecentWorkflowRuns();
  console.log(`🔄 工作流运行记录: ${workflowEvents.length} 条`);

  const moduleEvents = detectRecentModulePushes();
  console.log(`📦 模块推送记录: ${moduleEvents.length} 条`);

  const allEvents = [...memoryEvents, ...workflowEvents, ...moduleEvents];
  console.log(`📊 合计事件: ${allEvents.length} 条\n`);

  const table = buildBulletinTable(allEvents);
  const changed = updateReadme(table);

  if (changed) {
    console.log('\n📢 公告区更新完成！');
  } else {
    console.log('\n📢 公告区无需更新。');
  }
}

main().catch(err => {
  console.error('❌ 脚本执行失败:', err);
  process.exit(1);
});
