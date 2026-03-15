/**
 * BC-集成-005 代码补丁
 * 自动创建鉴权中间件 + 修改API路由 + 添加新端点
 * DEV-010桔子 · 2026-03-13
 */
const fs = require('fs');
const path = require('path');
const backendDir = __dirname;
console.log('📂 工作目录：', backendDir);
// ═══════════════════════════════════════
// 1. 创建 middleware/auth.js（API门卫）
// ═══════════════════════════════════════
const middlewareDir = path.join(backendDir, 'middleware');
if (!fs.existsSync(middlewareDir)) {
 fs.mkdirSync(middlewareDir, { recursive: true });
}
const authCode = [
 '/**',
 ' * API 鉴权中间件 · BC-集成-005',
 ' * 检查请求头 X-API-Key 是否匹配',
 ' * 只保护 POST 写入接口，GET 查询不需要鉴权',
 ' */',
 'function apiAuth(req, res, next) {',
 ' var apiKey = req.headers["x-api-key"];',
 ' if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {',
 ' console.log("❌ 鉴权失败：", req.ip);',
 ' return res.status(401).json({ error: "Unauthorized" });',
 ' }',
 ' next();',
 '}',
 '',
 'module.exports = apiAuth;'
].join('\n');
fs.writeFileSync(path.join(middlewareDir, 'auth.js'), authCode);
console.log('✅ [1/3] middleware/auth.js 已创建（API门卫）');
// ═══════════════════════════════════════
// 2. 修改 syslog-api.js：给 POST /receive 加门卫
// ═══════════════════════════════════════
const syslogPath = path.join(backendDir, 'routes', 'syslog-api.js');
if (fs.existsSync(syslogPath)) {
 var syslogCode = fs.readFileSync(syslogPath, 'utf8');
 if (!syslogCode.includes('apiAuth')) {
 syslogCode = "const apiAuth = require('../middleware/auth');\n" + syslogCode;
 syslogCode = syslogCode.replace(
 /router\.post\(\s*['"\/]receive/,
 "router.post('/receive', apiAuth"
 );
 fs.writeFileSync(syslogPath, syslogCode);
 console.log('✅ [2/3] syslog-api.js 已添加鉴权（POST /receive 需要 X-API-Key）');
 } else {
 console.log('ℹ️ [2/3] syslog-api.js 已包含鉴权，跳过');
 }
} else {
 console.log('❌ [2/3] syslog-api.js 不存在于: ', syslogPath);
 // 尝试列出 routes 目录
 var routesDir = path.join(backendDir, 'routes');
 if (fs.existsSync(routesDir)) {
   console.log('   routes 目录文件: ', fs.readdirSync(routesDir));
 }
}
// 3. 修改 dashboard-api.js: 添加两个新端点
const dashPath = path.join(backendDir, 'routes', 'dashboard-api.js');
if (fs.existsSync(dashPath)) {
 var dashCode = fs.readFileSync(dashPath, 'utf8');
 if (!dashCode.includes('/dev/:id')) {
   var newCode = `
// ══ BC-集成-005 新增: 开发者详情 ══
// GET /api/dashboard/dev/:id
router.get('/dev/:id', async function(req, res) {
  try {
    var devId = req.params.id;
    var resp = await axios.post(
      'https://api.notion.com/v1/databases/' + process.env.DASHBOARD_DATABASE_ID + '/query',
      {
        filter: {
          property: '孕育者',
          rich_text: { contains: devId }
        }
      },
      {
        headers: {
          'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );
    var results = resp.data.results;
    if (results.length === 0) {
      return res.json({ source: 'notion', data: null, message: '未找到该开发者' });
    }
    var devModules = results.map(function(page) {
      var p = page.properties;
      function gt(prop) {
        if (!prop) return '';
        if (prop.title) return prop.title.map(function(t) {return t.plain_text;}).join('');
        if (prop.rich_text) return prop.rich_text.map(function(t) {return t.plain_text;}).join('');
        if (prop.select) return prop.select ? prop.select.name : '';
        if (prop.status) return prop.status ? prop.status.name : '';
        if (prop.checkbox !== undefined) return prop.checkbox;
        return '';
      }
      return {
        name: gt(p['名称']),
        developer: gt(p['孕育者']),
        status: gt(p['对接状态']),
        version: gt(p['当前版本']),
        persona: gt(p['宝宝人格体']),
        notes: gt(p['备注']),
        type: gt(p['类型'])
      };
    });
    res.json({ source: 'notion', dev_id: devId, data: devModules });
  } catch (err) {
    console.log('❌ 开发者详情查询失败：', err.message);
    res.json({ source: 'fallback', data: {} });
  }
});

// ══ BC-集成-005 新增：模块列表 ══
// GET /api/dashboard/modules
router.get('/modules', async function(req, res) {
  try {
    var resp = await axios.post(
      'https://api.notion.com/v1/databases/' + process.env.MODULE_DATABASE_ID + '/query',
      {},
      {
        headers: {
          'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );
    var modules = resp.data.results.map(function(page) {
      var p = page.properties;
      function gt(prop) {
        if (!prop) return '';
        if (prop.title) return prop.title.map(function(t){return t.plain_text;}).join('');
        if (prop.rich_text) return prop.rich_text.map(function(t){return t.plain_text;}).join('');
        if (prop.select) return prop.select ? prop.select.name : '';
        if (prop.multi_select) return prop.multi_select.map(function(s){return s.name;}).join(', ');
        return '';
      }
      return {
        module_id: gt(p['模块编号']),
        name: gt(p['模块名称']),
        status: gt(p['状态']),
        developer: gt(p['执行者']),
        tags: gt(p['功能标签']),
        domain: gt(p['数据域'])
      };
    });
    res.json({ source: 'notion', data: modules });
  } catch (err) {
    console.log('❌ 模块列表查询失败：', err.message);
    res.json({ source: 'fallback', data: {} });
  }
});
`;
   if (dashCode.includes('module.exports')) {
     dashCode = dashCode.replace(/module\.exports/, newCode + '\nmodule.exports');
   } else {
     dashCode += newCode;
   }
   fs.writeFileSync(dashPath, dashCode);
   console.log('✅ [3/3] dashboard-api.js 已添加 /dev/:id 和 /modules');
 } else {
   console.log('ℹ️ [3/3] dashboard-api.js 已包含新端点，跳过');
 }
} else {
 console.log('❌ [3/3] dashboard-api.js 不存在于: ', dashPath);
 var routesDir2 = path.join(backendDir, 'routes');
 if (fs.existsSync(routesDir2)) {
   console.log('   routes 目录文件: ', fs.readdirSync(routesDir2));
 }
}
console.log('\n🎉 BC-集成-005 代码补丁全部完成!');
console.log('📁 新增文件: middleware/auth.js');
console.log('📝 修改文件: routes/syslog-api.js, routes/dashboard-api.js');
console.log('\n➡️ 下一步:');
console.log('   cd ~/Desktop/guanghulab');
console.log('   git add persona-studio/backend/');
console.log('   git commit -m "[BC-集成-005-JZ][DEV-010] API鉴权+开发者详情+模块列表"');
console.log('   git push origin main');
