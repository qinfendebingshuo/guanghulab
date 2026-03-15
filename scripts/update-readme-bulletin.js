/**
 * 光湖系统公告区自动更新脚本 v2.0
 *
 * 分离公告为两个区域：
 *   1. 冰朔公告栏 — 自检/轮询/数据库/铸渊自动提醒
 *   2. 合作者公告栏 — 模块上传状态/各人提醒
 *
 * 铸渊自动提醒逻辑：
 *   - 绿色 = 今日无需手动干预
 *   - 红色 = 需要干预，列出待处理事项，并发邮件通知
 *
 * 环境变量:
 *   GITHUB_TOKEN       - GitHub API token (Actions 自动提供)
 *   GITHUB_REPOSITORY  - owner/repo (Actions 自动提供)
 *   SMTP_HOST          - 邮件服务器 (可选)
 *   SMTP_PORT          - 邮件端口 (可选, 默认 465)
 *   SMTP_USER          - 邮件账号 (可选)
 *   SMTP_PASS          - 邮件密码 (可选)
 *   BINGSHUO_EMAIL     - 冰朔邮箱 (可选, 默认从 GitHub API 获取)
 *
 * 用法:
 *   node scripts/update-readme-bulletin.js
 */

const fs = require('fs');
const path = require('path');

const README_PATH = path.join(__dirname, '..', 'README.md');
const MEMORY_PATH = path.join(__dirname, '..', '.github', 'brain', 'memory.json');
const PERSONA_MEMORY_PATH = path.join(__dirname, '..', '.github', 'persona-brain', 'memory.json');
const DEV_STATUS_PATH = path.join(__dirname, '..', '.github', 'persona-brain', 'dev-status.json');
const COLLABORATORS_PATH = path.join(__dirname, '..', '.github', 'brain', 'collaborators.json');
const BULLETIN_CACHE_PATH = path.join(__dirname, '..', '.github', 'brain', 'bulletin-board-today.json');

const MAX_BINGSHUO_ENTRIES = 15;
const MAX_COLLAB_ENTRIES = 20;
const MAX_GIT_LOG_COMMITS = 30;
const BINGSHUO_USERNAME = 'qinfendebingshuo';

/* ── 公告区标记 ─────────────────────────── */
const MARKERS = {
  bingshuoBulletin: ['<!-- BINGSHUO_BULLETIN_START -->', '<!-- BINGSHUO_BULLETIN_END -->'],
  bingshuoAlert: ['<!-- BINGSHUO_ALERT_START -->', '<!-- BINGSHUO_ALERT_END -->'],
  collabBulletin: ['<!-- COLLABORATOR_BULLETIN_START -->', '<!-- COLLABORATOR_BULLETIN_END -->'],
  collabAlert: ['<!-- COLLABORATOR_ALERT_START -->', '<!-- COLLABORATOR_ALERT_END -->'],
};

/* ── 开发者名册 ─────────────────────────── */
const DEV_MAP = {
  'DEV-001': { name: '🛠️ 页页', modules: ['backend-integration'] },
  'DEV-002': { name: '🐱 肥猫', modules: ['m01-login', 'm03-personality'] },
  'DEV-003': { name: '🎨 燕樊', modules: ['m07-dialogue-ui', 'm15-cloud-drive', 'm10-cloud'] },
  'DEV-004': { name: '🤖 之之', modules: ['dingtalk-bot'] },
  'DEV-005': { name: '🍓 小草莓', modules: ['status-board', 'm12-kanban'] },
  'DEV-009': { name: '🌸 花尔', modules: ['m05-user-center'] },
  'DEV-010': { name: '🍊 桔子', modules: ['m06-ticket', 'm11-module', 'ticket-system'] },
  'DEV-011': { name: '✍️ 匆匆那年', modules: [] },
  'DEV-012': { name: '🌟 Awen', modules: ['notification'] },
};

const ACTOR_MAP = {
  'qinfendebingshuo': '冰朔',
  'copilot-swe-agent[bot]': '铸渊 (Copilot)',
};

