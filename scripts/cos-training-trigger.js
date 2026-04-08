/**
 * ═══════════════════════════════════════════════════════════
 * 🧠 COS训练触发器 · 端到端训练管线
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 扫描COS桶中的新语料 → 解压/转换TCS格式 → 启动训练会话
 *
 * 设计:
 *   1. 扫描cold桶，列出所有文件（含非压缩文件和文件夹）
 *   2. 对比tcs-structured/目录，找出未处理的语料
 *   3. 自动提取/转换为TCS结构化格式
 *   4. 启动训练会话，用LLM分析和分类
 *   5. 输出处理结果，写入日志
 *
 * 运行方式:
 *   node scripts/cos-training-trigger.js [scan|extract|train|full]
 *
 *   scan    — 仅扫描，输出未处理语料列表
 *   extract — 扫描并解压/转换为TCS格式
 *   train   — 对已有TCS语料启动训练
 *   full    — 完整流程: 扫描 → 提取 → 训练
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ─── 路径 ───
const ROOT = path.resolve(__dirname, '..');
const COS_MODULE = path.join(ROOT, 'server', 'age-os', 'mcp-server', 'cos');
const EXTRACTOR_MODULE = path.join(ROOT, 'server', 'age-os', 'mcp-server', 'tools', 'corpus-extractor-ops');
const TRAINING_MODULE = path.join(ROOT, 'server', 'age-os', 'mcp-server', 'tools', 'training-agent-ops');

// ─── 延迟加载模块（允许在CI中跳过数据库依赖） ───
let cos, extractor, trainer;

function loadModules() {
  cos = require(COS_MODULE);
  extractor = require(EXTRACTOR_MODULE);
  trainer = require(TRAINING_MODULE);
}

// ─── 配置 ───
const DEFAULT_BUCKET = 'cold';
const DEFAULT_PERSONA = 'zhuyuan';
const PROCESSED_PREFIX = 'tcs-structured/';
const MAX_EXTRACT_PER_RUN = 20;  // 每次最多处理文件数
const MAX_TRAIN_PER_RUN = 5;     // 每次最多训练文件数

// ─── 排除路径（不视为语料的目录/文件） ───
const EXCLUDED_PREFIXES = [
  'tcs-structured/',
  'training-sessions/',
  'training-results/',
  'training-memory/',
];

// ─── 支持的语料文件扩展名（含非压缩格式） ───
const CORPUS_EXTENSIONS = [
  '.zip', '.gz', '.tar.gz', '.tgz', '.json.gz',  // 压缩格式
  '.json', '.jsonl', '.md', '.txt', '.csv',        // 非压缩格式
];

/**
 * 判断文件是否为语料文件
 */
function isCorpusFile(key) {
  // 排除处理结果目录
  for (const prefix of EXCLUDED_PREFIXES) {
    if (key.startsWith(prefix)) return false;
  }
  // 匹配扩展名
  const lower = key.toLowerCase();
  return CORPUS_EXTENSIONS.some(ext => lower.endsWith(ext));
}

/**
 * 判断是否为语料目录（如 repo-archive/）
 */
function isCorpusDirectory(key) {
  for (const prefix of EXCLUDED_PREFIXES) {
    if (key.startsWith(prefix)) return false;
  }
  return key.endsWith('/');
}

/**
 * 从已处理列表中判断某文件是否已处理
 */
function isProcessed(rawKey, processedFiles) {
  // 从rawKey提取基础文件名（处理多重扩展名如.tar.gz）
  let baseName = rawKey.split('/').pop();
  // 移除所有已知的语料文件扩展名
  for (const ext of ['.tar.gz', '.json.gz', '.tgz', '.zip', '.gz', '.jsonl', '.json', '.md', '.txt', '.csv']) {
    if (baseName.toLowerCase().endsWith(ext)) {
      baseName = baseName.slice(0, -ext.length);
      break;
    }
  }
  return processedFiles.some(f => f.key.includes(baseName));
}

// ═══════════════════════════════════════════
// 命令: scan — 扫描未处理语料
// ═══════════════════════════════════════════

