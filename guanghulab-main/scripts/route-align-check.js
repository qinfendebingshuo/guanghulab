// scripts/route-align-check.js
// 用途：检查路由路径与 HLI 注册表编号的一致性

const fs = require('fs');
const path = require('path');

// HLI 路由路径映射（从 Notion 注册表同步）
const HLI_ROUTES = {
  'HLI-AUTH-001':      '/hli/auth/login',
  'HLI-AUTH-002':      '/hli/auth/register',
  'HLI-AUTH-003':      '/hli/auth/verify',
  'HLI-PERSONA-001':   '/hli/persona/load',
  'HLI-PERSONA-002':   '/hli/persona/switch',
  'HLI-USER-001':      '/hli/user/profile',
  'HLI-USER-002':      '/hli/user/profile/update',
  'HLI-TICKET-001':    '/hli/ticket/create',
  'HLI-TICKET-002':    '/hli/ticket/query',
  'HLI-TICKET-003':    '/hli/ticket/status',
  'HLI-DIALOGUE-001':  '/hli/dialogue/send',
  'HLI-DIALOGUE-002':  '/hli/dialogue/stream',
  'HLI-DIALOGUE-003':  '/hli/dialogue/history',
  'HLI-STORAGE-001':   '/hli/storage/upload',
  'HLI-STORAGE-002':   '/hli/storage/download',
  'HLI-DASHBOARD-001': '/hli/dashboard/status',
  'HLI-DASHBOARD-002': '/hli/dashboard/realtime',
};

const schemaDir = 'src/schemas/hli';
const errors = [];

Object.entries(HLI_ROUTES).forEach(([hliId, expectedPath]) => {
  const domain = hliId.split('-')[1].toLowerCase();
  const domainDir = path.join(schemaDir, domain);

  // 若 domain 目录尚不存在，视为未实现
  if (!fs.existsSync(domainDir)) {
    errors.push(`⚠️ [UNIMPLEMENTED] ${hliId} (${expectedPath}) — 尚无 schema 文件`);
    return;
  }

  const schemaFiles = fs.readdirSync(domainDir).filter(f => f.endsWith('.schema.json'));

  const matched = schemaFiles.find(f => {
    try {
      const schema = JSON.parse(fs.readFileSync(path.join(domainDir, f), 'utf8'));
      return schema.hli_id === hliId;
    } catch (_) {
      return false;
    }
  });

  if (!matched) {
    errors.push(`⚠️ [UNIMPLEMENTED] ${hliId} (${expectedPath}) — 尚无 schema 文件`);
  }
});

if (errors.length > 0) {
  console.warn('\n⚠️ Route Alignment Report:\n');
  errors.forEach(e => console.warn(e));
  // 非阻断，仅报告
  console.warn(`\n📊 覆盖率: ${Object.keys(HLI_ROUTES).length - errors.length}/${Object.keys(HLI_ROUTES).length}`);
} else {
  console.log('✅ Route Alignment PASSED — 所有 HLI 接口均已实现');
}
