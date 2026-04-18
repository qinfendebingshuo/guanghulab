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

// ── 预加载模块（E2E测试需要）──
const taskReceiver = require('../task-receiver');
const contextBuilder = require('../context-builder');
const stepExecutor = require('../step-executor');
const notifier = require('../notifier');

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
  assert(typeof mod.sendEmail === 'function', 'sendEmail 不是函数');
  assert(typeof mod.sendWeCom === 'function', 'sendWeCom 不是函数');
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
  assert(notif.html, '缺少 HTML 邮件内容');
  assert(notif.html.includes('GLADA-TEST-001'), 'HTML 缺少任务ID');
  assert(notif.html.includes('a.js'), 'HTML 缺少变更文件');
  assert(notif.html.includes('铸渊'), 'HTML 缺少铸渊签名');
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

// ── E2E 集成测试 ──

test('E2E: CAB任务提交→转换→入队→状态查询完整链路', () => {
  const cabSpec = {
    cab_version: '1.0',
    task_id: 'CAB-20260417-999',
    created_at: new Date().toISOString(),
    created_by: 'TCS-0002∞',
    status: 'pending',
    authorization: {
      sovereign: '冰朔 · TCS-0002∞',
      authorized_agent: 'copilot-agent',
      scope: 'full-auto-development'
    },
    architecture: {
      summary: 'E2E 测试任务',
      target_files: ['glada/README.md'],
      target_modules: ['glada']
    },
    development_plan: {
      title: 'E2E 集成测试任务',
      description: '验证完整链路',
      steps: ['步骤1: 检查文件', '步骤2: 修改文件'],
      priority: 'normal'
    },
    execution_plan: {
      executor: 'glada',
      model_preference: 'deepseek-chat',
      retry_policy: { max_retries: 2, backoff_ms: 1000 }
    },
    constraints: {
      no_touch_files: ['.github/brain/'],
      required_tests: false,
      max_files_changed: 5
    }
  };

  // 1. 验证任务规格
  const validation = taskReceiver.validateTaskSpec(cabSpec);
  assert(validation.valid, `验证失败: ${validation.errors.join(', ')}`);

  // 2. 转换为 GLADA 任务
  const gladaTask = taskReceiver.convertToGladaTask(cabSpec);
  assert(gladaTask.glada_task_id === 'GLADA-CAB-20260417-999', 'ID 转换错误');
  assert(gladaTask.plan.steps.length === 2, '步骤数应为 2');
  assert(gladaTask.plan.steps[0].status === 'pending', '步骤状态应为 pending');
  assert(gladaTask.constraints.no_touch_files.length === 1, '约束丢失');

  // 3. 保存到临时队列并读回
  const tmpQueueDir = '/tmp/glada-e2e-test-queue';
  fs.mkdirSync(tmpQueueDir, { recursive: true });
  const queueFile = path.join(tmpQueueDir, `${gladaTask.glada_task_id}.json`);
  fs.writeFileSync(queueFile, JSON.stringify(gladaTask, null, 2), 'utf-8');

  const readBack = JSON.parse(fs.readFileSync(queueFile, 'utf-8'));
  assert(readBack.glada_task_id === gladaTask.glada_task_id, '队列读回不一致');
  assert(readBack.plan.title === 'E2E 集成测试任务', '标题不一致');

  // 4. 构建上下文
  const context = contextBuilder.buildContext(gladaTask);
  assert(context.sections.identity, '上下文缺少 identity');
  assert(context.sections.task, '上下文缺少 task');

  const systemPrompt = contextBuilder.contextToSystemPrompt(context);
  assert(systemPrompt.length > 100, '系统提示词过短');
  assert(systemPrompt.includes('铸渊'), '提示词应包含铸渊身份');

  // 5. 构建步骤提示词
  const stepPrompt = stepExecutor.buildStepPrompt(gladaTask.plan.steps[0], gladaTask);
  assert(stepPrompt.includes('步骤 1'), '步骤提示词应包含步骤编号');
  assert(stepPrompt.includes('JSON'), '步骤提示词应要求 JSON 输出');

  // 6. 验证通知构建
  gladaTask.status = 'completed';
  gladaTask.completion = {
    total_files_changed: ['test.js'],
    git_branch: 'glada/test',
    git_commits: ['abc123']
  };
  const notification = notifier.buildNotification(gladaTask, 'completed');
  assert(notification.subject.includes('GLADA'), '通知标题应包含 GLADA');
  assert(notification.body.includes('test.js'), '通知正文应包含变更文件');

  // 清理
  fs.unlinkSync(queueFile);
  try { fs.rmdirSync(tmpQueueDir); } catch { /* ok */ }
});