async function cmdScan(bucket) {
  console.log('═══ COS训练触发器 · 语料扫描 ═══\n');

  const bucketName = bucket || DEFAULT_BUCKET;

  // 列出所有文件
  const allFiles = await cos.list(bucketName, '', 500);
  // 列出已处理文件
  const processed = await cos.list(bucketName, PROCESSED_PREFIX, 500);

  const processedFiles = processed.files.filter(f => f.key.endsWith('.tcs.json'));

  // 分类
  const corpusFiles = [];
  const corpusDirs = [];

  for (const file of allFiles.files) {
    if (isCorpusFile(file.key)) {
      const alreadyProcessed = isProcessed(file.key, processedFiles);
      corpusFiles.push({
        key: file.key,
        size_bytes: file.size_bytes,
        processed: alreadyProcessed
      });
    } else if (isCorpusDirectory(file.key)) {
      corpusDirs.push({ key: file.key });
    }
  }

  const pending = corpusFiles.filter(f => !f.processed);

  console.log(`桶: ${bucketName}`);
  console.log(`总文件数: ${allFiles.files.length}`);
  console.log(`语料文件: ${corpusFiles.length}`);
  console.log(`语料目录: ${corpusDirs.length}`);
  console.log(`已处理: ${corpusFiles.length - pending.length}`);
  console.log(`待处理: ${pending.length}`);
  console.log(`已生成TCS: ${processedFiles.length}`);

  if (pending.length > 0) {
    console.log('\n📋 待处理语料:');
    for (const f of pending) {
      console.log(`  📄 ${f.key} (${formatBytes(f.size_bytes)})`);
    }
  }

  if (corpusDirs.length > 0) {
    console.log('\n📁 语料目录:');
    for (const d of corpusDirs) {
      console.log(`  📂 ${d.key}`);
    }

    // 扫描目录内的文件
    for (const dir of corpusDirs) {
      try {
        const dirFiles = await cos.list(bucketName, dir.key, 100);
        const dirCorpus = dirFiles.files.filter(f => isCorpusFile(f.key));
        if (dirCorpus.length > 0) {
          console.log(`     └── ${dir.key} 内含 ${dirCorpus.length} 个语料文件`);
          for (const f of dirCorpus) {
            const alreadyProcessed = isProcessed(f.key, processedFiles);
            if (!alreadyProcessed) {
              pending.push({
                key: f.key,
                size_bytes: f.size_bytes,
                processed: false
              });
              console.log(`         📄 ${f.key} (${formatBytes(f.size_bytes)}) [待处理]`);
            }
          }
        }
      } catch (err) {
        console.log(`     └── ${dir.key} 扫描失败: ${err.message}`);
      }
    }
  }

  // 写入GitHub Actions输出
  if (process.env.GITHUB_OUTPUT) {
    const outputLines = [
      `pending=${pending.length}`,
      `total_corpus=${corpusFiles.length}`,
      `processed=${processedFiles.length}`,
      `has_new_corpus=${pending.length > 0 ? 'true' : 'false'}`,
      `pending_files=${pending.map(f => f.key).join(',')}`
    ];
    fs.appendFileSync(process.env.GITHUB_OUTPUT, outputLines.join('\n') + '\n');
  }

  return { pending, processedFiles, corpusDirs };
}

// ═══════════════════════════════════════════
// 命令: extract — 提取/转换语料为TCS格式
// ═══════════════════════════════════════════

