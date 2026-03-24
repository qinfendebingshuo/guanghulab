#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// .github/scripts/tianyan-repair.js
// Phase C — 铸渊自动修复核心
//
// 输入: /tmp/tianyan/analysis.json
// 输出: 修复后的文件写入修复分支, /tmp/tianyan/repair-result.json
//
// 对每个 auto_fixable 错误调用 Gemini 生成修复代码
// 安全护栏：七条铁律

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
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

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getTimestamp() {
  return new Date().toISOString();
}

function getDateStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

// ━━━ 安全护栏：七条铁律 ━━━

function isProtectedFile(filePath, config) {
  const protectedPatterns = config.safety.protected_patterns || [];
  const fileName = path.basename(filePath);

  for (const pattern of protectedPatterns) {
    // Simple glob matching for tianyan-*.yml style patterns
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    if (regex.test(fileName)) {
      return true;
    }
  }

  return false;
}

function validateRepairSafety(filePath, originalContent, repairedContent, config) {
  const checks = [];
  const fileName = path.basename(filePath);

  // Iron Rule 1: Never modify protected files
  if (isProtectedFile(filePath, config)) {
    checks.push({ rule: 'protected_file', pass: false, detail: `${fileName} is protected` });
    return { safe: false, checks };
  }

  // Iron Rule 2: Never delete security checks or tianyan scan steps
  if (filePath.endsWith('.yml')) {
    const origTianyanRefs = (originalContent.match(/tianyan/gi) || []).length;
    const newTianyanRefs = (repairedContent.match(/tianyan/gi) || []).length;
    if (newTianyanRefs < origTianyanRefs) {
      checks.push({ rule: 'tianyan_refs_removed', pass: false, detail: 'Tianyan references were removed' });
      return { safe: false, checks };
    }
  }

  // Iron Rule 3: Never add new secrets references
  const origSecrets = (originalContent.match(/secrets\.\w+/g) || []);
  const newSecrets = (repairedContent.match(/secrets\.\w+/g) || []);
  const addedSecrets = newSecrets.filter(s => !origSecrets.includes(s));
  if (addedSecrets.length > 0) {
    checks.push({ rule: 'new_secrets_added', pass: false, detail: `New secrets: ${addedSecrets.join(', ')}` });
    return { safe: false, checks };
  }

  // Iron Rule 4: Limit change size
  const origLines = originalContent.split('\n').length;
  const newLines = repairedContent.split('\n').length;
  const diff = Math.abs(newLines - origLines);
  if (diff > config.safety.max_lines_per_file) {
    checks.push({ rule: 'too_many_changes', pass: false, detail: `${diff} lines changed (max ${config.safety.max_lines_per_file})` });
    return { safe: false, checks };
  }

  // Iron Rule 5: No hardcoded tokens
  const tokenPatterns = [/ghp_[A-Za-z0-9]{36}/, /github_pat_[A-Za-z0-9]+/, /gho_[A-Za-z0-9]+/];
  for (const pat of tokenPatterns) {
    if (pat.test(repairedContent)) {
      checks.push({ rule: 'hardcoded_token', pass: false, detail: 'Hardcoded token detected' });
      return { safe: false, checks };
    }
  }

  // Iron Rule 6: Never push directly to main (check for push to main patterns)
  if (/git\s+push\s+origin\s+main/i.test(repairedContent) && !/git\s+push\s+origin\s+main/i.test(originalContent)) {
    checks.push({ rule: 'push_to_main', pass: false, detail: 'New push to main detected' });
    return { safe: false, checks };
  }

  checks.push({ rule: 'all_checks', pass: true, detail: 'All safety checks passed' });
  return { safe: true, checks };
}

// ━━━ Gemini API 调用 ━━━

function callGeminiAPI(prompt, systemPrompt, config) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      reject(new Error('GEMINI_API_KEY not set'));
      return;
    }

    const model = config.gemini.model || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const parsedUrl = new URL(url);

    const body = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${prompt}` }]
        }
      ],
      generationConfig: {
        temperature: config.gemini.temperature || 0.1,
        maxOutputTokens: config.gemini.max_output_tokens || 4096
      }
    });

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          resolve(text);
        } catch (e) {
          reject(new Error(`Gemini response parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Gemini API timeout'));
    });
    req.write(body);
    req.end();
  });
}

// ━━━ 语法验证 ━━━

