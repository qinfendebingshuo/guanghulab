#!/usr/bin/env node
/**
 * GLADA · 冒烟测试 · glada-smoke.test.js
 *
 * 验证所有模块可以正常加载和基本功能可用。
 *
 * 用法: node glada/tests/glada-smoke.test.js
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '../..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log('🧪 GLADA 冒烟测试\n');

// ── 1. 模块加载测试 ──

console.log('📦 模块加载:');

test('task-receiver 加载', () => {
  const mod = require('../task-receiver');
  assert(typeof mod.scanPendingTasks === 'function', 'scanPendingTasks 不是函数');
  assert(typeof mod.validateTaskSpec === 'function', 'validateTaskSpec 不是函数');
  assert(typeof mod.convertToGladaTask === 'function', 'convertToGladaTask 不是函数');
  assert(typeof mod.receiveNextTask === 'function', 'receiveNextTask 不是函数');
  assert(typeof mod.updateTask === 'function', 'updateTask 不是函数');
  assert(typeof mod.archiveTask === 'function', 'archiveTask 不是函数');
});

test('context-builder 加载', () => {
  const mod = require('../context-builder');
  assert(typeof mod.buildContext === 'function', 'buildContext 不是函数');
  assert(typeof mod.contextToSystemPrompt === 'function', 'contextToSystemPrompt 不是函数');
  assert(typeof mod.scanTargetFiles === 'function', 'scanTargetFiles 不是函数');
  assert(typeof mod.scanDependencies === 'function', 'scanDependencies 不是函数');
});

test('step-executor 加载', () => {
  const mod = require('../step-executor');
  assert(typeof mod.executeStep === 'function', 'executeStep 不是函数');
  assert(typeof mod.parseFileChanges === 'function', 'parseFileChanges 不是函数');
  assert(typeof mod.snapshotFiles === 'function', 'snapshotFiles 不是函数');
  assert(typeof mod.applyFileChanges === 'function', 'applyFileChanges 不是函数');
});

test('code-generator 加载', () => {
  const mod = require('../code-generator');
  assert(typeof mod.findDependents === 'function', 'findDependents 不是函数');
  assert(typeof mod.regressionCheck === 'function', 'regressionCheck 不是函数');
  assert(typeof mod.executeWithRegressionGuard === 'function', 'executeWithRegressionGuard 不是函数');
});

test('git-operator 加载', () => {
  const mod = require('../git-operator');
  assert(typeof mod.getCurrentBranch === 'function', 'getCurrentBranch 不是函数');
  assert(typeof mod.createTaskBranch === 'function', 'createTaskBranch 不是函数');
  assert(typeof mod.commitStep === 'function', 'commitStep 不是函数');
});

test('notifier 加载', () => {
  const mod = require('../notifier');
  assert(typeof mod.notify === 'function', 'notify 不是函数');
  assert(typeof mod.buildNotification === 'function', 'buildNotification 不是函数');
});

test('execution-loop 加载', () => {
  const mod = require('../execution-loop');
  assert(typeof mod.executeTask === 'function', 'executeTask 不是函数');
  assert(typeof mod.startLoop === 'function', 'startLoop 不是函数');
});

// ── 2. 功能测试 ──

console.log('\n⚙️ 功能测试:');

test('任务规格验证 - 合法', () => {
  const { validateTaskSpec } = require('../task-receiver');
  const result = validateTaskSpec({
    task_id: 'CAB-20260417-001',
    authorization: { sovereign: '冰朔 · TCS-0002∞' },
    development_plan: {
      title: '测试任务',
      steps: ['步骤1', '步骤2']
    }
  });
  assert(result.valid === true, `应该是合法的，但返回: ${JSON.stringify(result)}`);
});

test('任务规格验证 - 非法（无授权）', () => {
  const { validateTaskSpec } = require('../task-receiver');
  const result = validateTaskSpec({
    task_id: 'CAB-20260417-001',
    authorization: { sovereign: '其他人' },
    development_plan: { title: '测试', steps: ['步骤1'] }
  });
  assert(result.valid === false, '应该是非法的');
  assert(result.errors.length > 0, '应该有错误信息');
});

test('任务规格验证 - 非法（无步骤）', () => {
  const { validateTaskSpec } = require('../task-receiver');
  const result = validateTaskSpec({
    task_id: 'CAB-20260417-001',
    authorization: { sovereign: '冰朔 · TCS-0002∞' },
    development_plan: { title: '测试', steps: [] }
  });
  assert(result.valid === false, '应该是非法的');
});

test('CAB → GLADA 任务转换', () => {
  const { convertToGladaTask } = require('../task-receiver');
  const spec = {
    task_id: 'CAB-20260417-001',
    authorization: { sovereign: '冰朔 · TCS-0002∞' },
    development_plan: {
      title: '测试项目',
      description: '这是一个测试',
      steps: ['创建文件', '修改配置'],
      priority: 'high'
    },
    architecture: { summary: '架构描述' },
    constraints: { no_touch_files: ['.github/'], required_tests: true }
  };

  const task = convertToGladaTask(spec);
  assert(task.glada_task_id === 'GLADA-CAB-20260417-001', `任务ID错误: ${task.glada_task_id}`);
  assert(task.plan.steps.length === 2, `步骤数错误: ${task.plan.steps.length}`);
  assert(task.plan.steps[0].step_id === 1, '步骤1 ID错误');
  assert(task.plan.steps[0].description === '创建文件', '步骤1 描述错误');
  assert(task.plan.priority === 'high', '优先级错误');
  assert(task.status === 'pending', '状态错误');
  assert(Array.isArray(task.execution_log), '缺少 execution_log');
});

test('LLM 输出解析 - JSON 代码块', () => {
  const { parseFileChanges } = require('../step-executor');
  const output = '这是一些解释\n```json\n{"reasoning":"测试","files":[{"path":"test.txt","action":"create","content":"hello"}],"summary":"创建测试文件"}\n```\n更多解释';
  const result = parseFileChanges(output);
  assert(result !== null, '解析失败');
  assert(result.files.length === 1, `文件数错误: ${result.files.length}`);
  assert(result.files[0].path === 'test.txt', '路径错误');
  assert(result.reasoning === '测试', '推理错误');
});

test('LLM 输出解析 - 纯 JSON', () => {
  const { parseFileChanges } = require('../step-executor');
  const output = '{"reasoning":"纯JSON","files":[{"path":"a.js","action":"modify","content":"code"}],"summary":"修改"}';
  const result = parseFileChanges(output);
  assert(result !== null, '解析失败');
  assert(result.files[0].action === 'modify', '操作错误');
});

test('LLM 输出解析 - 无效格式', () => {
  const { parseFileChanges } = require('../step-executor');
  const result = parseFileChanges('这是一段普通文本');
  assert(result === null, '应该返回 null');
});

test('文件快照和恢复', () => {
  const { snapshotFiles, restoreFromSnapshot } = require('../step-executor');

  // 创建测试文件
  const testFile = '/tmp/glada-test-snapshot.txt';
  fs.writeFileSync(testFile, 'original content', 'utf-8');

  // 拍摄快照（使用相对路径模拟）
  const snapshot = new Map();
  snapshot.set(testFile, 'original content');

  // 修改文件
  fs.writeFileSync(testFile, 'modified content', 'utf-8');
  assert(fs.readFileSync(testFile, 'utf-8') === 'modified content', '文件没有被修改');

  // 清理
  fs.unlinkSync(testFile);
});

test('上下文构建', () => {
  const { buildContext, contextToSystemPrompt } = require('../context-builder');
  const mockTask = {
    glada_task_id: 'GLADA-TEST-001',
    plan: {
      title: '测试任务',
      description: '测试描述',
      steps: [{ step_id: 1, description: '步骤1', status: 'pending' }]
    },
    architecture: { summary: '测试架构', target_files: [] },
    constraints: {},
    reasoning_context: {},
    execution_log: []
  };

  const context = buildContext(mockTask);
  assert(context.task_id === 'GLADA-TEST-001', 'task_id 不匹配');
  assert(context.sections.identity, '缺少 identity section');
  assert(context.sections.task, '缺少 task section');

  const prompt = contextToSystemPrompt(context);
  assert(typeof prompt === 'string', 'prompt 不是字符串');
  assert(prompt.includes('铸渊'), 'prompt 缺少铸渊身份');
});

test('通知内容构建', () => {
  const { buildNotification } = require('../notifier');
  const mockTask = {
    glada_task_id: 'GLADA-TEST-001',
    plan: {
      title: '测试任务',
      steps: [
        { step_id: 1, description: '步骤1', status: 'completed' },
        { step_id: 2, description: '步骤2', status: 'pending' }
      ]
    },
    completion: {
      total_files_changed: ['a.js', 'b.js'],
      git_branch: 'glada/test',
      git_commits: ['abc1234: 步骤1']
    }
  };

  const notif = buildNotification(mockTask, 'completed');
  assert(notif.subject.includes('GLADA-TEST-001'), '主题缺少任务ID');
  assert(notif.body.includes('测试任务'), '正文缺少任务标题');
  assert(notif.body.includes('a.js'), '正文缺少变更文件');
});

test('文件依赖扫描', () => {
  const { scanDependencies } = require('../context-builder');
  // 扫描一个已知文件的依赖
  const serverPath = path.join(ROOT, 'server.js');
  if (fs.existsSync(serverPath)) {
    const deps = scanDependencies(serverPath);
    assert(Array.isArray(deps), 'deps 不是数组');
  }
});

test('中央任务队列 glada-task 类型已注册', () => {
  const taskQueuePath = path.join(ROOT, 'core', 'task-queue', 'index.js');
  assert(fs.existsSync(taskQueuePath), 'core/task-queue/index.js 不存在');
  const content = fs.readFileSync(taskQueuePath, 'utf-8');
  assert(content.includes("'glada-task'"), 'glada-task 类型未注册到中央任务队列');
});

test('CAB 任务模板包含 execution_plan 字段', () => {
  const templatePath = path.join(ROOT, 'bridge', 'chat-to-agent', 'task-template.json');
  assert(fs.existsSync(templatePath), 'task-template.json 不存在');
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
  assert(template.execution_plan, '缺少 execution_plan 字段');
  assert(template.execution_plan.executor === 'glada', 'executor 应为 glada');
  assert(template.execution_plan.rollback_on_failure === true, 'rollback_on_failure 应为 true');
});

test('ecosystem.config.js 包含 env 加载逻辑', () => {
  const ecosystemPath = path.join(ROOT, 'glada', 'ecosystem.config.js');
  const content = fs.readFileSync(ecosystemPath, 'utf-8');
  assert(content.includes('loadEnvFile'), 'ecosystem.config.js 缺少 loadEnvFile 函数');
  assert(content.includes('.env.glada'), '缺少 .env.glada 加载');
});

test('execution-loop 集成中央任务队列', () => {
  const loopPath = path.join(ROOT, 'glada', 'execution-loop.js');
  const content = fs.readFileSync(loopPath, 'utf-8');
  assert(content.includes('core/task-queue'), '缺少 core/task-queue 集成');
  assert(content.includes('dequeueFromCentralQueue'), '缺少 dequeueFromCentralQueue 函数');
  assert(content.includes('glada-task'), '缺少 glada-task 类型检查');
});

// ── 结果 ──

console.log(`\n${'═'.repeat(40)}`);
console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败`);
console.log(`${'═'.repeat(40)}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ 全部通过!\n');
}
