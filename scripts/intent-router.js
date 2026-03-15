/**
 * ━━━ 意图路由模块 ━━━
 * 文件位置：scripts/intent-router.js
 *
 * 解析用户在 Issue 评论中 @铸渊 的意图，路由到对应处理逻辑。
 * 用于替换原来的「无脑倒全部数据」行为。
 */

const https = require('https');
const fs = require('fs');

/**
 * 解析用户在 Issue 评论中 @铸渊 的意图
 * @param {string} commentBody - 评论原文
 * @returns {object} 意图对象
 */
function parseIntent(commentBody) {
  // 去掉 @铸渊 前缀，提取核心内容
  const content = commentBody.replace(/@铸渊[，,]?\s*/g, '').trim();

  // 意图1：查询某个 Issue 的闭环状态
  // 匹配：「查询#92闭环状态」「#92进度」「Issue 92 状态」「闭环状态」等
  const issueMatch = content.match(/#(\d+)/);
  if (issueMatch && /闭环|状态|进度|处理/.test(content)) {
    return {
      type: 'check_pipeline_status',
      issueNumber: parseInt(issueMatch[1]),
      raw: content
    };
  }

  // 意图2：查询某个开发者的状态
  // 匹配：「DEV-004状态」「之之进度」「查询肥猫」
  const devMatch = content.match(/DEV-(\d+)|页页|肥猫|燕樊|之之|小草莓|花尔|桔子|匆匆那年|Awen|小兴|时雨/);
  if (devMatch && /状态|进度|查询/.test(content)) {
    return {
      type: 'check_dev_status',
      devId: devMatch[0],
      raw: content
    };
  }

  // 意图3：团队总览（显式请求）
  // 匹配：「团队状态」「全部进度」「总览」
  if (/团队|全部|总览|所有人/.test(content)) {
    return {
      type: 'team_overview',
      raw: content
    };
  }

  // 意图4：未识别 → 返回 unknown
  return {
    type: 'unknown',
    raw: content
  };
}

/**
 * 查询 Issue 闭环管道状态（通过评论历史）
 * @param {number} issueNumber - 要查询的 Issue 编号
 * @returns {string} 格式化的状态回复
 */
async function checkPipelineStatus(issueNumber) {
  const [owner, repo] = (process.env.GITHUB_REPOSITORY || 'qinfendebingshuo/guanghulab').split('/');

  // 获取该 Issue 的评论历史
  let comments;
  try {
    comments = await githubAPI('GET',
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`);
  } catch (e) {
    return `📋 **Issue #${issueNumber} 闭环状态查询**\n\n` +
      `查询失败: ${e.message}\n` +
      `请确认 Issue 编号是否正确。`;
  }

  if (!Array.isArray(comments) || comments.length === 0) {
    return `📋 **Issue #${issueNumber} 闭环状态查询**\n\n` +
      `未找到该 Issue 的评论记录。\n` +
      `可能原因：该 Issue 不存在或没有任何评论。`;
  }

  // 筛选铸渊的进度评论（包含「步骤 X/8」的）
  const progressComments = comments.filter(c =>
    c.body && c.body.includes('步骤') && c.body.includes('/8') && c.body.includes('铸渊')
  );

  // 检查是否有闭环完成汇总
  const completeComment = comments.find(c =>
    c.body && (c.body.includes('闭环处理完成') || c.body.includes('闭环处理异常'))
  );

  if (progressComments.length === 0 && !completeComment) {
    // 检查是否有旧版静态进度表格
    const staticTable = comments.find(c =>
      c.body && c.body.includes('管道运行') && c.body.includes('等待中')
    );

    if (staticTable) {
      return `📋 **Issue #${issueNumber} 闭环状态查询**\n\n` +
        `⏳ 管道已启动但后续步骤未上报进度。\n` +
        `可能原因：管道处理脚本未触发，或中间步骤出错。\n\n` +
        `> 建议检查 Actions 运行日志。`;
    }

    return `📋 **Issue #${issueNumber} 闭环状态查询**\n\n` +
      `未找到该 Issue 的闭环进度记录。\n` +
      `可能原因：闭环尚未启动，或该 Issue 不是 SYSLOG 提交。`;
  }

  // 有进度评论：提取最新状态
  if (completeComment) {
    const isSuccess = completeComment.body.includes('闭环处理完成');
    const hasFailed = comments.some(c => c.body && c.body.includes('❌'));

    return `📋 **Issue #${issueNumber} 闭环状态**\n\n` +
      `${isSuccess && !hasFailed ? '✅ 闭环已完成' : '⚠️ 闭环有步骤异常'}\n` +
      `进度评论数: ${progressComments.length} 条\n` +
      `最后更新: ${completeComment.created_at}`;
  }

  // 进行中
  const lastProgress = progressComments[progressComments.length - 1];
  const stepMatch = lastProgress.body.match(/步骤 (\d+)\/8/);
  const lastStep = stepMatch ? parseInt(stepMatch[1]) : 0;
  const hasFailed = progressComments.some(c => c.body.includes('❌'));

  let statusLine;
  if (hasFailed) {
    statusLine = '❌ 闭环有步骤失败（详见该 Issue 下各步骤评论）';
  } else {
    statusLine = `⏳ 闭环进行中 · 已完成到步骤 ${lastStep}/8`;
  }

  return `📋 **Issue #${issueNumber} 闭环状态**\n\n` +
    `${statusLine}\n` +
    `进度评论数: ${progressComments.length} 条\n` +
    `最后更新: ${lastProgress.created_at}`;
}

/**
 * 查询指定开发者的状态
 * @param {string} devIdOrName - DEV-XXX 或开发者昵称
 * @param {object} devStatus - dev-status.json 数据
 * @returns {string} 格式化的状态回复
 */
function checkDevStatus(devIdOrName, devStatus) {
  const team = devStatus.team_status || devStatus.team || [];
  const dev = team.find(d =>
    d.dev_id === devIdOrName ||
    d.name === devIdOrName ||
    (d.dev_id && d.dev_id.toUpperCase() === devIdOrName.toUpperCase())
  );

  if (!dev) {
    return `未找到开发者 ${devIdOrName} 的记录。`;
  }

  const modules = dev.modules
    ? dev.modules.join('、')
    : (dev.module || '未知');

  return `📊 **${dev.dev_id} ${dev.name} · 当前状态**\n\n` +
    `- 📌 模块: ${modules}\n` +
    `- 📊 状态: ${dev.status}\n` +
    `- ⏳ 等待中: ${dev.waiting_for || dev.waiting || '无'}\n` +
    `- 👉 下一步: ${dev.next_step || dev.current || '无'}\n` +
    `- 🔥 连胜: ${dev.streak || 0}`;
}

/**
 * 团队总览
 * @param {object} devStatus - dev-status.json 数据
 * @returns {string} 格式化的总览
 */
function formatTeamOverview(devStatus) {
  const team = devStatus.team_status || devStatus.team || [];
  let reply = `## ⚒️ 铸渊回复 · 团队进度总览\n\n`;
  team.forEach(dev => {
    reply += `**${dev.dev_id} ${dev.name}** · ${dev.status}\n`;
  });
  reply += `\n---\n*最后同步：${devStatus.last_synced || devStatus.last_sync}*`;
  return reply;
}

/**
 * 生成「未识别意图」的帮助提示
 * @returns {string}
 */
function unknownIntentHelp() {
  return `🤔 我没理解你的问题。你可以试试：\n\n` +
    `- \`@铸渊 查询#92闭环状态\` — 查某个 SYSLOG 提交的处理进度\n` +
    `- \`@铸渊 DEV-004状态\` — 查某个开发者的进度\n` +
    `- \`@铸渊 团队总览\` — 查所有人的状态`;
}

// ━━━ GitHub API 工具 ━━━
function githubAPI(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Zhuyuan-Intent-Router',
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(responseBody)); }
          catch (e) { console.error('⚠️ JSON parse error:', e.message); resolve(responseBody); }
        } else {
          reject(new Error(`GitHub API ${res.statusCode}: ${responseBody.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = {
  parseIntent,
  checkPipelineStatus,
  checkDevStatus,
  formatTeamOverview,
  unknownIntentHelp
};