/* ── 模块 → 开发者 映射 ─────────────────────────── */
const MODULE_TO_DEV = {};
for (const [devId, info] of Object.entries(DEV_MAP)) {
  for (const mod of info.modules) {
    MODULE_TO_DEV[mod] = { devId, name: info.name };
  }
}

/* ── 模块路径 ─────────────────────────── */
const MODULE_PREFIXES = [
  'm01-login', 'm03-personality', 'm05-user-center', 'm06-ticket',
  'm07-dialogue-ui', 'm10-cloud', 'm11-module', 'm12-kanban',
  'm15-cloud-drive', 'm18-health-check', 'dingtalk-bot',
  'backend-integration', 'status-board', 'backend', 'frontend',
  'notification', 'ticket-system', 'cloud-drive',
];

/* ── 冰朔系统相关路径（非模块） ─────────────────────────── */
const SYSTEM_PREFIXES = ['scripts', 'docs', '.github', 'persona-brain-db'];

/* ── 工具函数 ─────────────────────────── */

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return typeof ts === 'string' ? ts.substring(0, Math.min(10, ts.length)) : '—';
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

function formatTimeShort(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '—';
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type) => (parts.find(p => p.type === type) || {}).value || '';
  return `${get('hour')}:${get('minute')}`;
}

function todayDateStr() {
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type) => (parts.find(p => p.type === type) || {}).value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
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

/* ── 读取 memory.json 事件 ─────────────────────────── */

function loadMemoryEvents() {
  const events = [];

  // 主 memory.json (.github/brain/)
  if (fs.existsSync(MEMORY_PATH)) {
    const memory = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
    for (const ev of (memory.events || [])) {
      events.push(ev);
    }
  }

  // persona memory.json (.github/persona-brain/)
  if (fs.existsSync(PERSONA_MEMORY_PATH)) {
    const pm = JSON.parse(fs.readFileSync(PERSONA_MEMORY_PATH, 'utf8'));
    for (const ev of (pm.recent_events || [])) {
      events.push(ev);
    }
  }

  return events;
}

/* ── 公告栏缓存（当日追加式） ─────────────────────────── */

function loadBulletinCache() {
  const today = todayDateStr();
  try {
    if (fs.existsSync(BULLETIN_CACHE_PATH)) {
      const cache = JSON.parse(fs.readFileSync(BULLETIN_CACHE_PATH, 'utf8'));
      if (cache.date === today) {
        return cache;
      }
    }
  } catch (err) {
    console.log(`⚠️  公告栏缓存读取失败: ${err.message}`);
  }
  return { date: today, records: [] };
}