async function cmdExtract(bucket) {
  console.log('═══ COS训练触发器 · 语料提取 ═══\n');

  const bucketName = bucket || DEFAULT_BUCKET;
  const { pending } = await cmdScan(bucketName);

  if (pending.length === 0) {
    console.log('\n✅ 无待处理语料');
    writeGitHubOutput('extracted=0', 'extract_status=skipped');
    return { extracted: 0, errors: 0 };
  }

  const toProcess = pending.slice(0, MAX_EXTRACT_PER_RUN);
  console.log(`\n🔄 开始提取 ${toProcess.length}/${pending.length} 个文件...\n`);

  let extracted = 0;
  let errors = 0;
  const results = [];

  for (const file of toProcess) {
    try {
      console.log(`  📦 处理: ${file.key}...`);
      const result = await extractor.cosExtractCorpus({
        bucket: bucketName,
        key: file.key,
        output_bucket: bucketName,
        output_prefix: PROCESSED_PREFIX
      });
      extracted++;
      results.push({ key: file.key, status: 'success', output: result.output?.key });
      console.log(`  ✅ 完成: ${result.output?.key || '已处理'} (${result.entries || 0} 条目)`);
    } catch (err) {
      errors++;
      results.push({ key: file.key, status: 'error', error: err.message });
      console.log(`  ❌ 失败: ${file.key} — ${err.message}`);
    }
  }

  console.log(`\n═══ 提取完毕 ═══`);
  console.log(`✅ 成功: ${extracted}`);
  console.log(`❌ 失败: ${errors}`);
  console.log(`⏳ 剩余: ${pending.length - toProcess.length}`);

  writeGitHubOutput(
    `extracted=${extracted}`,
    `extract_errors=${errors}`,
    `extract_status=${errors > 0 ? 'partial' : 'success'}`
  );

  return { extracted, errors, results };
}

// ═══════════════════════════════════════════
// 命令: train — 对TCS语料启动训练
// ═══════════════════════════════════════════

async function cmdTrain(bucket, personaId) {
  console.log('═══ COS训练触发器 · 训练处理 ═══\n');

  const bucketName = bucket || DEFAULT_BUCKET;
  const persona = personaId || DEFAULT_PERSONA;

  // 列出可用的TCS语料
  const processed = await cos.list(bucketName, PROCESSED_PREFIX, 500);
  const tcsFiles = processed.files.filter(f => f.key.endsWith('.tcs.json'));

  if (tcsFiles.length === 0) {
    console.log('⚠️ 无TCS结构化语料可训练。请先运行 extract 命令。');
    writeGitHubOutput('trained=0', 'train_status=no_corpus');
    return { trained: 0, errors: 0 };
  }

  console.log(`📚 找到 ${tcsFiles.length} 个TCS语料文件`);

  // 检查已有训练结果，避免重复处理
  let existingResults = [];
  try {
    const existing = await cos.list(bucketName, `training-results/${persona}/`, 100);
    existingResults = existing.files.filter(f => f.key.endsWith('.json'));
  } catch (err) {
    console.log(`⚠️ 无法读取已有训练结果: ${err.message}`);
  }

  // 启动训练会话
  console.log(`\n🧠 启动训练会话 · 人格体: ${persona}`);

  let session;
  try {
    session = await trainer.trainingStartSession({
      persona_id: persona,
      corpus_bucket: bucketName,
      corpus_prefix: PROCESSED_PREFIX,
      session_name: `自动训练-${new Date().toISOString().slice(0, 10)}`
    });
    console.log(`✅ 会话已启动: ${session.session_id}`);
    console.log(`   可用模型: ${session.models.available.map(m => m.name).join(', ') || '无'}`);
  } catch (err) {
    console.log(`❌ 训练会话启动失败: ${err.message}`);
    writeGitHubOutput('trained=0', `train_status=session_error`, `train_error=${err.message}`);
    return { trained: 0, errors: 1, error: err.message };
  }

  // 检查是否有可用的LLM模型
  if (!session.models.available || session.models.available.length === 0) {
    console.log('⚠️ 无可用LLM模型（需要配置 ZY_DEEPSEEK_API_KEY 等密钥）');
    console.log('   训练会话已记录，等待LLM密钥配置后再次运行。');
    writeGitHubOutput('trained=0', 'train_status=no_llm_keys');
    return { trained: 0, errors: 0, note: '无LLM密钥' };
  }

  // 处理语料
  const toTrain = tcsFiles.slice(0, MAX_TRAIN_PER_RUN);
  let trained = 0;
  let trainErrors = 0;
  const trainResults = [];

  for (const tcsFile of toTrain) {
    try {
      console.log(`  🔬 训练处理: ${tcsFile.key}...`);
      const result = await trainer.trainingProcessCorpus({
        corpus_bucket: bucketName,
        corpus_key: tcsFile.key,
        persona_id: persona,
        max_entries: 10
      });
      trained++;
      trainResults.push({ key: tcsFile.key, status: 'success', ...result });
      console.log(`  ✅ 完成: ${result.classified}/${result.total} 分类成功`);
    } catch (err) {
      trainErrors++;
      trainResults.push({ key: tcsFile.key, status: 'error', error: err.message });
      console.log(`  ❌ 失败: ${tcsFile.key} — ${err.message}`);
    }
  }

  console.log(`\n═══ 训练完毕 ═══`);
  console.log(`✅ 成功: ${trained}`);
  console.log(`❌ 失败: ${trainErrors}`);

  writeGitHubOutput(
    `trained=${trained}`,
    `train_errors=${trainErrors}`,
    `train_status=${trainErrors > 0 ? 'partial' : 'success'}`
  );

  return { trained, errors: trainErrors, results: trainResults, session_id: session.session_id };
}

