/**
 * ━━━ 实时进度上报模块 ━━━
 * 文件位置：scripts/pipeline-reporter.js
 *
 * 每完成一步，在 Issue 评论区发一条新评论，开发者刷新即可看到实时进度。
 *
 * 使用方式（CLI）：
 *   ISSUE_NUMBER=92 STEP_NUM=2 STEP_NAME="解析内容" STEP_STATUS=ok \
 *   STEP_DETAIL="广播编号: BC-M22-007-AW" GITHUB_TOKEN=xxx \
 *   node scripts/pipeline-reporter.js
 *
 * 或在 Node.js 中 require：
 *   const { reportStep, reportComplete } = require('./pipeline-reporter');
 */

const https = require('https');

const OWNER = process.env.GITHUB_REPOSITORY
  ? process.env.GITHUB_REPOSITORY.split('/')[0]
  : 'qinfendebingshuo';
const REPO = process.env.GITHUB_REPOSITORY
  ? process.env.GITHUB_REPOSITORY.split('/')[1]
  : 'guanghulab';

/**
 * 发送 GitHub API 请求
 */
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
        'User-Agent': 'Zhuyuan-Pipeline-Reporter',
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

/**
 * 每完成一步，在 Issue 评论区发一条新评论
 * @param {number} issueNumber - Issue 编号
 * @param {number} stepNum - 步骤编号（1-8）
 * @param {string} stepName - 步骤名称
 * @param {'ok'|'error'|'skip'} status - 步骤状态
 * @param {string} detail - 详情说明
 */
async function reportStep(issueNumber, stepNum, stepName, status, detail) {
  const icon = status === 'ok' ? '✅' : status === 'error' ? '❌' : '⏭️';
  const statusText = status === 'ok' ? '已完成' : status === 'error' ? '失败' : '跳过';

  const body = [
    `${icon} **步骤 ${stepNum}/8 · ${stepName}** · ${statusText}`,
    '',
    detail,
    '',
    `——铸渊（ICE-GL-ZY001）· ${new Date().toISOString()}`
  ].join('\n');

  await githubAPI('POST', `/repos/${OWNER}/${REPO}/issues/${issueNumber}/comments`, { body });
}

/**
 * 闭环完成时发最终汇总
 * @param {number} issueNumber - Issue 编号
 * @param {boolean} success - 是否全部成功
 * @param {string} summary - 汇总内容
 */
async function reportComplete(issueNumber, success, summary) {
  const icon = success ? '🎉' : '⚠️';
  const title = success ? '闭环处理完成' : '闭环处理异常';

  const body = [
    `## ${icon} ${title}`,
    '',
    summary,
    '',
    success
      ? '> 新广播已生成，结果将发送到您的邮箱。'
      : '> 部分步骤异常，已记录日志。冰朔会在下次巡检时处理。',
    '',
    `——铸渊（ICE-GL-ZY001）· ${new Date().toISOString()}`
  ].join('\n');

  await githubAPI('POST', `/repos/${OWNER}/${REPO}/issues/${issueNumber}/comments`, { body });
}

// ━━━ CLI 模式：直接 node scripts/pipeline-reporter.js ━━━
if (require.main === module) {
  const issueNumber = parseInt(process.env.ISSUE_NUMBER);
  const stepNum = parseInt(process.env.STEP_NUM);
  const stepName = process.env.STEP_NAME || '';
  const status = process.env.STEP_STATUS || 'ok';
  const detail = process.env.STEP_DETAIL || '';
  const isComplete = process.env.REPORT_COMPLETE === 'true';
  const isSuccess = process.env.REPORT_SUCCESS !== 'false';

  if (!issueNumber) {
    console.error('❌ 缺少 ISSUE_NUMBER');
    process.exit(1);
  }

  (async () => {
    try {
      if (isComplete) {
        await reportComplete(issueNumber, isSuccess, detail);
        console.log(`📋 闭环汇总已发送 · Issue #${issueNumber}`);
      } else {
        await reportStep(issueNumber, stepNum, stepName, status, detail);
        console.log(`📋 步骤 ${stepNum}/8 · ${stepName} · ${status} 已上报 · Issue #${issueNumber}`);
      }
    } catch (err) {
      console.error(`⚠️ 进度上报失败: ${err.message}`);
      // 上报失败不应阻断管道
      process.exit(0);
    }
  })();
}

module.exports = { reportStep, reportComplete };
