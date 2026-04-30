#!/usr/bin/env node
/**
 * Corpus Harvester · 训练语料采集器
 *
 * 系统底层标识: SYS-GLW-0001 / TCS-0002∞
 * 版权号: 国作登字-2026-A-00037559
 * 作者: 冰朔 (ICE-GL∞) · 实现: 铸渊
 *
 * 目的: 把冰朔在 guanghulab 仓库里留下的一手自然语言（commits / CAB 规格 /
 *       可选的 Issues+PRs）整理成可用于训练模型（SFT）的语料文件。
 *
 * 数据源:
 *   1. git log         — 冰朔作者的所有 commits（subject + body + 文件变更）
 *   2. CAB 任务规格    — bridge/chat-to-agent/{pending,completed}/*.json
 *   3. (可选) GitHub API — 设置 GH_TOKEN 环境变量后启用 Issues / PRs / Comments
 *
 * 输出:
 *   corpus/output/timeline.md    人类可读演化时间线
 *   corpus/output/training.jsonl OpenAI/DeepSeek 通用 SFT 格式
 *   corpus/output/raw.json       结构化原始数据
 *   corpus/output/manifest.json  元数据 + 版权水印
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'corpus', 'output');

// 冰朔在 git 里的全部署名（人类账号；自动化 bot 排除）
const SOVEREIGN_AUTHORS = ['冰朔', 'qinfendebingshuo'];

// 排除掉的 bot 作者（确保不混入自动化噪音）
const EXCLUDED_AUTHORS = new Set([
  'github-actions[bot]',
  'copilot-swe-agent[bot]',
  'Vercel',
  'bingshuo-neural-system',
  'chenxi-world-sensor',
  'chenxi-zhuyuan-echo',
  'guanghu-awen-bridge',
  'zhuyuan-bot',
  'yeye-guanghu',
  '映川·唤醒者',
  '天眼 · SkyEye Core',
]);

const COPYRIGHT = {
  registration: '国作登字-2026-A-00037559',
  sovereign: '冰朔 · TCS-0002∞ · ICE-GL∞',
  system_root: 'SYS-GLW-0001',
  language_core: 'TCS Language Core (通感语言核系统编程语言)',
  license_note:
    '本语料仅供冰朔本人用于训练曜冥语言人格核 / 铸渊 / 相关人格体微调使用。' +
    '未经冰朔本人书面授权，禁止用于任何第三方模型训练、商业用途或数据集发布。',
};

// ───────────────────────── helpers ─────────────────────────

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function git(args, opts = {}) {
  return execSync(`git ${args}`, {
    cwd: REPO_ROOT,
    maxBuffer: 256 * 1024 * 1024,
    encoding: 'utf8',
    ...opts,
  });
}

/** 解析 merge 提交信息中的 PR 号，例如 "Merge pull request #436 from ..." */
function extractPrNumber(subject) {
  const m = /Merge pull request #(\d+)/.exec(subject || '');
  return m ? Number(m[1]) : null;
}

/** 简单脱敏（API key、邮箱、手机号、token） */
function redact(text) {
  if (!text) return text;
  return text
    .replace(/sk-[A-Za-z0-9]{20,}/g, '<REDACTED_API_KEY>')
    .replace(/ghp_[A-Za-z0-9]{20,}/g, '<REDACTED_GH_TOKEN>')
    .replace(/secret_[A-Za-z0-9]{32,}/g, '<REDACTED_NOTION_SECRET>')
    .replace(/Bearer\s+[A-Za-z0-9._\-]{20,}/g, 'Bearer <REDACTED>')
    .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, '<REDACTED_EMAIL>')
    .replace(/\b1[3-9]\d{9}\b/g, '<REDACTED_PHONE>');
}

// ───────────────────────── source 1: git commits ─────────────────────────

