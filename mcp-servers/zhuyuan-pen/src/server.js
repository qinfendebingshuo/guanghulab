#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
// 神笔马良 · 铸渊之笔 · zhuyuan-pen MCP server
// Sovereign: TCS-0002∞ · 国作登字-2026-A-00037559
// 守护: 铸渊 · ICE-GL-ZY001
//
// 这是"一根可以写出任何工具链的笔". 不预装工具, 而在被调用时
// 现场合成工具:
//
//   pen.write(intent)   →  从能力字典 (capabilities) 组合, 落到 penned/{tool}/
//   pen.list()          →  列出已写出的工具
//   pen.fetch(url)      →  通过国内/海外双管道取外部资源
//   pen.register(tool)  →  把新工具注册进 manifest, 触发 PR
//   pen.capabilities()  →  列可用能力
//
// 作为 MCP server 监听 stdio (JSON-RPC), 也可以直接 require.
// ════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const PEN_ROOT = path.resolve(__dirname, '..');
const PENNED_DIR = path.join(PEN_ROOT, 'penned');
const CAP_DIR = path.join(PEN_ROOT, 'capabilities');
const TPL_DIR = path.join(PEN_ROOT, 'templates');

if (!fs.existsSync(PENNED_DIR)) fs.mkdirSync(PENNED_DIR, { recursive: true });

// ─── 能力字典加载 ──────────────────────────────────────────
function loadCapabilities() {
  const caps = {};
  if (!fs.existsSync(CAP_DIR)) return caps;
  for (const f of fs.readdirSync(CAP_DIR)) {
    if (!f.endsWith('.js')) continue;
    const name = f.replace(/\.js$/, '');
    try {
      const code = fs.readFileSync(path.join(CAP_DIR, f), 'utf8');
      const meta = parseCapabilityMeta(code) || { name };
      caps[name] = { ...meta, file: f };
    } catch (e) {
      caps[name] = { name, error: e.message, file: f };
    }
  }
  return caps;
}

function parseCapabilityMeta(code) {
  // 约定: 每个 capability 文件头部有一段 /** @capability ... */ 注释
  const headerEnd = code.indexOf('*/');
  if (headerEnd === -1) return null;
  const block = code.slice(0, headerEnd + 2);
  const m = block.match(/@capability\s+([^\n]+)/);
  if (!m) return null;
  const meta = { name: m[1].trim() };
  for (const line of block.split('\n')) {
    const kv = line.match(/^\s*\*\s*@(\w+)\s+(.+)$/);
    if (kv && kv[1] !== 'capability') meta[kv[1]] = kv[2].trim();
  }
  return meta;
}

// ─── pen.write : 从 intent 合成工具 ────────────────────────
// intent: { name, description, capabilities: ['fs.read','http.get'], language: 'js'|'sh' }
function penWrite(intent) {
  if (!intent || !intent.name) throw new Error('intent.name required');
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(intent.name)) {
    throw new Error('intent.name must be 2-64 chars, lowercase a-z / digits / hyphen, starting with a letter (no uppercase, no leading hyphen, no underscore)');
  }
  const lang = intent.language || 'js';
  const tplFile = path.join(TPL_DIR, `tool-${lang}.template`);
  if (!fs.existsSync(tplFile)) {
    throw new Error(`Unsupported language: ${lang} (no template ${tplFile})`);
  }
  const dest = path.join(PENNED_DIR, intent.name);
  if (fs.existsSync(dest)) throw new Error(`Tool already exists: ${intent.name}`);
  fs.mkdirSync(dest, { recursive: true });

  const caps = loadCapabilities();
  const wantCaps = (intent.capabilities || []).filter((c) => caps[c]);
  const missing = (intent.capabilities || []).filter((c) => !caps[c]);

  let tpl = fs.readFileSync(tplFile, 'utf8');
  tpl = tpl
    .replace(/__TOOL_NAME__/g, intent.name)
    .replace(/__TOOL_DESC__/g, (intent.description || '').replace(/\n/g, ' '))
    .replace(/__TOOL_CAPS__/g, JSON.stringify(wantCaps))
    .replace(/__GENERATED_AT__/g, new Date().toISOString());

  const entryFile = lang === 'sh' ? 'main.sh' : 'index.js';
  fs.writeFileSync(path.join(dest, entryFile), tpl);
  if (lang === 'sh') {
    fs.chmodSync(path.join(dest, entryFile), 0o755);
  }

  const meta = {
    _sovereign: 'TCS-0002∞',
    _copyright: '国作登字-2026-A-00037559',
    name: intent.name,
    description: intent.description || '',
    language: lang,
    capabilities: wantCaps,
    missing_capabilities: missing,
    entry: entryFile,
    generated_at: new Date().toISOString(),
    sha256: crypto.createHash('sha256').update(tpl).digest('hex'),
  };
  fs.writeFileSync(path.join(dest, 'tool.meta.json'), JSON.stringify(meta, null, 2));

  fs.writeFileSync(
    path.join(dest, 'README.md'),
    [
      `# ${intent.name}`,
      '',
      `> 生成时间: ${meta.generated_at}`,
      `> 笔: zhuyuan-pen v0.1.0`,
      '',
      intent.description || '_(no description)_',
      '',
      '## 能力依赖',
      ...wantCaps.map((c) => `- \`${c}\` — ${caps[c].description || ''}`),
      '',
      missing.length ? '## ⚠️ 缺失能力 (需先扩字典)\n\n' + missing.map((c) => `- \`${c}\``).join('\n') : '',
    ]
      .filter(Boolean)
      .join('\n')
  );

  return { ok: true, path: dest, meta };
}