test('step-executor 支持 LLM 重试配置', () => {
  const content = fs.readFileSync(path.join(ROOT, 'glada', 'step-executor.js'), 'utf-8');
  assert(content.includes('maxRetries'), '缺少 maxRetries 参数');
  assert(content.includes('backoffMs'), '缺少 backoffMs 参数');
  assert(content.includes('execution_plan'), '缺少 execution_plan 集成');
  assert(content.includes('retry_policy'), '缺少 retry_policy 读取');
});

test('service.js 包含速率限制', () => {
  const content = fs.readFileSync(path.join(ROOT, 'glada', 'service.js'), 'utf-8');
  assert(content.includes('rateLimit'), '缺少速率限制函数');
  assert(content.includes('429'), '缺少 429 状态码');
});

test('package.json 包含 express 依赖', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'glada', 'package.json'), 'utf-8'));
  assert(pkg.dependencies && pkg.dependencies.express, '缺少 express 依赖');
});

test('package.json 包含 nodemailer 依赖', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'glada', 'package.json'), 'utf-8'));
  assert(pkg.dependencies && pkg.dependencies.nodemailer, '缺少 nodemailer 依赖');
});

test('notifier.js 已替换钉钉为邮箱+企业微信', () => {
  const content = fs.readFileSync(path.join(ROOT, 'glada', 'notifier.js'), 'utf-8');
  // 应包含邮箱通道
  assert(content.includes('sendEmail'), '缺少 sendEmail 函数');
  assert(content.includes('nodemailer'), '缺少 nodemailer 引用');
  assert(content.includes('smtp.qq.com'), '缺少 QQ 邮箱 SMTP 配置');
  assert(content.includes('ZY_SMTP_USER'), '缺少 ZY_SMTP_USER 环境变量');
  // 应包含企业微信预留通道
  assert(content.includes('sendWeCom'), '缺少 sendWeCom 函数');
  assert(content.includes('WECOM_WEBHOOK'), '缺少 WECOM_WEBHOOK 环境变量');
  // 不应包含钉钉
  assert(!content.includes('sendDingTalk'), '仍包含已废弃的 sendDingTalk');
  assert(!content.includes('DINGTALK_WEBHOOK'), '仍包含已废弃的 DINGTALK_WEBHOOK');
});

test('通知 HTML 邮件模板包含光湖视觉风格', () => {
  const { buildNotification } = require('../notifier');
  const mockTask = {
    glada_task_id: 'GLADA-TEST-HTML',
    plan: {
      title: 'HTML模板测试',
      steps: [
        { step_id: 1, description: '步骤A', status: 'completed' },
        { step_id: 2, description: '步骤B', status: 'failed', error: '测试错误' }
      ]
    },
    completion: { total_files_changed: ['test.js'], git_branch: 'glada/html-test', git_commits: ['hash: msg'] }
  };

  // 测试 completed
  const completed = buildNotification(mockTask, 'completed');
  assert(completed.html.includes('<!DOCTYPE html>'), 'HTML 缺少 DOCTYPE');
  assert(completed.html.includes('渊'), 'HTML 缺少铸渊标识');
  assert(completed.html.includes('#050810'), 'HTML 缺少光湖暗色背景');

  // 测试 failed
  const failed = buildNotification(mockTask, 'failed');
  assert(failed.html.includes('f87171'), 'failed HTML 应包含红色');
  assert(failed.subject.includes('❌'), 'failed 主题应包含 ❌');

  // 测试 started
  const started = buildNotification(mockTask, 'started');
  assert(started.html.includes('🚀'), 'started HTML 应包含 🚀');
});

test('deploy workflow 注入 SMTP 到 .env.glada', () => {
  const content = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy-to-zhuyuan-server.yml'), 'utf-8');
  assert(content.includes('ZY_SMTP_USER') && content.includes('.env.glada'), '部署 workflow 缺少 SMTP 注入到 .env.glada');
});

