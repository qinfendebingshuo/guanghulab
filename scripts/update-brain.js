const fs = require('fs');
const path = require('path');

const BRAIN = '.github/persona-brain';
const MEMORY = path.join(BRAIN, 'memory.json');
const SCHEMA_DIR = 'src/schemas/hli';
const ROUTE_DIR = 'src/routes/hli';

let memory = {};
try {
  memory = JSON.parse(fs.readFileSync(MEMORY, 'utf8'));
} catch {
  memory = { 
    persona_id: 'ICE-GL-ZY001', 
    persona_name: '铸渊', 
    recent_events: [] 
  };
}

let schemaCount = 0, routeCount = 0;
const domains = ['auth', 'persona', 'user', 'ticket', 'dialogue', 'storage', 'dashboard'];

domains.forEach(d => {
  const sp = path.join(SCHEMA_DIR, d);
  const rp = path.join(ROUTE_DIR, d);
  if (fs.existsSync(sp)) schemaCount += fs.readdirSync(sp).filter(f => f.endsWith('.schema.json')).length;
  if (fs.existsSync(rp)) routeCount += fs.readdirSync(rp).filter(f => f.endsWith('.js')).length;
});

memory.last_updated = new Date().toISOString();
memory.total_schemas_created = schemaCount;
memory.total_routes_implemented = routeCount;
memory.hli_coverage = schemaCount + '/17';
memory.total_ci_runs = (memory.total_ci_runs || 0) + 1;

memory.recent_events = memory.recent_events || [];
memory.recent_events.unshift({
  date: new Date().toISOString().split('T')[0],
  type: 'ci_run',
  description: 'CI完成 · schema ' + schemaCount + '/17 · 路由 ' + routeCount + ' 个',
  by: 'GitHub Actions'
});
memory.recent_events = memory.recent_events.slice(0, 50);

fs.writeFileSync(MEMORY, JSON.stringify(memory, null, 2));
console.log('✅ 铸渊记忆已更新 · schema: ' + schemaCount + '/17');