function saveBulletinCache(cache) {
  try {
    fs.writeFileSync(BULLETIN_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.log(`⚠️  公告栏缓存写入失败: ${err.message}`);
  }
}

function appendToCache(cache, newEntries) {
  const existingKeys = new Set(cache.records.map(r => r.key));
  let added = 0;
  for (const e of newEntries) {
    const key = `${e.actor}|${e.module || '—'}|${e.ts || ''}`;
    if (!existingKeys.has(key)) {
      existingKeys.add(key);
      cache.records.push({
        key,
        ts: e.ts,
        actor: e.actor,
        module: e.module || '—',
        result: e.result,
        icon: e.icon,
        sortKey: e.sortKey,
      });
      added++;
    }
  }
  cache.records.sort((a, b) => a.sortKey - b.sortKey);
  return added;
}

/* ── 分类事件为冰朔/合作者 ─────────────────────────── */

function classifyEvents(events) {
  const bingshuoEvents = [];
  const collabEvents = [];

  for (const ev of events) {
    const ts = ev.timestamp || ev.date || '';
    const actor = resolveActor(ev.actor || ev.by || '');
    const type = ev.type || 'event';

    // 冰朔系统级事件
    if (['daily_check', 'daily_selfcheck', 'psp_inspection', 'system_build',
         'brain_upgrade', 'ci_run'].includes(type)) {
      let icon, detail;
      switch (type) {
        case 'daily_check':
          icon = statusIcon(ev.result);
          detail = `每日巡检 ${ev.result === 'passed' ? '✅ 通过' : '❌ 异常'}`;
          break;
        case 'daily_selfcheck':
          icon = '🔍';
          detail = ev.description || '铸渊每日自检完成';
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
        default:
          icon = '📋';
          detail = ev.title || ev.description || type;
      }
      bingshuoEvents.push({
        ts, icon, actor, detail,
        result: ev.result,
        sortKey: new Date(ts || '2000-01-01').getTime(),
      });
    }

    // 模块上传事件 → 合作者
    if (type === 'module_upload') {
      collabEvents.push({
        ts,
        icon: statusIcon(ev.result),
        actor,
        module: ev.module || '未知',
        detail: `${ev.module || '未知'} · ${ev.result === 'passed' || ev.result === 'success' ? '上传成功' : '上传失败'}`,
        result: ev.result,
        sortKey: new Date(ts || '2000-01-01').getTime(),
      });
    }
  }

  return { bingshuoEvents, collabEvents };
}

/* ── 从 GitHub Actions API 获取工作流运行 ─────────────────────────── */

async function fetchRecentWorkflowRuns() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.log('⚠️  GITHUB_TOKEN 或 GITHUB_REPOSITORY 未设置，跳过 API 查询');
    return { bingshuoRuns: [], collabRuns: [] };
  }

  const url = `https://api.github.com/repos/${repo}/actions/runs?per_page=30&status=completed`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!res.ok) {
      console.log(`⚠️  GitHub API 响应 ${res.status}，跳过工作流数据`);
      return { bingshuoRuns: [], collabRuns: [] };
    }
    const data = await res.json();
    const runs = data.workflow_runs || [];

    const bingshuoRuns = [];
    const collabRuns = [];

    // 冰朔关注的系统工作流
    const systemWorkflows = [
      '铸渊 · 每日自检',
      '铸渊 · PSP 分身巡检',
      '铸渊巡检 Agent',
      '更新系统公告区',
      '铸渊 CD · 自动部署',
      'Brain Sync',
      'Notion',
      'SYSLOG',
    ];

    for (const run of runs) {
      const actor = resolveActor(run.actor?.login);
      const conclusion = run.conclusion || 'unknown';
      const icon = statusIcon(conclusion);
      const wfName = run.name || '工作流';
      const resultText = conclusion === 'success' ? '成功' : conclusion === 'failure' ? '失败' : conclusion;

      const entry = {
        ts: run.updated_at || run.created_at,
        icon,
        actor,
        detail: `${wfName} · ${resultText}`,
        result: conclusion,
        sortKey: new Date(run.updated_at || run.created_at).getTime(),
      };

      if (systemWorkflows.some(sw => wfName.includes(sw))) {
        bingshuoRuns.push(entry);
      }

      // 模块相关工作流 → 合作者
      if (wfName.includes('Module Doc') || wfName.includes('模块')) {
        collabRuns.push(entry);
      }
    }

    return { bingshuoRuns, collabRuns };
  } catch (err) {
    console.log(`⚠️  获取工作流数据失败: ${err.message}`);
    return { bingshuoRuns: [], collabRuns: [] };
  }
}

/* ── 从 git 日志检测模块推送 ─────────────────────────── */