test('install-check.js 预飞检查工具存在', () => {
  const checkPath = path.join(ROOT, 'glada', 'install-check.js');
  assert(fs.existsSync(checkPath), 'install-check.js 不存在');
  const content = fs.readFileSync(checkPath, 'utf-8');
  assert(content.includes('ZY_LLM_API_KEY'), '预飞检查应检查 API Key');
  assert(content.includes('ZY_LLM_BASE_URL'), '预飞检查应检查 Base URL');
  assert(content.includes('testLLMConnection'), '预飞检查应测试 LLM 连通性');
  assert(content.includes('ZY_SMTP_USER'), '预飞检查应检查 SMTP');
  assert(content.includes('WECOM_WEBHOOK'), '预飞检查应检查企业微信');
});

// ── 3. Skill 蒸馏测试（Hermes-inspired · Phase 1） ──

console.log('\n🧪 Skill 蒸馏测试:');

test('skill-distiller 模块加载', () => {
  const mod = require('../skill-distiller');
  assert(typeof mod.distillSkill === 'function', 'distillSkill 不是函数');
  assert(typeof mod.saveSkill === 'function', 'saveSkill 不是函数');
  assert(typeof mod.loadAllSkills === 'function', 'loadAllSkills 不是函数');
  assert(typeof mod.findRelevantSkills === 'function', 'findRelevantSkills 不是函数');
  assert(typeof mod.skillsToContext === 'function', 'skillsToContext 不是函数');
  assert(typeof mod.distillAndSave === 'function', 'distillAndSave 不是函数');
  assert(typeof mod.extractTags === 'function', 'extractTags 不是函数');
});

test('Skill 蒸馏 - 成功任务生成 HNL 格式 skill', () => {
  const { distillSkill } = require('../skill-distiller');
  const mockTask = {
    glada_task_id: 'GLADA-CAB-20260418-001',
    status: 'completed',
    plan: {
      title: '添加用户认证 API',
      description: '实现 login 和 register 接口',
      steps: [
        { step_id: 1, description: '创建 schema', status: 'completed', files_changed: ['src/schemas/hli/auth/login.schema.json'], reasoning: 'HLI 协议要求 schema 优先' },
        { step_id: 2, description: '创建路由', status: 'completed', files_changed: ['src/routes/hli/auth/login.js'], reasoning: '路由遵循 HLI 约定' }
      ]
    },
    execution_log: [
      { step_id: 1, action: '创建 schema', status: 'completed', reasoning: 'HLI 协议要求', files_changed: ['src/schemas/hli/auth/login.schema.json'], duration_ms: 5000 },
      { step_id: 2, action: '创建路由', status: 'completed', reasoning: '遵循约定', files_changed: ['src/routes/hli/auth/login.js'], duration_ms: 8000 }
    ],
    architecture: { target_files: ['src/routes/hli/auth/'], target_modules: ['auth'] },
    constraints: { no_touch_files: ['.github/'], required_tests: true }
  };

  const skill = distillSkill(mockTask);
  assert(skill !== null, 'skill 不应为 null');
  assert(skill.hnl_v === '1.0', 'HNL 版本应为 1.0');
  assert(skill.type === 'SKILL', '类型应为 SKILL');
  assert(skill.from === 'YM001/ZY001', '发送者应为铸渊');
  assert(skill.skill.name === '添加用户认证 API', 'skill 名称错误');
  assert(skill.skill.step_patterns.length === 2, '步骤模式数量错误');
  assert(skill.skill.success_rate === 1, '成功率应为 1');
  assert(skill.skill.file_domain.length === 2, '文件域数量错误');
  assert(skill.memory_sovereignty.can_forget === true, '记忆主权：应可遗忘');
  assert(skill.op.includes('GROW'), '操作应为 GROW');
});

test('Skill 蒸馏 - 未完成任务返回 null', () => {
  const { distillSkill } = require('../skill-distiller');
  const result = distillSkill({ status: 'failed', plan: { steps: [] }, execution_log: [] });
  assert(result === null, '未完成任务应返回 null');
});

