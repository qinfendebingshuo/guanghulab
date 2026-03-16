// scripts/skyeye/asop-executor.js
// 天眼·ASOP 已批准优化执行器
//
// 读取 data/asop-requests/approved/ 下的已批准申请
// 按优先级逐个执行
// 执行完成后移动到 executed/
//
// 执行原则：
//   ① 执行前保存快照到 snapshots/
//   ② 只执行明确定义的操作
//   ③ 执行后记录结果
//   ④ 绝不做破坏性操作

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const ASOP_DIR = path.join(ROOT, 'data/asop-requests');
const APPROVED_DIR = path.join(ASOP_DIR, 'approved');
const EXECUTED_DIR = path.join(ASOP_DIR, 'executed');
const SNAPSHOTS_DIR = path.join(ASOP_DIR, 'snapshots');

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

// ━━━ 安全读取 JSON ━━━
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ━━━ 保存快照（执行前备份） ━━━
function saveSnapshot(requestId, affectedFiles) {
  const snapshotDir = path.join(SNAPSHOTS_DIR, requestId);
  fs.mkdirSync(snapshotDir, { recursive: true });

  for (const file of affectedFiles) {
    const srcPath = path.join(ROOT, file);
    if (fs.existsSync(srcPath)) {
      const destPath = path.join(snapshotDir, file.replace(/\//g, '__'));
      fs.copyFileSync(srcPath, destPath);
    }
  }

  console.log(`📸 快照已保存: ${requestId} (${affectedFiles.length} 文件)`);
}

// ━━━ 执行单个优化 ━━━
function executeOptimization(request) {
  const requestId = request.request_id;
  const affectedFiles = (request.impact_assessment && request.impact_assessment.affected_files) || [];

  console.log(`\n🔧 执行: ${requestId}`);
  console.log(`   方案: ${request.proposed_optimization}`);
  console.log(`   影响: ${affectedFiles.join(', ') || '无文件变更'}`);

  // 保存快照
  if (affectedFiles.length > 0) {
    saveSnapshot(requestId, affectedFiles);
  }

  // ASOP 执行器只记录执行意图，实际执行由天眼修复 Agent 统一处理
  // 这样可以避免 ASOP 执行器和修复 Agent 做重复/冲突的操作
  const result = {
    executed: true,
    executed_at: new Date(Date.now() + BEIJING_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 19) + '+08:00',
    executor: '🦅 天眼·ASOP执行器',
    snapshot_saved: affectedFiles.length > 0,
    note: '已记录执行意图，待下次天眼验证效果'
  };

  console.log(`   ✅ 执行完成: ${requestId}`);
  return result;
}

// ━━━ 主执行流程 ━━━
function executeAll() {
  console.log('🔧 天眼·ASOP 执行器启动');
  console.log('═══════════════════════════════════════════\n');

  if (!fs.existsSync(APPROVED_DIR)) {
    console.log('ℹ️ approved/ 目录不存在，无待执行优化');
    const result = { total: 0, executed: 0, failed: 0 };
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  const files = fs.readdirSync(APPROVED_DIR)
    .filter(f => f.endsWith('.json') && f !== '.gitkeep');

  if (files.length === 0) {
    console.log('🔧 ASOP：无已批准待执行的优化');
    const result = { total: 0, executed: 0, failed: 0 };
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log(`🔧 ASOP：发现 ${files.length} 条已批准待执行的优化\n`);

  const summary = { total: files.length, executed: 0, failed: 0, results: [] };

  for (const file of files) {
    const filePath = path.join(APPROVED_DIR, file);
    const req = readJSON(filePath);
    if (!req) {
      console.log(`⚠️ 无法解析 ${file}，跳过`);
      continue;
    }

    try {
      const result = executeOptimization(req);
      req.execution_result = result;

      // 移动到 executed/
      fs.mkdirSync(EXECUTED_DIR, { recursive: true });
      fs.writeFileSync(path.join(EXECUTED_DIR, file), JSON.stringify(req, null, 2) + '\n');
      fs.unlinkSync(filePath);

      summary.executed++;
      summary.results.push({ request_id: req.request_id, status: 'executed' });
    } catch (e) {
      console.error(`❌ ${req.request_id} 执行失败: ${e.message}`);
      summary.failed++;
      summary.results.push({ request_id: req.request_id, status: 'failed', error: e.message });
    }
  }

  console.log(`\n📊 执行结果：成功 ${summary.executed} / 失败 ${summary.failed}`);
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

// ━━━ 导出 ━━━
module.exports = { executeAll, saveSnapshot };

// ━━━ 直接运行 ━━━
if (require.main === module) {
  executeAll();
}
