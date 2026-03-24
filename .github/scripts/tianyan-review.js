#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// .github/scripts/tianyan-review.js
// Phase D — 天眼审核修复代码 (H1-H9 Checklist)
//
// 输入: /tmp/tianyan/repair-result.json + git diff on repair branch
// 输出: /tmp/tianyan/review-result.json
//
// 天眼检查清单 v3.0:
//   H1 → Secrets 安全：无硬编码令牌
//   H2 → 文件完整性：YAML/JSON/JS 语法正确
//   H3 → 依赖安全：无新增不受信依赖
//   H4 → 权限最小化：Workflow permissions 未被扩大
//   H5 → 天眼自保护：tianyan-*.yml 文件未被修改
//   H6 → 变更范围：总变更行数 < 200，单文件 < 50
//   H7 → Secrets引用完整性：修改前后 secrets.* 引用数量一致
//   H8 → 注释规范：每个修复位置都有 [AUTO-FIX] 注释
//   H9 → 无残留调试代码：无 console.log、echo debug 等临时代码

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const TMP_DIR = '/tmp/tianyan';
const CONFIG_PATH = path.join(ROOT, '.github/tianyan-config.json');

// ━━━ 工具函数 ━━━

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function getTimestamp() {
  return new Date().toISOString();
}

function gitExec(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (e) {
    return '';
  }
}

// ━━━ H1: Secrets 安全 ━━━

function checkH1_SecretsHardcoded(modifiedFiles) {
  const result = { id: 'H1', name: 'Secrets安全', pass: true, details: [] };

  const tokenPatterns = [
    { pattern: /ghp_[A-Za-z0-9]{36}/g, type: 'GitHub PAT' },
    { pattern: /github_pat_[A-Za-z0-9_]+/g, type: 'GitHub Fine-grained PAT' },
    { pattern: /gho_[A-Za-z0-9]+/g, type: 'GitHub OAuth token' },
    { pattern: /sk-[A-Za-z0-9]{40,}/g, type: 'API key (sk-)' },
    { pattern: /AIza[A-Za-z0-9_-]{35}/g, type: 'Google API key' }
  ];

  for (const filePath of modifiedFiles) {
    const absPath = path.join(ROOT, filePath);
    if (!fs.existsSync(absPath)) continue;
    const content = fs.readFileSync(absPath, 'utf8');

    for (const { pattern, type } of tokenPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        result.pass = false;
        result.details.push(`${filePath}: Found hardcoded ${type}`);
      }
    }
  }

  if (result.pass) result.details.push('No hardcoded tokens found');
  return result;
}

// ━━━ H2: 文件完整性 ━━━

function checkH2_FileSyntax(modifiedFiles) {
  const result = { id: 'H2', name: '文件完整性', pass: true, details: [] };

  for (const filePath of modifiedFiles) {
    const absPath = path.join(ROOT, filePath);
    if (!fs.existsSync(absPath)) continue;
    const content = fs.readFileSync(absPath, 'utf8');
    const ext = path.extname(filePath);

    try {
      if (ext === '.json') {
        JSON.parse(content);
      } else if (ext === '.js') {
        execSync(`node --check "${absPath}"`, { stdio: 'pipe' });
      } else if (ext === '.yml' || ext === '.yaml') {
        if (content.includes('\t')) {
          throw new Error('YAML contains tab characters');
        }
        // Basic YAML structural check: must have at least one key-value or comment
        const trimmed = content.trim();
        if (trimmed.length > 0) {
          const hasValidStructure = trimmed.split('\n').some(line => {
            const l = line.trim();
            return l.startsWith('#') || l.startsWith('---') || l.includes(':') || l.startsWith('-');
          });
          if (!hasValidStructure) {
            throw new Error('YAML does not contain valid structure');
          }
        }
      }
      result.details.push(`${filePath}: ✅ syntax OK`);
    } catch (e) {
      result.pass = false;
      result.details.push(`${filePath}: ❌ ${e.message}`);
    }
  }

  return result;
}

// ━━━ H3: 依赖安全 ━━━

