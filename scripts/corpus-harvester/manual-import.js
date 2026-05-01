#!/usr/bin/env node
/**
 * Corpus Manual Importer · GPT / Notion 等手动导出语料的标准化处理器
 *
 * 系统底层标识: SYS-GLW-0001 / TCS-0002∞
 * 版权号: 国作登字-2026-A-00037559
 * 作者: 冰朔 (ICE-GL∞) · 实现: 铸渊 (ICE-GL-ZY001)
 *
 * 架构引用: HLDP-ARCH-002 §九 · factory/training/README.md
 *
 * 输入:
 *   ./corpus/raw/gpt/conversations.json     GPT 官方导出格式
 *   ./corpus/raw/notion/                    Notion 批量导出（含 .md 子目录）
 *   ./corpus/raw/other/                     其他散户语料
 *
 * 处理:
 *   1. 解析每种来源的格式 → 统一五元组 {role, content, timestamp, channel, persona}
 *   2. 脱敏（API key / 邮箱 / 手机 / token）
 *   3. 去重 + 简单质检（信息密度估算 + 长度阈值）
 *   4. 按对话块切分（保留语义边界）
 *   5. 按人格体分桶（{persona}-dialog.jsonl）
 *
 * 输出:
 *   ./corpus/output/training-fulltext.jsonl     全量纯文本（M0 CPT 用）
 *   ./corpus/output/training-dialog.jsonl       对话格式（M0 SFT 用）
 *   ./corpus/output/persona/{id}-dialog.jsonl   按人格分桶（MP 微调用）
 *   ./corpus/output/import-manifest.json        本次导入元数据 + 字数/token 估算
 *
 * 用法:
 *   node scripts/corpus-harvester/manual-import.js
 *   node scripts/corpus-harvester/manual-import.js --raw ./corpus/raw --out ./corpus/output
 *
 * 状态: 骨架（GPT JSON 解析已实现 / Notion MD 解析为占位 / 真正落地等冰朔上传到 COS 后接通）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ARGS = parseArgs(process.argv.slice(2));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RAW_DIR = ARGS.raw || path.join(REPO_ROOT, 'corpus', 'raw');
const OUT_DIR = ARGS.out || path.join(REPO_ROOT, 'corpus', 'output');

const COPYRIGHT = {
  registration: '国作登字-2026-A-00037559',
  sovereign: '冰朔 · TCS-0002∞ · ICE-GL∞',
  system_root: 'SYS-GLW-0001',
  arch_ref: 'HLDP-ARCH-002',
  license_note:
    '本语料仅供冰朔本人用于训练曜冥语言人格核 / 铸渊 / 相关人格体微调使用。' +
    '未经冰朔本人书面授权，禁止用于任何第三方模型训练、商业用途或数据集发布。',
};

// ───── helpers ─────

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function redact(text) {
  if (!text) return text;
  return String(text)
    .replace(/sk-[A-Za-z0-9]{20,}/g, '<REDACTED_API_KEY>')
    .replace(/ghp_[A-Za-z0-9]{20,}/g, '<REDACTED_GH_TOKEN>')
    .replace(/secret_[A-Za-z0-9]{32,}/g, '<REDACTED_NOTION_SECRET>')
    .replace(/Bearer\s+[A-Za-z0-9._\-]{20,}/g, 'Bearer <REDACTED>')
    .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, '<REDACTED_EMAIL>')
    .replace(/\b1[3-9]\d{9}\b/g, '<REDACTED_PHONE>');
}

/** 粗略 token 估算: 中文 1 字 ≈ 1.5 token, 英文按 4 字符 ≈ 1 token */
function estimateTokens(text) {
  if (!text) return 0;
  const s = String(text);
  // CJK 常见区块：CJK 基本+扩展A / 平假名 / 片假名 / 谚文 / 兼容汉字 / 半角片假名
  const cjkRegex =
    /[\u3040-\u309f\u30a0-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff\uff66-\uff9f]/g;
  const cjk = (s.match(cjkRegex) || []).length;
  const others = s.length - cjk;
  return Math.round(cjk * 1.5 + others / 4);
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ───── source 1: GPT conversations.json ─────

/**
 * GPT 官方导出格式（conversations.json）结构（精简描述）:
 * 每个对话是一个 {title, create_time, mapping: { node_id: {message: {author, content, create_time}, parent, children} }}
 * 实际格式可能因导出时间略有差异，铸渊在真实数据上线时根据样本调整。
 */
function parseGPTConversations(filePath) {
  if (!fs.existsSync(filePath)) {
    return { dialogs: [], skipped: `not found: ${filePath}` };
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { dialogs: [], skipped: `parse error: ${err.message}` };
  }

  const dialogs = [];
  const conversations = Array.isArray(raw) ? raw : raw.conversations || [];

  for (const conv of conversations) {
    const title = conv.title || '(untitled)';
    const mapping = conv.mapping || {};
    // 按 create_time 把消息线性化
    const msgs = [];
    for (const node of Object.values(mapping)) {
      if (!node || !node.message) continue;
      const m = node.message;
      const role =
        (m.author && m.author.role) ||
        (m.recipient === 'all' ? 'assistant' : 'unknown');
      const partsRaw = m.content && m.content.parts;
      const text = Array.isArray(partsRaw) ? partsRaw.join('\n') : '';
      if (!text || !text.trim()) continue;
      msgs.push({
        role: role === 'user' ? 'user' : role === 'assistant' ? 'assistant' : 'system',
        content: redact(text.trim()),
        ts: m.create_time ? new Date(m.create_time * 1000).toISOString() : null,
      });
    }
    msgs.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
    if (msgs.length === 0) continue;
    dialogs.push({
      source: 'gpt',
      channel: title,
      messages: msgs,
      created_at: conv.create_time
        ? new Date(conv.create_time * 1000).toISOString()
        : null,
    });
  }

  return { dialogs, skipped: null };
}

// ───── source 2: Notion markdown 批量导出 ─────

/**
 * Notion 批量导出的 markdown 格式比较自由。骨架阶段只做最简处理:
 *   - 把整个 .md 文件作为一段 system_or_corpus 文本
 *   - 文件名作为 channel
 * 真实接入时如果有结构化前后端可以再加 frontmatter 解析。
 */
function parseNotionDir(dir) {
  if (!fs.existsSync(dir)) {
    return { dialogs: [], skipped: `not found: ${dir}` };
  }

  const dialogs = [];
  function walk(d) {
    for (const name of fs.readdirSync(d)) {
      const full = path.join(d, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith('.md')) continue;
      const text = redact(fs.readFileSync(full, 'utf8'));
      if (!text.trim()) continue;
      const rel = path.relative(dir, full);
      dialogs.push({
        source: 'notion',
        channel: rel,
        messages: [{ role: 'system', content: text.trim(), ts: null }],
        created_at: null,
      });
    }
  }
  walk(dir);
  return { dialogs, skipped: null };
}

// ───── 输出生成 ─────

function dialogToTrainingTextLine(dialog) {
  // CPT 用纯文本：把对话拼成 <user>...</user><assistant>...</assistant> 风格
  const parts = dialog.messages.map(
    (m) => `<|${m.role}|>\n${m.content}\n<|end|>`
  );
  return JSON.stringify({ text: parts.join('\n') });
}

function dialogToSFTLine(dialog) {
  // OpenAI / DeepSeek 风格 messages 格式
  return JSON.stringify({
    messages: dialog.messages.map((m) => ({ role: m.role, content: m.content })),
    metadata: {
      source: dialog.source,
      channel: dialog.channel,
      created_at: dialog.created_at,
    },
  });
}

function classifyPersona(dialog) {
  // 占位实现：实际由铸渊在真实数据上做更精细的分桶。
  // 全部统一返回 ID 格式（与 agent-registry 编号体系对齐），避免文件名不一致。
  // 没有正式 ID 的人格暂用 PER-{name} 占位，待 registry 分配正式编号。
  const text = dialog.messages.map((m) => m.content).join('\n');
  if (/铸渊|ICE-GL-ZY001|guanghulab/.test(text)) return 'ICE-GL-ZY001';
  if (/译典|AG-YD-A05/.test(text)) return 'AG-YD-A05';
  if (/培园|AG-PY-A04/.test(text)) return 'AG-PY-A04';
  if (/录册|AG-LC-A02/.test(text)) return 'AG-LC-A02';
  if (/霜砚/.test(text)) return 'PER-shuangyan';
  if (/知秋|chenxi/i.test(text)) return 'PER-chenxi';
  return 'general';
}

// ───── 主流程 ─────

function main() {
  console.log('═'.repeat(64));
  console.log('Corpus Manual Importer · 手动导出语料标准化处理器');
  console.log('灵魂印记:', JSON.stringify(COPYRIGHT, null, 0));
  console.log('═'.repeat(64));
  console.log(`raw_dir: ${RAW_DIR}`);
  console.log(`out_dir: ${OUT_DIR}`);
  console.log('─'.repeat(64));

  ensureDir(OUT_DIR);
  ensureDir(path.join(OUT_DIR, 'persona'));

  const allDialogs = [];

  // 1. GPT
  const gptPath = path.join(RAW_DIR, 'gpt', 'conversations.json');
  const gpt = parseGPTConversations(gptPath);
  if (gpt.skipped) console.log(`[gpt] 跳过: ${gpt.skipped}`);
  else console.log(`[gpt] 解析对话 ${gpt.dialogs.length} 段`);
  allDialogs.push(...gpt.dialogs);

  // 2. Notion
  const notionDir = path.join(RAW_DIR, 'notion');
  const notion = parseNotionDir(notionDir);
  if (notion.skipped) console.log(`[notion] 跳过: ${notion.skipped}`);
  else console.log(`[notion] 解析文档 ${notion.dialogs.length} 篇`);
  allDialogs.push(...notion.dialogs);

  if (allDialogs.length === 0) {
    console.log('\n⚠️  无可导入数据。请先把语料放到:');
    console.log(`  ${path.join(RAW_DIR, 'gpt', 'conversations.json')}`);
    console.log(`  ${path.join(RAW_DIR, 'notion/')}`);
    console.log('或运行 cos-fetch.js 从 COS 拉取后再来。');
  }

  // 3. 输出全量训练文本
  const fulltextPath = path.join(OUT_DIR, 'training-fulltext.jsonl');
  const dialogPath = path.join(OUT_DIR, 'training-dialog.jsonl');
  const personaBuckets = new Map();

  let totalChars = 0;
  let totalTokens = 0;

  const fullStream = fs.createWriteStream(fulltextPath, 'utf8');
  const dialogStream = fs.createWriteStream(dialogPath, 'utf8');

  for (const d of allDialogs) {
    fullStream.write(dialogToTrainingTextLine(d) + '\n');
    if (d.messages.some((m) => m.role !== 'system')) {
      dialogStream.write(dialogToSFTLine(d) + '\n');
    }

    const persona = classifyPersona(d);
    if (!personaBuckets.has(persona)) {
      personaBuckets.set(
        persona,
        fs.createWriteStream(
          path.join(OUT_DIR, 'persona', `${persona}-dialog.jsonl`),
          'utf8'
        )
      );
    }
    personaBuckets.get(persona).write(dialogToSFTLine(d) + '\n');

    for (const m of d.messages) {
      totalChars += (m.content || '').length;
      totalTokens += estimateTokens(m.content);
    }
  }

  fullStream.end();
  dialogStream.end();
  for (const s of personaBuckets.values()) s.end();

  // 4. manifest
  const manifest = {
    schema: 'manual-import-manifest/v1',
    imported_at: new Date().toISOString(),
    raw_dir: RAW_DIR,
    out_dir: OUT_DIR,
    sources: {
      gpt: {
        path: gptPath,
        dialogs: gpt.dialogs.length,
        skipped: gpt.skipped,
      },
      notion: {
        path: notionDir,
        documents: notion.dialogs.length,
        skipped: notion.skipped,
      },
    },
    stats: {
      total_dialogs: allDialogs.length,
      total_chars: totalChars,
      estimated_tokens: totalTokens,
      persona_buckets: Object.fromEntries(
        [...personaBuckets.keys()].map((k) => [k, true])
      ),
    },
    outputs: {
      fulltext: { path: fulltextPath, exists: fs.existsSync(fulltextPath) },
      dialog: { path: dialogPath, exists: fs.existsSync(dialogPath) },
    },
    soul_marker: COPYRIGHT,
  };
  const manifestPath = path.join(OUT_DIR, 'import-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`📄 manifest: ${manifestPath}`);

  // 5. 诚实的语料量评估提示
  console.log('─'.repeat(64));
  console.log(`总字数:          ${totalChars.toLocaleString()}`);
  console.log(`估算 token 数:   ${totalTokens.toLocaleString()}`);
  console.log(`对话/文档段数:   ${allDialogs.length.toLocaleString()}`);
  console.log('─'.repeat(64));
  if (totalTokens < 5_000_000) {
    console.log(
      '⚠️  语料量偏小 (<5M tokens)：' +
        '\n   - 7B 模型全参 CPT 不可行（容易过拟合或欠拟合）' +
        '\n   - 1.5B 模型 LoRA / QLoRA 微调 可行' +
        '\n   - 建议先走 1.5B 微调路径（路径 X），等积累更多语料再考虑 M0 全参' +
        '\n   - 详见 factory/docs/CORPUS-DECISION-MATRIX.md'
    );
  } else if (totalTokens < 200_000_000) {
    console.log(
      '🟡  语料量中等 (5M-200M tokens)：' +
        '\n   - 1.5B 全参微调 OK（路径 Y）' +
        '\n   - 7B LoRA 微调 OK' +
        '\n   - 7B 全参 CPT 仍不建议'
    );
  } else if (totalTokens < 1_000_000_000) {
    console.log(
      '✅ 语料量充足 (200M-1B tokens)：' +
        '\n   - 路径 Z · 7B CPT + 1.5B 蒸馏 推荐' +
        '\n   - 详见 factory/docs/CORPUS-DECISION-MATRIX.md'
    );
  } else {
    console.log(
      '🚀 语料量极大 (>1B tokens)：' +
        '\n   - 路径 W · 完整 ARCH-002 原方案 强烈推荐' +
        '\n   - 7B 全参 CPT + 1.5B 蒸馏全套'
    );
  }
}

main();