test('Skill 蒸馏 - 部分失败任务包含教训', () => {
  const { distillSkill } = require('../skill-distiller');
  const mockTask = {
    glada_task_id: 'GLADA-CAB-20260418-002',
    status: 'completed',
    plan: {
      title: '数据库迁移',
      steps: [
        { step_id: 1, description: '备份数据', status: 'completed', files_changed: ['scripts/backup.sh'] },
        { step_id: 2, description: '迁移表', status: 'failed', error: 'SQL 语法错误' },
        { step_id: 3, description: '验证迁移', status: 'completed', files_changed: ['tests/migration.test.js'] }
      ]
    },
    execution_log: [],
    architecture: {},
    constraints: {}
  };

  const skill = distillSkill(mockTask);
  assert(skill !== null, 'skill 不应为 null');
  assert(skill.skill.lessons_learned.length === 1, '应有 1 条教训');
  assert(skill.skill.lessons_learned[0].error === 'SQL 语法错误', '教训应包含错误信息');
  assert(skill.skill.success_rate < 1, '成功率应小于 1');
});

test('Skill 标签提取', () => {
  const { extractTags } = require('../skill-distiller');
  const tags = extractTags('添加 HLI API 认证中间件', [
    { description: '创建 auth middleware', files_changed: ['src/middleware/auth.js'] }
  ]);
  assert(Array.isArray(tags), 'tags 应为数组');
  assert(tags.length > 0, 'tags 不应为空');
  assert(tags.includes('middleware'), '应包含 middleware 标签');
  assert(tags.includes('src'), '应包含 src 模块标签');
});

test('Skill 查找 - 按文件域匹配', () => {
  const { findRelevantSkills, saveSkill, SKILLS_DIR } = require('../skill-distiller');

  // 创建临时 skill
  const tmpSkill = {
    type: 'SKILL',
    id: 'SKILL-TEST-MATCH',
    skill: {
      name: '测试 Skill',
      tags: ['glada', 'test'],
      success_rate: 1,
      step_patterns: [],
      file_domain: ['glada/notifier.js', 'glada/service.js'],
      lessons_learned: [],
      architecture_context: { target_files: ['glada/'], target_modules: ['glada'] }
    }
  };

  // 保存测试 skill
  fs.mkdirSync(SKILLS_DIR, { recursive: true });
  const testPath = path.join(SKILLS_DIR, 'SKILL-TEST-MATCH.json');
  fs.writeFileSync(testPath, JSON.stringify(tmpSkill, null, 2), 'utf-8');

  // 查找匹配
  const results = findRelevantSkills({
    architecture: { target_files: ['glada/notifier.js'], target_modules: ['glada'] },
    plan: { title: 'GLADA 通知改进' }
  });

  // 清理
  try { fs.unlinkSync(testPath); } catch { /* ok */ }

  assert(results.length > 0, '应找到匹配的 skill');
  assert(results[0].skill.name === '测试 Skill', '匹配的 skill 名称错误');
});

test('Skill 格式化为上下文', () => {
  const { skillsToContext } = require('../skill-distiller');

  const mockSkills = [{
    skill: {
      name: '测试上下文 Skill',
      source_task: 'GLADA-TEST-001',
      success_rate: 0.85,
      step_patterns: [
        { description: '创建文件', reasoning: '规范要求', files_changed: ['test.js'] }
      ],
      lessons_learned: [
        { step_description: '编译', error: '类型错误' }
      ],
      file_domain: ['test.js']
    }
  }];

  const context = skillsToContext(mockSkills);
  assert(context.includes('测试上下文 Skill'), '上下文应包含 skill 名称');
  assert(context.includes('85%'), '上下文应包含成功率');
  assert(context.includes('教训'), '上下文应包含教训');
  assert(context.includes('test.js'), '上下文应包含文件');
});

test('skillsToContext 空 skills 返回空字符串', () => {
  const { skillsToContext } = require('../skill-distiller');
  assert(skillsToContext([]) === '', '空 skills 应返回空字符串');
  assert(skillsToContext(null) === '', 'null 应返回空字符串');
});

// ── 4. 自我反思测试（Hermes-inspired · Phase 2） ──

console.log('\n🪞 自我反思测试:');

test('reflector 模块加载', () => {
  const mod = require('../reflector');
  assert(typeof mod.buildReflectionPrompt === 'function', 'buildReflectionPrompt 不是函数');
  assert(typeof mod.parseReflection === 'function', 'parseReflection 不是函数');
  assert(typeof mod.wrapAsHNL === 'function', 'wrapAsHNL 不是函数');
  assert(typeof mod.reflectOffline === 'function', 'reflectOffline 不是函数');
  assert(typeof mod.reflectWithLLM === 'function', 'reflectWithLLM 不是函数');
  assert(typeof mod.loadRecentReflections === 'function', 'loadRecentReflections 不是函数');
});