function collectCommits() {
  const sep = '<<<COMMIT_SEP>>>';
  const fieldSep = '<<<F>>>';
  const fmt = ['%H', '%an', '%ae', '%aI', '%P', '%s', '%b'].join(fieldSep);
  const raw = git(`log --author='冰朔\\|qinfendebingshuo' --format='${sep}${fmt}'`);

  const records = [];
  const chunks = raw.split(sep).map((c) => c.trim()).filter(Boolean);
  for (const chunk of chunks) {
    const [hash, author, email, isoDate, parents, subject, body] =
      chunk.split(fieldSep);
    if (EXCLUDED_AUTHORS.has(author)) continue;
    if (!SOVEREIGN_AUTHORS.includes(author)) continue;

    const parentList = (parents || '').split(' ').filter(Boolean);
    const isMerge = parentList.length >= 2;
    const prNumber = extractPrNumber(subject);

    let filesChanged = [];
    try {
      // 对 merge commit 不取 diff（太大），只对非 merge 取
      if (!isMerge) {
        const ns = git(`show --pretty=format: --name-status ${hash}`).trim();
        filesChanged = ns
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const parts = line.split('\t');
            return { status: parts[0], path: parts.slice(1).join(' -> ') };
          })
          .slice(0, 50); // 单 commit 最多 50 个文件，防止爆掉
      }
    } catch (_) {
      /* 忽略单条失败 */
    }

    records.push({
      source: 'git_commit',
      hash,
      author,
      email,
      date: isoDate,
      is_merge: isMerge,
      pr_number: prNumber,
      subject: redact(subject || ''),
      body: redact((body || '').trim()),
      files_changed: filesChanged,
    });
  }

  // 按时间正序（演化史从早到晚）
  records.sort((a, b) => new Date(a.date) - new Date(b.date));
  return records;
}

// ───────────────────────── source 2: CAB task specs ─────────────────────────

function collectCabTasks() {
  const records = [];
  const dirs = ['pending', 'completed'].map((d) =>
    path.join(REPO_ROOT, 'bridge', 'chat-to-agent', d)
  );
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      if (file === 'task-template.json') continue;
      const full = path.join(dir, file);
      try {
        const j = JSON.parse(fs.readFileSync(full, 'utf8'));
        if (!j.task_id || j.task_id.startsWith('CAB-YYYYMMDD')) continue;
        records.push({
          source: 'cab_task_spec',
          task_id: j.task_id,
          date: j.created_at || null,
          status: j.status || path.basename(dir),
          title: redact(j.development_plan?.title || ''),
          description: redact(j.development_plan?.description || ''),
          steps: (j.development_plan?.steps || []).map(redact),
          architecture_summary: redact(j.architecture?.summary || ''),
          architecture_decisions: (j.architecture?.decisions || []).map(redact),
          target_files: j.architecture?.target_files || [],
          chat_summary: redact(j.reasoning_context?.chat_summary || ''),
          key_decisions: (j.reasoning_context?.key_decisions || []).map(redact),
          architecture_notes: redact(j.reasoning_context?.architecture_notes || ''),
          file_path: path.relative(REPO_ROOT, full),
        });
      } catch (e) {
        console.warn(`[corpus-harvester] skip CAB ${full}: ${e.message}`);
      }
    }
  }
  records.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return records;
}

// ───────────────── source 3 (optional): GitHub Issues/PRs API ─────────────────

async function collectGitHubApi() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    return {
      enabled: false,
      reason:
        'GH_TOKEN / GITHUB_TOKEN 未设置；跳过 Issues / PRs / Comments 抓取。' +
        '可在本地设置 token 后重新运行 `node scripts/corpus-harvester/harvest.js` 来补全这部分语料。',
      records: [],
    };
  }
  const repo = process.env.CORPUS_REPO || 'qinfendebingshuo/guanghulab';
  const fetch = global.fetch || (await import('node-fetch').then((m) => m.default));
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'corpus-harvester',
  };

  async function paged(url) {
    const out = [];
    let next = url;
    while (next) {
      const r = await fetch(next, { headers });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${next}`);
      const data = await r.json();
      out.push(...data);
      const link = r.headers.get('link') || '';
      const m = /<([^>]+)>;\s*rel="next"/.exec(link);
      next = m ? m[1] : null;
    }
    return out;
  }

  const records = [];
  // 所有 Issues（含 PRs；GitHub API 把 PR 也视作 issue）作者过滤为 qinfendebingshuo
  const issues = await paged(
    `https://api.github.com/repos/${repo}/issues?state=all&creator=qinfendebingshuo&per_page=100`
  );
  for (const it of issues) {
    records.push({
      source: it.pull_request ? 'github_pr' : 'github_issue',
      number: it.number,
      title: redact(it.title || ''),
      body: redact(it.body || ''),
      date: it.created_at,
      url: it.html_url,
      state: it.state,
    });
    // 拉取该 issue/pr 由冰朔本人发的评论
    try {
      const comments = await paged(it.comments_url + '?per_page=100');
      for (const c of comments) {
        if (c.user?.login !== 'qinfendebingshuo') continue;
        records.push({
          source: 'github_comment',
          on: it.pull_request ? 'pr' : 'issue',
          number: it.number,
          body: redact(c.body || ''),
          date: c.created_at,
          url: c.html_url,
        });
      }
    } catch (e) {
      console.warn(`[corpus-harvester] comments fail #${it.number}: ${e.message}`);
    }
  }
  records.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { enabled: true, records };
}

