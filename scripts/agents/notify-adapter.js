// scripts/agents/notify-adapter.js
// Notify Adapter · 通知适配器
// ZY-P1-ESC-002 · Phase 1 · Escalation System
// 版权：国作登字-2026-A-00037559

'use strict';

const https = require('https');

// ── 通知目标映射 ─────────────────────────────────────────────────────────
const TARGETS = {
  'DEV-002-肥猫': '@qinfendebingshuo',
  'TCS-0002∞-冰朔': '@qinfendebingshuo'
};

/**
 * 格式化通知内容 · 转为 markdown
 * @param {string} target - 通知目标 ID
 * @param {{ type: string, description: string }} issue
 * @returns {string} markdown 格式的通知
 */
function formatNotification(target, issue) {
  const mention = TARGETS[target] || target;
  const now = new Date().toISOString();

  return [
    `## 🔔 升级通知`,
    '',
    `**目标**: ${mention}`,
    `**类型**: ${issue.type || '未知'}`,
    `**描述**: ${issue.description || '无描述'}`,
    `**来源**: ${issue.source || '系统自动检测'}`,
    `**时间**: ${now}`,
    '',
    '---',
    '_由铸渊升级路由器自动生成_'
  ].join('\n');
}

/**
 * 发送通知
 * @param {string} target - 通知目标 ID
 * @param {{ type: string, description: string }} issue
 * @returns {Promise<{ target: string, channel: string, messageId: string, timestamp: string }>}
 */
async function notify(target, issue) {
  const timestamp = new Date().toISOString();
  const content = formatNotification(target, issue);
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY || 'qinfendebingshuo/guanghulab';

  if (!token) {
    // 无 token 时回退到控制台输出
    console.log(`\n📢 通知（控制台模式）:\n${content}\n`);
    return {
      target,
      channel: 'console',
      messageId: `console-${Date.now()}`,
      timestamp
    };
  }

  // 通过 GitHub Issues API 创建 issue
  const [owner, repoName] = repo.split('/');
  const body = JSON.stringify({
    title: `🔔 [${issue.type}] ${issue.description || '升级通知'}`,
    body: content,
    labels: ['escalation', issue.type || 'unknown']
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repoName}/issues`,
      method: 'POST',
      headers: {
        'User-Agent': 'zhuyuan-notify-adapter',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            target,
            channel: 'github_issue',
            messageId: `issue-${parsed.number || 'unknown'}`,
            timestamp
          });
        } catch (e) {
          resolve({
            target,
            channel: 'github_issue',
            messageId: `issue-error`,
            timestamp
          });
        }
      });
    });

    req.on('error', () => {
      resolve({
        target,
        channel: 'github_issue_failed',
        messageId: `error-${Date.now()}`,
        timestamp
      });
    });

    req.write(body);
    req.end();
  });
}

// ── CLI 入口 ─────────────────────────────────────────────────────────────
if (require.main === module) {
  console.log('📢 Notify Adapter · 通知适配器\n');
  const formatted = formatNotification('DEV-002-肥猫', {
    type: 'test_persistent_fail',
    description: '持续性测试失败'
  });
  console.log(formatted);
}

module.exports = { notify, formatNotification, TARGETS };
