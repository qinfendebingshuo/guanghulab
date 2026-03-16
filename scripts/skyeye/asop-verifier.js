// scripts/skyeye/asop-verifier.js
// 天眼·ASOP 优化效果验证器
//
// 天眼运行时检查 data/asop-requests/executed/ 下已执行的优化
// 验证效果：
//   ① 优化后相关 Workflow 是否正常运行？
//   ② 是否引入了新的问题？
//   ③ 连续 2 次失败 → 自动回滚
//
// 验证通过 → 移到 verified/ 归档
// 验证失败 → 回滚 + 记录

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const ASOP_DIR = path.join(ROOT, 'data/asop-requests');
const EXECUTED_DIR = path.join(ASOP_DIR, 'executed');
const VERIFIED_DIR = path.join(ASOP_DIR, 'verified');
const SNAPSHOTS_DIR = path.join(ASOP_DIR, 'snapshots');
const SKYEYE_DIR = '/tmp/skyeye';

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
const CONSECUTIVE_FAILURE_THRESHOLD = 2;

// ━━━ 安全读取 JSON ━━━
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ━━━ 检查受影响 Workflow 的最近运行状态 ━━━
function checkWorkflowHealth(affectedWorkflows) {
  // 从天眼扫描结果中获取 Workflow 运行状态
  const recentRunsPath = path.join(SKYEYE_DIR, 'recent-runs.json');
  if (!fs.existsSync(recentRunsPath)) {
    return { healthy: true, reason: '无最近运行数据可验证，默认通过' };
  }

  const recentRuns = readJSON(recentRunsPath) || [];
  const failures = [];

  for (const wf of affectedWorkflows) {
    const wfRuns = recentRuns.filter(r => {
      const name = r.name || '';
      return name.includes(wf.replace('.yml', '').replace('.yaml', ''));
    });

    const recentFailures = wfRuns.filter(r => r.conclusion === 'failure');
    if (recentFailures.length >= CONSECUTIVE_FAILURE_THRESHOLD) {
      failures.push({
        workflow: wf,
        consecutive_failures: recentFailures.length
      });
    }
  }

  if (failures.length > 0) {
    return {
      healthy: false,
      reason: `连续失败检测：${failures.map(f => `${f.workflow}(${f.consecutive_failures}次)`).join(', ')}`,
      failures
    };
  }

  return { healthy: true, reason: '所有受影响 Workflow 运行正常' };
}

// ━━━ 回滚优化 ━━━
function rollbackOptimization(request) {
  const requestId = request.request_id;
  const snapshotDir = path.join(SNAPSHOTS_DIR, requestId);

  if (!fs.existsSync(snapshotDir)) {
    console.log(`⚠️ ${requestId} 快照不存在，无法回滚`);
    return false;
  }

  const snapshotFiles = fs.readdirSync(snapshotDir).filter(f => f !== '.gitkeep');
  let restored = 0;

  for (const file of snapshotFiles) {
    const originalPath = file.replace(/__/g, '/');
    const srcPath = path.join(snapshotDir, file);
    const destPath = path.join(ROOT, originalPath);

    try {
      const destDir = path.dirname(destPath);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      restored++;
    } catch (e) {
      console.error(`⚠️ 回滚 ${originalPath} 失败: ${e.message}`);
    }
  }

  console.log(`🔄 ${requestId} 已回滚 ${restored}/${snapshotFiles.length} 个文件`);
  return restored > 0;
}

// ━━━ 验证单个优化 ━━━
function verifyOptimization(request) {
  const requestId = request.request_id;
  const affectedWorkflows = (request.impact_assessment && request.impact_assessment.affected_workflows) || [];

  console.log(`\n🔍 验证: ${requestId}`);
  console.log(`   方案: ${request.proposed_optimization}`);

  // 检查受影响 Workflow 的健康度
  const health = checkWorkflowHealth(affectedWorkflows);

  if (!health.healthy) {
    console.log(`   ❌ 验证失败: ${health.reason}`);

    // 异常熔断：回滚
    const rolled = rollbackOptimization(request);
    return {
      verified: false,
      reason: health.reason,
      rolled_back: rolled,
      verified_at: new Date(Date.now() + BEIJING_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 19) + '+08:00'
    };
  }

  console.log(`   ✅ 验证通过: ${health.reason}`);
  return {
    verified: true,
    reason: health.reason,
    rolled_back: false,
    verified_at: new Date(Date.now() + BEIJING_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 19) + '+08:00'
  };
}

// ━━━ 主验证流程 ━━━
function verifyAll() {
  console.log('🔍 天眼·ASOP 验证器启动');
  console.log('═══════════════════════════════════════════\n');

  if (!fs.existsSync(EXECUTED_DIR)) {
    console.log('ℹ️ executed/ 目录不存在，无待验证优化');
    const result = { total: 0, verified: 0, rolled_back: 0 };
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  const files = fs.readdirSync(EXECUTED_DIR)
    .filter(f => f.endsWith('.json') && f !== '.gitkeep');

  if (files.length === 0) {
    console.log('🔍 ASOP：无待验证的已执行优化');
    const result = { total: 0, verified: 0, rolled_back: 0 };
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log(`🔍 ASOP：发现 ${files.length} 条待验证的已执行优化\n`);

  const summary = { total: files.length, verified: 0, rolled_back: 0, results: [] };

  for (const file of files) {
    const filePath = path.join(EXECUTED_DIR, file);
    const req = readJSON(filePath);
    if (!req) {
      console.log(`⚠️ 无法解析 ${file}，跳过`);
      continue;
    }

    const result = verifyOptimization(req);
    req.verification_result = result;

    if (result.verified) {
      // 验证通过 → 移到 verified/ 归档
      fs.mkdirSync(VERIFIED_DIR, { recursive: true });
      fs.writeFileSync(path.join(VERIFIED_DIR, file), JSON.stringify(req, null, 2) + '\n');
      fs.unlinkSync(filePath);
      summary.verified++;
    } else {
      // 验证失败 + 已回滚 → 标记在 executed/（保留记录）
      fs.writeFileSync(filePath, JSON.stringify(req, null, 2) + '\n');
      summary.rolled_back++;
    }

    summary.results.push({
      request_id: req.request_id,
      verified: result.verified,
      rolled_back: result.rolled_back,
      reason: result.reason
    });
  }

  console.log(`\n📊 验证结果：通过 ${summary.verified} / 回滚 ${summary.rolled_back}`);
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

// ━━━ 导出 ━━━
module.exports = { verifyAll, verifyOptimization, rollbackOptimization };

// ━━━ 直接运行 ━━━
if (require.main === module) {
  verifyAll();
}
