/**
 * ═══════════════════════════════════════════════════════════
 * 🔌 Channel Switcher · 母编号 × 子编号 切换器 (Phase 1 最小版本)
 * ═══════════════════════════════════════════════════════════
 *
 * 角色:
 *   一台服务器 (母编号 ZY-SVR-XXX) 上常驻的唯一切换 Agent.
 *   Phase 1 仅支持只读: list / current. 不实施真实切换 (避免误动生产).
 *   Phase 2 增加 activate (移软链 + reload PM2 + reload Nginx).
 *
 * 守护:   铸渊 · ICE-GL-ZY001
 * 主权:   TCS-0002∞ | SYS-GLW-0001
 * 版权:   国作登字-2026-A-00037559
 *
 * 监听:
 *   仅 127.0.0.1:39000 (CHANNEL_SWITCHER_BIND / CHANNEL_SWITCHER_PORT 可覆盖)
 *   由 Nginx 反向代理到 /__switch (各域名共享同一切换器)
 *
 * 数据源:
 *   FUNCTION_MANIFEST_PATH (默认 /opt/guanghu/_manifest/function-manifest.json)
 *   该文件由部署 workflow 从仓库 .github/brain/architecture/ 同步而来,
 *   不直接读仓库 — 服务器零 git 依赖.
 *
 * 路由:
 *   GET  /__switch/health           健康
 *   GET  /__switch/current          当前服务器激活的 ZY-FN 列表
 *   GET  /__switch/list             本服务器上所有已登记的 ZY-FN
 *   GET  /__switch/manifest         返回精简后的 manifest (供前端徽章)
 *   POST /__switch/activate         Phase 2 实现, 当前返回 501
 *
 * SYSLOG 回执: 每次有意义的查询写一行到 stdout, 由 PM2 收集后由
 *   .github/workflows/bridge-syslog-to-notion.yml 汇聚到 AG-ZY-README,
 *   天眼涌现层自然感知.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const url = require('url');
const os = require('os');

const PORT = parseInt(process.env.CHANNEL_SWITCHER_PORT || '39000', 10);
const BIND = process.env.CHANNEL_SWITCHER_BIND || '127.0.0.1';
const SERVER_ID = process.env.CHANNEL_SWITCHER_SERVER_ID || 'ZY-SVR-UNKNOWN';
const MANIFEST_PATH =
  process.env.FUNCTION_MANIFEST_PATH ||
  '/opt/guanghu/_manifest/function-manifest.json';

let manifestCache = null;
let manifestMtime = 0;

function loadManifest() {
  try {
    const stat = fs.statSync(MANIFEST_PATH);
    if (manifestCache && stat.mtimeMs === manifestMtime) {
      return manifestCache;
    }
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    manifestCache = parsed;
    manifestMtime = stat.mtimeMs;
    return parsed;
  } catch (err) {
    return { _error: err.message };
  }
}

function jsonResponse(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body, null, 2));
}

function logSyslog(event, payload) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    source: 'channel-switcher',
    server_id: SERVER_ID,
    host: os.hostname(),
    event,
    payload: payload || {}
  });
  process.stdout.write(line + '\n');
}

function serverFunctionsFromManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.functions)) return [];
  return manifest.functions.filter((fn) => fn.host_server === SERVER_ID);
}

function activeRoutesForServer(manifest) {
  if (!manifest || !manifest.active_routes) return {};
  const out = {};
  for (const [domain, route] of Object.entries(manifest.active_routes)) {
    if (!route || typeof route !== 'object') continue;
    if (route.host_server === SERVER_ID) out[domain] = route;
  }
  return out;
}

function handleHealth(_req, res) {
  jsonResponse(res, 200, {
    ok: true,
    service: 'channel-switcher',
    server_id: SERVER_ID,
    bind: BIND,
    port: PORT,
    manifest_path: MANIFEST_PATH,
    manifest_loaded: !!manifestCache,
    phase: 1,
    capabilities: ['list', 'current', 'manifest'],
    activate_supported: false
  });
}

function handleList(_req, res) {
  const manifest = loadManifest();
  if (manifest._error) return jsonResponse(res, 500, { error: true, message: manifest._error });
  const fns = serverFunctionsFromManifest(manifest).map((fn) => ({
    id: fn.id,
    display_name_zh: fn.display_name_zh,
    aliases: fn.aliases || [],
    domain: fn.domain,
    description: fn.description,
    status: fn.status,
    keep_decision: fn.keep_decision || 'evaluate'
  }));
  logSyslog('list', { count: fns.length });
  jsonResponse(res, 200, { server_id: SERVER_ID, count: fns.length, functions: fns });
}

function handleCurrent(_req, res) {
  const manifest = loadManifest();
  if (manifest._error) return jsonResponse(res, 500, { error: true, message: manifest._error });
  const routes = activeRoutesForServer(manifest);
  const fns = serverFunctionsFromManifest(manifest);
  const fnById = Object.fromEntries(fns.map((f) => [f.id, f]));
  const enriched = {};
  for (const [domain, route] of Object.entries(routes)) {
    const fn = fnById[route.active_fn];
    enriched[domain] = {
      active_fn: route.active_fn,
      display_name_zh: fn ? fn.display_name_zh : null,
      since: route.since || null,
      status: fn ? fn.status : 'unknown'
    };
  }
  logSyslog('current', { domains: Object.keys(enriched) });
  jsonResponse(res, 200, { server_id: SERVER_ID, active_routes: enriched });
}

function handleManifest(_req, res) {
  const manifest = loadManifest();
  if (manifest._error) return jsonResponse(res, 500, { error: true, message: manifest._error });
  // 精简版: 仅本服务器 + 必要字段, 不暴露 secrets 别名映射的全貌
  const fns = serverFunctionsFromManifest(manifest).map((fn) => ({
    id: fn.id,
    display_name_zh: fn.display_name_zh,
    aliases: fn.aliases || [],
    domain: fn.domain,
    description: fn.description,
    created_for: fn.created_for,
    status: fn.status,
    keep_decision: fn.keep_decision || 'evaluate'
  }));
  jsonResponse(res, 200, {
    server_id: SERVER_ID,
    version: manifest.version,
    updated_at: manifest.updated_at,
    functions: fns,
    active_routes: activeRoutesForServer(manifest)
  });
}

function handleActivate(_req, res) {
  // Phase 1 不支持真实切换. 返回 501 但带上未来形状, 让前端可以提前对接.
  logSyslog('activate.rejected', { reason: 'phase-1-readonly' });
  jsonResponse(res, 501, {
    error: true,
    code: 'not_implemented_phase_1',
    message: '切换器当前为只读模式 (Phase 1). Phase 2 将启用 activate.',
    future_shape: {
      method: 'POST',
      path: '/__switch/activate',
      body: { fn_id: 'ZY-FN-XXXX', token: '<语言层令牌>' }
    }
  });
}

const ROUTES = {
  '/__switch/health': handleHealth,
  '/__switch/list': handleList,
  '/__switch/current': handleCurrent,
  '/__switch/manifest': handleManifest,
  '/__switch/activate': handleActivate
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || '/', true);
  const pathname = (parsed.pathname || '/').replace(/\/+$/, '') || '/';
  const handler = ROUTES[pathname];
  if (!handler) {
    return jsonResponse(res, 404, {
      error: true,
      code: 'not_found',
      message: `未知路径 ${pathname}`,
      available: Object.keys(ROUTES)
    });
  }
  if (pathname === '/__switch/activate' && req.method !== 'POST') {
    return jsonResponse(res, 405, { error: true, code: 'method_not_allowed' });
  }
  if (pathname !== '/__switch/activate' && req.method !== 'GET') {
    return jsonResponse(res, 405, { error: true, code: 'method_not_allowed' });
  }
  try {
    handler(req, res);
  } catch (err) {
    jsonResponse(res, 500, { error: true, message: err.message });
  }
});

if (require.main === module) {
  server.listen(PORT, BIND, () => {
    logSyslog('bootstrap', { bind: BIND, port: PORT, server_id: SERVER_ID, manifest: MANIFEST_PATH });
    // eslint-disable-next-line no-console
    console.log(`[channel-switcher] ${SERVER_ID} listening on ${BIND}:${PORT} · manifest: ${MANIFEST_PATH}`);
  });
}

module.exports = { server, loadManifest, serverFunctionsFromManifest, activeRoutesForServer };
