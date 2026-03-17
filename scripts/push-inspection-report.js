/**
 * scripts/push-inspection-report.js
 * 铸渊巡检报告推送脚本
 *
 * 将巡检报告推送到两个 Notion 工作空间的工单库：
 * - 冰朔空间（零点原核）
 * - 之之空间（明天见频道）
 *
 * 同时在仓库 Issue 区更新固定标题的巡检公告。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const BRAIN_DIR = path.join(ROOT, '.github/persona-brain');
const REPORT_PATH = path.join(BRAIN_DIR, 'inspection-report.json');

const NOTION_TOKEN_BINGSUO = process.env.NOTION_TOKEN_BINGSUO;
const NOTION_TOKEN_ZHIZHI = process.env.NOTION_TOKEN_ZHIZHI;
const WORKORDER_DB_BINGSUO = process.env.WORKORDER_DB_BINGSUO;
const WORKORDER_DB_ZHIZHI = process.env.WORKORDER_DB_ZHIZHI;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY || 'qinfendebingshuo/guanghulab';

const today = new Date().toISOString().split('T')[0];

console.log(`📤 巡检报告推送开始 · ${today}`);

// ── Notion API helper ─────────────────────────────────────────────────────

function notionRequest(token, method, urlPath, body) {
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'api.notion.com',
      path: urlPath,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
    };
    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
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
      console.error(`  ⚠️ Notion API 请求失败: ${err.message}`);
      resolve({ statusCode: 0, data: null });
    });
    if (body) req.write(postData);
    req.end();
  });
}

// ── GitHub API helper ─────────────────────────────────────────────────────

function githubApi(urlPath, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'api.github.com',
      path: urlPath,
      method: method,
      headers: {
        'User-Agent': 'zhuyuan-inspection-report',
        'Accept': 'application/vnd.github.v3+json',
      },
    };
    if (GITHUB_TOKEN) {
      options.headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
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
      console.error(`  ⚠️ GitHub API 请求失败: ${err.message}`);
      resolve({ statusCode: 0, data: null });
    });
    if (body) req.write(postData);
    req.end();
  });
}

// ── 生成报告 Markdown ─────────────────────────────────────────────────────

function generateReportMarkdown(report) {
  const lines = [];
  lines.push(`# [铸渊公告栏] 每日人格体签到报告`);
  lines.push(`📅 日期: ${report.date}`);
  lines.push(`📊 总计: ${report.summary.total} | ✅ 已签到: ${report.summary.checked_in} | ❌ 缺席: ${report.summary.missing}`);
  lines.push('');

  // 已签到列表
  lines.push('## ✅ 已签到小兵');
  if (report.checked_in && report.checked_in.length > 0) {
    lines.push('| Agent ID | 名称 |');
    lines.push('|----------|------|');
    for (const agent of report.checked_in) {
      lines.push(`| ${agent.agent_id} | ${agent.agent_name} |`);
    }
  } else {
    lines.push('无');
  }
  lines.push('');

  // 缺席列表
  lines.push('## ❌ 缺席小兵');
  if (report.missing_agents && report.missing_agents.length > 0) {
    lines.push('| Agent ID | 名称 |');
    lines.push('|----------|------|');
    for (const agent of report.missing_agents) {
      lines.push(`| ${agent.agent_id} | ${agent.agent_name} |`);
    }
  } else {
    lines.push('无');
  }
  lines.push('');

  // 自修复情况
  lines.push('## 🔧 自修复情况');
  if (report.auto_repaired && report.auto_repaired.length > 0) {
    lines.push('| Agent ID | 名称 | 操作 | 结果 |');
    lines.push('|----------|------|------|------|');
    for (const agent of report.auto_repaired) {
      lines.push(`| ${agent.agent_id} | ${agent.agent_name} | ${agent.action} | ${agent.result} |`);
    }
  } else {
    lines.push('无需自修复');
  }
  lines.push('');

  // 需要干预
  lines.push('## 📌 需要之之干预');
  if (report.intervention_required && report.intervention_required.length > 0) {
    lines.push('| Agent ID | 名称 | 原因 |');
    lines.push('|----------|------|------|');
    for (const agent of report.intervention_required) {
      lines.push(`| ${agent.agent_id} | ${agent.agent_name} | ${agent.reason} |`);
    }
  } else {
    lines.push('全部正常，无需干预 🎉');
  }
  lines.push('');

  lines.push(`---`);
  lines.push(`> 报告由铸渊自动生成 · ${new Date().toISOString()}`);

  return lines.join('\n');
}

// ── 推送到 Notion ─────────────────────────────────────────────────────────

async function pushToNotion(token, dbId, report, target) {
  if (!token || !dbId) {
    console.log(`  ⚠️ ${target}: 缺少 Notion Token 或 DB ID，跳过推送`);
    return;
  }

  const body = {
    parent: { database_id: dbId },
    properties: {
      '标题': {
        title: [{ text: { content: report.title } }],
      },
      '类型': {
        select: { name: '巡检报告' },
      },
      '日期': {
        date: { start: report.date },
      },
    },
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: {
              content: `已签到: ${report.summary.checked_in} / 缺席: ${report.summary.missing} / 自修复: ${report.summary.auto_repaired} / 需干预: ${report.summary.needs_intervention}`,
            },
          }],
        },
      },
    ],
  };

  const result = await notionRequest(token, 'POST', '/v1/pages', body);
  if (result.statusCode === 200 || result.statusCode === 201) {
    console.log(`  ✅ ${target}: 工单推送成功`);
  } else {
    console.log(`  ⚠️ ${target}: 工单推送失败 (HTTP ${result.statusCode})`);
  }
}

// ── 更新 GitHub Issue ─────────────────────────────────────────────────────

async function updateIssue(report) {
  if (!GITHUB_TOKEN) {
    console.log('  ⚠️ 缺少 GITHUB_TOKEN，跳过 Issue 更新');
    return;
  }

  const issueTitle = '[铸渊公告栏] 每日人格体签到报告';
  const body = generateReportMarkdown(report);

  // 搜索已存在的 Issue
  const searchResult = await githubApi(
    `/repos/${REPO}/issues?state=open&labels=${encodeURIComponent('铸渊公告栏')}&per_page=10`
  );

  let existingIssue = null;
  if (searchResult.data && Array.isArray(searchResult.data)) {
    existingIssue = searchResult.data.find(i => i.title === issueTitle);
  }

  if (existingIssue) {
    // 更新现有 Issue
    const updateResult = await githubApi(
      `/repos/${REPO}/issues/${existingIssue.number}`,
      'PATCH',
      { body: body }
    );
    if (updateResult.statusCode === 200) {
      console.log(`  ✅ Issue #${existingIssue.number} 已更新`);
    } else {
      console.log(`  ⚠️ Issue 更新失败 (HTTP ${updateResult.statusCode})`);
    }
  } else {
    // 创建新 Issue
    const createResult = await githubApi(
      `/repos/${REPO}/issues`,
      'POST',
      {
        title: issueTitle,
        body: body,
        labels: ['铸渊公告栏'],
      }
    );
    if (createResult.statusCode === 201) {
      console.log(`  ✅ Issue #${createResult.data.number} 已创建`);
    } else {
      console.log(`  ⚠️ Issue 创建失败 (HTTP ${createResult.statusCode})`);
    }
  }
}

// ── 主流程 ────────────────────────────────────────────────────────────────

async function main() {
  // 读取巡检报告
  if (!fs.existsSync(REPORT_PATH)) {
    console.error('❌ inspection-report.json 不存在，请先运行巡检脚本');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));

  // 推送到冰朔空间（零点原核）
  console.log('\n📤 推送到冰朔空间（零点原核）...');
  await pushToNotion(NOTION_TOKEN_BINGSUO, WORKORDER_DB_BINGSUO, report, '零点原核');

  // 推送到之之空间（明天见频道）
  console.log('\n📤 推送到之之空间（明天见频道）...');
  await pushToNotion(NOTION_TOKEN_ZHIZHI, WORKORDER_DB_ZHIZHI, report, '明天见频道');

  // 更新 GitHub Issue
  console.log('\n📤 更新 GitHub Issue 公告栏...');
  await updateIssue(report);

  console.log(`\n✅ 巡检报告推送完成`);
}

main().catch((err) => {
  console.error('❌ 推送脚本异常:', err.message);
  process.exit(1);
});
