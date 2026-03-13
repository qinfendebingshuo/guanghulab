// scripts/receipt-handler.js
// 铸渊 · 回执接收处理器
//
// Notion Agent 处理完工单后，将回执推送到 GitHub 仓库。
// 本脚本读取回执文件 → 唤醒铸渊核心大脑 → 决定下一步操作。
//
// 回执文件格式（JSON，存放在 receipts/ 目录）：
//   {
//     "receipt_id": "RCP-20260313-001",
//     "ticket_id": "notion-page-id",
//     "taskId": "BC-M23-001-AW",
//     "developer": "DEV-012 Awen",
//     "status": "completed" | "needs_revision" | "error",
//     "result": "处理结果文本",
//     "next_action": "continue" | "wait" | "escalate",
//     "timestamp": "2026-03-13T10:00:00.000Z"
//   }
//
// 环境变量：
//   RECEIPT_FILE           回执文件路径（如 receipts/RCP-xxx.json）
//   GITHUB_TOKEN           GitHub API token

'use strict';

var fs = require('fs');
var path = require('path');

var RECEIPT_FILE = process.env.RECEIPT_FILE || '';
var RECEIPTS_DIR = path.resolve(__dirname, '..', 'receipts');

// ══════════════════════════════════════════════════════════
// 扫描回执目录
// ══════════════════════════════════════════════════════════

function scanReceipts() {
  if (RECEIPT_FILE) {
    // 处理指定文件
    var fullPath = path.resolve(__dirname, '..', RECEIPT_FILE);
    if (fs.existsSync(fullPath)) {
      return [fullPath];
    }
    console.log('⚠️  指定文件不存在: ' + RECEIPT_FILE);
    return [];
  }

  // 扫描 receipts/ 目录
  if (!fs.existsSync(RECEIPTS_DIR)) {
    console.log('ℹ️  receipts/ 目录不存在，无回执待处理');
    return [];
  }

  var files = fs.readdirSync(RECEIPTS_DIR)
    .filter(function (f) { return f.endsWith('.json') && f !== '.gitkeep'; })
    .map(function (f) { return path.join(RECEIPTS_DIR, f); });

  return files;
}

// ══════════════════════════════════════════════════════════
// 解析回执
// ══════════════════════════════════════════════════════════

function parseReceipt(filePath) {
  try {
    var content = fs.readFileSync(filePath, 'utf8');
    var receipt = JSON.parse(content);

    // 基础校验
    if (!receipt.receipt_id && !receipt.ticket_id && !receipt.taskId) {
      console.log('⚠️  回执文件格式异常（需要 receipt_id, ticket_id 或 taskId 之一）: ' + filePath);
      return null;
    }

    return receipt;
  } catch (err) {
    console.log('⚠️  回执文件解析失败: ' + err.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════
// 处理回执
// ══════════════════════════════════════════════════════════

function processReceipt(receipt, filePath) {
  var receiptId = receipt.receipt_id || receipt.ticket_id || 'unknown';
  var taskId = receipt.taskId || receipt.task_id || receipt.broadcast_id || 'unknown';
  var status = receipt.status || 'unknown';
  var nextAction = receipt.next_action || 'wait';
  var result = receipt.result || '';

  console.log('  📥 回执: ' + receiptId);
  console.log('     taskId:      ' + taskId);
  console.log('     status:      ' + status);
  console.log('     next_action: ' + nextAction);

  // 根据 next_action 决定下一步
  var decision = {
    action: nextAction,
    receipt_id: receiptId,
    task_id: taskId,
    status: status,
    result_summary: result.slice(0, 200),
  };

  // 归档：移到 receipts/processed/
  var processedDir = path.join(RECEIPTS_DIR, 'processed');
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }
  var fileName = path.basename(filePath);
  var destPath = path.join(processedDir, fileName);
  fs.renameSync(filePath, destPath);
  console.log('     → 已归档: receipts/processed/' + fileName);

  return decision;
}

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('📥 铸渊 · 回执接收处理器');
  console.log('═══════════════════════════════════════════');
  console.log('  时间: ' + new Date().toISOString());
  console.log('');

  var receiptFiles = scanReceipts();

  if (receiptFiles.length === 0) {
    console.log('✅ 无回执待处理');
    return;
  }

  console.log('📄 发现 ' + receiptFiles.length + ' 个回执文件');
  console.log('');

  var decisions = [];

  for (var i = 0; i < receiptFiles.length; i++) {
    var receipt = parseReceipt(receiptFiles[i]);
    if (receipt) {
      var decision = processReceipt(receipt, receiptFiles[i]);
      decisions.push(decision);
    }
  }

  // 输出到 GITHUB_OUTPUT
  var outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, 'receipts_processed=' + decisions.length + '\n');

    // 输出需要继续执行的任务
    var continueTasks = decisions.filter(function (d) { return d.action === 'continue'; });
    if (continueTasks.length > 0) {
      fs.appendFileSync(outputFile, 'continue_tasks=' + JSON.stringify(continueTasks) + '\n');
      fs.appendFileSync(outputFile, 'has_continue_tasks=true\n');
    } else {
      fs.appendFileSync(outputFile, 'has_continue_tasks=false\n');
    }

    // 输出需要升级处理的任务
    var escalateTasks = decisions.filter(function (d) { return d.action === 'escalate'; });
    if (escalateTasks.length > 0) {
      fs.appendFileSync(outputFile, 'escalate_tasks=' + JSON.stringify(escalateTasks) + '\n');
      fs.appendFileSync(outputFile, 'has_escalate_tasks=true\n');
    } else {
      fs.appendFileSync(outputFile, 'has_escalate_tasks=false\n');
    }
  }

  console.log('');
  console.log('✅ 回执处理完成: ' + decisions.length + ' 个已处理');
}

main().catch(function (err) {
  console.error('❌ 回执处理失败: ' + err.message);
  process.exit(1);
});