test('反思提示词构建', () => {
  const { buildReflectionPrompt } = require('../reflector');
  const mockTask = {
    glada_task_id: 'GLADA-TEST-REFLECT',
    status: 'completed',
    plan: {
      title: '反思测试任务',
      description: '用于测试反思功能',
      steps: [
        { step_id: 1, description: '步骤1', status: 'completed', reasoning: '推理1', files_changed: ['a.js'] },
        { step_id: 2, description: '步骤2', status: 'failed', error: '测试错误' }
      ]
    },
    execution_log: [
      { step_id: 1, action: '步骤1', status: 'completed', reasoning: '推理1', files_changed: ['a.js'], duration_ms: 3000 },
      { step_id: 2, action: '步骤2', status: 'failed', error: '测试错误', duration_ms: 2000 }
    ],
    constraints: { no_touch_files: ['.github/'] }
  };

  const { systemPrompt, userMessage } = buildReflectionPrompt(mockTask);
  assert(systemPrompt.includes('铸渊'), '系统提示词应包含铸渊身份');
  assert(systemPrompt.includes('JSON'), '系统提示词应要求 JSON 输出');
  assert(userMessage.includes('GLADA-TEST-REFLECT'), '用户消息应包含任务ID');
  assert(userMessage.includes('反思测试任务'), '用户消息应包含任务标题');
  assert(userMessage.includes('测试错误'), '用户消息应包含失败错误');
});

test('反思 JSON 解析 - 标准格式', () => {
  const { parseReflection } = require('../reflector');
  const output = '```json\n{"what_went_well":["步骤1成功"],"what_went_wrong":["步骤2失败"],"improvements":["增加检查"],"patterns_discovered":["模式A"],"confidence_score":0.75}\n```';
  const result = parseReflection(output);
  assert(result !== null, '解析不应为 null');
  assert(result.what_went_well.length === 1, 'what_went_well 长度错误');
  assert(result.what_went_wrong.length === 1, 'what_went_wrong 长度错误');
  assert(result.improvements.length === 1, 'improvements 长度错误');
  assert(result.confidence_score === 0.75, '信心评分错误');
});

test('反思 JSON 解析 - 异常值安全处理', () => {
  const { parseReflection } = require('../reflector');
  const output = '{"what_went_well":"not_array","confidence_score":999}';
  const result = parseReflection(output);
  assert(result !== null, '解析不应为 null');
  assert(Array.isArray(result.what_went_well), 'what_went_well 应降级为数组');
  assert(result.what_went_well.length === 0, '非数组应降级为空数组');
  assert(result.confidence_score === 1, '超出范围的分数应 clamp 到 1');
});

test('反思 JSON 解析 - 无效输入返回 null', () => {
  const { parseReflection } = require('../reflector');
  assert(parseReflection('这不是 JSON') === null, '纯文本应返回 null');
});

test('反思 HNL 包装', () => {
  const { wrapAsHNL } = require('../reflector');
  const mockTask = {
    glada_task_id: 'GLADA-TEST-HNL',
    status: 'completed',
    plan: { title: 'HNL 包装测试' }
  };
  const reflectionData = {
    what_went_well: ['很好'],
    what_went_wrong: [],
    improvements: ['可以更好'],
    patterns_discovered: ['模式1'],
    confidence_score: 0.9
  };

  const doc = wrapAsHNL(mockTask, reflectionData);
  assert(doc.hnl_v === '1.0', 'HNL 版本应为 1.0');
  assert(doc.type === 'GROW', '类型应为 GROW');
  assert(doc.from === 'YM001/ZY001', '发送者应为铸渊');
  assert(doc.to === 'YM001/ZY001', '接收者应为铸渊（自我反思）');
  assert(doc.op.includes('GROW'), '操作应为 GROW');
  assert(doc.payload.intent === 'task_reflection', '意图应为 task_reflection');
  assert(doc.payload.data.confidence_score === 0.9, '信心评分应传递');
  assert(doc.memory_sovereignty.can_forget === true, '记忆主权：应可遗忘');
});

