// channel-switcher 冒烟测试 (零依赖)
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');

// 构造一个临时 manifest, 指给被测服务读
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-smoke-'));
const manifestPath = path.join(tmpDir, 'function-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify({
  version: '1.0.0-smoke',
  updated_at: '2026-05-02',
  servers: [{ id: 'ZY-SVR-TEST', display_name_zh: '测试机', ipv4: '127.0.0.1', status: 'active', template_version: '0.1.0' }],
  functions: [
    { id: 'ZY-FN-T001', display_name_zh: '测试功能甲', host_server: 'ZY-SVR-TEST', domain: 'test.local', description: 'd', created_for: 'smoke', status: 'active', modules: [] },
    { id: 'ZY-FN-T002', display_name_zh: '测试功能乙', host_server: 'ZY-SVR-OTHER', domain: 'other.local', description: 'd', created_for: 'smoke', status: 'active', modules: [] }
  ],
  active_routes: { 'test.local': { active_fn: 'ZY-FN-T001', host_server: 'ZY-SVR-TEST' } }
}));

process.env.FUNCTION_MANIFEST_PATH = manifestPath;
process.env.CHANNEL_SWITCHER_SERVER_ID = 'ZY-SVR-TEST';
process.env.CHANNEL_SWITCHER_PORT = '0';
process.env.CHANNEL_SWITCHER_BIND = '127.0.0.1';

const { server, serverFunctionsFromManifest, loadManifest } = require('../server.js');

const m = loadManifest();
const fns = serverFunctionsFromManifest(m);
if (fns.length !== 1 || fns[0].id !== 'ZY-FN-T001') {
  console.error('FAIL: serverFunctionsFromManifest filtering wrong', fns);
  process.exit(1);
}

function get(port, urlPath) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: urlPath }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    }).on('error', reject);
  });
}

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  let ok = true;
  try {
    const h = await get(port, '/__switch/health');
    if (h.status !== 200 || !JSON.parse(h.body).ok) { ok = false; console.error('health failed', h); }

    const list = await get(port, '/__switch/list');
    const listJson = JSON.parse(list.body);
    if (list.status !== 200 || listJson.count !== 1 || listJson.functions[0].id !== 'ZY-FN-T001') {
      ok = false; console.error('list failed', list);
    }

    const cur = await get(port, '/__switch/current');
    const curJson = JSON.parse(cur.body);
    if (cur.status !== 200 || !curJson.active_routes['test.local']) {
      ok = false; console.error('current failed', cur);
    }

    const mani = await get(port, '/__switch/manifest');
    if (mani.status !== 200) { ok = false; console.error('manifest failed', mani); }

    const act = await get(port, '/__switch/activate');
    if (act.status !== 405) { ok = false; console.error('activate method check failed', act); }

    const nf = await get(port, '/__switch/unknown');
    if (nf.status !== 404) { ok = false; console.error('404 check failed', nf); }
  } catch (e) {
    ok = false;
    console.error('exception', e);
  } finally {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  if (ok) {
    console.log('channel-switcher smoke OK');
    process.exit(0);
  } else {
    process.exit(1);
  }
});
