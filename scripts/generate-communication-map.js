// scripts/generate-communication-map.js
// 通信地图生成器 · Communication Map Generator
//
// 功能：扫描仓库中的 API 端点、webhook、同步脚本，生成 brain/communication-map.json
// 触发方式：
//   - GitHub Actions: daily-maintenance.yml
//   - 本地：node scripts/generate-communication-map.js

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT      = path.join(__dirname, '..');
const BRAIN_DIR = path.join(ROOT, 'brain');
const OUT_PATH  = path.join(BRAIN_DIR, 'communication-map.json');

const now    = new Date();

// ── 工具函数 ──

function safeRead(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

function listFiles(dirPath, ext) {
  try {
    return fs.readdirSync(dirPath)
      .filter(f => !ext || f.endsWith(ext))
      .filter(f => !f.startsWith('.'));
  } catch { return []; }
}

// ── 扫描 HLI 路由 ──

function scanHLIRoutes() {
  const routeDir = path.join(ROOT, 'src/routes/hli');
  const routes = [];

  function scanDir(dir, prefix) {
    const files = listFiles(dir, '.js');
    for (const file of files) {
      const content = safeRead(path.join(dir, file));
      const matches = content.matchAll(/router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g);
      for (const m of matches) {
        routes.push({
          method: m[1].toUpperCase(),
          path: prefix + m[2],
          file: path.relative(ROOT, path.join(dir, file))
        });
      }
    }

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          scanDir(path.join(dir, e.name), prefix + '/' + e.name);
        }
      }
    } catch { /* ignore */ }
  }

  scanDir(routeDir, '/hli');
  return routes;
}

// ── 扫描 backend 路由 ──

function scanBackendRoutes() {
  const serverFile = path.join(ROOT, 'backend/server.js');
  const content = safeRead(serverFile);
  const routes = [];
  const matches = content.matchAll(/app\.use\s*\(\s*['"]([^'"]+)['"]/g);
  for (const m of matches) {
    routes.push({ method: '*', path: m[1], file: 'backend/server.js' });
  }
  // Check for webhook
  const webhooks = content.matchAll(/app\.(post|get)\s*\(\s*['"]([^'"]+)['"]/g);
  for (const m of webhooks) {
    routes.push({ method: m[1].toUpperCase(), path: m[2], file: 'backend/server.js' });
  }
  return routes;
}

// ── 扫描 Notion 同步脚本 ──

function scanSyncScripts() {
  const scriptDir = path.join(ROOT, 'scripts');
  const files = listFiles(scriptDir, '.js');
  const syncScripts = [];

  for (const file of files) {
    const content = safeRead(path.join(scriptDir, file));
    const isNotion = /NOTION|@notionhq|notion/i.test(content);
    const isSync = /sync|bridge|push/i.test(file);
    const isHTTP = /fetch\(|axios|https?\.request/i.test(content);

    if (isNotion || isSync) {
      let direction = 'unknown';
      if (/bridge/i.test(file)) direction = 'bidirectional';
      else if (/push|sync-login|broadcast/i.test(file)) direction = 'github_to_external';
      else if (/receive|poll|heartbeat/i.test(file)) direction = 'external_to_github';
      else if (isNotion) direction = 'github_to_notion';

      syncScripts.push({
        script: 'scripts/' + file,
        direction,
        uses_notion_api: isNotion,
        uses_http: isHTTP
      });
    }
  }

  return syncScripts;
}

// ── 扫描触发路径 ──

function scanTriggerPaths() {
  const wfDir = path.join(ROOT, '.github/workflows');
  const files = listFiles(wfDir, '.yml');
  const githubToNotion = [];
  const notionToGithub = [];

  for (const file of files) {
    const content = safeRead(path.join(wfDir, file));
    const nameMatch = content.match(/^name:\s*(.+)/m);
    const name = nameMatch ? nameMatch[1].trim().replace(/^["']|["']$/g, '') : file;

    if (/notion.*bridge|bridge.*notion|syslog.*notion|changes.*notion|session.*summary/i.test(name) ||
        /notion-bridge|receive-syslog|push-broadcast|sync-login/i.test(content)) {
      githubToNotion.push({ workflow: file, name });
    }
    if (/notion.*poll|heartbeat|persona.*invoke|process.*notion|notion.*order/i.test(name) ||
        /notion-signal-bridge|notion-heartbeat|invoke-persona/i.test(content)) {
      notionToGithub.push({ workflow: file, name });
    }
  }

  return { github_to_notion: githubToNotion, notion_to_github: notionToGithub };
}

// ── 主生成 ──

function generate() {
  if (!fs.existsSync(BRAIN_DIR)) fs.mkdirSync(BRAIN_DIR, { recursive: true });

  const hliRoutes = scanHLIRoutes();
  const backendRoutes = scanBackendRoutes();
  const syncScripts = scanSyncScripts();
  const triggerPaths = scanTriggerPaths();

  // Read existing for merge
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')); } catch { /* new file */ }

  const map = {
    version: existing.version || '4.0',
    generated_at: now.toISOString(),
    generated_by: 'scripts/generate-communication-map.js',
    description: '数字地球系统通信地图 · 所有通信入口与数据流',
    api_endpoints: existing.api_endpoints || {},
    webhook_endpoints: existing.webhook_endpoints || [],
    trigger_paths: triggerPaths,
    data_sync_scripts: syncScripts,
    automation_flows: existing.automation_flows || [],
    scan_results: {
      hli_routes_found: hliRoutes.length,
      backend_routes_found: backendRoutes.length,
      sync_scripts_found: syncScripts.length,
      hli_routes: hliRoutes,
      backend_routes: backendRoutes
    }
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(map, null, 2));
  console.log(`✅ communication-map.json 已生成 · ${hliRoutes.length} HLI 路由 · ${syncScripts.length} 同步脚本`);
}

generate();