function validateSyntax(filePath, content) {
  const ext = path.extname(filePath);
  const tmpFile = path.join(TMP_DIR, `validate-${Date.now()}${ext}`);

  try {
    fs.writeFileSync(tmpFile, content);

    if (ext === '.js') {
      execSync(`node --check "${tmpFile}"`, { stdio: 'pipe' });
    } else if (ext === '.json') {
      JSON.parse(content);
    } else if (ext === '.yml' || ext === '.yaml') {
      // Basic YAML validation: check for tab characters and obvious issues
      if (content.includes('\t')) {
        return { valid: false, error: 'YAML contains tab characters' };
      }
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, error: e.message };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
  }
}

// ━━━ 提取修复代码 ━━━

function extractFileContent(geminiResponse) {
  // Try to extract file content from code blocks
  const codeBlockMatch = geminiResponse.match(/```(?:yaml|yml|javascript|js|json|sh|bash)?\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1];
  }

  // If no code block, try to use the full response (minus any leading/trailing explanation)
  const lines = geminiResponse.split('\n');
  const contentLines = [];
  let inContent = false;

  for (const line of lines) {
    if (!inContent && (line.startsWith('#') || line.startsWith('name:') || line.startsWith('{') || line.startsWith('/') || line.startsWith('const ') || line.startsWith('//') || line.startsWith('#!/'))) {
      inContent = true;
    }
    if (inContent) {
      contentLines.push(line);
    }
  }

  return contentLines.length > 0 ? contentLines.join('\n') : geminiResponse;
}

// ━━━ 修复单个错误 ━━━

async function repairError(analysis, config) {
  const result = {
    workflow: analysis.workflow,
    error_type: analysis.error_type,
    files_modified: [],
    success: false,
    skipped: false,
    error: null
  };

  if (!analysis.auto_fixable) {
    result.skipped = true;
    result.error = 'Not auto-fixable';
    return result;
  }

  if (!analysis.affected_files || analysis.affected_files.length === 0) {
    result.skipped = true;
    result.error = 'No affected files identified';
    return result;
  }

  // Check file count limit
  if (analysis.affected_files.length > config.safety.max_files_per_repair) {
    result.error = `Too many files (${analysis.affected_files.length} > max ${config.safety.max_files_per_repair})`;
    return result;
  }

  const todayDate = new Date().toISOString().slice(0, 10);
  const rootCauseShort = (analysis.root_cause || analysis.error_type || '').slice(0, 80);
  const systemPrompt = `你是铸渊核心大脑。根据以下分析结果生成修复代码。
规则：
1. 只修改必要的行，最小化变更
2. 保留所有注释和格式
3. 输出完整的修复后文件内容
4. 在修复位置添加注释：# [AUTO-FIX] ${todayDate} by 铸渊 - ${rootCauseShort}
5. 严禁修改任何与报错无关的代码
6. 严禁删除任何安全检查或天眼扫描步骤
7. 输出格式：将完整修复后文件内容放在代码块中`;

  for (const filePath of analysis.affected_files) {
    const absPath = path.join(ROOT, filePath);
    if (!fs.existsSync(absPath)) {
      console.log(`  ⚠️ File not found: ${filePath}`);
      continue;
    }

    const originalContent = fs.readFileSync(absPath, 'utf8');

    const userPrompt = `分析结果：
${JSON.stringify(analysis, null, 2)}

当前文件内容 (${filePath})：
\`\`\`
${originalContent}
\`\`\`

请输出修复后的完整文件内容。`;

    try {
      if (!process.env.GEMINI_API_KEY) {
        console.log(`  ⚠️ No GEMINI_API_KEY — skipping Gemini repair for ${filePath}`);
        result.error = 'GEMINI_API_KEY not available';
        continue;
      }

      const response = await callGeminiAPI(userPrompt, systemPrompt, config);
      const repairedContent = extractFileContent(response);

      // Safety validation
      const safety = validateRepairSafety(filePath, originalContent, repairedContent, config);
      if (!safety.safe) {
        const failedRule = safety.checks.find(c => !c.pass);
        console.log(`  🛡️ Safety block for ${filePath}: ${failedRule.detail}`);
        result.error = `Safety block: ${failedRule.detail}`;
        continue;
      }

      // Syntax validation
      const syntax = validateSyntax(filePath, repairedContent);
      if (!syntax.valid) {
        console.log(`  ❌ Syntax error in repair for ${filePath}: ${syntax.error}`);
        result.error = `Syntax error: ${syntax.error}`;
        continue;
      }

      // Write repaired file
      fs.writeFileSync(absPath, repairedContent);
      result.files_modified.push(filePath);
      result.success = true;

      console.log(`  ✅ Repaired: ${filePath}`);
    } catch (e) {
      console.log(`  ❌ Repair failed for ${filePath}: ${e.message}`);
      result.error = e.message;
    }
  }

  return result;
}

