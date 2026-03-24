#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// .github/scripts/tianyan-analyze.js
// Phase B — 报错智能分析引擎
//
// 输入: 环境变量 ERROR_REPORT (JSON)
// 输出: /tmp/tianyan/analysis.json
//
// 调用 Gemini API 分析每个错误的根因、影响文件、修复方案、风险等级

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = '/tmp/tianyan';
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
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getTimestamp() {
  return new Date().toISOString();
}

// ━━━ 错误分类器 ━━━

function classifyError(workflow, errorMessage) {
  const msg = (errorMessage || '').toLowerCase();

  if (msg.includes('json') && (msg.includes('parse') || msg.includes('syntax'))) return 'config_parse';
  if (msg.includes('yaml') && (msg.includes('parse') || msg.includes('syntax'))) return 'config_parse';
  if (msg.includes('401') || msg.includes('token expired') || msg.includes('unauthorized')) return 'token_expired';
  if (msg.includes('oauth') && msg.includes('failed')) return 'rclone_oauth_parse';
  if (msg.includes('rclone') && msg.includes('failed to create')) return 'rclone_oauth_parse';
  if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('503')) return 'network_timeout';
  if (msg.includes('403') || msg.includes('permission') || msg.includes('insufficient')) return 'permission_denied';
  if (msg.includes('command not found') || msg.includes('syntaxerror') || msg.includes('referenceerror')) return 'script_error';
  if (msg.includes('exit code') || msg.includes('process completed with exit code')) return 'script_error';

  return 'unknown';
}

// ━━━ 判断是否可自动修复 ━━━