function detectRecentModulePushes() {
  const { execSync } = require('child_process');
  const collabEntries = [];
  const bingshuoEntries = [];

  try {
    const log = execSync(
      `git log --oneline --name-only --since="7 days ago" -${MAX_GIT_LOG_COMMITS} 2>/dev/null || true`,
      { encoding: 'utf8', cwd: path.join(__dirname, '..') }
    );

    const lines = log.split('\n');
    let currentCommit = null;
    const moduleChanges = new Map();
    const systemChanges = new Map();

    for (const line of lines) {
      const commitMatch = line.match(/^([a-f0-9]+)\s+(.*)$/);
      if (commitMatch) {
        currentCommit = commitMatch[1];
        continue;
      }

      if (!line.trim()) continue;

      // 模块变更 → 合作者
      for (const prefix of MODULE_PREFIXES) {
        if (line.startsWith(prefix + '/') || line === prefix) {
          if (!moduleChanges.has(prefix)) {
            moduleChanges.set(prefix, currentCommit);
          }
          break;
        }
      }

      // 系统变更 → 冰朔
      for (const prefix of SYSTEM_PREFIXES) {
        if (line.startsWith(prefix + '/') || line === prefix) {
          if (!systemChanges.has(prefix)) {
            systemChanges.set(prefix, currentCommit);
          }
          break;
        }
      }
    }

    // 解析模块变更
    for (const [mod, commit] of moduleChanges) {
      try {
        const info = execSync(
          `git log -1 --format="%aI|%an" ${commit} 2>/dev/null || true`,
          { encoding: 'utf8', cwd: path.join(__dirname, '..') }
        ).trim();
        const [ts, author] = info.split('|');
        const devInfo = MODULE_TO_DEV[mod];
        collabEntries.push({
          ts,
          icon: '📦',
          actor: devInfo ? devInfo.name : (resolveActor(author) || author),
          module: mod,
          detail: `\`${mod}/\` · 更新推送`,
          result: 'success',
          devId: devInfo?.devId || null,
          sortKey: new Date(ts).getTime(),
        });
      } catch (err) {
        console.log(`⚠️  读取模块 ${mod} 提交信息失败: ${err.message}`);
      }
    }

    // 解析系统变更
    for (const [prefix, commit] of systemChanges) {
      try {
        const info = execSync(
          `git log -1 --format="%aI|%an" ${commit} 2>/dev/null || true`,
          { encoding: 'utf8', cwd: path.join(__dirname, '..') }
        ).trim();
        const [ts, author] = info.split('|');
        bingshuoEntries.push({
          ts,
          icon: '🔧',
          actor: resolveActor(author) || author,
          detail: `系统更新: \`${prefix}/\``,
          sortKey: new Date(ts).getTime(),
        });
      } catch (err) {
        console.log(`⚠️  读取系统 ${prefix} 提交信息失败: ${err.message}`);
      }
    }
  } catch (err) {
    console.log(`⚠️  Git 日志读取失败: ${err.message}`);
  }

  return { collabEntries, bingshuoEntries };
}

/* ── 检测需要干预的问题 ─────────────────────────── */

function detectIssues(bingshuoEvents, collabEvents) {
  const bingshuoIssues = [];
  const collabIssuesByDev = {};

  const today = todayDateStr();

  // 检查冰朔的系统问题
  const todayChecks = bingshuoEvents.filter(e =>
    (e.ts || '').startsWith(today) &&
    ['daily_check', 'ci_run', 'psp_inspection', 'daily_selfcheck'].includes(e.type || '')
  );

  // 检查是否有失败的事件
  for (const ev of bingshuoEvents) {
    if (!(ev.ts || '').startsWith(today)) continue;
    if (ev.result === 'failed' || ev.result === 'failure') {
      bingshuoIssues.push(`${ev.icon} ${ev.detail}`);
    }
  }

  // 检查合作者的模块问题
  for (const ev of collabEvents) {
    if (ev.result === 'failed' || ev.result === 'failure') {
      const devId = ev.devId || '未知';
      if (!collabIssuesByDev[devId]) collabIssuesByDev[devId] = [];
      collabIssuesByDev[devId].push(`${ev.icon} ${ev.module || '未知模块'}: ${ev.detail}`);
    }
  }

  // 检查模块结构完整性（README.md 缺失等）
  for (const [devId, info] of Object.entries(DEV_MAP)) {
    for (const mod of info.modules) {
      const modDir = path.join(__dirname, '..', mod);
      if (fs.existsSync(modDir)) {
        const readmePath = path.join(modDir, 'README.md');
        if (!fs.existsSync(readmePath)) {
          if (!collabIssuesByDev[devId]) collabIssuesByDev[devId] = [];
          collabIssuesByDev[devId].push(`⚠️ \`${mod}/\` 缺少 README.md`);
        }
      }
    }
  }

  return { bingshuoIssues, collabIssuesByDev };
}