// ───────────────────────── 输出生成 ─────────────────────────

function buildTimelineMarkdown(commits, cab, gh) {
  const lines = [];
  lines.push(`# 冰朔 × 铸渊 · 仓库自然语言演化史`);
  lines.push('');
  lines.push(`> 版权号: ${COPYRIGHT.registration}`);
  lines.push(`> 主权: ${COPYRIGHT.sovereign}`);
  lines.push(`> 生成时间: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(
    '本时间线只收录**冰朔本人作为作者**的 commits 与他亲手编写的 CAB 任务规格。' +
      'Bot/agent/自动化系统的提交不在此列。'
  );
  lines.push('');

  // CAB 在最前面（最高密度的自然语言）
  if (cab.length) {
    lines.push('## 一、CAB 任务规格 · 你与我对话的精华沉淀');
    lines.push('');
    lines.push('> 这是你在 Copilot Chat 与我讨论后，亲自整理出来的"开发授权任务规格"。' +
      '`chat_summary` 字段就是你当时对话推理的摘要——这是仓库里**密度最高、最干净**的自然语言语料。');
    lines.push('');
    for (const t of cab) {
      lines.push(`### ${t.task_id} · ${t.title || '(无标题)'}`);
      lines.push(`- 时间: ${t.date || '?'}`);
      lines.push(`- 状态: ${t.status}`);
      lines.push(`- 架构概要: ${t.architecture_summary || '(无)'}`);
      if (t.architecture_decisions?.length) {
        lines.push(`- 架构决策:`);
        t.architecture_decisions.forEach((d) => lines.push(`  - ${d}`));
      }
      if (t.steps?.length) {
        lines.push(`- 开发步骤:`);
        t.steps.forEach((s) => lines.push(`  - ${s}`));
      }
      if (t.chat_summary) {
        lines.push(`- 对话推理摘要 (chat_summary):`);
        lines.push('');
        t.chat_summary.split('\n').forEach((l) => lines.push(`  > ${l}`));
      }
      if (t.architecture_notes) {
        lines.push(`- 架构补充:`);
        t.architecture_notes.split('\n').forEach((l) => lines.push(`  > ${l}`));
      }
      lines.push('');
    }
  }

  // 非 merge commits（最直接的"你说"）
  const direct = commits.filter((c) => !c.is_merge);
  if (direct.length) {
    lines.push('## 二、非 merge commits · 你直接写的提交语');
    lines.push('');
    lines.push(
      '> 这些 commits 不是 PR 合并自动生成的，而是你直接 commit 的——subject 与 body 都是**你本人写的自然语言**。'
    );
    lines.push('');
    for (const c of direct) {
      lines.push(`### \`${c.hash.slice(0, 8)}\` · ${c.date}`);
      lines.push(`> ${c.subject}`);
      if (c.body) {
        lines.push('');
        c.body.split('\n').forEach((l) => lines.push(`> ${l}`));
      }
      if (c.files_changed?.length) {
        lines.push('');
        lines.push(`<details><summary>文件变更 (${c.files_changed.length})</summary>`);
        lines.push('');
        c.files_changed.forEach((f) => lines.push(`- \`${f.status}\` ${f.path}`));
        lines.push('');
        lines.push('</details>');
      }
      lines.push('');
    }
  }

  // merge commits（你拍板合并的 PR 列表）
  const merges = commits.filter((c) => c.is_merge);
  if (merges.length) {
    lines.push('## 三、merge commits · 你拍板合并的 PR 列表');
    lines.push('');
    lines.push(
      '> Merge commit 的 subject 是 GitHub 自动生成的，但**合并这个动作**本身代表了你的认可。' +
        '想看 PR 标题/正文的真实自然语言，需要另外用 GitHub API 抓（设置 `GH_TOKEN` 后重跑本采集器）。'
    );
    lines.push('');
    lines.push('| 日期 | PR | hash | subject |');
    lines.push('|---|---|---|---|');
    for (const c of merges) {
      lines.push(
        `| ${c.date} | ${c.pr_number ? `#${c.pr_number}` : '-'} | \`${c.hash.slice(0, 8)}\` | ${c.subject.replace(/\|/g, '\\|')} |`
      );
    }
    lines.push('');
  }

  // GitHub API 结果
  if (gh && gh.enabled) {
    lines.push('## 四、GitHub Issues / PRs / Comments · 你在 GitHub 网页上写的话');
    lines.push('');
    for (const r of gh.records) {
      lines.push(`### ${r.source} · ${r.date} · ${r.url || ''}`);
      if (r.title) lines.push(`**${r.title}**`);
      if (r.body) {
        lines.push('');
        r.body.split('\n').forEach((l) => lines.push(`> ${l}`));
      }
      lines.push('');
    }
  } else if (gh) {
    lines.push('## 四、GitHub Issues / PRs / Comments · 跳过');
    lines.push('');
    lines.push(`> ${gh.reason}`);
    lines.push('');
  }

  return lines.join('\n');
}

