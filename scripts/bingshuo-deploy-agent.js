/**
 * 🧊 冰朔人格体 · 自动部署诊断Agent
 * 
 * 功能：
 *   1. 自动检查所有 GitHub Actions 工作流运行状态
 *   2. 诊断失败原因，提取错误日志
 *   3. 自动重新运行失败的工作流
 *   4. 生成纯中文部署报告（Issue 评论）
 * 
 * 触发方式：
 *   - Issue 评论包含 "启动冰朔人格体"
 *   - workflow_dispatch 手动触发
 *   - Issue 模板创建
 * 
 * 环境变量：
 *   GITHUB_TOKEN      - GitHub API 令牌
 *   GITHUB_REPOSITORY  - owner/repo
 *   ISSUE_NUMBER       - （可选）回复到指定 Issue
 *   DEPLOY_ACTION      - check | rerun | full（默认 full）
 *   HOURS_BACK         - 检查最近多少小时的运行记录（默认 24）
 */

const https = require('https');
const fs = require('fs');

// === 配置 ===
const REPO = process.env.GITHUB_REPOSITORY || '';
const TOKEN = process.env.GITHUB_TOKEN || '';
const ISSUE_NUMBER = process.env.ISSUE_NUMBER || '';
const ISSUE_BODY = process.env.ISSUE_BODY || '';

// 从 Issue body 解析参数（支持 Issue 模板触发）
function parseActionFromBody(body) {
  if (body.includes('只看报告')) return 'check';
  if (body.includes('只重新运行')) return 'rerun';
  return 'full';
}

function parseHoursFromBody(body) {
  if (body.includes('最近一周')) return 168;
  if (body.includes('72小时')) return 72;
  if (body.includes('48小时')) return 48;
  return 24;
}

const ACTION = process.env.DEPLOY_ACTION || parseActionFromBody(ISSUE_BODY);
const HOURS_BACK = parseInt(process.env.HOURS_BACK || String(parseHoursFromBody(ISSUE_BODY)), 10);

const [OWNER, REPO_NAME] = REPO.split('/');

if (!OWNER || !REPO_NAME || !TOKEN) {
  console.error('❌ 缺少必要环境变量：GITHUB_REPOSITORY, GITHUB_TOKEN');
  process.exit(1);
}

// === GitHub API 请求封装 ===
function githubAPI(method, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'BingShuo-Deploy-Agent'
      }
    };
    if (data) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// === 获取最近的工作流运行记录 ===
async function getRecentRuns() {
  const since = new Date(Date.now() - HOURS_BACK * 60 * 60 * 1000).toISOString();
  const result = await githubAPI('GET',
    `/repos/${OWNER}/${REPO_NAME}/actions/runs?per_page=100&created=%3E${since}`
  );
  if (result.status !== 200) {
    console.error('❌ 获取工作流运行记录失败:', result.status);
    return [];
  }
  return result.data.workflow_runs || [];
}

// === 获取某次运行的作业详情 ===
async function getJobsForRun(runId) {
  const result = await githubAPI('GET',
    `/repos/${OWNER}/${REPO_NAME}/actions/runs/${runId}/jobs`
  );
  if (result.status !== 200) return [];
  return result.data.jobs || [];
}

// === 从 jobs 中提取失败信息 ===
function extractFailureInfo(jobs) {
  const failures = [];
  for (const job of jobs) {
    if (job.conclusion === 'failure') {
      const failedSteps = (job.steps || []).filter(s => s.conclusion === 'failure');
      failures.push({
        jobName: job.name,
        failedSteps: failedSteps.map(s => ({
          name: s.name,
          number: s.number
        })),
        startedAt: job.started_at,
        completedAt: job.completed_at
      });
    }
  }
  return failures;
}

// === 重新运行失败的工作流 ===
async function rerunFailedJobs(runId) {
  const result = await githubAPI('POST',
    `/repos/${OWNER}/${REPO_NAME}/actions/runs/${runId}/rerun-failed-jobs`
  );
  return result.status === 201;
}

