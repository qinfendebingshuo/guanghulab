// 用途：检查 HLI 注册表里的 17 个接口，代码里实现了几个
const fs = require('fs');
const path = require('path');

const HLI_ROUTES = {
  'HLI-AUTH-001': '/hli/auth/login',
  'HLI-AUTH-002': '/hli/auth/register',
  'HLI-AUTH-003': '/hli/auth/verify',
  'HLI-PERSONA-001': '/hli/persona/load',
  'HLI-PERSONA-002': '/hli/persona/switch',
  'HLI-USER-001': '/hli/user/profile',
  'HLI-USER-002': '/hli/user/profile/update',
  'HLI-TICKET-001': '/hli/ticket/create',
  'HLI-TICKET-002': '/hli/ticket/query',
  'HLI-TICKET-003': '/hli/ticket/status',
  'HLI-DIALOGUE-001': '/hli/dialogue/send',
  'HLI-DIALOGUE-002': '/hli/dialogue/stream',
  'HLI-DIALOGUE-003': '/hli/dialogue/history',
  'HLI-STORAGE-001': '/hli/storage/upload',
  'HLI-STORAGE-002': '/hli/storage/download',
  'HLI-DASHBOARD-001': '/hli/dashboard/status',
  'HLI-DASHBOARD-002': '/hli/dashboard/realtime'
};

const schemaDir = 'src/schemas/hli';
let implemented = 0;
let missing = 0;

Object.entries(HLI_ROUTES).forEach(([hliId, route]) => {
  const domain = hliId.split('-')[1].toLowerCase();
  const domainDir = path.join(schemaDir, domain);
  
  if (!fs.existsSync(domainDir)) {
    console.warn('△ [UNIMPLEMENTED] ' + hliId + ' (' + route + ')');
    missing++;
    return;
  }
  
  const files = fs.readdirSync(domainDir).filter(f => f.endsWith('.schema.json'));
  const found = files.some(f => {
    try {
      const schema = JSON.parse(fs.readFileSync(path.join(domainDir, f), 'utf8'));
      return schema.hli_id === hliId;
    } catch { return false; }
  });
  
  if (found) {
    implemented++;
  } else {
    console.warn('△ [UNIMPLEMENTED] ' + hliId + ' (' + route + ')');
    missing++;
  }
});

console.log(`\n\n📊 覆盖率: ${implemented} / ${implemented + missing}`);
if (missing === 0) {
  console.log('✅ Route Alignment PASSED - 所有 HLI 接口均已实现');
} else {
  console.error(`❌ Route Alignment FAILED - ${missing} 个 HLI 接口未实现`);
  process.exit(1);
}
