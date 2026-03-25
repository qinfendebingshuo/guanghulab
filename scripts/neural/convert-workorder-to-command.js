// scripts/neural/convert-workorder-to-command.js
// 🧬 工单→下行指令 转化器
// Notion Agent 调用此脚本，将工单转化为铸渊可执行的下行指令
// 输入：工单 JSON 文件路径
// 输出：下行指令 JSON（写入 deploy-queue/pending/）

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEPLOY_QUEUE = 'data/deploy-queue/pending';
const NEURAL_MAP_PATH = 'skyeye/neural-map.json';

function loadJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return null; }
}

function generateCommandId() {
  var now = new Date();
  var cst = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  var date = cst.toISOString().split('T')[0].replace(/-/g, '');
  var seq = crypto.randomBytes(2).toString('hex').toUpperCase();
  return 'CMD-' + date + '-' + seq;
}

function convertWorkOrderToCommand(workOrder) {
  var neuralMap = loadJSON(NEURAL_MAP_PATH);
  if (!neuralMap) throw new Error('neural-map.json 不存在');

  var commandId = generateCommandId();
  var now = new Date().toISOString();

  // 确定目标 Workflow
  var targetWorkflowId = (workOrder.affected && workOrder.affected.workflows)
    ? workOrder.affected.workflows[0] : null;
  var targetWorkflow = targetWorkflowId
    ? neuralMap.github_workflows[targetWorkflowId] : null;

  // 确定指令类型
  var instructionType = 'trigger_workflow';
  var instructionParams = {};

  var action = (workOrder.source && workOrder.source.rule_triggered) || '';
  if (action.indexOf('cleanup') !== -1 || action.indexOf('clean') !== -1) {
    instructionType = 'run_script';
    instructionParams = {
      script: 'scripts/neural/cleanup-old-reports.js',
      args: { max_age_days: 7 }
    };
  } else if (action.indexOf('guard_restart') !== -1 || action.indexOf('quota') !== -1) {
    instructionType = 'modify_config';
    instructionParams = {
      target_file: (workOrder.affected && workOrder.affected.guards && workOrder.affected.guards[0])
        ? 'skyeye/guards/' + workOrder.affected.guards[0] + '.json'
        : null,
      modifications: { status: 'active', mode: 'normal' }
    };
  } else {
    instructionType = 'trigger_workflow';
    instructionParams = {
      event: 'workflow_dispatch',
      inputs: {
        reason: '工单 ' + workOrder.work_order_id + ' 自动触发',
        source_work_order: workOrder.work_order_id
      }
    };
  }

  var assignedTo = (workOrder.assignment && workOrder.assignment.assigned_to) || 'AG-TY-01';
  var assignedToName = (workOrder.assignment && workOrder.assignment.assigned_to_name) || '天眼 Notion 大脑';

  var command = {
    _protocol: 'neural-bridge-v3.0',
    _type: 'downstream_command',
    command_id: commandId,
    parent_work_order: workOrder.work_order_id,
    source: {
      agent_id: assignedTo,
      agent_name: assignedToName,
      issued_at: now,
      issued_reason: workOrder.title
    },
    target: {
      workflow_id: targetWorkflowId || 'unknown',
      workflow_file: targetWorkflow ? targetWorkflow.file : 'unknown',
      brain: targetWorkflow ? targetWorkflow.brain : assignedTo
    },
    instruction: {
      type: instructionType,
      params: instructionParams
    },
    constraints: {
      priority: workOrder.severity,
      timeout_hours: (workOrder.constraints && workOrder.constraints.timeout_hours) || 24,
      max_retries: (workOrder.constraints && workOrder.constraints.max_retries) || 2,
      requires_human_approval: workOrder.severity === 'P0',
      execution_window: {
        start: '06:00 CST',
        end: '23:00 CST'
      }
    },
    expected_outcome: {
      description: '解决工单 ' + workOrder.work_order_id + ': ' + workOrder.title,
      verification: {
        type: 'check_workflow_status',
        workflow: targetWorkflowId,
        expected_conclusion: 'success'
      }
    },
    security: {
      sfp: '⌜SFP::' + assignedTo + '::NeuralBridge::' + commandId + '::' + now + '⌝',
      signature_chain: [assignedTo, '铸渊桥接层']
    }
  };

  // 写入 deploy-queue
  fs.mkdirSync(DEPLOY_QUEUE, { recursive: true });
  fs.writeFileSync(
    path.join(DEPLOY_QUEUE, commandId + '.json'),
    JSON.stringify(command, null, 2)
  );

  console.log('✅ 工单 ' + workOrder.work_order_id + ' → 指令 ' + commandId);
  console.log('   类型: ' + instructionType);
  console.log('   目标: ' + (targetWorkflowId || '(待确定)'));
  console.log('   优先级: ' + workOrder.severity);

  return command;
}

// CLI 入口
if (require.main === module) {
  var woPath = process.argv[2];
  if (!woPath) {
    console.error('用法: node convert-workorder-to-command.js <work-order.json>');
    process.exit(1);
  }
  var wo = loadJSON(woPath);
  if (!wo) {
    console.error('❌ 无法读取工单文件: ' + woPath);
    process.exit(1);
  }
  convertWorkOrderToCommand(wo);
}

module.exports = { convertWorkOrderToCommand };