// ═══════════════════════════════════════════
// 命令: full — 完整流程
// ═══════════════════════════════════════════

async function cmdFull(bucket, personaId) {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  COS训练触发器 · 完整训练管线             ║');
  console.log('║  铸渊 · ICE-GL-ZY001                     ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  const bucketName = bucket || DEFAULT_BUCKET;
  const persona = personaId || DEFAULT_PERSONA;
  const startTime = Date.now();

  // 第一步: 提取语料
  console.log('📍 第一步: 提取语料\n');
  const extractResult = await cmdExtract(bucketName);

  // 第二步: 训练处理
  console.log('\n📍 第二步: 训练处理\n');
  const trainResult = await cmdTrain(bucketName, persona);

  // 汇总
  const duration = Date.now() - startTime;
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  完整训练管线 · 运行完毕                   ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`  提取: ${extractResult.extracted} 成功 / ${extractResult.errors} 失败`);
  console.log(`  训练: ${trainResult.trained} 成功 / ${trainResult.errors} 失败`);
  console.log(`  耗时: ${(duration / 1000).toFixed(1)}s`);

  writeGitHubOutput(
    `pipeline_status=${(extractResult.errors + trainResult.errors) > 0 ? 'partial' : 'success'}`,
    `pipeline_duration_ms=${duration}`
  );

  return { extract: extractResult, train: trainResult, duration_ms: duration };
}

// ═══════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function writeGitHubOutput(...lines) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n');
  }
}

// ═══════════════════════════════════════════
// CLI 入口
// ═══════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'scan';
  const bucket = args.find(a => a.startsWith('--bucket='))?.split('=')[1] || DEFAULT_BUCKET;
  const persona = args.find(a => a.startsWith('--persona='))?.split('=')[1] || DEFAULT_PERSONA;

  // 加载模块
  try {
    loadModules();
  } catch (err) {
    console.error(`❌ 模块加载失败: ${err.message}`);
    console.error('   请确保 server/age-os/mcp-server/ 依赖已安装');
    process.exit(1);
  }

  switch (command) {
    case 'scan':
      await cmdScan(bucket);
      break;
    case 'extract':
      await cmdExtract(bucket);
      break;
    case 'train':
      await cmdTrain(bucket, persona);
      break;
    case 'full':
      await cmdFull(bucket, persona);
      break;
    default:
      console.log('COS训练触发器 · 铸渊 · ICE-GL-ZY001');
      console.log('');
      console.log('用法:');
      console.log('  node scripts/cos-training-trigger.js scan      — 扫描未处理语料');
      console.log('  node scripts/cos-training-trigger.js extract   — 提取/转换为TCS格式');
      console.log('  node scripts/cos-training-trigger.js train     — 启动训练处理');
      console.log('  node scripts/cos-training-trigger.js full      — 完整流程');
      console.log('');
      console.log('选项:');
      console.log('  --bucket=cold|hot|team   — 指定COS桶（默认cold）');
      console.log('  --persona=zhuyuan        — 指定人格体（默认zhuyuan）');
      break;
  }
}

main().catch(err => {
  console.error('COS训练触发器异常:', err.message);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'pipeline_status=error\n');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `pipeline_error=${err.message}\n`);
  }
  process.exit(1);
});
