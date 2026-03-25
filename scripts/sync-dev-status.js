/**
 * sync-dev-status.js
 * 从 Notion 主控台同步 dev-status.json 到 GitHub 仓库
 * 机制：霜砚签发制 v1.0 (shuangyan-signed-v1.0)
 * 指令溯源：ZY-DEVSYNC-REBUILD-2026-0325-001
 *
 * 使用方式：
 *   NOTION_TOKEN=xxx DEV_STATUS_DB_ID=xxx node scripts/sync-dev-status.js
 *
 * 如果 Notion 环境变量不可用，将基于本地文件刷新 last_sync 时间戳
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const DEV_STATUS_PATH = path.join('.github', 'persona-brain', 'dev-status.json');
const ROOT_STATUS_PATH = 'dev-status.json';

const NOTION_TOKEN = process.env.NOTION_TOKEN || '';
const DEV_STATUS_DB_ID = process.env.DEV_STATUS_DB_ID || '';

const INSTRUCTION_REF = 'ZY-DEVSYNC-REBUILD-2026-0325-001';
const SYNC_MECHANISM = 'shuangyan-signed-v1.0';

// ── Notion API 请求封装 ──
function notionRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.notion.com',
      path: `/v1/${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

    const req = https.request(options, (res) => {
      let result = '';
      res.on('data', (chunk) => result += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(result) });
        } catch {
          resolve({ status: res.statusCode, data: result });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── 从 Notion 数据库查询开发者状态 ──
async function fetchDevStatusFromNotion() {
  if (!NOTION_TOKEN || !DEV_STATUS_DB_ID) {
    console.log('⚠️ NOTION_TOKEN 或 DEV_STATUS_DB_ID 未配置，跳过 Notion 同步');
    return null;
  }

  console.log('📡 正在从 Notion 查询开发者状态...');

  const response = await notionRequest('POST', `databases/${DEV_STATUS_DB_ID}/query`, {
    sorts: [{ property: '编号', direction: 'ascending' }],
  });

  if (response.status !== 200) {
    console.error(`❌ Notion API 返回 ${response.status}:`, JSON.stringify(response.data).slice(0, 500));
    return null;
  }

  const pages = response.data.results || [];
  if (pages.length === 0) {
    console.log('⚠️ Notion 数据库为空，跳过同步');
    return null;
  }

  console.log(`✅ 从 Notion 获取到 ${pages.length} 条开发者记录`);

  // 解析 Notion 页面属性为 dev-status 格式（霜砚签发制格式）
  const team = pages.map(page => {
    const props = page.properties || {};
    const syslogProp = props['最后SYSLOG'];
    const lastSyslog = getNotionDate(syslogProp) || getNotionText(syslogProp);
    return {
      dev_id: getNotionText(props['编号']) || getNotionTitle(props['Name']) || '',
      name: getNotionText(props['昵称']) || getNotionTitle(props['Name']) || '',
      module: getNotionText(props['当前模块']) || '',
      status: mapNotionStatus(getNotionSelect(props['状态'])),
      current_task: getNotionText(props['当前广播']) || getNotionText(props['当前进度']) || '',
      streak: getNotionNumber(props['连胜']) || 0,
      waiting_for: getNotionText(props['等待项']) || null,
      last_syslog: lastSyslog || null,
      alert: computeAlert(lastSyslog),
    };
  }).filter(d => d.dev_id);

  return team;
}

// ── 根据 last_syslog 计算告警级别 ──
function computeAlert(lastSyslog) {
  if (!lastSyslog) return null;
  try {
    const last = new Date(lastSyslog);
    if (isNaN(last.getTime())) return null;
    const diffHours = (Date.now() - last.getTime()) / (1000 * 60 * 60);
    if (diffHours > 168) return 'over_7d';
    if (diffHours > 72) return 'over_72h';
    return null;
  } catch {
    return null;
  }
}

// ── Notion 属性解析辅助函数 ──
function getNotionText(prop) {
  if (!prop) return '';
  if (prop.type === 'rich_text') return (prop.rich_text || []).map(t => t.plain_text).join('');
  if (prop.type === 'title') return (prop.title || []).map(t => t.plain_text).join('');
  return '';
}

function getNotionTitle(prop) {
  if (!prop) return '';
  if (prop.type === 'title') return (prop.title || []).map(t => t.plain_text).join('');
  return '';
}

function getNotionSelect(prop) {
  if (!prop || prop.type !== 'select') return '';
  return prop.select?.name || '';
}

function getNotionNumber(prop) {
  if (!prop || prop.type !== 'number') return 0;
  return prop.number || 0;
}

function getNotionDate(prop) {
  if (!prop || prop.type !== 'date') return '';
  return prop.date?.start || '';
}

function mapNotionStatus(status) {
  const map = {
    '活跃': 'active',
    '等待SYSLOG': 'waiting_syslog',
    '等待广播': 'waiting_broadcast',
    '暂停': 'paused',
    '已毕业': 'graduated',
  };
  return map[status] || status || 'active';
}

// ── 生成汇总信息 ──
function generateSummary(team) {
  const activeCount = team.filter(d => d.status === 'active').length;
  const waitingSyslog = team.filter(d => d.status === 'waiting_syslog').length;
  const topStreakDev = team.length > 0
    ? team.reduce((max, d) => d.streak > max.streak ? d : max, team[0])
    : null;
  const alerts = team
    .filter(d => d.alert || (d.waiting_for && typeof d.waiting_for === 'string' && d.waiting_for.includes('⚠️')))
    .map(d => {
      if (d.alert === 'over_7d') return `${d.dev_id} ${d.name}: 超7天未回执`;
      if (d.alert === 'over_72h') return `${d.dev_id} ${d.name}: 超72h未回执`;
      return `${d.dev_id} ${d.name}: ${d.waiting_for}`;
    });

  return {
    total_devs: team.length,
    active_waiting_syslog: waitingSyslog,
    active_normal: activeCount,
    top_streak: topStreakDev ? `${topStreakDev.dev_id} ${topStreakDev.name} ${topStreakDev.streak}连胜` : '无',
    alerts,
  };
}

// ── 计算签名哈希 ──
function computeSignatureHash(developers) {
  const devJson = JSON.stringify(developers);
  const hash = crypto.createHash('sha256').update(devJson).digest('hex');
  return `sha256:${hash}`;
}

// ── 主流程 ──
async function main() {
  const now = new Date();
  const bjTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const timestamp = bjTime.toISOString().replace('Z', '+08:00');
  const syncDate = timestamp.split('T')[0];

  console.log('═══ dev-status.json 同步 · 霜砚签发制 v1.0 ═══');
  console.log(`同步时间：${timestamp}`);

  // 读取当前状态
  let currentStatus = {};
  try {
    currentStatus = JSON.parse(fs.readFileSync(DEV_STATUS_PATH, 'utf8'));
  } catch {
    console.log('⚠️ 当前 dev-status.json 不存在或格式错误，将创建新文件');
  }

  // 尝试从 Notion 获取数据
  const notionTeam = await fetchDevStatusFromNotion();

  let team;
  if (notionTeam) {
    // Notion 同步成功
    team = notionTeam;
    console.log(`✅ Notion 同步成功 · ${notionTeam.length} 位开发者`);
  } else {
    // Notion 不可用时，保持现有数据
    console.log('📌 Notion 不可用，保留当前数据，更新同步时间戳');
    team = currentStatus.developers || currentStatus.team || [];
  }

  // 组装霜砚签发包
  const signatureHash = computeSignatureHash(team);

  const syncPackage = {
    // ─── 签发元数据 ───
    signed_by: 'AG-SY-01',
    signed_at: timestamp,
    sync_date: syncDate,
    instruction_ref: INSTRUCTION_REF,

    // ─── 同步元数据 ───
    last_sync: timestamp,
    sync_source: notionTeam ? 'notion-mastercontrol-v3' : (currentStatus.sync_source || 'local-refresh'),
    sync_mechanism: SYNC_MECHANISM,

    // ─── 团队数据 ───
    team_count: team.length,
    developers: team,

    // ─── 汇总 ───
    summary: generateSummary(team),

    // ─── 签名校验 ───
    signature_hash: signatureHash,
  };

  // 写入 persona-brain 版本
  fs.writeFileSync(DEV_STATUS_PATH, JSON.stringify(syncPackage, null, 2) + '\n');
  console.log(`✅ 已写入 ${DEV_STATUS_PATH}`);

  // 同步写入根目录版本
  fs.writeFileSync(ROOT_STATUS_PATH, JSON.stringify(syncPackage, null, 2) + '\n');
  console.log(`✅ 已写入 ${ROOT_STATUS_PATH}`);

  // 输出摘要
  const summary = syncPackage.summary;
  console.log('\n📊 团队状态摘要:');
  console.log(`   总开发者: ${summary.total_devs}`);
  console.log(`   等待SYSLOG: ${summary.active_waiting_syslog}`);
  console.log(`   最高连胜: ${summary.top_streak}`);
  console.log(`   签名哈希: ${signatureHash.slice(0, 19)}...`);
  if (summary.alerts?.length > 0) {
    console.log(`   ⚠️ 告警: ${summary.alerts.length} 条`);
    summary.alerts.forEach(a => console.log(`      - ${a}`));
  }

  console.log(`\n✅ dev-status.json 同步完成 · 霜砚签发制 v1.0 · ${timestamp}`);
}

main().catch(err => {
  console.error('❌ 同步失败:', err.message);
  process.exit(1);
});
