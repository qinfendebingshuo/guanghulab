// scripts/verify-modules.js
// 铸渊 · 模块上传验证脚本
//
// 功能：
//   ① 从 SYSLOG 内容中提取模块编号（M01, M22, M-AUTH 等）
//   ② 通过 routing-map.json 查找模块对应的目录
//   ③ 检测目录是否存在于仓库中
//   ④ 检测 dev-nodes 中开发者节点是否存在
//   ⑤ 输出验证结果（JSON 格式）到 GITHUB_OUTPUT
//
// 环境变量：
//   SYSLOG_CONTENT       SYSLOG 全文内容
//   BROADCAST_ID         广播编号（如 BC-M22-009-AW）
//   AUTHOR               提交者 GitHub 用户名

'use strict';

const fs = require('fs');
const path = require('path');
const devSuffixMap = require('./utils/dev-suffix-map');

const SYSLOG_CONTENT = process.env.SYSLOG_CONTENT || '';
const BROADCAST_ID = process.env.BROADCAST_ID || '';
const AUTHOR = process.env.AUTHOR || '';

const REPO_ROOT = path.resolve(__dirname, '..');
const ROUTING_MAP_PATH = path.join(REPO_ROOT, 'routing-map.json');
const DEV_STATUS_PATH = path.join(REPO_ROOT, '.github', 'persona-brain', 'dev-status.json');

// ══════════════════════════════════════════════════════════
// 模块编号提取
// ══════════════════════════════════════════════════════════

function extractModuleIds(content, broadcastId) {
  var modules = new Set();

  // 从广播编号提取模块编号（如 BC-M22-009-AW → M22）
  var bcMatch = broadcastId.match(/BC-([A-Z][A-Z0-9]+(?:-[A-Z]+)?)-/i);
  if (bcMatch) {
    modules.add(bcMatch[1].toUpperCase());
  }

  // 从内容中匹配模块编号模式
  // 支持: M01, M03, M05, M22, M-AUTH, M-CHANNEL, M-DASHBOARD, M-STATUS, M-MEMORY, M-DINGTALK
  var patterns = [
    /\b(M\d{2})\b/gi,
    /\b(M-[A-Z]+)\b/gi,
    /模块[：:]\s*(M[A-Z0-9-]+)/gi,
    /module[：:]\s*(M[A-Z0-9-]+)/gi,
  ];

  patterns.forEach(function (re) {
    var match;
    while ((match = re.exec(content)) !== null) {
      modules.add(match[1].toUpperCase());
    }
  });

  return Array.from(modules);
}

// ══════════════════════════════════════════════════════════
// 开发者编号提取
// ══════════════════════════════════════════════════════════

function extractDevId(content, broadcastId) {
  // 从内容中直接提取 DEV-XXX（最优先）
  var devMatch = content.match(/\b(DEV-\d{3})\b/i);
  if (devMatch) return devMatch[1].toUpperCase();

  // 从广播编号提取开发者编号（使用共享映射表）
  var mappedDevId = devSuffixMap.getDevIdFromBroadcast(broadcastId);
  if (mappedDevId) return mappedDevId;

  // 兜底：从 dev-status.json 匹配
  var suffixMatch = broadcastId.match(/BC-[A-Z0-9]+-\d+-([A-Z]+)/i);
  var devSuffix = suffixMatch ? suffixMatch[1].toUpperCase() : '';

  if (devSuffix) {
    try {
      var devStatus = JSON.parse(fs.readFileSync(DEV_STATUS_PATH, 'utf8'));
      var team = devStatus.team || [];
      for (var i = 0; i < team.length; i++) {
        var waiting = team[i].waiting || '';
        if (waiting.includes(broadcastId) || waiting.includes(devSuffix)) {
          return team[i].dev_id;
        }
      }
    } catch (_) { /* ignore */ }
  }

  return '';
}

// ══════════════════════════════════════════════════════════
// 模块目录验证
// ══════════════════════════════════════════════════════════

function verifyModules(moduleIds) {
  var routingMap = {};
  try {
    routingMap = JSON.parse(fs.readFileSync(ROUTING_MAP_PATH, 'utf8'));
  } catch (_) {
    console.log('⚠️  routing-map.json 不存在或格式错误');
  }

  var modules = routingMap.modules || {};
  var results = [];

  moduleIds.forEach(function (modId) {
    var entry = modules[modId];
    var result = {
      module_id: modId,
      registered: false,
      dir_exists: false,
      dir_path: '',
      dev_id: '',
      status: '',
      files_found: 0,
    };

    if (entry) {
      result.registered = true;
      result.dir_path = entry.dir || '';
      result.dev_id = entry.dev || '';
      result.status = entry.status || '';

      // 检查目录是否存在
      var dirFullPath = path.join(REPO_ROOT, entry.dir);
      if (fs.existsSync(dirFullPath)) {
        result.dir_exists = true;
        // 统计文件数量（不含隐藏文件）
        try {
          var files = fs.readdirSync(dirFullPath).filter(function (f) {
            return !f.startsWith('.');
          });
          result.files_found = files.length;
        } catch (_) { /* ignore */ }
      }
    } else {
      // 模块未在 routing-map 中注册，尝试直接查找
      var candidates = [
        modId.toLowerCase(),
        'm' + modId.replace(/^M/i, '').toLowerCase(),
        'dev-nodes/' + modId,
      ];
      for (var i = 0; i < candidates.length; i++) {
        var candidatePath = path.join(REPO_ROOT, candidates[i]);
        if (fs.existsSync(candidatePath)) {
          result.dir_exists = true;
          result.dir_path = candidates[i];
          try {
            var files = fs.readdirSync(candidatePath).filter(function (f) {
              return !f.startsWith('.');
            });
            result.files_found = files.length;
          } catch (_) { /* ignore */ }
          break;
        }
      }
    }

    results.push(result);
  });

  return results;
}