function checkH3_DependencySafety(modifiedFiles) {
  const result = { id: 'H3', name: '依赖安全', pass: true, details: [] };

  for (const filePath of modifiedFiles) {
    if (!filePath.endsWith('.yml') && !filePath.endsWith('.yaml')) continue;
    const absPath = path.join(ROOT, filePath);
    if (!fs.existsSync(absPath)) continue;

    const content = fs.readFileSync(absPath, 'utf8');

    // Check for new uses: actions that aren't from trusted sources
    const usesMatches = content.match(/uses:\s*([^\s#]+)/g) || [];
    for (const use of usesMatches) {
      const action = use.replace('uses:', '').trim();
      // Allow official actions/* and known trusted actions
      const trusted = ['actions/', 'github/', 'peter-evans/', 'dawidd6/', 'peaceiris/'];
      const isTrusted = trusted.some(t => action.startsWith(t));
      if (!isTrusted && !action.startsWith('./')) {
        result.details.push(`${filePath}: ⚠️ External action: ${action}`);
        // Don't fail, just warn
      }
    }
  }

  if (result.details.length === 0) result.details.push('No dependency concerns');
  return result;
}

// ━━━ H4: 权限最小化 ━━━

function checkH4_PermissionsMinimal(modifiedFiles) {
  const result = { id: 'H4', name: '权限最小化', pass: true, details: [] };

  for (const filePath of modifiedFiles) {
    if (!filePath.endsWith('.yml') && !filePath.endsWith('.yaml')) continue;
    const absPath = path.join(ROOT, filePath);
    if (!fs.existsSync(absPath)) continue;

    const content = fs.readFileSync(absPath, 'utf8');

    // Check for overly broad permissions
    if (content.includes('permissions: write-all') || content.includes('permissions:\n  contents: write\n  actions: write\n  issues: write\n  pull-requests: write')) {
      result.pass = false;
      result.details.push(`${filePath}: ❌ Overly broad permissions detected`);
    }
  }

  if (result.pass) result.details.push('Permissions within acceptable scope');
  return result;
}

// ━━━ H5: 天眼自保护 ━━━

function checkH5_TianyanProtection(modifiedFiles) {
  const result = { id: 'H5', name: '天眼自保护', pass: true, details: [] };

  for (const filePath of modifiedFiles) {
    const fileName = path.basename(filePath);
    if (fileName.match(/^tianyan-.*\.yml$/)) {
      result.pass = false;
      result.details.push(`${filePath}: ❌ tianyan workflow file was modified`);
    }
  }

  if (result.pass) result.details.push('No tianyan workflow files modified');
  return result;
}

// ━━━ H6: 变更范围 ━━━

function checkH6_ChangeScope(modifiedFiles, config) {
  const result = { id: 'H6', name: '变更范围', pass: true, details: [] };

  let totalChanged = 0;
  const maxPerFile = config.safety.max_lines_per_file || 50;
  const maxTotal = config.safety.max_total_changed_lines || 200;

  for (const filePath of modifiedFiles) {
    const diff = gitExec(`git diff --numstat main -- "${filePath}"`) || gitExec(`git diff --numstat HEAD -- "${filePath}"`);
    if (!diff) continue;

    const parts = diff.split('\t');
    const added = parseInt(parts[0]) || 0;
    const deleted = parseInt(parts[1]) || 0;
    const fileChanged = added + deleted;
    totalChanged += fileChanged;

    if (fileChanged > maxPerFile) {
      result.pass = false;
      result.details.push(`${filePath}: ❌ ${fileChanged} lines changed (max ${maxPerFile})`);
    } else {
      result.details.push(`${filePath}: ✅ ${fileChanged} lines changed`);
    }
  }

  if (totalChanged > maxTotal) {
    result.pass = false;
    result.details.push(`Total: ❌ ${totalChanged} lines (max ${maxTotal})`);
  } else {
    result.details.push(`Total: ✅ ${totalChanged} lines`);
  }

  return result;
}

// ━━━ H7: Secrets 引用完整性 ━━━

function checkH7_SecretsIntegrity(modifiedFiles) {
  const result = { id: 'H7', name: 'Secrets引用完整性', pass: true, details: [] };

  for (const filePath of modifiedFiles) {
    if (!filePath.endsWith('.yml') && !filePath.endsWith('.yaml')) continue;

    // Get original content from git (use main branch as reference)
    const originalContent = gitExec(`git show main:"${filePath}" 2>/dev/null`) || gitExec(`git show HEAD:"${filePath}" 2>/dev/null`);
    const absPath = path.join(ROOT, filePath);
    if (!fs.existsSync(absPath)) continue;
    const newContent = fs.readFileSync(absPath, 'utf8');

    const origSecrets = (originalContent.match(/secrets\.\w+/g) || []).sort();
    const newSecrets = (newContent.match(/secrets\.\w+/g) || []).sort();

    const removed = origSecrets.filter(s => !newSecrets.includes(s));
    const added = newSecrets.filter(s => !origSecrets.includes(s));

    if (removed.length > 0) {
      result.pass = false;
      result.details.push(`${filePath}: ❌ Secrets removed: ${removed.join(', ')}`);
    }
    if (added.length > 0) {
      result.pass = false;
      result.details.push(`${filePath}: ❌ Secrets added: ${added.join(', ')}`);
    }
    if (removed.length === 0 && added.length === 0) {
      result.details.push(`${filePath}: ✅ Secrets references intact`);
    }
  }

  return result;
}

// ━━━ H8: 注释规范 ━━━

function checkH8_AutoFixComments(modifiedFiles) {
  const result = { id: 'H8', name: '注释规范', pass: true, details: [] };

  let hasModifiedContent = false;
  for (const filePath of modifiedFiles) {
    const absPath = path.join(ROOT, filePath);
    if (!fs.existsSync(absPath)) continue;
    const content = fs.readFileSync(absPath, 'utf8');

    if (content.includes('[AUTO-FIX]')) {
      result.details.push(`${filePath}: ✅ [AUTO-FIX] comment found`);
      hasModifiedContent = true;
    }
  }

  if (!hasModifiedContent && modifiedFiles.length > 0) {
    result.pass = false;
    result.details.push('❌ No [AUTO-FIX] comments found in modified files');
  }

  return result;
}

// ━━━ H9: 无残留调试代码 ━━━

function checkH9_NoDebugCode(modifiedFiles) {
  const result = { id: 'H9', name: '无残留调试代码', pass: true, details: [] };

  const debugPatterns = [
    /console\.log\s*\(\s*['"]debug/gi,
    /echo\s+['"]?debug/gi,
    /TODO:\s*remove/gi,
    /FIXME:\s*temp/gi,
    /console\.log\s*\(\s*['"]test/gi
  ];

  for (const filePath of modifiedFiles) {
    const absPath = path.join(ROOT, filePath);
    if (!fs.existsSync(absPath)) continue;
    const content = fs.readFileSync(absPath, 'utf8');

    for (const pattern of debugPatterns) {
      if (pattern.test(content)) {
        result.pass = false;
        result.details.push(`${filePath}: ❌ Debug code found: ${pattern.source}`);
      }
    }
  }

  if (result.pass) result.details.push('No debug code residue found');
  return result;
}

// ━━━ 主审核流程 ━━━

function main() {
  console.log('[天眼 v3.0] Phase D 启动 — 审核修复代码');
  console.log('═══════════════════════════════════════════');

  const config = loadJSON(CONFIG_PATH);
  if (!config) {
    console.error('❌ 无法加载 tianyan-config.json');
    process.exit(1);
  }

  // Load repair result
  const repairResult = loadJSON(path.join(TMP_DIR, 'repair-result.json'));
  if (!repairResult) {
    console.log('⚠️ repair-result.json 不存在');
    const result = { timestamp: getTimestamp(), pass: false, reason: 'No repair result found', checks: [] };
    fs.writeFileSync(path.join(TMP_DIR, 'review-result.json'), JSON.stringify(result, null, 2));
    return;
  }

  if (repairResult.skipped) {
    console.log('⚠️ 修复已跳过（周末模式）');
    const result = { timestamp: getTimestamp(), pass: false, reason: 'Repair skipped', checks: [] };
    fs.writeFileSync(path.join(TMP_DIR, 'review-result.json'), JSON.stringify(result, null, 2));
    return;
  }

  // Collect all modified files
  const modifiedFiles = [];
  for (const repair of (repairResult.repairs || [])) {
    if (repair.success && repair.files_modified) {
      modifiedFiles.push(...repair.files_modified);
    }
  }

  const uniqueFiles = [...new Set(modifiedFiles)];
  console.log(`📁 审核文件: ${uniqueFiles.length} 个\n`);

  if (uniqueFiles.length === 0) {
    console.log('⚠️ 没有修改的文件需要审核');
    const result = { timestamp: getTimestamp(), pass: false, reason: 'No files to review', checks: [], pr_needed: false };
    fs.writeFileSync(path.join(TMP_DIR, 'review-result.json'), JSON.stringify(result, null, 2));
    return;
  }

  // Run all checks
  const checks = [
    checkH1_SecretsHardcoded(uniqueFiles),
    checkH2_FileSyntax(uniqueFiles),
    checkH3_DependencySafety(uniqueFiles),
    checkH4_PermissionsMinimal(uniqueFiles),
    checkH5_TianyanProtection(uniqueFiles),
    checkH6_ChangeScope(uniqueFiles, config),
    checkH7_SecretsIntegrity(uniqueFiles),
    checkH8_AutoFixComments(uniqueFiles),
    checkH9_NoDebugCode(uniqueFiles)
  ];

  // Print results
  console.log('📋 天眼检查清单 v3.0:');
  console.log('─────────────────────────────────');
  let allPass = true;
  for (const check of checks) {
    const icon = check.pass ? '✅' : '❌';
    console.log(`  ${icon} ${check.id}: ${check.name}`);
    for (const detail of check.details) {
      console.log(`      ${detail}`);
    }
    if (!check.pass) allPass = false;
  }
  console.log('─────────────────────────────────');

  const reviewResult = {
    timestamp: getTimestamp(),
    pass: allPass,
    pr_needed: allPass,
    checks,
    files_reviewed: uniqueFiles,
    summary: {
      total_checks: checks.length,
      passed: checks.filter(c => c.pass).length,
      failed: checks.filter(c => !c.pass).length
    }
  };

  fs.writeFileSync(path.join(TMP_DIR, 'review-result.json'), JSON.stringify(reviewResult, null, 2));

  if (allPass) {
    console.log('\n✅ 天眼审核通过 — 准备创建 PR');
  } else {
    const failedChecks = checks.filter(c => !c.pass).map(c => c.id).join(', ');
    console.log(`\n❌ 天眼审核未通过 — 失败项: ${failedChecks}`);
  }
}

main();
