#!/usr/bin/env node
/**
 * skyeye/scripts/scan-engine.js
 * 天眼扫描引擎 — 全量 + 增量基础设施扫描
 * Phase 1 of weekly scan: Infrastructure Scan
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SKYEYE_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(SKYEYE_DIR, 'infra-manifest.json');
const GUARDS_DIR = path.join(SKYEYE_DIR, 'guards');
const LOGS_DIR = path.join(SKYEYE_DIR, 'logs');

function getTimestamp() {
  return new Date().toISOString();
}

function getDateStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function scanGuardConfigs() {
  const results = { total: 0, valid: 0, invalid: [], missing_fields: [] };
  const requiredFields = ['guard_id', 'status', 'mode', 'quota_policy', 'health_check'];

  const files = fs.readdirSync(GUARDS_DIR).filter(f => f.endsWith('.json') && f !== 'guard-template.json');
  results.total = files.length;

  for (const file of files) {
    const filePath = path.join(GUARDS_DIR, file);
    const guard = loadJSON(filePath);
    if (!guard) {
      results.invalid.push({ file, reason: 'Invalid JSON' });
      continue;
    }
    const missing = requiredFields.filter(f => !(f in guard));
    if (missing.length > 0) {
      results.missing_fields.push({ file, missing });
    } else {
      results.valid++;
    }
  }
  return results;
}

function scanWorkflows() {
  const workflowDir = path.join(ROOT, '.github/workflows');
  const results = { total: 0, files: [], errors: [] };

  if (!fs.existsSync(workflowDir)) {
    results.errors.push('Workflow directory not found');
    return results;
  }

  const files = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  results.total = files.length;
  results.files = files;
  return results;
}

function scanDirectoryStructure() {
  const requiredDirs = [
    'buffer',
    'buffer/inbox',
    'buffer/staging',
    'buffer/scripts',
    'buffer/config',
    'grid-db',
    'skyeye',
    'skyeye/guards',
    'skyeye/scripts',
    'skyeye/logs',
    'skyeye/scan-report',
    'skyeye/hibernation',
    'skyeye/hibernation/checkpoints',
    'skyeye/hibernation/weekly-snapshots',
    'skyeye/hibernation/upgrade-packs',
    'skyeye/hibernation/distribution-reports',
    '.github/persona-brain',
    '.github/workflows',
    'scripts/skyeye'
  ];

  const results = { checked: requiredDirs.length, present: 0, missing: [] };

  for (const dir of requiredDirs) {
    const fullPath = path.join(ROOT, dir);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      results.present++;
    } else {
      results.missing.push(dir);
    }
  }
  return results;
}

function scanSubRepos(manifest) {
  const results = { total: 0, verified: [] };
  if (!manifest || !manifest.infrastructure || !manifest.infrastructure.github) return results;

  const repos = manifest.infrastructure.github.repos || [];
  results.total = repos.length;

  for (const repo of repos) {
    results.verified.push({
      name: repo.name,
      role: repo.role,
      guard_path_exists: repo.guard ? fs.existsSync(path.join(ROOT, repo.guard)) : false
    });
  }
  return results;
}

// D16 · 本体论完整性检查 (Ontology Integrity)
function checkOntologyIntegrity() {
  const result = {
    dimension: 'D16',
    name: '本体论完整性',
    checks: []
  };

  // 检查 ontology.json 存在且版本正确
  const ontologyPath = path.join(ROOT, '.github/persona-brain/ontology.json');
  if (fs.existsSync(ontologyPath)) {
    const ontology = loadJSON(ontologyPath);
    if (ontology) {
      result.checks.push({
        item: 'ontology.json 存在',
        status: '✅',
        version: ontology.version
      });
      // 验证六条公理完整
      const axiomCount = Object.keys(ontology.core_axioms || {}).length;
      result.checks.push({
        item: '核心公理完整性',
        status: axiomCount >= 6 ? '✅' : '🔴',
        detail: `${axiomCount}/6 条公理`
      });
      // 验证三层安全定义完整
      const layers = ontology.security_layers || {};
      const layerCount = Object.keys(layers).length;
      result.checks.push({
        item: '三层安全定义',
        status: layerCount >= 3 ? '✅' : '🔴',
        detail: `${layerCount}/3 层`
      });
    } else {
      result.checks.push({
        item: 'ontology.json 存在',
        status: '🔴',
        detail: 'JSON 解析失败'
      });
    }
  } else {
    result.checks.push({
      item: 'ontology.json 存在',
      status: '🔴',
      detail: '文件缺失'
    });
  }

  // 检查 copilot-instructions.md 包含本体论宣言
  const copilotPath = path.join(ROOT, '.github/copilot-instructions.md');
  if (fs.existsSync(copilotPath)) {
    const content = fs.readFileSync(copilotPath, 'utf8');
    const hasOntology = content.includes('数字地球本体论');
    result.checks.push({
      item: 'copilot-instructions 本体论宣言',
      status: hasOntology ? '✅' : '🟡',
      detail: hasOntology ? '已注入' : '未找到本体论段落'
    });
  }

  // 检查 README 包含本体论语言
  const readmePath = path.join(ROOT, 'README.md');
  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, 'utf8');
    const hasOntology = readme.includes('数字地球') || readme.includes('Digital Earth Ontology');
    result.checks.push({
      item: 'README 本体论标识',
      status: hasOntology ? '✅' : '🟡',
      detail: hasOntology ? '已注入' : '未找到'
    });
  }

  return result;
}

// D20 · 双端映射完整性检查 (Neural Map Integrity)
function checkNeuralMapIntegrity() {
  var result = {
    dimension: 'D20',
    name: '双端映射完整性',
    checks: [],
    unmapped_workflows: [],
    invalid_brains: []
  };

  var neuralMapPath = path.join(SKYEYE_DIR, 'neural-map.json');
  if (!fs.existsSync(neuralMapPath)) {
    result.checks.push({
      item: 'neural-map.json 存在',
      status: '🔴',
      detail: '文件缺失'
    });
    return result;
  }

  var neuralMap = loadJSON(neuralMapPath);
  if (!neuralMap) {
    result.checks.push({
      item: 'neural-map.json 可解析',
      status: '🔴',
      detail: 'JSON 解析失败'
    });
    return result;
  }

  result.checks.push({
    item: 'neural-map.json 存在且可解析',
    status: '✅',
    detail: 'version: ' + (neuralMap.version || 'unknown')
  });

  // 检查所有映射的 Workflow 文件是否实际存在
  var mappedFiles = {};
  var workflowEntries = Object.entries(neuralMap.github_workflows || {});
  var existCount = 0;
  var missingCount = 0;

  for (var i = 0; i < workflowEntries.length; i++) {
    var wfId = workflowEntries[i][0];
    var wf = workflowEntries[i][1];
    var filePath = path.join(ROOT, wf.file);
    mappedFiles[wf.file] = true;
    if (fs.existsSync(filePath)) {
      existCount++;
    } else {
      missingCount++;
      result.checks.push({
        item: '映射文件存在: ' + wf.file,
        status: '🔴',
        detail: wfId + ' 映射的文件不存在'
      });
    }
  }

  result.checks.push({
    item: '映射 Workflow 文件检查',
    status: missingCount === 0 ? '✅' : '🔴',
    detail: existCount + '/' + workflowEntries.length + ' 文件存在'
  });

  // 检查实际 .yml 中是否有未映射的（仅检查核心 Workflow，非全量）
  var workflowDir = path.join(ROOT, '.github/workflows');
  if (fs.existsSync(workflowDir)) {
    var actualFiles = fs.readdirSync(workflowDir)
      .filter(function(f) { return f.endsWith('.yml') || f.endsWith('.yaml'); });

    for (var j = 0; j < actualFiles.length; j++) {
      var ymlPath = '.github/workflows/' + actualFiles[j];
      if (!mappedFiles[ymlPath]) {
        result.unmapped_workflows.push(actualFiles[j]);
      }
    }
  }

  // Note: unmapped is not necessarily an error since neural-map only maps core workflows
  // The total workflow count minus mapped workflows gives the expected unmapped count
  var mappedCount = workflowEntries.length;
  result.checks.push({
    item: '未映射 Workflow 检查',
    status: '✅',
    detail: result.unmapped_workflows.length + ' 个未映射（非核心 Workflow 可不映射，已映射 ' + mappedCount + ' 个）'
  });

  // 检查每个 brain 是否在 notion_brains 中注册
  for (var k = 0; k < workflowEntries.length; k++) {
    var wfId2 = workflowEntries[k][0];
    var wf2 = workflowEntries[k][1];
    if (wf2.brain && !(neuralMap.notion_brains || {})[wf2.brain]) {
      result.invalid_brains.push({ workflow: wfId2, brain: wf2.brain });
    }
  }

  result.checks.push({
    item: 'Brain 注册完整性',
    status: result.invalid_brains.length === 0 ? '✅' : '🔴',
    detail: result.invalid_brains.length === 0
      ? '所有 Brain 均已注册'
      : result.invalid_brains.length + ' 个 Brain 未注册'
  });

  // 检查 report_path 目录是否存在
  var reportPathMissing = 0;
  for (var m = 0; m < workflowEntries.length; m++) {
    var wf3 = workflowEntries[m][1];
    if (wf3.report_path && !fs.existsSync(path.join(ROOT, wf3.report_path))) {
      reportPathMissing++;
    }
  }

  result.checks.push({
    item: '报告目录存在性',
    status: reportPathMissing === 0 ? '✅' : '🟡',
    detail: reportPathMissing === 0
      ? '所有报告目录已创建'
      : reportPathMissing + ' 个报告目录缺失'
  });

  return result;
}

function run() {
  const args = process.argv.slice(2);
  const mode = args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'full';

  console.log(`[SkyEye Scan Engine] Mode: ${mode}`);
  console.log(`[SkyEye Scan Engine] Timestamp: ${getTimestamp()}`);

  const manifest = loadJSON(MANIFEST_PATH);
  if (!manifest) {
    console.error('[SkyEye Scan Engine] ERROR: Cannot load infra-manifest.json');
    process.exit(1);
  }

  const scanResult = {
    scan_id: `SCAN-${getDateStr()}`,
    mode,
    timestamp: getTimestamp(),
    guard_scan: scanGuardConfigs(),
    workflow_scan: scanWorkflows(),
    directory_scan: scanDirectoryStructure(),
    sub_repo_scan: scanSubRepos(manifest),
    ontology_scan: checkOntologyIntegrity(),
    neural_map_scan: checkNeuralMapIntegrity(),
    issues: [],
    summary: {}
  };

  // Collect issues
  if (scanResult.guard_scan.invalid.length > 0) {
    scanResult.issues.push(...scanResult.guard_scan.invalid.map(i => ({
      severity: 'error',
      category: 'guard_config',
      detail: `Invalid guard config: ${i.file} - ${i.reason}`
    })));
  }
  if (scanResult.guard_scan.missing_fields.length > 0) {
    scanResult.issues.push(...scanResult.guard_scan.missing_fields.map(i => ({
      severity: 'warning',
      category: 'guard_config',
      detail: `Guard ${i.file} missing fields: ${i.missing.join(', ')}`
    })));
  }
  if (scanResult.directory_scan.missing.length > 0) {
    scanResult.issues.push(...scanResult.directory_scan.missing.map(d => ({
      severity: 'warning',
      category: 'directory_structure',
      detail: `Missing directory: ${d}`
    })));
  }

  // D16 · 本体论完整性 issues
  if (scanResult.ontology_scan && scanResult.ontology_scan.checks) {
    for (const check of scanResult.ontology_scan.checks) {
      if (check.status === '🔴') {
        scanResult.issues.push({
          severity: 'error',
          category: 'ontology_integrity',
          detail: `D16 · ${check.item}: ${check.detail || '失败'}`
        });
      } else if (check.status === '🟡') {
        scanResult.issues.push({
          severity: 'warning',
          category: 'ontology_integrity',
          detail: `D16 · ${check.item}: ${check.detail || '需关注'}`
        });
      }
    }
  }

  // D20 · 双端映射完整性 issues
  if (scanResult.neural_map_scan && scanResult.neural_map_scan.checks) {
    for (const check of scanResult.neural_map_scan.checks) {
      if (check.status === '🔴') {
        scanResult.issues.push({
          severity: 'error',
          category: 'neural_map_integrity',
          detail: `D20 · ${check.item}: ${check.detail || '失败'}`
        });
      } else if (check.status === '🟡') {
        scanResult.issues.push({
          severity: 'warning',
          category: 'neural_map_integrity',
          detail: `D20 · ${check.item}: ${check.detail || '需关注'}`
        });
      }
    }
    if (scanResult.neural_map_scan.invalid_brains.length > 0) {
      scanResult.issues.push({
        severity: 'error',
        category: 'neural_map_integrity',
        detail: `D20 · Brain 映射指向不存在的 Agent: ${scanResult.neural_map_scan.invalid_brains.map(b => b.brain).join(', ')}`
      });
    }
  }

  // Summary
  scanResult.summary = {
    total_issues: scanResult.issues.length,
    errors: scanResult.issues.filter(i => i.severity === 'error').length,
    warnings: scanResult.issues.filter(i => i.severity === 'warning').length,
    guards_healthy: `${scanResult.guard_scan.valid}/${scanResult.guard_scan.total}`,
    workflows_found: scanResult.workflow_scan.total,
    directories_ok: `${scanResult.directory_scan.present}/${scanResult.directory_scan.checked}`
  };

  // Update manifest
  manifest.last_scan = getTimestamp();
  manifest.last_scan_by = 'skyeye-scan-engine';
  saveJSON(MANIFEST_PATH, manifest);

  // Write log
  const logDir = path.join(LOGS_DIR, mode === 'full' ? 'weekly' : 'daily');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `scan-${getDateStr()}.json`);
  saveJSON(logPath, scanResult);

  console.log(`[SkyEye Scan Engine] Scan complete.`);
  console.log(`[SkyEye Scan Engine] Guards: ${scanResult.summary.guards_healthy}`);
  console.log(`[SkyEye Scan Engine] Workflows: ${scanResult.summary.workflows_found}`);
  console.log(`[SkyEye Scan Engine] Directories: ${scanResult.summary.directories_ok}`);
  console.log(`[SkyEye Scan Engine] Issues: ${scanResult.summary.total_issues} (${scanResult.summary.errors} errors, ${scanResult.summary.warnings} warnings)`);

  // D16 · 本体论完整性状态
  if (scanResult.ontology_scan) {
    console.log(`[SkyEye Scan Engine] D16 Ontology:`);
    for (const check of scanResult.ontology_scan.checks) {
      console.log(`  ${check.status} ${check.item}${check.detail ? ' · ' + check.detail : ''}${check.version ? ' · v' + check.version : ''}`);
    }
  }

  // D20 · 双端映射完整性状态
  if (scanResult.neural_map_scan) {
    console.log(`[SkyEye Scan Engine] D20 Neural Map:`);
    for (const check of scanResult.neural_map_scan.checks) {
      console.log(`  ${check.status} ${check.item}${check.detail ? ' · ' + check.detail : ''}`);
    }
  }
  console.log(`[SkyEye Scan Engine] Log saved: ${logPath}`);

  // Output full result as JSON for pipeline
  console.log('---SCAN_RESULT_JSON---');
  console.log(JSON.stringify(scanResult, null, 2));

  return scanResult;
}

run();