// ══════════════════════════════════════════════════════════
// 开发者节点验证
// ══════════════════════════════════════════════════════════

function verifyDevNode(devId) {
  if (!devId) return { exists: false, path: '', files: 0 };

  var devNodePath = path.join(REPO_ROOT, 'dev-nodes', devId);
  var result = { exists: false, path: 'dev-nodes/' + devId, files: 0 };

  if (fs.existsSync(devNodePath)) {
    result.exists = true;
    try {
      var files = fs.readdirSync(devNodePath).filter(function (f) {
        return !f.startsWith('.');
      });
      result.files = files.length;
    } catch (_) { /* ignore */ }
  }

  return result;
}

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

function main() {
  console.log('═══════════════════════════════════════════');
  console.log('🔍 铸渊 · 模块上传验证');
  console.log('═══════════════════════════════════════════');
  console.log('  广播编号: ' + BROADCAST_ID);
  console.log('  提交者: ' + AUTHOR);
  console.log('  内容长度: ' + SYSLOG_CONTENT.length + ' 字符');
  console.log('');

  // ① 提取模块编号
  var moduleIds = extractModuleIds(SYSLOG_CONTENT, BROADCAST_ID);
  console.log('📦 识别到模块: ' + (moduleIds.length > 0 ? moduleIds.join(', ') : '(无)'));

  // ② 提取开发者编号
  var devId = extractDevId(SYSLOG_CONTENT, BROADCAST_ID);
  console.log('👤 开发者编号: ' + (devId || '(未识别)'));

  // ③ 验证模块目录
  var moduleResults = verifyModules(moduleIds);

  // ④ 验证开发者节点
  var devNodeResult = verifyDevNode(devId);

  // ⑤ 汇总结果
  var allModulesUploaded = moduleResults.length > 0 && moduleResults.every(function (r) {
    return r.dir_exists;
  });

  var summary = {
    broadcast_id: BROADCAST_ID,
    author: AUTHOR,
    dev_id: devId,
    modules_detected: moduleIds,
    module_count: moduleIds.length,
    module_results: moduleResults,
    dev_node: devNodeResult,
    all_modules_uploaded: allModulesUploaded,
    verification_passed: allModulesUploaded || moduleIds.length === 0,
    timestamp: new Date().toISOString(),
  };

  // ⑥ 输出报告
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('📋 验证报告');
  console.log('═══════════════════════════════════════════');

  if (moduleResults.length === 0) {
    console.log('  ℹ️  未检测到模块引用，跳过模块验证');
  } else {
    moduleResults.forEach(function (r) {
      var icon = r.dir_exists ? '✅' : '❌';
      console.log('  ' + icon + ' ' + r.module_id +
        ' → ' + (r.dir_path || '(未注册)') +
        (r.dir_exists ? ' (' + r.files_found + ' 个文件)' : ' (目录不存在)'));
    });
  }

  console.log('  ' + (devNodeResult.exists ? '✅' : '⚠️') +
    ' 开发者节点: ' + devNodeResult.path +
    (devNodeResult.exists ? ' (' + devNodeResult.files + ' 个文件)' : ' (不存在)'));

  console.log('');
  console.log('  总结: ' + (summary.verification_passed ? '✅ 验证通过' : '❌ 模块未完整上传'));

  // ⑦ 写入 GITHUB_OUTPUT
  var outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    var delimiter = 'EOF_' + Date.now();
    var jsonStr = JSON.stringify(summary);
    fs.appendFileSync(outputFile, 'verify_result<<' + delimiter + '\n' + jsonStr + '\n' + delimiter + '\n');
    fs.appendFileSync(outputFile, 'modules_uploaded=' + (allModulesUploaded ? 'true' : 'false') + '\n');
    fs.appendFileSync(outputFile, 'verification_passed=' + (summary.verification_passed ? 'true' : 'false') + '\n');
    fs.appendFileSync(outputFile, 'module_count=' + moduleIds.length + '\n');
  }

  // ⑧ 将汇总文本输出（供后续步骤作为上下文）
  var reportLines = [
    '## 🔍 模块上传验证报告',
    '',
    '| 项目 | 结果 |',
    '|------|------|',
    '| 广播编号 | ' + BROADCAST_ID + ' |',
    '| 开发者 | ' + (devId || AUTHOR) + ' |',
    '| 检测模块数 | ' + moduleIds.length + ' |',
    '| 全部上传 | ' + (allModulesUploaded ? '✅ 是' : '❌ 否') + ' |',
    '| 验证结果 | ' + (summary.verification_passed ? '✅ 通过' : '❌ 未通过') + ' |',
  ];

  if (moduleResults.length > 0) {
    reportLines.push('');
    reportLines.push('### 模块详情');
    reportLines.push('| 模块 | 目录 | 状态 | 文件数 |');
    reportLines.push('|------|------|------|--------|');
    moduleResults.forEach(function (r) {
      reportLines.push('| ' + r.module_id + ' | ' + (r.dir_path || '-') +
        ' | ' + (r.dir_exists ? '✅ 已上传' : '❌ 未找到') +
        ' | ' + r.files_found + ' |');
    });
  }

  if (outputFile) {
    var reportDelimiter = 'REPORT_EOF_' + Date.now();
    fs.appendFileSync(outputFile, 'verify_report<<' + reportDelimiter + '\n' + reportLines.join('\n') + '\n' + reportDelimiter + '\n');
  }

  console.log('');
  console.log('✅ 验证完成');
}

main();