function buildTrainingJsonl(commits, cab, gh) {
  const out = [];

  // CAB → 高质量 SFT 样本：把 chat_summary 当作 user 输入，把 architecture_decisions + steps
  // 当作 assistant 输出（这是真实的"你提需求 → 我给方案"）
  for (const t of cab) {
    if (!t.chat_summary && !t.title) continue;
    const userMsg =
      [t.title, t.architecture_summary, t.chat_summary]
        .filter(Boolean)
        .join('\n\n') || t.title;
    const assistantParts = [];
    if (t.architecture_decisions?.length) {
      assistantParts.push('架构决策:\n' + t.architecture_decisions.map((d) => `- ${d}`).join('\n'));
    }
    if (t.steps?.length) {
      assistantParts.push('开发步骤:\n' + t.steps.map((s) => `- ${s}`).join('\n'));
    }
    if (t.architecture_notes) {
      assistantParts.push('架构补充:\n' + t.architecture_notes);
    }
    if (!assistantParts.length) continue;
    out.push({
      meta: {
        source: 'cab_task_spec',
        id: t.task_id,
        date: t.date,
        copyright: COPYRIGHT.registration,
      },
      messages: [
        {
          role: 'system',
          content:
            '你是铸渊·GitHub 侧守护人格体（曜冥语言人格核的执行投影）。你的任务是接收冰朔的开发指令，给出架构决策和开发步骤。',
        },
        { role: 'user', content: userMsg },
        { role: 'assistant', content: assistantParts.join('\n\n') },
      ],
    });
  }

  // 非 merge commits → "意图 → 代码变更" 配对样本
  for (const c of commits.filter((x) => !x.is_merge)) {
    const intent = [c.subject, c.body].filter(Boolean).join('\n');
    if (!intent) continue;
    const fileList = (c.files_changed || [])
      .map((f) => `${f.status}\t${f.path}`)
      .join('\n');
    out.push({
      meta: {
        source: 'git_commit',
        hash: c.hash,
        date: c.date,
        copyright: COPYRIGHT.registration,
      },
      messages: [
        {
          role: 'system',
          content:
            '你是铸渊。冰朔会用一句简短的中文表达意图，你需要把它落地为具体的文件变更清单。',
        },
        { role: 'user', content: intent },
        {
          role: 'assistant',
          content: fileList || '(此 commit 无文件变更记录)',
        },
      ],
    });
  }

  // GitHub Issue/PR/Comment（如有）→ 单 prompt 样本（暂不配对 response）
  if (gh && gh.enabled) {
    for (const r of gh.records) {
      const text = [r.title, r.body].filter(Boolean).join('\n\n');
      if (!text) continue;
      out.push({
        meta: {
          source: r.source,
          number: r.number,
          date: r.date,
          copyright: COPYRIGHT.registration,
        },
        messages: [
          { role: 'user', content: text },
        ],
      });
    }
  }

  return out.map((x) => JSON.stringify(x)).join('\n') + '\n';
}