/* ── 生成冰朔公告表格 ─────────────────────────── */

function buildBingshuoBulletin(entries) {
  const sorted = [...entries].sort((a, b) => b.sortKey - a.sortKey);
  const seen = new Set();
  const unique = [];
  for (const e of sorted) {
    const key = `${e.detail}|${formatTime(e.ts)}`;
    if (!seen.has(key)) { seen.add(key); unique.push(e); }
  }

  const display = unique.slice(0, MAX_BINGSHUO_ENTRIES);
  if (display.length === 0) {
    return '| 时间 | 检查项 | 状态 |\n|------|--------|------|\n| 🕐 暂无记录 | — | 等待下次自检 |';
  }

  const rows = display.map(e =>
    `| ${formatTime(e.ts)} | ${e.icon} ${e.detail} | ${e.actor} |`
  );
  return `| 时间 | 检查项 | 状态 |\n|------|--------|------|\n${rows.join('\n')}`;
}

/* ── 生成冰朔提醒 ─────────────────────────── */

function buildBingshuoAlert(issues) {
  const today = todayDateStr();
  if (issues.length === 0) {
    return `> 🟢 **今日无需冰朔手动干预** · 系统一切正常\n>\n> 🗓️ ${today} · 铸渊自动检测`;
  }

  let alert = `> 🔴 **需要冰朔手动干预！**\n>\n`;
  for (const issue of issues) {
    alert += `> - ${issue}\n`;
  }
  alert += `>\n> 🗓️ ${today} · 铸渊已发送邮件提醒`;
  return alert;
}

/* ── 生成合作者公告表格（追加式，从缓存构建） ─────────────────────────── */

function buildCollabBulletin(cacheRecords) {
  const today = todayDateStr();
  const display = cacheRecords.slice(0, MAX_COLLAB_ENTRIES);
  if (display.length === 0) {
    return `👥 合作者公告栏（${today}）\n\n| 时间 | 合作者 | 模块 | 状态 |\n|------|--------|------|------|\n| 🕐 暂无记录 | — | — | 等待模块推送 |`;
  }

  const rows = display.map(e =>
    `| ${formatTimeShort(e.ts)} | ${e.actor} | \`${e.module || '—'}/\` | ${e.icon} ${e.result === 'success' || e.result === 'passed' ? '上传成功' : e.result === 'failed' || e.result === 'failure' ? '❌ 上传失败' : '已更新'} |`
  );
  return `👥 合作者公告栏（${today}）\n\n| 时间 | 合作者 | 模块 | 状态 |\n|------|--------|------|------|\n${rows.join('\n')}`;
}

/* ── 生成合作者提醒 ─────────────────────────── */

function buildCollabAlert(issuesByDev) {
  const today = todayDateStr();
  const devIds = Object.keys(issuesByDev);

  if (devIds.length === 0) {
    return `> 🟢 **今日无需合作者手动干预** · 所有模块状态正常\n>\n> 🗓️ ${today} · 铸渊自动检测`;
  }

  let alert = `> 🔴 **以下合作者需要手动干预：**\n>\n`;
  for (const devId of devIds) {
    const devName = DEV_MAP[devId]?.name || devId;
    alert += `> **${devName}（${devId}）：**\n`;
    for (const issue of issuesByDev[devId]) {
      alert += `> - ${issue}\n`;
    }
    alert += `>\n`;
  }
  alert += `> 🗓️ ${today} · 铸渊已发送邮件提醒`;
  return alert;
}

/* ── 发送邮件通知（需要 SMTP 配置） ─────────────────────────── */

