/**
 * services/zhuyuan-bridge/scripts/parse-instruction.js
 *
 * 解析 Issue 中的铸渊执行指令
 * 从 Issue 标题和正文中提取：DEV 编号、目标仓库、指令内容
 *
 * 环境变量：
 *   ISSUE_BODY   — Issue 正文
 *   ISSUE_TITLE  — Issue 标题
 *
 * 输出：
 *   /tmp/parsed-instruction.json — 解析后的指令 JSON
 *   GitHub Actions outputs（通过 GITHUB_OUTPUT）
 */

'use strict';

const fs = require('fs');
const path = require('path');

const issueBody = process.env.ISSUE_BODY || '';
const issueTitle = process.env.ISSUE_TITLE || '';

console.log('📋 开始解析执行指令...');
console.log(`  标题: ${issueTitle}`);
console.log(`  正文长度: ${issueBody.length} 字符`);

// ===== 解析 DEV 编号 =====
const devMatch = issueBody.match(/DEV-\d{3}/);
const devId = devMatch ? devMatch[0] : null;

// ===== 解析目标仓库 =====
const repoMatch = issueBody.match(/目标仓库[：:]\s*(\S+)/);
const targetRepo = repoMatch ? repoMatch[1] : null;

// ===== 解析指令编号 =====
const instrMatch = issueTitle.match(/\[(ZY-EXEC[^\]]*)\]/);
const instructionId = instrMatch ? instrMatch[1] : null;

// ===== 提取指令内容（在 ``` 代码块之间） =====
const codeBlockMatch = issueBody.match(/```[\s\S]*?\n([\s\S]*?)```/);
const instructionContent = codeBlockMatch ? codeBlockMatch[1].trim() : '';

const parsed = {
  instructionId: instructionId || 'ZY-EXEC-UNKNOWN',
  devId,
  targetRepo,
  instructionContent,
  issueTitle,
  parsedAt: new Date().toISOString()
};

console.log('\n📋 解析结果：');
console.log(JSON.stringify(parsed, null, 2));

// ===== 写入临时文件供后续步骤使用 =====
fs.writeFileSync('/tmp/parsed-instruction.json', JSON.stringify(parsed, null, 2));

// ===== 写入 GitHub Actions outputs =====
const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  const outputs = [
    `instruction_id=${parsed.instructionId}`,
    `dev_id=${parsed.devId || ''}`,
    `target_repo=${parsed.targetRepo || ''}`,
  ].join('\n') + '\n';
  fs.appendFileSync(outputFile, outputs);
}

// ===== 验证指令格式 =====
if (!devId) {
  console.error('❌ 指令格式不合法：缺少 DEV 编号（格式：DEV-XXX）');
  process.exit(1);
}

if (!instructionContent) {
  console.error('❌ 指令格式不合法：缺少指令内容（需要在 ``` 代码块中）');
  process.exit(1);
}

console.log('\n✅ 指令解析完成');