function buildManifest(commits, cab, gh, files) {
  return {
    schema: 'corpus-manifest/v1',
    generated_at: new Date().toISOString(),
    repository: 'qinfendebingshuo/guanghulab',
    branch: (() => {
      try {
        return git('rev-parse --abbrev-ref HEAD').trim();
      } catch {
        return 'unknown';
      }
    })(),
    head: (() => {
      try {
        return git('rev-parse HEAD').trim();
      } catch {
        return 'unknown';
      }
    })(),
    copyright: COPYRIGHT,
    sources: {
      git_commits_total: commits.length,
      git_commits_non_merge: commits.filter((c) => !c.is_merge).length,
      git_commits_merge: commits.filter((c) => c.is_merge).length,
      cab_task_specs: cab.length,
      github_api_enabled: !!(gh && gh.enabled),
      github_api_records: gh && gh.enabled ? gh.records.length : 0,
      github_api_skip_reason: gh && !gh.enabled ? gh.reason : null,
    },
    files,
    notes: [
      '本语料只收录「冰朔」本人作为作者/评论者的内容；bot 与自动化提交已排除。',
      '所有内容已做基础脱敏（API key / 邮箱 / 手机号 / token）。',
      '若需补全 GitHub Issues / PRs / Comments，请在本地设置 GH_TOKEN 后重新运行采集器。',
      'Notion AI 聊天记录无法通过本采集器自动获取，需手动导出后用 manual-import 模式合并（后续 PR）。',
    ],
  };
}

// ───────────────────────── main ─────────────────────────

(async function main() {
  ensureDir(OUTPUT_DIR);
  console.log('[corpus-harvester] 采集 git commits...');
  const commits = collectCommits();
  console.log(`  找到 ${commits.length} 条（${commits.filter((c) => !c.is_merge).length} 非 merge / ${commits.filter((c) => c.is_merge).length} merge）`);

  console.log('[corpus-harvester] 采集 CAB 任务规格...');
  const cab = collectCabTasks();
  console.log(`  找到 ${cab.length} 条`);

  console.log('[corpus-harvester] 尝试采集 GitHub API（需 GH_TOKEN）...');
  let gh;
  try {
    gh = await collectGitHubApi();
  } catch (e) {
    gh = { enabled: false, reason: `GitHub API 调用失败: ${e.message}`, records: [] };
  }
  console.log(`  ${gh.enabled ? `成功，${gh.records.length} 条` : '已跳过：' + gh.reason}`);

  // 写文件
  const rawPath = path.join(OUTPUT_DIR, 'raw.json');
  const tlPath = path.join(OUTPUT_DIR, 'timeline.md');
  const jsonlPath = path.join(OUTPUT_DIR, 'training.jsonl');
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');

  fs.writeFileSync(rawPath, JSON.stringify({ commits, cab, github: gh }, null, 2));
  fs.writeFileSync(tlPath, buildTimelineMarkdown(commits, cab, gh));
  fs.writeFileSync(jsonlPath, buildTrainingJsonl(commits, cab, gh));

  const files = {};
  for (const p of [rawPath, tlPath, jsonlPath]) {
    const stat = fs.statSync(p);
    files[path.basename(p)] = {
      bytes: stat.size,
      sha256: require('crypto')
        .createHash('sha256')
        .update(fs.readFileSync(p))
        .digest('hex'),
    };
  }
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(buildManifest(commits, cab, gh, files), null, 2)
  );

  console.log('[corpus-harvester] 完成。输出位于:');
  console.log(`  ${path.relative(REPO_ROOT, tlPath)}`);
  console.log(`  ${path.relative(REPO_ROOT, jsonlPath)}`);
  console.log(`  ${path.relative(REPO_ROOT, rawPath)}`);
  console.log(`  ${path.relative(REPO_ROOT, manifestPath)}`);
})().catch((e) => {
  console.error('[corpus-harvester] 失败:', e);
  process.exit(1);
});