// ━━━ 主流程 ━━━

async function main() {
  console.log('[铸渊核心大脑] Phase C 启动 — 自动修复');
  console.log('═══════════════════════════════════════════');

  ensureDir(TMP_DIR);

  const config = loadJSON(CONFIG_PATH);
  if (!config) {
    console.error('❌ 无法加载 tianyan-config.json');
    process.exit(1);
  }

  // Check weekend mode
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const utcHour = now.getUTCHours();
  // Saturday in CST = UTC Saturday (after 16:00 UTC Friday to 16:00 UTC Saturday)
  if (config.weekend_mode.enabled && config.weekend_mode.skip_repair_on_saturday) {
    // CST 20:00 = UTC 12:00, CST 00:00 = UTC 16:00
    if (dayOfWeek === 6 && utcHour >= 12) {
      console.log('🌙 周六休眠期 — 跳过自动修复');
      const skipResult = { timestamp: getTimestamp(), skipped: true, reason: 'saturday_hibernation', repairs: [] };
      fs.writeFileSync(path.join(TMP_DIR, 'repair-result.json'), JSON.stringify(skipResult, null, 2));
      return;
    }
  }

  // Load analysis
  const analysisPath = path.join(TMP_DIR, 'analysis.json');
  const analysis = loadJSON(analysisPath);
  if (!analysis) {
    console.error('❌ 无法加载 analysis.json');
    process.exit(1);
  }

  const fixableItems = (analysis.analyses || []).filter(a => a.auto_fixable);
  console.log(`📊 可修复项: ${fixableItems.length} / ${analysis.total}`);

  if (fixableItems.length === 0) {
    console.log('⚠️ 没有可自动修复的错误');
    const emptyResult = { timestamp: getTimestamp(), total: 0, repaired: 0, failed: 0, repairs: [] };
    fs.writeFileSync(path.join(TMP_DIR, 'repair-result.json'), JSON.stringify(emptyResult, null, 2));
    return;
  }

  // Create repair branch
  const branchName = `fix/auto-repair-${getDateStr()}-001`;
  console.log(`🌿 修复分支: ${branchName}`);

  const repairs = [];
  for (const item of fixableItems) {
    console.log(`\n⚒️ 修复: ${item.workflow} (${item.error_type})`);
    const result = await repairError(item, config);
    repairs.push(result);

    if (result.success && result.files_modified.length > 0) {
      // Git commit for each repair
      try {
        const shortDesc = item.root_cause ? item.root_cause.slice(0, 60) : item.error_type;
        for (const f of result.files_modified) {
          execSync(`git add "${f}"`, { cwd: ROOT, stdio: 'pipe' });
        }
        execSync(
          `git commit -m "[AUTO-FIX] ${item.workflow}: ${shortDesc} (by 铸渊夜间修复引擎)"`,
          { cwd: ROOT, stdio: 'pipe' }
        );
        console.log(`  📝 Committed fix for: ${item.workflow}`);
      } catch (e) {
        console.log(`  ⚠️ Git commit failed: ${e.message}`);
      }
    }
  }

  const repairResult = {
    timestamp: getTimestamp(),
    branch: branchName,
    total: fixableItems.length,
    repaired: repairs.filter(r => r.success).length,
    failed: repairs.filter(r => !r.success && !r.skipped).length,
    skipped: repairs.filter(r => r.skipped).length,
    repairs
  };

  fs.writeFileSync(path.join(TMP_DIR, 'repair-result.json'), JSON.stringify(repairResult, null, 2));

  console.log('\n═══════════════════════════════════════════');
  console.log(`📊 修复结果: 成功 ${repairResult.repaired} · 失败 ${repairResult.failed} · 跳过 ${repairResult.skipped}`);
}

main().catch(e => {
  console.error(`❌ Phase C 异常: ${e.message}`);
  process.exit(1);
});
