// ===============================
// Notion 连通测试 · notion-test.js
// DEV-004 之之 · Phase 5
// 用法：node notion-test.js
// ===============================

require('dotenv').config();
const notion = require('./sync/sync-to-notion');

async function runTests() {
  console.log('\n==============================');
  console.log('  Notion 数据桥连通测试');
  console.log('==============================\n');

  // 测试1：检查配置
  console.log('--- 测试1：配置检查 ---');
  var configured = notion.isConfigured();
  console.log('Token 已配置:', configured ? '✅ 是' : '❌ 否');
  if (!configured) {
    console.log('⚠️ 请检查 .env 文件中的 NOTION_TOKEN');
    return;
  }

  // 测试2：Token有效性（调 users/me）
  console.log('\n--- 测试2：Token有效性 ---');
  var health = await notion.healthCheck();
  console.log('API 在线:', health.online ? '✅ 是' : '❌ 否');
  if (health.online) {
    console.log('  集成名称:', health.bot_name);
    console.log('  集成 ID:', health.bot_id);
  } else {
    console.log('  失败原因:', health.reason);
    console.log('\n△ Token无效或网络不通，后续测试跳过');
    return;
  }

  // 测试3：数据库连通
  console.log('\n--- 测试3：数据库连通 ---');
  var databases = ['syslog', 'signalLog', 'changeLog', 'ticket'];
  var dbNames = ['SYSLOG收件箱', '信号日志', '变更日志', '工单簿'];
  for (var i = 0; i < databases.length; i++) {
    var result = await notion.testDatabase(databases[i]);
    var icon = result.accessible ? '✅' : '❌';
    console.log(icon + ' ' + dbNames[i] + ':', result.accessible ? '可访问' : result.reason);
  }

  // 测试4：写入测试（写一条测试SYSLOG）
  console.log('\n--- 测试4：SYSLOG写入测试 ---');
  var writeResult = await notion.writeSyslog({
    title: '【测试】M-DINGTALK Phase 5 连通测试 · DEV-004之之',
    dev_id: 'DEV-004',
    session_id: 'TEST-PHASE5-' + Date.now(),
    module: 'M-DINGTALK',
    phase_status: 'completed',
    content: '这是M-DINGTALK Phase 5 的连通测试。如果你在Notion看到这条记录，说明钉钉工作台已成功连入Notion数据桥！测试时间：' + new Date().toLocaleString('zh-CN'),
    protocol_version: 'SYSLOG-v4.0',
    source: 'M-DINGTALK-连通测试'
  });

  console.log('写入结果：', writeResult.written_to);
  if (writeResult.written_to === 'notion') {
    console.log('✅ 写入Notion成功！页面ID：', writeResult.page_id);
    console.log('🎉 数据桥真实连通！！');
  } else {
    console.log('⚠️ 降级到本地存储：', writeResult.file);
    console.log('  可能需要冰朔将数据库关联到集成');
  }

  console.log('\n==============================');
  console.log('测试完成');
  console.log('==============================\n');
}

runTests().catch(function(err) {
  console.error('测试出错：', err.message);
});
