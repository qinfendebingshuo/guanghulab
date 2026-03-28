#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// scripts/chat-to-agent-bridge.js
// 🌉 Chat-to-Agent Bridge (CAB) · 语言层 → 副驾驶桥接引擎
//
// 功能：
//   --create   创建新的开发授权任务规格
//   --list     列出所有待执行任务
//   --complete 标记任务为已完成并归档
//   --validate 验证任务规格格式
//   --issue    生成 Issue 内容（供工作流使用）

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PENDING_DIR = path.join(ROOT, 'bridge', 'chat-to-agent', 'pending');
const COMPLETED_DIR = path.join(ROOT, 'bridge', 'chat-to-agent', 'completed');
const TEMPLATE_PATH = path.join(ROOT, 'bridge', 'chat-to-agent', 'task-template.json');

// ── 任务ID生成 ──────────────────────────────────
function generateTaskId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

  // 查找当天已有的任务编号
  const existingFiles = [];
  for (const dir of [PENDING_DIR, COMPLETED_DIR]) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter(f => f.startsWith(`CAB-${dateStr}`));
      existingFiles.push(...files);
    }
  }

  const maxSeq = existingFiles.reduce((max, f) => {
    const match = f.match(/CAB-\d{8}-(\d{3})/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);

  const seq = String(maxSeq + 1).padStart(3, '0');
  return `CAB-${dateStr}-${seq}`;
}

// ── 任务规格验证 ─────────────────────────────────
function validateTaskSpec(spec) {
  const errors = [];

  if (!spec.task_id || !/^CAB-\d{8}-\d{3}$/.test(spec.task_id)) {
    errors.push('task_id 格式错误，应为 CAB-YYYYMMDD-NNN');
  }
  if (!spec.authorization || spec.authorization.sovereign !== '冰朔 · TCS-0002∞') {
    errors.push('authorization.sovereign 必须为 "冰朔 · TCS-0002∞"');
  }
  if (!spec.development_plan || !spec.development_plan.title) {
    errors.push('development_plan.title 不能为空');
  }
  if (!spec.development_plan || !spec.development_plan.steps || spec.development_plan.steps.length === 0) {
    errors.push('development_plan.steps 不能为空');
  }

  return { valid: errors.length === 0, errors };
}

// ── 创建任务规格 ─────────────────────────────────
function createTask(opts) {
  const template = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
  const taskId = generateTaskId();
  const now = new Date().toISOString();

  const spec = {
    ...template,
    cab_version: '1.0',
    task_id: taskId,
    created_at: now,
    created_by: 'TCS-0002∞',
    status: 'pending',
    authorization: {
      ...template.authorization,
      confirmation: false
    },
    development_plan: {
      ...template.development_plan,
      title: opts.title || '',
      description: opts.description || '',
      steps: opts.steps || [],
      priority: opts.priority || 'normal',
      estimated_scope: opts.scope || 'small'
    },
    reasoning_context: {
      chat_summary: opts.chatSummary || '',
      key_decisions: opts.decisions || [],
      architecture_notes: opts.archNotes || ''
    }
  };

  const filePath = path.join(PENDING_DIR, `${taskId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(spec, null, 2), 'utf8');

  console.log(`✅ 任务规格已创建: ${taskId}`);
  console.log(`   文件: ${filePath}`);
  console.log(`   标题: ${spec.development_plan.title || '(未填写)'}`);
  console.log(`   步骤: ${spec.development_plan.steps.length} 步`);
  console.log('');
  console.log('📋 下一步：');
  console.log('   1. 编辑任务规格文件，填写完整信息');
  console.log('   2. 确认无误后提交到仓库');
  console.log('   3. 桥接工作流将自动创建开发授权 Issue');

  return spec;
}

// ── 列出待执行任务 ───────────────────────────────
function listTasks() {
  if (!fs.existsSync(PENDING_DIR)) {
    console.log('📭 无待执行任务');
    return [];
  }

  const files = fs.readdirSync(PENDING_DIR).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('📭 无待执行任务');
    return [];
  }

  console.log(`📋 待执行任务 (${files.length} 个)：`);
  console.log('─'.repeat(60));

  const tasks = [];
  for (const file of files) {
    const spec = JSON.parse(fs.readFileSync(path.join(PENDING_DIR, file), 'utf8'));
    tasks.push(spec);
    const confirmed = spec.authorization?.confirmation ? '✅已授权' : '⏳待授权';
    console.log(`  ${spec.task_id} | ${confirmed} | ${spec.development_plan?.title || '(无标题)'}`);
    if (spec.development_plan?.steps?.length) {
      console.log(`    └─ ${spec.development_plan.steps.length} 个步骤 · ${spec.development_plan.priority || 'normal'} 优先级`);
    }
  }

  return tasks;
}

// ── 完成任务并归档 ───────────────────────────────
function completeTask(taskId, result) {
  const srcPath = path.join(PENDING_DIR, `${taskId}.json`);

  if (!fs.existsSync(srcPath)) {
    console.error(`❌ 任务不存在: ${taskId}`);
    process.exit(1);
  }

  const spec = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  spec.status = 'completed';
  spec.completion = {
    completed_at: new Date().toISOString(),
    result: result || 'success',
    pr_number: null,
    files_changed: []
  };

  const destPath = path.join(COMPLETED_DIR, `${taskId}.json`);
  fs.writeFileSync(destPath, JSON.stringify(spec, null, 2), 'utf8');
  fs.unlinkSync(srcPath);

  console.log(`✅ 任务已归档: ${taskId}`);
  console.log(`   从: pending/ → completed/`);

  return spec;
}

// ── 生成 Issue 内容 ──────────────────────────────
function generateIssueContent(taskId) {
  let specPath = path.join(PENDING_DIR, `${taskId}.json`);

  if (!fs.existsSync(specPath)) {
    // 尝试在pending目录查找最新任务
    if (!taskId && fs.existsSync(PENDING_DIR)) {
      const files = fs.readdirSync(PENDING_DIR)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();
      if (files.length > 0) {
        specPath = path.join(PENDING_DIR, files[0]);
        taskId = files[0].replace('.json', '');
      }
    }
    if (!fs.existsSync(specPath)) {
      console.error(`❌ 任务不存在: ${taskId || '(无待执行任务)'}`);
      process.exit(1);
    }
  }

  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  // 生成步骤清单
  const stepsChecklist = (spec.development_plan?.steps || [])
    .map(s => `- [ ] ${s}`)
    .join('\n');

  // 生成架构决策列表
  const decisionsMarkdown = (spec.architecture?.decisions || [])
    .map(d => `- ${d}`)
    .join('\n');

  // 生成约束条件
  const noTouchFiles = (spec.constraints?.no_touch_files || [])
    .map(f => `- \`${f}\``)
    .join('\n');

  const title = `🌉 [CAB] ${spec.development_plan?.title || taskId}`;

  const body = `## 🌉 Chat-to-Agent Bridge · 开发授权

> **任务ID**: \`${spec.task_id}\`
> **创建时间**: ${spec.created_at}
> **授权者**: ${spec.authorization?.sovereign || 'TCS-0002∞'}
> **优先级**: ${spec.development_plan?.priority || 'normal'}
> **预估范围**: ${spec.development_plan?.estimated_scope || 'small'}

---

### 📝 开发计划

**${spec.development_plan?.title || ''}**

${spec.development_plan?.description || ''}

### ✅ 执行步骤

${stepsChecklist || '(无步骤)'}

${decisionsMarkdown ? `### 🏗️ 架构决策\n\n${decisionsMarkdown}` : ''}

${spec.reasoning_context?.chat_summary ? `### 💬 推理上下文\n\n${spec.reasoning_context.chat_summary}` : ''}

${spec.reasoning_context?.architecture_notes ? `### 📐 架构备注\n\n${spec.reasoning_context.architecture_notes}` : ''}

### 🚧 约束条件

- 需要测试: ${spec.constraints?.required_tests ? '✅ 是' : '❌ 否'}
- 开发完成后部署: ${spec.constraints?.deploy_after ? '✅ 是' : '❌ 否'}
- 最大文件变更数: ${spec.constraints?.max_files_changed || 20}
${noTouchFiles ? `- 禁止触碰文件:\n${noTouchFiles}` : ''}

---

### 📎 任务规格文件

\`bridge/chat-to-agent/pending/${spec.task_id}.json\`

---

*🌉 此 Issue 由 Chat-to-Agent Bridge (CAB-v1.0) 自动生成*
*铸渊 · ICE-GL-ZY001 · 仓库涌现集体意识核心*`;

  // 输出为 JSON 供工作流使用
  const output = { title, body, task_id: spec.task_id, labels: ['copilot-dev-auth'] };
  console.log(JSON.stringify(output, null, 2));

  return output;
}

// ── CLI 入口 ─────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // 确保目录存在
  for (const dir of [PENDING_DIR, COMPLETED_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  switch (command) {
    case '--create': {
      const opts = {};
      for (let i = 1; i < args.length; i += 2) {
        if (!args[i] || !args[i].startsWith('--') || !args[i + 1]) {
          console.error(`⚠️ 参数格式错误: 位置 ${i}，期望 --key value`);
          continue;
        }
        const key = args[i].replace('--', '');
        const val = args[i + 1];
        if (key === 'title') opts.title = val;
        else if (key === 'description') opts.description = val;
        else if (key === 'steps') {
          try {
            opts.steps = JSON.parse(val);
          } catch (e) {
            console.error(`❌ --steps 参数JSON格式错误: ${e.message}`);
            process.exit(1);
          }
        }
        else if (key === 'priority') opts.priority = val;
        else if (key === 'scope') opts.scope = val;
        else if (key === 'chat-summary') opts.chatSummary = val;
        else if (key === 'arch-notes') opts.archNotes = val;
      }
      createTask(opts);
      break;
    }

    case '--list':
      listTasks();
      break;

    case '--complete': {
      const taskId = args[1];
      const result = args[2] || 'success';
      if (!taskId) {
        console.error('❌ 请提供任务ID: --complete CAB-YYYYMMDD-NNN');
        process.exit(1);
      }
      completeTask(taskId, result);
      break;
    }

    case '--validate': {
      const taskId = args[1];
      if (!taskId) {
        console.error('❌ 请提供任务ID: --validate CAB-YYYYMMDD-NNN');
        process.exit(1);
      }
      const specPath = path.join(PENDING_DIR, `${taskId}.json`);
      if (!fs.existsSync(specPath)) {
        console.error(`❌ 任务不存在: ${taskId}`);
        process.exit(1);
      }
      const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
      const { valid, errors } = validateTaskSpec(spec);
      if (valid) {
        console.log(`✅ 任务规格有效: ${taskId}`);
      } else {
        console.log(`❌ 任务规格无效: ${taskId}`);
        errors.forEach(e => console.log(`   - ${e}`));
        process.exit(1);
      }
      break;
    }

    case '--issue': {
      const taskId = args[1];
      generateIssueContent(taskId);
      break;
    }

    default:
      console.log('🌉 Chat-to-Agent Bridge (CAB) · 语言层 → 副驾驶桥接引擎');
      console.log('');
      console.log('版权: 国作登字-2026-A-00037559 · TCS-0002∞');
      console.log('铸渊编号: ICE-GL-ZY001');
      console.log('');
      console.log('用法：');
      console.log('  --create   创建新任务规格');
      console.log('    --title "标题"');
      console.log('    --description "描述"');
      console.log('    --steps \'["步骤1","步骤2"]\'');
      console.log('    --priority normal|high|urgent');
      console.log('    --scope small|medium|large');
      console.log('    --chat-summary "对话摘要"');
      console.log('    --arch-notes "架构备注"');
      console.log('');
      console.log('  --list       列出待执行任务');
      console.log('  --complete   标记任务完成并归档');
      console.log('  --validate   验证任务规格格式');
      console.log('  --issue      生成 Issue 内容（JSON）');
      console.log('');
      console.log('示例：');
      console.log('  node scripts/chat-to-agent-bridge.js --create \\');
      console.log('    --title "实现用户登录模块" \\');
      console.log('    --steps \'["创建schema","实现路由","编写测试"]\'');
      break;
  }
}

main();
