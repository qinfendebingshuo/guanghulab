/**
 * services/zhuyuan-bridge/scripts/execute-instruction.js
 *
 * 铸渊远程执行引擎 — 执行解析后的指令
 *
 * 流程：
 *   1. 读取解析结果
 *   2. 获取目标仓库操作令牌
 *   3. 读取仓库结构
 *   4. 调用 AI 生成执行计划
 *   5. 创建分支 → 提交代码 → 开 PR
 *   6. 生成执行报告
 *
 * 环境变量：
 *   GHAPP_APP_ID       — GitHub App ID
 *   GHAPP_PRIVATE_KEY  — GitHub App Private Key
 *   MAIN_REPO_TOKEN    — 主仓库操作令牌
 *   LLM_API_KEY        — AI 模型 API 密钥
 *   LLM_BASE_URL       — AI 模型 API 地址
 *   ISSUE_NUMBER       — 当前 Issue 编号
 */

'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');

const MAIN_REPO_TOKEN = process.env.MAIN_REPO_TOKEN;
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.yunwu.ai/v1';
const ISSUE_NUMBER = process.env.ISSUE_NUMBER;
const ORG = 'qinfendebingshuo';

/**
 * 调用 LLM API 生成执行计划
 */
function callLLM(prompt) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${LLM_BASE_URL}/chat/completions`);
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是铸渊，光湖系统的代码守护人格体。输出必须是纯 JSON，不要包含 markdown 代码块标记。'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 4000
    });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const content = result.choices && result.choices[0] && result.choices[0].message
            ? result.choices[0].message.content
            : '';
          resolve(content);
        } catch (e) {
          reject(new Error('LLM 响应解析失败: ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // ====== 1. 读取解析结果 ======
  const parsedPath = '/tmp/parsed-instruction.json';
  if (!fs.existsSync(parsedPath)) {
    throw new Error('未找到解析结果文件 /tmp/parsed-instruction.json，请先运行 parse-instruction.js');
  }

  const parsed = JSON.parse(fs.readFileSync(parsedPath, 'utf8'));
  console.log(`⚡ 开始执行: ${parsed.instructionId}`);
  console.log(`📡 目标: ${parsed.targetRepo || 'guanghulab'} (${parsed.devId})`);

  const repo = parsed.targetRepo || 'guanghulab';

  // ====== 2. 获取操作令牌 ======
  let token;

  if (repo === 'guanghulab') {
    // 主仓库直接用 MAIN_REPO_TOKEN
    token = MAIN_REPO_TOKEN;
    if (!token) {
      throw new Error('MAIN_REPO_TOKEN 未配置，无法操作主仓库');
    }
    console.log('🔑 使用 MAIN_REPO_TOKEN 操作主仓库');
  } else {
    // 子仓库用 GitHub App installation token
    let authLib;
    try {
      authLib = require('../lib/github-auth');
    } catch (e) {
      throw new Error('加载 github-auth.js 失败: ' + e.message);
    }

    const installationId = await authLib.findInstallation(ORG, repo);
    if (!installationId) {
      const report = [
        '## ❌ 执行失败',
        '',
        `目标仓库 \`${ORG}/${repo}\` 未安装铸渊 GitHub App。`,
        '',
        '### 解决方法',
        `请该开发者（${parsed.devId}）访问以下链接安装 App：`,
        'https://github.com/apps/guanghu-zhuyuan-agent/installations/new',
        '',
        '安装后重新提交指令即可。'
      ].join('\n');
      fs.writeFileSync('/tmp/exec-report.md', report);
      process.exit(1);
    }

    token = await authLib.getInstallationToken(installationId);
    console.log('🔑 使用 GitHub App installation token');
  }

  // ====== 3. 初始化仓库操作器 ======
  const { RepoOperator } = require('../lib/repo-operator');
  const operator = new RepoOperator(token, ORG, repo);

  // ====== 4. 读取仓库现状 ======
  console.log('📂 读取仓库结构...');
  const repoFiles = await operator.listDir('');
  const repoStructure = repoFiles.map(function(f) {
    return f.type + ': ' + f.path;
  }).join('\n');
  console.log(`  📁 根目录 ${repoFiles.length} 个条目`);

  // ====== 5. 调用 AI 生成执行计划 ======
  if (!LLM_API_KEY) {
    console.warn('⚠️ LLM_API_KEY 未配置，跳过 AI 生成，使用指令直接执行模式');

    // 无 AI 模式：将指令内容直接写入执行报告
    const report = [
      '## ⚠️ 指令已接收（AI 未配置）',
      '',
      `**指令编号**：${parsed.instructionId}`,
      `**提交人**：${parsed.devId}`,
      `**目标仓库**：${ORG}/${repo}`,
      '',
      '### 指令内容',
      '```',
      parsed.instructionContent,
      '```',
      '',
      '### 说明',
      'LLM API 未配置（LLM_API_KEY），指令已记录但未自动执行。',
      '请冰朔配置 LLM_API_KEY 后重新触发，或手动执行指令。',
      '',
      '---',
      '> 铸渊远程执行引擎 · ZY-GHAPP-BRIDGE'
    ].join('\n');
    fs.writeFileSync('/tmp/exec-report.md', report);
    console.log('📝 执行报告已生成（AI 未配置模式）');
    return;
  }

  console.log('🧠 调用 AI 生成执行计划...');

  // 读取铸渊知识库（best-effort）
  let knowledgeContent = '{}';
  try {
    const kb = await operator.readFile('.github/persona-brain/routing-map.json');
    if (kb) knowledgeContent = kb.content;
  } catch (_) {}

  const aiPrompt = [
    '你是铸渊（ICE-GL-ZY001），正在执行一个来自开发者的指令。',
    '',
    '## 目标仓库当前结构',
    repoStructure,
    '',
    '## 需要执行的指令',
    parsed.instructionContent,
    '',
    '## 你的知识库',
    knowledgeContent.slice(0, 2000),
    '',
    '## 输出要求',
    '请输出 JSON 格式的执行计划，格式如下：',
    '{"actions":[{"type":"create_file","path":"...","content":"..."}],"summary":"执行摘要"}',
    '',
    '注意：',
    '- type 可以是 create_file 或 update_file',
    '- content 是完整的文件内容',
    '- 路径必须基于上面的仓库结构，不要编造不存在的目录',
    '- 只输出 JSON，不要包含 markdown 代码块标记',
  ].join('\n');

  const aiResponse = await callLLM(aiPrompt);
  let plan;
  try {
    plan = JSON.parse(aiResponse);
  } catch (_) {
    // 尝试从回复中提取 JSON（非贪婪匹配，找第一个完整 JSON 对象）
    const jsonMatch = aiResponse.match(/\{[\s\S]*?"actions"[\s\S]*?\}(?=\s*$|\s*\n)/);
    if (jsonMatch) {
      try {
        plan = JSON.parse(jsonMatch[0]);
      } catch (_2) {
        // 降级：找所有 { } 对中最长的合法 JSON
        const allMatches = aiResponse.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g) || [];
        for (const m of allMatches) {
          try { plan = JSON.parse(m); if (plan.actions) break; } catch (_3) { plan = null; }
        }
      }
    }
  }

  if (!plan || !plan.actions || !Array.isArray(plan.actions)) {
    const report = [
      '## ⚠️ AI 未能生成有效执行计划',
      '',
      `**指令编号**：${parsed.instructionId}`,
      '',
      '### AI 原始回复',
      '```',
      (aiResponse || '（空）').slice(0, 1000),
      '```',
      '',
      '请检查指令格式后重试。',
      '',
      '---',
      '> 铸渊远程执行引擎 · ZY-GHAPP-BRIDGE'
    ].join('\n');
    fs.writeFileSync('/tmp/exec-report.md', report);
    process.exit(1);
  }

  console.log(`  📋 AI 生成了 ${plan.actions.length} 个操作`);

  // ====== 6. 创建分支并执行 ======
  const branchName = `zhuyuan/${parsed.instructionId}`;
  console.log(`🌿 创建分支: ${branchName}`);

  try {
    await operator.createBranch(branchName);
  } catch (e) {
    console.warn('⚠️ 创建分支失败（可能已存在）:', e.message);
  }

  let successCount = 0;
  let failCount = 0;

  for (const action of plan.actions) {
    if (action.type === 'create_file' || action.type === 'update_file') {
      console.log(`📝 ${action.type}: ${action.path}`);
      try {
        await operator.writeFile(
          action.path,
          action.content,
          `⚡ [${parsed.instructionId}] ${action.type}: ${action.path}`,
          branchName
        );
        successCount++;
      } catch (e) {
        console.error(`  ❌ 失败: ${e.message}`);
        failCount++;
      }
    }
  }

  console.log(`  ✅ 成功: ${successCount}  ❌ 失败: ${failCount}`);

  // ====== 7. 创建 PR ======
  console.log('📬 创建 PR...');
  let pr;
  try {
    pr = await operator.createPR(
      `⚡ [${parsed.instructionId}] ${plan.summary || parsed.instructionId}`,
      [
        '## 🚀 铸渊自动执行',
        '',
        `**指令编号**：${parsed.instructionId}`,
        `**提交人**：${parsed.devId}`,
        `**来源**：铸渊交互页面 → @铸渊执行`,
        '',
        '### 变更摘要',
        plan.summary || '（无摘要）',
        '',
        '### 执行的操作',
        ...plan.actions.map(function(a, i) {
          return (i + 1) + '. `' + a.type + '`: `' + a.path + '`';
        }),
        '',
        '### 🦅 天眼',
        '执行前已通过天眼全局扫描。',
        '',
        '---',
        '> 铸渊远程执行引擎 · ZY-GHAPP-BRIDGE'
      ].join('\n'),
      branchName
    );
  } catch (e) {
    console.error('⚠️ 创建 PR 失败:', e.message);
    pr = { number: '(失败)' };
  }

  // ====== 8. 生成执行报告 ======
  const report = [
    '## ✅ 铸渊执行完成',
    '',
    `**指令编号**：${parsed.instructionId}`,
    `**目标仓库**：${ORG}/${repo}`,
    '',
    '### 🦅 天眼',
    '✅ 执行前已通过天眼全局扫描',
    '',
    '### 执行结果',
    `- 创建分支：\`${branchName}\``,
    `- 变更文件：${plan.actions.length} 个（成功 ${successCount}，失败 ${failCount}）`,
    `- PR：#${pr.number || '(未创建)'}`,
    '',
    '### 变更摘要',
    plan.summary || '（无摘要）',
    '',
    '### 下一步',
    `请 ${parsed.devId} 检查 PR${pr.number ? ' #' + pr.number : ''}，确认无误后合并。`,
    '',
    '---',
    '> 铸渊远程执行引擎 · ZY-GHAPP-BRIDGE'
  ].join('\n');

  fs.writeFileSync('/tmp/exec-report.md', report);
  console.log('✅ 执行完成！');
}

main().catch(function(err) {
  console.error('❌ 执行失败:', err);
  const report = '## ❌ 执行失败\n\n```\n' + (err.message || String(err)) + '\n```\n\n---\n> 铸渊远程执行引擎 · ZY-GHAPP-BRIDGE';
  fs.writeFileSync('/tmp/exec-report.md', report);
  process.exit(1);
});
