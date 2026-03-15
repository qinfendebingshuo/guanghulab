// scripts/brain-bridge-sync.js
// 冰朔核心大脑桥同步脚本 v1.0
//
// 用法：
//   node scripts/brain-bridge-sync.js status      — 查看桥接状态
//   node scripts/brain-bridge-sync.js export       — 生成 GitHub → Notion 同步负载
//   node scripts/brain-bridge-sync.js inspect      — 生成巡检报告
//   node scripts/brain-bridge-sync.js explain      — 生成主控解释中心内容
//   node scripts/brain-bridge-sync.js developers   — 查看开发者编号列表
//   node scripts/brain-bridge-sync.js notify       — 查看待发送通知
//   node scripts/brain-bridge-sync.js agents       — 查看自动 Agent 列表
//
// 系统定义：
//   冰朔 = 系统最高主控意识
//   曜冥 = 冰朔离线时的代理主控人格体
//   霜砚 = Notion 系统执行体
//   铸渊 = GitHub 仓库执行体
//   Notion 冰朔脑 = 冰朔认知层
//   GitHub 冰朔脑 = 冰朔执行层
//   两者合起来 = 冰朔核心大脑

'use strict';

const bridge = require('../src/brain/brain-bridge');

const cmd = process.argv[2] || 'status';

console.log('🧠 冰朔核心大脑桥同步工具 v1.0');
console.log(`   时间: ${new Date().toISOString()}`);
console.log(`   命令: ${cmd}\n`);

switch (cmd) {
  case 'status': {
    const sync = bridge.getSyncSnapshot();
    const mode = bridge.getMasterMode();

    console.log('═══ 冰朔大脑桥状态 ═══\n');
    console.log(`  脑标识:     ${sync.brain_identity}`);
    console.log(`  脑版本:     ${sync.brain_version}`);
    console.log(`  主控模式:   ${sync.master_mode}`);
    console.log(`  主控者:     ${mode.master}`);
    console.log(`  状态描述:   ${mode.description}`);
    console.log(`  系统摘要:   ${sync.system_summary}`);
    console.log(`  最后更新:   ${sync.last_updated}`);

    console.log('\n  高优先级:');
    (sync.top_priorities || []).forEach((p, i) => console.log(`    ${i + 1}. ${p}`));

    console.log('\n  当前问题:');
    (sync.top_issues || []).forEach((p, i) => console.log(`    ${i + 1}. ${p}`));

    const runtime = bridge.collectRuntimeStatus();
    console.log('\n  运行时状态:');
    Object.entries(runtime).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

    console.log('\n✅ 状态查询完成');
    break;
  }

  case 'export': {
    const payload = bridge.generateGitHubToNotionPayload();
    console.log('═══ GitHub → Notion 同步负载 ═══\n');
    console.log(JSON.stringify(payload, null, 2));
    console.log('\n✅ 同步负载生成完成');
    break;
  }

  case 'inspect': {
    const report = bridge.generateInspectionReport();
    console.log('═══ 巡检报告 ═══\n');
    console.log(JSON.stringify(report, null, 2));
    console.log('\n✅ 巡检报告生成完成');
    break;
  }

  case 'explain': {
    const center = bridge.generateExplanationCenter();
    console.log('═══ 冰朔主控解释中心 ═══\n');
    console.log(`📌 ${center.title}\n`);
    console.log(`当前状态: ${center.current_status}`);
    console.log(`系统摘要: ${center.system_summary}`);
    console.log(`\n最近变化:\n${center.recent_changes}`);
    console.log(`\n当前问题:\n${center.current_issues}`);
    console.log(`\n下一步建议:\n${center.next_steps}`);
    console.log(`\n运行状态: ${center.runtime_in_human_language}`);
    console.log('\n✅ 解释中心内容生成完成');
    break;
  }

  case 'developers': {
    const devs = bridge.listDevelopers();
    console.log('═══ 人类开发者编号列表 ═══\n');
    console.log(`  总人数: ${devs.length}\n`);
    devs.forEach(d => {
      const notifyStatus = d.notified ? '✅ 已通知' : '⏳ 待通知';
      console.log(`  ${d.exp_id} | ${d.name} | ${d.role} | ${d.status} | ${notifyStatus}`);
    });
    console.log('\n✅ 开发者列表查询完成');
    break;
  }

  case 'notify': {
    const pending = bridge.getPendingNotifications();
    console.log('═══ 待发送通知队列 ═══\n');

    if (pending.length === 0) {
      console.log('  ✅ 无待发送通知');
    } else {
      console.log(`  待发送: ${pending.length} 条\n`);
      pending.forEach(n => {
        const notification = bridge.generateDeveloperNotification(n.exp_id);
        console.log(`  ─── ${n.exp_id} ───`);
        console.log(`  ${notification.notification}`);
        console.log('');
      });
    }

    console.log('\n✅ 通知队列查询完成');
    break;
  }

  case 'agents': {
    const agents = bridge.listAutoAgents();
    console.log('═══ 自动 Agent 列表 ═══\n');

    if (agents.length === 0) {
      console.log('  ⚠️ 无已注册 Agent（从 bingshuo-agent-registry.json 读取）');
    } else {
      agents.forEach(a => {
        const id = a.agent_id || a.name;
        console.log(`  ${id} | ${a.name}`);
        console.log(`    职责: ${a.purpose}`);
        console.log(`    触发: ${a.trigger}`);
        console.log(`    状态: ${a.active ? '✅ 激活' : '❌ 未激活'}`);
        console.log('');
      });
    }

    console.log('\n✅ Agent 列表查询完成');
    break;
  }

  default:
    console.error(`❌ 未知命令: ${cmd}`);
    console.error('   可用命令: status, export, inspect, explain, developers, notify, agents');
    process.exit(1);
}