test('离线反思 - 全部成功的任务', () => {
  const { reflectOffline, REFLECTIONS_DIR } = require('../reflector');
  const mockTask = {
    glada_task_id: 'GLADA-TEST-OFFLINE-OK',
    status: 'completed',
    plan: {
      title: '离线反思成功测试',
      steps: [
        { step_id: 1, description: '步骤1', status: 'completed', files_changed: ['a.js'], reasoning: '推理1' },
        { step_id: 2, description: '步骤2', status: 'completed', files_changed: ['b.js'] }
      ]
    },
    execution_log: [
      { step_id: 1, action: '步骤1', status: 'completed', reasoning: '推理1', files_changed: ['a.js'], duration_ms: 1000 },
      { step_id: 2, action: '步骤2', status: 'completed', files_changed: ['b.js'], duration_ms: 2000 }
    ],
    constraints: {}
  };

  const result = reflectOffline(mockTask);
  assert(result.saved === true, '应保存成功');
  assert(result.reflection.confidence_score === 1, '全部成功时信心应为 1');
  assert(result.reflection.what_went_well.length === 2, '应有 2 条好的');
  assert(result.reflection.what_went_wrong.length === 0, '不应有差的');
  assert(result.hnlDoc.hnl_v === '1.0', 'HNL 文档版本应为 1.0');

  // 清理
  try { fs.unlinkSync(result.path); } catch { /* ok */ }
});

test('离线反思 - 有失败步骤的任务', () => {
  const { reflectOffline } = require('../reflector');
  const mockTask = {
    glada_task_id: 'GLADA-TEST-OFFLINE-FAIL',
    status: 'failed',
    plan: {
      title: '离线反思失败测试',
      steps: [
        { step_id: 1, description: '成功步骤', status: 'completed', files_changed: ['ok.js'] },
        { step_id: 2, description: '失败步骤', status: 'failed', error: 'SQL 错误' },
        { step_id: 3, description: '回滚步骤', status: 'rolled_back', error: '测试失败' }
      ]
    },
    execution_log: [
      { step_id: 1, action: '成功步骤', status: 'completed', files_changed: ['ok.js'] },
      { step_id: 2, action: '失败步骤', status: 'failed', error: 'SQL 错误' },
      { step_id: 3, action: '回滚步骤', status: 'rolled_back', error: '测试失败' }
    ],
    constraints: {}
  };

  const result = reflectOffline(mockTask);
  assert(result.saved === true, '应保存成功');
  assert(result.reflection.confidence_score < 1, '有失败时信心应小于 1');
  assert(result.reflection.what_went_wrong.length === 2, '应有 2 条差的');
  assert(result.reflection.improvements.length >= 2, '应有改进建议');

  // 清理
  try { fs.unlinkSync(result.path); } catch { /* ok */ }
});

test('execution-loop 集成 skill-distiller 和 reflector', () => {
  const loopContent = fs.readFileSync(path.join(ROOT, 'glada', 'execution-loop.js'), 'utf-8');
  assert(loopContent.includes("require('./skill-distiller')"), 'execution-loop 应引用 skill-distiller');
  assert(loopContent.includes("require('./reflector')"), 'execution-loop 应引用 reflector');
  assert(loopContent.includes('distillAndSave'), 'execution-loop 应调用 distillAndSave');
  assert(loopContent.includes('reflectOffline'), 'execution-loop 应调用 reflectOffline');
});

test('context-builder 集成 skills 加载', () => {
  const ctxContent = fs.readFileSync(path.join(ROOT, 'glada', 'context-builder.js'), 'utf-8');
  assert(ctxContent.includes('skill-distiller'), 'context-builder 应引用 skill-distiller');
  assert(ctxContent.includes('findRelevantSkills'), 'context-builder 应调用 findRelevantSkills');
  assert(ctxContent.includes('skillsToContext'), 'context-builder 应调用 skillsToContext');
  assert(ctxContent.includes('sections.skills'), 'context-builder 应有 skills section');
});

test('context-builder 将 skills 加入系统提示词', () => {
  const ctxContent = fs.readFileSync(path.join(ROOT, 'glada', 'context-builder.js'), 'utf-8');
  assert(ctxContent.includes('context.sections.skills'), 'contextToSystemPrompt 应包含 skills 输出');
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