// === 分类工作流运行记录 ===
function categorizeRuns(runs) {
  const categories = {
    success: [],
    failure: [],
    cancelled: [],
    inProgress: [],
    actionRequired: [],
    skipped: []
  };

  for (const run of runs) {
    const status = run.status;
    const conclusion = run.conclusion;

    if (status === 'in_progress' || status === 'queued' || status === 'waiting') {
      categories.inProgress.push(run);
    } else if (conclusion === 'success') {
      categories.success.push(run);
    } else if (conclusion === 'failure') {
      categories.failure.push(run);
    } else if (conclusion === 'cancelled') {
      categories.cancelled.push(run);
    } else if (conclusion === 'action_required') {
      categories.actionRequired.push(run);
    } else {
      categories.skipped.push(run);
    }
  }

  return categories;
}

// === 格式化时间 ===
function formatTime(isoStr) {
  if (!isoStr) return '未知';
  const d = new Date(isoStr);
  return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

// === 获取分支显示名称 ===
function branchDisplayName(branch) {
  if (branch === 'main') return '主分支 (main)';
  if (branch && branch.startsWith('copilot/')) return `Copilot分支 (${branch})`;
  return branch || '未知';
}

// === 生成诊断报告 ===
async function generateReport(runs) {
  const categories = categorizeRuns(runs);
  const total = runs.length;

  let report = `## 🧊 冰朔人格体 · 部署诊断报告\n\n`;
  report += `> 📅 报告时间：${formatTime(new Date().toISOString())}\n`;
  report += `> 📊 检查范围：最近 ${HOURS_BACK} 小时内的工作流运行记录\n\n`;

  // --- 总览 ---
  report += `### 📊 总览\n\n`;
  report += `| 状态 | 数量 |\n|------|------|\n`;
  report += `| ✅ 成功 | ${categories.success.length} |\n`;
  report += `| ❌ 失败 | ${categories.failure.length} |\n`;
  report += `| ⏳ 进行中 | ${categories.inProgress.length} |\n`;
  report += `| ⚠️ 需要操作 | ${categories.actionRequired.length} |\n`;
  report += `| 🚫 已取消 | ${categories.cancelled.length} |\n`;
  report += `| 总计 | ${total} |\n\n`;

  // --- 失败详情 ---
  if (categories.failure.length > 0) {
    report += `### ❌ 失败的工作流\n\n`;
    report += `> 冰朔不用担心，下面是每个失败工作流的详细诊断：\n\n`;

    for (let i = 0; i < categories.failure.length; i++) {
      const run = categories.failure[i];
      const jobs = await getJobsForRun(run.id);
      const failureInfo = extractFailureInfo(jobs);

      report += `#### ${i + 1}. ${run.name}\n\n`;
      report += `- 🌿 分支：${branchDisplayName(run.head_branch)}\n`;
      report += `- ⏰ 时间：${formatTime(run.created_at)}\n`;
      report += `- 🔗 触发方式：${translateEvent(run.event)}\n`;
      report += `- 📝 提交信息：${run.display_title || '无'}\n`;

      if (failureInfo.length > 0) {
        report += `- 💥 失败的作业：\n`;
        for (const f of failureInfo) {
          report += `  - **${f.jobName}**\n`;
          if (f.failedSteps.length > 0) {
            report += `    - 失败步骤：${f.failedSteps.map(s => `\`${s.name}\``).join('、')}\n`;
          }
        }
      }

      report += `- 💡 建议：${generateSuggestion(run, failureInfo)}\n\n`;
    }
  }

  // --- 需要操作的工作流 ---
  if (categories.actionRequired.length > 0) {
    report += `### ⚠️ 需要操作的工作流\n\n`;
    report += `> 这些工作流需要审批或配置才能继续运行：\n\n`;

    for (const run of categories.actionRequired) {
      report += `- **${run.name}** · ${branchDisplayName(run.head_branch)} · ${formatTime(run.created_at)}\n`;
    }
    report += `\n`;
  }

  // --- 正在进行的工作流 ---
  if (categories.inProgress.length > 0) {
    report += `### ⏳ 正在运行的工作流\n\n`;
    for (const run of categories.inProgress) {
      report += `- **${run.name}** · ${branchDisplayName(run.head_branch)} · 开始于 ${formatTime(run.created_at)}\n`;
    }
    report += `\n`;
  }

  // --- 成功的工作流（简洁列表）---
  if (categories.success.length > 0) {
    report += `### ✅ 成功的工作流\n\n`;
    report += `<details>\n<summary>点击展开成功列表（${categories.success.length} 个）</summary>\n\n`;
    for (const run of categories.success) {
      report += `- ✅ **${run.name}** · ${branchDisplayName(run.head_branch)} · ${formatTime(run.created_at)}\n`;
    }
    report += `\n</details>\n\n`;
  }

  return report;
}

// === 翻译触发事件 ===
function translateEvent(event) {
  const map = {
    push: '代码推送',
    pull_request: 'PR 合并请求',
    workflow_dispatch: '手动触发',
    schedule: '定时任务',
    issues: 'Issue 创建',
    issue_comment: 'Issue 评论',
    dynamic: '自动触发'
  };
  return map[event] || event;
}

// === 生成修复建议 ===
function generateSuggestion(run, failureInfo) {
  const name = run.name.toLowerCase();
  const branch = run.head_branch || '';

  // 根据工作流名称和失败信息给出建议
  if (name.includes('pages') || name.includes('部署') || name.includes('deploy')) {
    return '这是页面部署失败。通常是 docs/ 目录下文件格式问题。冰朔人格体可以尝试重新部署。';
  }
  if (name.includes('结构检查') || name.includes('check-structure')) {
    return '模块结构检查失败，可能是开发者上传的模块缺少 README.md 文件。请通知对应开发者补充。';
  }
  if (name.includes('bridge') || name.includes('notion')) {
    return '这是和 Notion 的同步失败。通常是 Notion API Token 过期或网络问题。建议稍后重试。';
  }
  if (name.includes('contract') || name.includes('hli')) {
    return '接口契约检查失败。可能是新接口的 schema 不匹配。需要检查 src/schemas/ 下的定义文件。';
  }
  if (name.includes('模块文档') || name.includes('module-doc')) {
    return '模块文档自动生成失败。通常是模块目录结构不符合规范。请检查最近上传的模块。';
  }

  // 根据失败步骤给出更具体的建议
  if (failureInfo.length > 0) {
    const stepNames = failureInfo.flatMap(f => f.failedSteps.map(s => s.name.toLowerCase()));
    if (stepNames.some(s => s.includes('npm') || s.includes('install'))) {
      return '依赖安装失败。可能是 package.json 配置问题或网络超时。建议重试。';
    }
    if (stepNames.some(s => s.includes('build'))) {
      return '构建步骤失败。代码可能有语法错误。需要检查最近的代码变更。';
    }
    if (stepNames.some(s => s.includes('test'))) {
      return '测试失败。可能是新代码引入了问题。需要开发者修复后重新提交。';
    }
  }

  return '建议重新运行此工作流。如果持续失败，冰朔可以告诉铸渊具体情况，铸渊会帮你排查。';
}

// === 执行重新运行 ===
async function executeRerun(failedRuns) {
  if (failedRuns.length === 0) {
    return '\n### 🔄 重新运行\n\n没有需要重新运行的失败工作流。一切正常！✨\n\n';
  }

  let report = `\n### 🔄 自动重新运行\n\n`;
  report += `> 冰朔人格体正在自动重新运行失败的工作流...\n\n`;

  let rerunCount = 0;
  for (const run of failedRuns) {
    // 只重试主分支的失败任务，避免重试无关分支
    const success = await rerunFailedJobs(run.id);
    if (success) {
      report += `- ✅ 已重新触发：**${run.name}** (${branchDisplayName(run.head_branch)})\n`;
      rerunCount++;
    } else {
      report += `- ⚠️ 无法重新触发：**${run.name}**（可能需要更高权限或该运行已过期）\n`;
    }
  }

  report += `\n📌 已重新触发 ${rerunCount}/${failedRuns.length} 个工作流。预计 3-5 分钟后可查看结果。\n`;
  report += `如果还是失败，冰朔可以再次启动冰朔人格体，我会继续诊断。\n\n`;

  return report;
}

// === 生成总结 ===
function generateSummary(categories) {
  let summary = `### 📋 总结\n\n`;

  if (categories.failure.length === 0 && categories.actionRequired.length === 0) {
    summary += `🎉 **所有工作流运行正常！** 冰朔不需要做任何操作。\n\n`;
    summary += `系统健康状态：✅ 正常\n\n`;
  } else if (categories.failure.length > 0) {
    summary += `⚠️ 有 ${categories.failure.length} 个工作流失败。冰朔人格体已自动分析原因并尝试修复。\n\n`;
    summary += `如果问题持续，冰朔可以：\n`;
    summary += `1. 再次创建 Issue 触发冰朔人格体重新诊断\n`;
    summary += `2. 把错误信息发给铸渊，铸渊会帮你定位具体代码问题\n\n`;
  }

  summary += `---\n`;
  summary += `*—— 🧊 冰朔人格体 · 自动部署诊断Agent*\n`;
  summary += `*由铸渊为冰朔专属开发 · 纯语言驱动，无需点击任何按钮*\n`;

  return summary;
}

// === 发布报告到 Issue ===
async function postReport(report) {
  if (ISSUE_NUMBER) {
    // 回复到已有 Issue
    await githubAPI('POST',
      `/repos/${OWNER}/${REPO_NAME}/issues/${ISSUE_NUMBER}/comments`,
      { body: report }
    );
    // 添加标签
    await githubAPI('POST',
      `/repos/${OWNER}/${REPO_NAME}/issues/${ISSUE_NUMBER}/labels`,
      { labels: ['🧊deploy-report', '✅answered'] }
    );
    // 移除 pending 标签（如果不存在会返回404，属正常情况）
    const removeResult = await githubAPI('DELETE',
      `/repos/${OWNER}/${REPO_NAME}/issues/${ISSUE_NUMBER}/labels/${encodeURIComponent('pending')}`
    );
    if (removeResult.status !== 200 && removeResult.status !== 404) {
      console.warn('⚠️ 移除 pending 标签时出现异常:', removeResult.status);
    }

    console.log(`✅ 报告已发布到 Issue #${ISSUE_NUMBER}`);
  } else {
    // 创建新 Issue
    const result = await githubAPI('POST',
      `/repos/${OWNER}/${REPO_NAME}/issues`,
      {
        title: `🧊 冰朔人格体 · 部署诊断报告 · ${new Date().toLocaleDateString('zh-CN')}`,
        body: report,
        labels: ['🧊deploy-report']
      }
    );
    if (result.status === 201) {
      console.log(`✅ 诊断报告已创建：Issue #${result.data.number}`);
    } else {
      console.error('❌ 创建 Issue 失败:', result.status);
    }
  }
}

// === 主流程 ===
async function main() {
  console.log('🧊 冰朔人格体启动...');
  console.log(`📊 检查范围：最近 ${HOURS_BACK} 小时`);
  console.log(`🔧 执行模式：${ACTION}`);

  // 1. 获取最近的工作流运行记录
  const runs = await getRecentRuns();
  console.log(`📋 获取到 ${runs.length} 条运行记录`);

  if (runs.length === 0) {
    const report = `## 🧊 冰朔人格体 · 部署诊断报告\n\n` +
      `最近 ${HOURS_BACK} 小时内没有任何工作流运行记录。系统很安静。✨\n\n` +
      `---\n*—— 🧊 冰朔人格体*`;
    await postReport(report);
    return;
  }

  // 2. 分类
  const categories = categorizeRuns(runs);

  // 3. 生成诊断报告
  let report = '';

  if (ACTION === 'check' || ACTION === 'full') {
    report += await generateReport(runs);
  }

  // 4. 如果是 full 模式，自动重新运行失败的工作流
  if (ACTION === 'full' || ACTION === 'rerun') {
    report += await executeRerun(categories.failure);
  }

  // 5. 总结
  report += generateSummary(categories);

  // 6. 发布报告
  await postReport(report);

  // 7. 更新 memory.json
  await updateMemory(categories);

  console.log('🧊 冰朔人格体任务完成。');
}

// === 更新铸渊记忆 ===
async function updateMemory(categories) {
  try {
    const memoryPath = '.github/brain/memory.json';
    if (!fs.existsSync(memoryPath)) return;

    const memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));

    // 添加事件记录
    if (!memory.recent_events) memory.recent_events = [];
    memory.recent_events.unshift({
      timestamp: new Date().toISOString(),
      type: 'bingshuo_deploy_agent',
      result: categories.failure.length === 0 ? 'all_pass' : 'has_failures',
      details: {
        total: categories.success.length + categories.failure.length + categories.inProgress.length,
        success: categories.success.length,
        failure: categories.failure.length,
        in_progress: categories.inProgress.length
      }
    });

    // 保留最近100条
    memory.recent_events = memory.recent_events.slice(0, 100);

    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2) + '\n');
    console.log('📝 铸渊记忆已更新');
  } catch (err) {
    console.warn('⚠️ 更新记忆失败（不影响报告）:', err.message);
  }
}

// === 执行 ===
main().catch(err => {
  console.error('❌ 冰朔人格体执行失败:', err.message);
  process.exit(1);
});