async function sendEmailNotification(to, subject, body) {
  // 检查是否有 nodemailer 可用
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    console.log('⚠️  nodemailer 未安装，跳过邮件通知');
    return false;
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log('⚠️  SMTP 配置不完整，跳过邮件通知');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host, port, secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"铸渊 · 光湖系统" <${user}>`,
      to,
      subject,
      html: body,
    });

    console.log(`📧 邮件已发送至 ${to}`);
    return true;
  } catch (err) {
    console.log(`⚠️  邮件发送失败: ${err.message}`);
    return false;
  }
}

/* ── 获取用户邮箱（通过 GitHub API） ─────────────────────────── */

async function fetchUserEmail(username) {
  if (!username || !process.env.GITHUB_TOKEN) return null;
  try {
    const res = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.email || null;
  } catch {
    return null;
  }
}

/* ── 发送提醒邮件 ─────────────────────────── */

async function sendAlertEmails(bingshuoIssues, collabIssuesByDev) {
  const today = todayDateStr();

  // 冰朔邮件
  if (bingshuoIssues.length > 0) {
    const bingshuoEmail = process.env.BINGSHUO_EMAIL
      || await fetchUserEmail(BINGSHUO_USERNAME)
      || null;

    if (bingshuoEmail) {
      const issueList = bingshuoIssues.map(i => `<li>${i}</li>`).join('');
      await sendEmailNotification(
        bingshuoEmail,
        `🔴 光湖系统提醒 · ${today} · 需要冰朔干预`,
        `<h2>🔴 铸渊自动提醒</h2>
        <p>以下事项需要冰朔手动处理：</p>
        <ul>${issueList}</ul>
        <p>—— 铸渊（ICE-GL-ZY001）· 光湖系统守护人格</p>`
      );
    }
  }

  // 合作者邮件
  let collaborators = {};
  if (fs.existsSync(COLLABORATORS_PATH)) {
    try {
      collaborators = JSON.parse(fs.readFileSync(COLLABORATORS_PATH, 'utf8'));
    } catch {
      console.log('⚠️  collaborators.json 读取失败');
    }
  }

  for (const [devId, issues] of Object.entries(collabIssuesByDev)) {
    const devName = DEV_MAP[devId]?.name || devId;
    // 查找 GitHub 用户名
    let githubUsername = null;
    if (Array.isArray(collaborators)) {
      const collab = collaborators.find(c => c.dev_id === devId);
      githubUsername = collab?.github_username || null;
    }

    if (githubUsername) {
      const email = await fetchUserEmail(githubUsername);
      if (email) {
        const issueList = issues.map(i => `<li>${i}</li>`).join('');
        await sendEmailNotification(
          email,
          `🔴 光湖系统提醒 · ${today} · ${devName} 需要处理`,
          `<h2>🔴 铸渊自动提醒</h2>
          <p>亲爱的 ${devName}（${devId}），以下事项需要你手动处理：</p>
          <ul>${issueList}</ul>
          <p>请登录 GitHub 仓库查看详情。</p>
          <p>—— 铸渊（ICE-GL-ZY001）· 光湖系统守护人格</p>`
        );
      }
    }
  }
}

/* ── 更新 README.md 指定区域 ─────────────────────────── */

function updateSection(readme, startMarker, endMarker, content) {
  const startIdx = readme.indexOf(startMarker);
  const endIdx = readme.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    console.log(`⚠️  未找到标记 ${startMarker}，跳过`);
    return readme;
  }

  const before = readme.substring(0, startIdx + startMarker.length);
  const after = readme.substring(endIdx);
  return `${before}\n${content}\n${after}`;
}

/* ── README 骨架模板（首页被覆盖时的兜底重建） ─────────────────────────── */

function buildReadmeSkeleton() {
  return `<div align="center">

# 🌊 光湖 HoloLake

**人格语言操作系统（AGE OS）· 壳-核分离架构**

[![Daily Check](https://github.com/qinfendebingshuo/guanghulab/actions/workflows/zhuyuan-daily-selfcheck.yml/badge.svg)](https://github.com/qinfendebingshuo/guanghulab/actions/workflows/zhuyuan-daily-selfcheck.yml)
[![Deploy](https://github.com/qinfendebingshuo/guanghulab/actions/workflows/deploy-to-server.yml/badge.svg)](https://github.com/qinfendebingshuo/guanghulab/actions/workflows/deploy-to-server.yml)

\`guanghulab.com\` · Node.js 20 + Express + PM2 + Nginx

</div>

---

## 🚀 开发者入口

<div align="center">

[![提交系统日志](https://img.shields.io/badge/📡_提交系统日志-点这里-blue?style=for-the-badge)](https://github.com/qinfendebingshuo/guanghulab/issues/new?template=syslog-submit.yml)
[![遇到问题](https://img.shields.io/badge/❓_遇到问题-点这里提问-green?style=for-the-badge)](https://github.com/qinfendebingshuo/guanghulab/issues/new?template=dev-question.yml)

</div>

---

## 📖 系统简介

**光湖（HoloLake）** 是一个基于人格语言操作系统的智能协作平台，采用壳-核分离设计：

| 层级 | 说明 | 包含 |
|------|------|------|
| **壳 Shell** | 前端交互层 | 对话 UI、用户中心、工单系统、云盘、状态看板 |
| **核 Core** | 后端智能层 | 人格引擎、广播分发、信号处理、Notion 桥接、CI/CD |

---

## 🧊 冰朔公告栏

> 🔄 此区域由 GitHub Actions 自动更新，显示系统自检、轮询、数据库状态。

<!-- BINGSHUO_BULLETIN_START -->
| 时间 | 检查项 | 状态 |
|------|--------|------|
| 🕐 暂无记录 | — | 等待下次自检 |
<!-- BINGSHUO_BULLETIN_END -->

### 🤖 铸渊自动提醒

<!-- BINGSHUO_ALERT_START -->
> 🟢 **今日无需冰朔手动干预** · 系统一切正常
<!-- BINGSHUO_ALERT_END -->

---

## 👥 合作者公告栏

> 📦 此区域显示各合作者的模块上传状态。

<!-- COLLABORATOR_BULLETIN_START -->
| 时间 | 合作者 | 模块 | 状态 |
|------|--------|------|------|
| 🕐 暂无记录 | — | — | 等待模块推送 |
<!-- COLLABORATOR_BULLETIN_END -->

### 🤖 铸渊自动提醒 · 合作者

<!-- COLLABORATOR_ALERT_START -->
> 🟢 **今日无需合作者手动干预** · 所有模块状态正常
<!-- COLLABORATOR_ALERT_END -->

---

<div align="center">

**光湖 HoloLake** · 由冰朔创建 · 铸渊守护

*壳-核分离 · 人格共生 · 协作共建*

</div>
`;
}

/* ── 主流程 ─────────────────────────── */

async function main() {
  console.log('🌊 光湖系统公告区更新脚本 v2.0 启动...\n');

  // 1. 收集事件
  const memoryEvents = loadMemoryEvents();
  console.log(`📋 memory 事件: ${memoryEvents.length} 条`);

  const { bingshuoEvents, collabEvents } = classifyEvents(memoryEvents);
  console.log(`🧊 冰朔事件: ${bingshuoEvents.length} 条`);
  console.log(`👥 合作者事件: ${collabEvents.length} 条`);

  // 2. GitHub API 工作流
  const { bingshuoRuns, collabRuns } = await fetchRecentWorkflowRuns();
  console.log(`🔄 冰朔工作流: ${bingshuoRuns.length} 条`);
  console.log(`🔄 合作者工作流: ${collabRuns.length} 条`);

  // 3. Git 日志
  const { collabEntries, bingshuoEntries } = detectRecentModulePushes();
  console.log(`📦 模块推送: ${collabEntries.length} 条`);
  console.log(`🔧 系统更新: ${bingshuoEntries.length} 条`);

  // 4. 合并事件
  const allBingshuo = [...bingshuoEvents, ...bingshuoRuns, ...bingshuoEntries];
  const allCollab = [...collabEvents, ...collabRuns, ...collabEntries];
  console.log(`\n📊 冰朔合计: ${allBingshuo.length} 条`);
  console.log(`📊 合作者合计: ${allCollab.length} 条\n`);

  // 5. 合作者公告栏：追加式缓存
  const cache = loadBulletinCache();
  const addedCount = appendToCache(cache, allCollab);
  saveBulletinCache(cache);
  console.log(`📋 公告栏缓存: ${cache.records.length} 条记录（本次新增 ${addedCount} 条）`);

  // 6. 检测需要干预的问题
  const { bingshuoIssues, collabIssuesByDev } = detectIssues(allBingshuo, allCollab);
  console.log(`🔴 冰朔待处理: ${bingshuoIssues.length} 条`);
  console.log(`🔴 合作者待处理: ${Object.keys(collabIssuesByDev).length} 人\n`);

  // 7. 生成各区域内容
  const bingshuoBulletin = buildBingshuoBulletin(allBingshuo);
  const bingshuoAlert = buildBingshuoAlert(bingshuoIssues);
  const collabBulletin = buildCollabBulletin(cache.records);
  const collabAlert = buildCollabAlert(collabIssuesByDev);

  // 8. 更新 README.md（含自愈检测）
  if (!fs.existsSync(README_PATH)) {
    console.error('❌ README.md 不存在');
    process.exit(1);
  }

  let readme = fs.readFileSync(README_PATH, 'utf8');

  // 🛡️ 首页自愈检测：如果 README 被覆盖（缺少公告栏标记），从 git 历史恢复
  const hasMarkers = Object.values(MARKERS).every(
    ([start, end]) => readme.includes(start) && readme.includes(end)
  );
  if (!hasMarkers) {
    console.log('⚠️ README.md 首页被覆盖！公告栏标记丢失，尝试从 git 历史恢复...');
    const { execSync } = require('child_process');
    try {
      const commits = execSync(
        'git log --all --oneline -- README.md',
        { encoding: 'utf8', cwd: path.join(__dirname, '..') }
      ).trim().split('\n');
      let restored = false;
      for (const line of commits) {
        const sha = line.split(' ')[0];
        try {
          const candidate = execSync(
            `git show ${sha}:README.md`,
            { encoding: 'utf8', cwd: path.join(__dirname, '..') }
          );
          const candidateHasMarkers = Object.values(MARKERS).every(
            ([start, end]) => candidate.includes(start) && candidate.includes(end)
          );
          if (candidateHasMarkers) {
            readme = candidate;
            restored = true;
            console.log(`✅ 从 git 历史 (${sha}) 恢复了 README.md 首页结构`);
            break;
          }
        } catch { /* commit inaccessible or corrupt, skip */ }
      }
      if (!restored) {
        console.log('⚠️ 无法从 git 历史恢复，使用内置骨架模板重建首页');
        readme = buildReadmeSkeleton();
      }
    } catch (err) {
      console.log(`⚠️ git 历史查询失败 (${err.message})，使用内置骨架模板重建首页`);
      readme = buildReadmeSkeleton();
    }
  }

  readme = updateSection(readme, MARKERS.bingshuoBulletin[0], MARKERS.bingshuoBulletin[1], bingshuoBulletin);
  readme = updateSection(readme, MARKERS.bingshuoAlert[0], MARKERS.bingshuoAlert[1], bingshuoAlert);
  readme = updateSection(readme, MARKERS.collabBulletin[0], MARKERS.collabBulletin[1], collabBulletin);
  readme = updateSection(readme, MARKERS.collabAlert[0], MARKERS.collabAlert[1], collabAlert);

  const original = fs.readFileSync(README_PATH, 'utf8');
  if (readme === original) {
    console.log('ℹ️  公告区内容无变化，跳过写入');
  } else {
    fs.writeFileSync(README_PATH, readme, 'utf8');
    console.log('✅ README.md 公告区已更新');
  }

  // 9. 发送邮件（如有需要）
  if (bingshuoIssues.length > 0 || Object.keys(collabIssuesByDev).length > 0) {
    await sendAlertEmails(bingshuoIssues, collabIssuesByDev);
  }

  console.log('\n📢 公告区更新完成！');
}

main().catch(err => {
  console.error('❌ 脚本执行失败:', err);
  process.exit(1);
});