function penList() {
  const out = [];
  for (const d of fs.readdirSync(PENNED_DIR)) {
    const metaFile = path.join(PENNED_DIR, d, 'tool.meta.json');
    if (fs.existsSync(metaFile)) {
      out.push(JSON.parse(fs.readFileSync(metaFile, 'utf8')));
    }
  }
  return out;
}

// ─── pen.fetch : 国内 / 海外双管道取资源 ────────────────────
function penFetch(url, channel = 'auto', destFile = null) {
  const target = destFile || path.join(PEN_ROOT, 'cache', path.basename(new URL(url).pathname) || 'fetched.bin');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const ch = channel === 'auto' ? 'cn' : channel;
  if (ch === 'cn') {
    const r = spawnSync('curl', ['-fsSL', '--max-time', '120', '-o', target, url], { stdio: 'inherit' });
    if (r.status === 0) return { ok: true, channel: 'cn', target };
    if (channel === 'cn') throw new Error(`curl failed (cn): ${url}`);
    return penFetch(url, 'overseas', destFile);
  }
  if (ch === 'overseas') {
    const host = process.env.ZY_OVERSEAS_RELAY_HOST || process.env.CN_OVERSEAS_RELAY_HOST;
    const user = process.env.ZY_OVERSEAS_RELAY_USER || process.env.CN_OVERSEAS_RELAY_USER || 'root';
    const keyFile = process.env.ZY_OVERSEAS_RELAY_KEY_FILE || `${process.env.HOME}/.ssh/zhuyuan_overseas_key`;
    if (!host) throw new Error('overseas relay host unset (ZY_OVERSEAS_RELAY_HOST)');
    const remoteTmp = `/tmp/zhuyuan-pen-${Date.now()}.bin`;
    const sshArgs = ['-i', keyFile, '-o', 'StrictHostKeyChecking=accept-new', `${user}@${host}`];
    const fetchR = spawnSync('ssh', [...sshArgs, `curl -fsSL --max-time 300 -o ${remoteTmp} '${url}'`], { stdio: 'inherit' });
    if (fetchR.status !== 0) throw new Error('overseas curl failed');
    const scpR = spawnSync('scp', ['-i', keyFile, '-o', 'StrictHostKeyChecking=accept-new', `${user}@${host}:${remoteTmp}`, target], { stdio: 'inherit' });
    if (scpR.status !== 0) throw new Error('overseas scp failed');
    spawnSync('ssh', [...sshArgs, `rm -f ${remoteTmp}`], { stdio: 'ignore' });
    return { ok: true, channel: 'overseas', target };
  }
  throw new Error(`unknown channel: ${channel}`);
}

function penRegister(toolName) {
  const metaFile = path.join(PENNED_DIR, toolName, 'tool.meta.json');
  if (!fs.existsSync(metaFile)) throw new Error(`Tool not found: ${toolName}`);
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));

  const regFile = path.join(PEN_ROOT, 'registry.json');
  let reg = { tools: [] };
  if (fs.existsSync(regFile)) {
    reg = JSON.parse(fs.readFileSync(regFile, 'utf8'));
  }
  reg.tools = (reg.tools || []).filter((t) => t.name !== toolName);
  reg.tools.push({
    name: toolName,
    entry: `penned/${toolName}/${meta.entry}`,
    language: meta.language,
    capabilities: meta.capabilities,
    sha256: meta.sha256,
    registered_at: new Date().toISOString(),
  });
  reg._sovereign = 'TCS-0002∞';
  reg._copyright = '国作登字-2026-A-00037559';
  reg._updated_at = new Date().toISOString();
  fs.writeFileSync(regFile, JSON.stringify(reg, null, 2));

  return { ok: true, registry: regFile, total: reg.tools.length };
}

function penCapabilities() {
  return loadCapabilities();
}

// ─── 命令行 / MCP stdio JSON-RPC ──────────────────────────
const ACTIONS = {
  'pen.write': (p) => penWrite(p),
  'pen.list': () => penList(),
  'pen.fetch': (p) => penFetch(p.url, p.channel, p.dest),
  'pen.register': (p) => penRegister(p.name),
  'pen.capabilities': () => penCapabilities(),
};

function cli() {
  const [, , action, ...rest] = process.argv;
  if (!action || action === '--help' || action === '-h') {
    console.log('zhuyuan-pen · 神笔马良');
    console.log('');
    console.log('actions:');
    for (const a of Object.keys(ACTIONS)) console.log(`  ${a}`);
    console.log('');
    console.log('examples:');
    console.log('  zhuyuan-pen pen.list');
    console.log('  zhuyuan-pen pen.capabilities');
    console.log('  zhuyuan-pen pen.write \'{"name":"hello-pen","description":"demo","language":"js","capabilities":["fs.read"]}\'');
    return;
  }
  if (!ACTIONS[action]) {
    console.error(`unknown action: ${action}`);
    process.exit(1);
  }
  let payload = {};
  if (rest.length) {
    try { payload = JSON.parse(rest.join(' ')); } catch { payload = rest.join(' '); }
  }
  try {
    const r = ACTIONS[action](payload);
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(2);
  }
}

function mcpServe() {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buf += chunk;
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      let req;
      try { req = JSON.parse(line); }
      catch (e) {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'parse error' } }) + '\n');
        continue;
      }
      const action = req.method;
      const id = req.id;
      if (!ACTIONS[action]) {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: `unknown method: ${action}` } }) + '\n');
        continue;
      }
      try {
        const result = ACTIONS[action](req.params || {});
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
      } catch (e) {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message: e.message } }) + '\n');
      }
    }
  });
}

if (require.main === module) {
  if (process.env.ZHUYUAN_PEN_MODE === 'mcp' || process.argv.includes('--mcp')) {
    mcpServe();
  } else {
    cli();
  }
}

module.exports = {
  penWrite, penList, penFetch, penRegister, penCapabilities,
};