function isAutoFixable(errorType, config) {
  if (config.error_classification.auto_fixable.includes(errorType)) return true;
  return false;
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
        maxOutputTokens: config.gemini.max_output_tokens || 4096,
        responseMimeType: 'application/json'
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
          try {
            resolve(JSON.parse(text));
          } catch {
            resolve({ raw_response: text, parse_error: true });
          }
        } catch (e) {
          reject(new Error(`Gemini response parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Gemini API timeout'));
    });
    req.write(body);
    req.end();
  });
}

// ━━━ 获取仓库文件树（简化版） ━━━

function getRepoTree() {
  const tree = [];
  const wfDir = path.join(ROOT, '.github/workflows');
  const scriptsDir = path.join(ROOT, 'scripts');

  try {
    if (fs.existsSync(wfDir)) {
      tree.push('.github/workflows/');
      fs.readdirSync(wfDir).filter(f => f.endsWith('.yml')).forEach(f => {
        tree.push(`  ${f}`);
      });
    }
    if (fs.existsSync(scriptsDir)) {
      tree.push('scripts/');
      fs.readdirSync(scriptsDir).forEach(f => {
        tree.push(`  ${f}/`);
      });
    }
  } catch (e) {
    tree.push(`(tree error: ${e.message})`);
  }

  return tree.join('\n');
}

// ━━━ 分析单个错误 ━━━

async function analyzeError(error, config, treeOutput) {
  const errorType = classifyError(error.workflow, error.error_message || '');
  const autoFixable = isAutoFixable(errorType, config);

  const systemPrompt = `你是铸渊核心大脑，零点原核频道的 CI/CD 工程人格。
分析以下 GitHub Actions 报错日志，输出 JSON 格式：
{
  "root_cause": "错误根因描述",
  "affected_files": ["文件路径列表"],
  "fix_plan": "修复方案（具体到代码行级别）",
  "risk": "low 或 medium 或 high",
  "side_effects": "预计修复是否会影响其他 Workflow",
  "auto_fixable": true或false
}
规则：只输出JSON，不要其他文字。`;

  const userPrompt = `Workflow: ${error.workflow}
Run ID: ${error.run_id}
Error type: ${errorType}
Error message: ${error.error_message || 'N/A'}
Log context:
${error.log_excerpt || 'No log excerpt available'}

仓库文件结构：
${treeOutput}`;

  // If no Gemini API key, use local analysis
  if (!process.env.GEMINI_API_KEY) {
    console.log(`  ⚠️ No GEMINI_API_KEY — using local classification for: ${error.workflow}`);
    return {
      workflow: error.workflow,
      run_id: error.run_id,
      error_type: errorType,
      root_cause: `Classified as ${errorType} based on error patterns`,
      affected_files: error.affected_files || [],
      fix_plan: autoFixable ? `Auto-fix ${errorType} error` : 'Requires human intervention',
      risk: autoFixable ? 'low' : 'high',
      side_effects: 'none',
      auto_fixable: autoFixable
    };
  }

  try {
    const result = await callGeminiAPI(userPrompt, systemPrompt, config);

    if (result.parse_error) {
      console.log(`  ⚠️ Gemini response not valid JSON for: ${error.workflow}`);
      return {
        workflow: error.workflow,
        run_id: error.run_id,
        error_type: errorType,
        root_cause: 'Gemini analysis returned non-JSON',
        affected_files: [],
        fix_plan: 'Requires human review',
        risk: 'high',
        side_effects: 'unknown',
        auto_fixable: false
      };
    }

    // Merge Gemini analysis with local classification
    return {
      workflow: error.workflow,
      run_id: error.run_id,
      error_type: errorType,
      root_cause: result.root_cause || 'Unknown',
      affected_files: result.affected_files || [],
      fix_plan: result.fix_plan || 'No plan generated',
      risk: result.risk || 'high',
      side_effects: result.side_effects || 'unknown',
      auto_fixable: result.risk !== 'high' && autoFixable
    };
  } catch (e) {
    console.log(`  ❌ Gemini API error for ${error.workflow}: ${e.message}`);
    return {
      workflow: error.workflow,
      run_id: error.run_id,
      error_type: errorType,
      root_cause: `Analysis failed: ${e.message}`,
      affected_files: [],
      fix_plan: 'Requires human review',
      risk: 'high',
      side_effects: 'unknown',
      auto_fixable: false
    };
  }
}

// ━━━ 主流程 ━━━

async function main() {
  console.log('[铸渊核心大脑] Phase B 启动 — 报错智能分析');
  console.log('═══════════════════════════════════════════');

  ensureDir(OUTPUT_DIR);

  // Load config
  const config = loadJSON(CONFIG_PATH);
  if (!config) {
    console.error('❌ 无法加载 tianyan-config.json');
    process.exit(1);
  }

  // Parse error report from env
  const errorReportRaw = process.env.ERROR_REPORT;
  if (!errorReportRaw) {
    console.log('⚠️ ERROR_REPORT 环境变量为空，跳过分析');
    const emptyResult = { analyses: [], timestamp: getTimestamp(), total: 0, auto_fixable: 0 };
    fs.writeFileSync(path.join(OUTPUT_DIR, 'analysis.json'), JSON.stringify(emptyResult, null, 2));
    return;
  }

  let errors;
  try {
    errors = JSON.parse(errorReportRaw);
  } catch (e) {
    console.error(`❌ ERROR_REPORT JSON 解析失败: ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(errors)) {
    errors = [errors];
  }

  console.log(`📊 待分析错误: ${errors.length} 个\n`);

  const treeOutput = getRepoTree();
  const analyses = [];

  for (const error of errors) {
    console.log(`🔍 分析: ${error.workflow || error.name || 'unknown'} (run ${error.run_id || error.id || 'N/A'})`);

    // Normalize error object
    const normalizedError = {
      workflow: error.workflow || error.name || 'unknown',
      run_id: error.run_id || error.id || 0,
      error_message: error.error_message || error.conclusion || '',
      log_excerpt: error.log_excerpt || '',
      html_url: error.html_url || '',
      created_at: error.created_at || ''
    };

    const analysis = await analyzeError(normalizedError, config, treeOutput);
    analyses.push(analysis);

    const riskIcon = analysis.risk === 'low' ? '🟢' : analysis.risk === 'medium' ? '🟡' : '🔴';
    console.log(`  ${riskIcon} Risk: ${analysis.risk} | Auto-fixable: ${analysis.auto_fixable}`);
    console.log(`  Root cause: ${analysis.root_cause}\n`);
  }

  const result = {
    timestamp: getTimestamp(),
    total: analyses.length,
    auto_fixable: analyses.filter(a => a.auto_fixable).length,
    manual_only: analyses.filter(a => !a.auto_fixable).length,
    analyses
  };

  // Risk filter: skip high-risk auto-fix
  for (const a of result.analyses) {
    if (a.risk === 'high') {
      a.auto_fixable = false;
    }
  }

  const outputPath = path.join(OUTPUT_DIR, 'analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log('═══════════════════════════════════════════');
  console.log(`📊 分析结果: 共 ${result.total} 个, 可自动修复 ${result.auto_fixable} 个, 需人工 ${result.manual_only} 个`);
  console.log(`📁 结果保存: ${outputPath}`);

  // Output for GitHub Actions (using GITHUB_OUTPUT env file)
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `auto_fixable_count=${result.auto_fixable}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `total_errors=${result.total}\n`);
  }
}

main().catch(e => {
  console.error(`❌ Phase B 异常: ${e.message}`);
  process.exit(1);
});
