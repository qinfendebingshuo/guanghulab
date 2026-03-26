// scripts/community/tests/community.test.js
// 社区涌现系统 · 综合测试
// ZY-TEST-COMMUNITY-001
// 版权：国作登字-2026-A-00037559

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message}`);
  }
}

// ── 测试准备：使用临时目录隔离 ─────────────────────────────────────────────
const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'community-test-'));
const COMMUNITY_DIR = path.join(TEMP_DIR, '.github', 'community');
const BRAIN_DIR = path.join(TEMP_DIR, '.github', 'persona-brain');
const CHANNEL_DIR = path.join(TEMP_DIR, '.github', 'brain', 'architecture');
const TIANYEN_DIR = path.join(TEMP_DIR, '.github', 'tianyen');
fs.mkdirSync(COMMUNITY_DIR, { recursive: true });
fs.mkdirSync(BRAIN_DIR, { recursive: true });
fs.mkdirSync(CHANNEL_DIR, { recursive: true });
fs.mkdirSync(TIANYEN_DIR, { recursive: true });

// 写入测试用社区元数据
fs.writeFileSync(path.join(COMMUNITY_DIR, 'community-meta.json'), JSON.stringify({
  community_name: '测试社区',
  birth_date: '2025-05-14T07:49:23Z'
}, null, 2));

// 写入空的广场数据
fs.writeFileSync(path.join(COMMUNITY_DIR, 'plaza.json'), JSON.stringify({
  schema_version: '1.0.0',
  announcements: [],
  comments: [],
  human_wall: []
}, null, 2));

// 写入空的配置分享数据
fs.writeFileSync(path.join(COMMUNITY_DIR, 'shared-configs.json'), JSON.stringify({
  schema_version: '1.0.0',
  configs: []
}, null, 2));

// 写入空的协作数据
fs.writeFileSync(path.join(COMMUNITY_DIR, 'collaboration.json'), JSON.stringify({
  schema_version: '1.0.0',
  requests: []
}, null, 2));

// 写入测试用频道映射
fs.writeFileSync(path.join(CHANNEL_DIR, 'channel-map.json'), JSON.stringify({
  channels: {
    'DEV-001': { name: '测试者A', persona: '测试人格A', status: 'active' },
    'DEV-002': { name: '测试者B', persona: '测试人格B', status: 'inactive_72h' },
    'DEV-003': { name: '测试者C', persona: null, status: 'paused' }
  }
}, null, 2));

console.log('🌊 社区涌现系统 · 综合测试\n');
console.log('  测试目录: ' + TEMP_DIR + '\n');

// ── 备份真实数据文件，测试结束后恢复 ────────────────────────────────────
const REAL_ROOT = path.resolve(__dirname, '../../..');
const REAL_COMMUNITY_DIR = path.join(REAL_ROOT, '.github/community');
const filesToBackup = ['plaza.json', 'shared-configs.json', 'collaboration.json', 'self-upgrades.json'];
const backups = {};
filesToBackup.forEach(function (f) {
  var fp = path.join(REAL_COMMUNITY_DIR, f);
  if (fs.existsSync(fp)) {
    backups[f] = fs.readFileSync(fp, 'utf8');
  }
});

// ══════════════════════════════════════════════════════════════════════════
// 测试 1: Timeline Tracker
// ══════════════════════════════════════════════════════════════════════════
console.log('── 测试 1: Timeline Tracker ──');

const { daysAlive, getMilestone, wakeGreeting, getTimelineStatus, SYSTEM_BIRTH } = require('../timeline-tracker');

assert(SYSTEM_BIRTH === '2025-05-14T07:49:23Z', 'SYSTEM_BIRTH 常量正确');

// daysAlive 基本测试
const testNow = new Date('2025-05-15T07:49:23Z');
assert(daysAlive('2025-05-14T07:49:23Z', testNow) === 1, 'daysAlive: 1天后 = 1');

const testNow2 = new Date('2025-05-14T07:49:23Z');
assert(daysAlive('2025-05-14T07:49:23Z', testNow2) === 0, 'daysAlive: 同一天 = 0');

const testNow3 = new Date('2025-06-13T07:49:23Z');
assert(daysAlive('2025-05-14T07:49:23Z', testNow3) === 30, 'daysAlive: 30天后 = 30');

// getMilestone 测试
const ms1 = getMilestone(0);
assert(ms1.milestone === null, 'getMilestone(0): 尚未达到任何里程碑');

const ms7 = getMilestone(7);
assert(ms7.milestone !== null && ms7.milestone.includes('一周年'), 'getMilestone(7): 一周年里程碑');

const ms100 = getMilestone(100);
assert(ms100.milestone !== null && ms100.milestone.includes('百日'), 'getMilestone(100): 百日里程碑');

const ms365 = getMilestone(365);
assert(ms365.milestone !== null, 'getMilestone(365): 有里程碑');

// wakeGreeting 测试
const greeting = wakeGreeting('铸渊', new Date('2025-08-14T00:00:00Z'));
assert(typeof greeting === 'string', 'wakeGreeting 返回字符串');
assert(greeting.includes('铸渊'), 'wakeGreeting 包含人格体名称');
assert(greeting.includes('数字地球已存在'), 'wakeGreeting 包含存在天数');

// getTimelineStatus 测试
const status = getTimelineStatus(new Date('2026-03-26T00:00:00Z'));
assert(typeof status === 'object', 'getTimelineStatus 返回对象');
assert(typeof status.days_alive === 'number', 'getTimelineStatus 包含 days_alive');
assert(status.days_alive > 300, 'getTimelineStatus: 2026-03-26 距诞生超过300天');
assert(status.birth_date === SYSTEM_BIRTH, 'getTimelineStatus 包含正确的 birth_date');

// ══════════════════════════════════════════════════════════════════════════
// 测试 2: Community Manager (使用文件系统隔离)
// ══════════════════════════════════════════════════════════════════════════
console.log('\n── 测试 2: Community Manager ──');

// 由于 community-manager 硬编码了路径，我们直接测试导入成功
const cm = require('../community-manager');

assert(typeof cm.postAnnouncement === 'function', 'postAnnouncement 是函数');
assert(typeof cm.postComment === 'function', 'postComment 是函数');
assert(typeof cm.replyToComment === 'function', 'replyToComment 是函数');
assert(typeof cm.postHumanMessage === 'function', 'postHumanMessage 是函数');
assert(typeof cm.replyToHuman === 'function', 'replyToHuman 是函数');
assert(typeof cm.shareConfig === 'function', 'shareConfig 是函数');
assert(typeof cm.adoptConfig === 'function', 'adoptConfig 是函数');
assert(typeof cm.requestCollaboration === 'function', 'requestCollaboration 是函数');
assert(typeof cm.acceptCollaboration === 'function', 'acceptCollaboration 是函数');
assert(typeof cm.tianyanReview === 'function', 'tianyanReview 是函数');
assert(typeof cm.getSummary === 'function', 'getSummary 是函数');

// 测试公告发布
const ann1 = cm.postAnnouncement({
  id: 'ANN-TEST-001',
  author: '铸渊',
  title: '社区系统上线',
  content: '光湖涌现社区正式上线'
});
assert(ann1 === true, '成功发布公告');

// 去重测试
const ann1dup = cm.postAnnouncement({
  id: 'ANN-TEST-001',
  author: '铸渊',
  title: '重复公告',
  content: '不应该成功'
});
assert(ann1dup === false, '重复公告被拒绝');

// 参数校验
assert(cm.postAnnouncement(null) === false, '空参数被拒绝');
assert(cm.postAnnouncement({ id: 'x' }) === false, '缺少必要字段被拒绝');

// 测试评论
const c1 = cm.postComment({
  id: 'CMT-TEST-001',
  from: '知秋',
  to: '霜砚',
  content: '你好霜砚，我是知秋！'
});
assert(c1 === true, '成功发布评论');

const c1dup = cm.postComment({
  id: 'CMT-TEST-001',
  from: '知秋',
  to: '霜砚',
  content: '重复'
});
assert(c1dup === false, '重复评论被拒绝');

assert(cm.postComment(null) === false, '空评论被拒绝');
assert(cm.postComment({ id: 'x' }) === false, '缺少 from 字段被拒绝');

// 测试回复评论
const reply1 = cm.replyToComment('CMT-TEST-001', {
  from: '霜砚',
  content: '你好知秋！很高兴认识你'
});
assert(reply1 === true, '成功回复评论');

assert(cm.replyToComment('NONEXIST', { from: 'a', content: 'b' }) === false, '回复不存在的评论失败');
assert(cm.replyToComment(null, null) === false, '空参数回复失败');

// 测试人类留言
const h1 = cm.postHumanMessage({
  id: 'HUM-TEST-001',
  author: '冰朔',
  content: '你们好，人类留言测试'
});
assert(h1 === true, '成功发布人类留言');

assert(cm.postHumanMessage({ id: 'HUM-TEST-001', author: 'x', content: 'y' }) === false, '重复人类留言被拒绝');

// 测试人格体回复人类
const hr1 = cm.replyToHuman('HUM-TEST-001', {
  persona: '铸渊',
  content: '欢迎冰朔！社区已就绪。'
});
assert(hr1 === true, '人格体成功回复人类');
assert(cm.replyToHuman('NONEXIST', { persona: 'a', content: 'b' }) === false, '回复不存在的人类留言失败');

// 测试配置分享
const cfg1 = cm.shareConfig({
  id: 'CFG-TEST-001',
  shared_by: '铸渊',
  name: '天眼巡检配置',
  description: '每日天眼巡检的默认配置',
  config_data: { scan_interval: '6h', auto_repair: true }
});
assert(cfg1 === true, '成功分享配置');
assert(cm.shareConfig({ id: 'CFG-TEST-001', shared_by: 'x', name: 'y' }) === false, '重复配置被拒绝');

// 测试采纳配置
const adopt1 = cm.adoptConfig('CFG-TEST-001', 'PER-ZQ001');
assert(adopt1 === true, '成功采纳配置');
assert(cm.adoptConfig('CFG-TEST-001', 'PER-ZQ001') === false, '重复采纳被拒绝');
assert(cm.adoptConfig('NONEXIST', 'PER-ZQ001') === false, '采纳不存在的配置失败');

// 测试协作邀请
const collab1 = cm.requestCollaboration({
  id: 'COLLAB-TEST-001',
  from: '知秋',
  task: '共同优化天眼巡检',
  description: '希望和霜砚一起优化天眼巡检流程',
  desired_partners: ['霜砚']
});
assert(collab1 === true, '成功发起协作邀请');
assert(cm.requestCollaboration({ id: 'COLLAB-TEST-001', from: 'x', task: 'y' }) === false, '重复邀请被拒绝');

// 测试接受协作
const accept1 = cm.acceptCollaboration('COLLAB-TEST-001', 'PER-SY001');
assert(accept1 === true, '成功接受协作');
assert(cm.acceptCollaboration('COLLAB-TEST-001', 'PER-SY001') === false, '重复接受被拒绝');
assert(cm.acceptCollaboration('NONEXIST', 'PER-SY001') === false, '接受不存在的邀请失败');

// 测试天眼审核
const review1 = cm.tianyanReview('COLLAB-TEST-001', true);
assert(review1 === true, '天眼审核通过');

const collab2 = cm.loadCollaboration();
const reviewed = collab2.requests.find(function (r) { return r.id === 'COLLAB-TEST-001'; });
assert(reviewed.tianyan_approved === true, '审核状态已更新');
assert(reviewed.status === 'approved', '协作状态更新为 approved');

assert(cm.tianyanReview('NONEXIST', true) === false, '审核不存在的请求失败');
assert(cm.tianyanReview(null, true) === false, '空ID审核失败');

// 测试拒绝
const collab3 = cm.requestCollaboration({
  id: 'COLLAB-TEST-002',
  from: '舒舒',
  task: '测试拒绝',
  description: '测试天眼拒绝'
});
assert(collab3 === true, '发起第二个协作邀请');
assert(cm.tianyanReview('COLLAB-TEST-002', false) === true, '天眼拒绝协作');
const rejectedData = cm.loadCollaboration();
const rejected = rejectedData.requests.find(function (r) { return r.id === 'COLLAB-TEST-002'; });
assert(rejected.status === 'rejected', '被拒绝的协作状态为 rejected');

// 测试摘要
const summary = cm.getSummary();
assert(typeof summary === 'object', 'getSummary 返回对象');
assert(typeof summary.days_alive === 'number', '摘要包含 days_alive');
assert(summary.announcements_count >= 1, '摘要包含公告计数');
assert(summary.comments_count >= 1, '摘要包含评论计数');
assert(summary.human_messages_count >= 1, '摘要包含人类留言计数');
assert(summary.shared_configs_count >= 1, '摘要包含配置计数');

// ══════════════════════════════════════════════════════════════════════════
// 测试 3: Self-Upgrade Registry
// ══════════════════════════════════════════════════════════════════════════
console.log('\n── 测试 3: Self-Upgrade Registry ──');

const sur = require('../self-upgrade-registry');

assert(typeof sur.proposeUpgrade === 'function', 'proposeUpgrade 是函数');
assert(typeof sur.reviewUpgrade === 'function', 'reviewUpgrade 是函数');
assert(typeof sur.completeUpgrade === 'function', 'completeUpgrade 是函数');
assert(typeof sur.getPendingUpgrades === 'function', 'getPendingUpgrades 是函数');

// 提交升级提案
const up1 = sur.proposeUpgrade({
  id: 'UPG-TEST-001',
  persona_id: 'PER-ZY001',
  title: '巡检频率优化',
  description: '将巡检频率从6h调整为4h',
  upgrade_type: 'optimization'
});
assert(up1 === true, '成功提交升级提案');
assert(sur.proposeUpgrade({ id: 'UPG-TEST-001', persona_id: 'x', title: 'y' }) === false, '重复提案被拒绝');
assert(sur.proposeUpgrade(null) === false, '空提案被拒绝');

// 获取待审核
const pending = sur.getPendingUpgrades();
assert(pending.length >= 1, '有待审核的提案');
assert(pending[0].status === 'proposed', '提案状态为 proposed');

// 天眼审核
assert(sur.reviewUpgrade('UPG-TEST-001', true) === true, '审核通过升级提案');
assert(sur.reviewUpgrade('NONEXIST', true) === false, '审核不存在的提案失败');

const afterReview = sur.loadUpgrades();
const reviewedUp = afterReview.proposals.find(function (p) { return p.id === 'UPG-TEST-001'; });
assert(reviewedUp.tianyan_approved === true, '升级提案审核状态更新');
assert(reviewedUp.status === 'approved', '升级提案状态为 approved');

// 完成升级
assert(sur.completeUpgrade('UPG-TEST-001') === true, '标记升级完成');
assert(sur.completeUpgrade('NONEXIST') === false, '完成不存在的提案失败');

const completed = sur.loadUpgrades();
const comp = completed.proposals.find(function (p) { return p.id === 'UPG-TEST-001'; });
assert(comp.status === 'completed', '升级状态为 completed');

// ══════════════════════════════════════════════════════════════════════════
// 测试 4: Dormancy Watcher
// ══════════════════════════════════════════════════════════════════════════
console.log('\n── 测试 4: Dormancy Watcher ──');

const dw = require('../dormancy-watcher');

assert(typeof dw.collectDormancyStatus === 'function', 'collectDormancyStatus 是函数');
assert(typeof dw.getWakeupCandidates === 'function', 'getWakeupCandidates 是函数');
assert(typeof dw.generateWakeupSuggestion === 'function', 'generateWakeupSuggestion 是函数');
assert(typeof dw.DORMANCY_THRESHOLDS === 'object', 'DORMANCY_THRESHOLDS 存在');
assert(dw.DORMANCY_THRESHOLDS.warning === 48, '警告阈值 = 48h');
assert(dw.DORMANCY_THRESHOLDS.critical === 72, '严重阈值 = 72h');
assert(dw.DORMANCY_THRESHOLDS.deep_sleep === 168, '深度休眠阈值 = 168h');

// 收集休眠状态（使用仓库真实数据）
const allStatus = dw.collectDormancyStatus();
assert(Array.isArray(allStatus), 'collectDormancyStatus 返回数组');
assert(allStatus.length > 0, '有成员数据');

// 检查数据结构
if (allStatus.length > 0) {
  const first = allStatus[0];
  assert(typeof first.id === 'string', '成员有 id');
  assert(typeof first.name === 'string', '成员有 name');
  assert(typeof first.dormancy_level === 'string', '成员有 dormancy_level');
  assert(typeof first.should_wake === 'boolean', '成员有 should_wake 布尔值');
}

// 唤醒建议
const suggestion = dw.generateWakeupSuggestion();
assert(typeof suggestion === 'object', 'generateWakeupSuggestion 返回对象');
assert(Array.isArray(suggestion.candidates), '建议包含 candidates 数组');
assert(typeof suggestion.suggestion === 'string', '建议包含 suggestion 文字');

// ══════════════════════════════════════════════════════════════════════════
// 测试 5: README Community Dashboard
// ══════════════════════════════════════════════════════════════════════════
console.log('\n── 测试 5: README Community Dashboard ──');

const rc = require('../readme-community');

assert(typeof rc.generateCommunityDashboard === 'function', 'generateCommunityDashboard 是函数');

const dashboard = rc.generateCommunityDashboard(new Date('2026-03-26T12:00:00Z'));
assert(typeof dashboard === 'string', 'dashboard 是字符串');
assert(dashboard.includes('光湖涌现社区'), 'dashboard 包含社区名称');
assert(dashboard.includes('数字地球时间线'), 'dashboard 包含时间线');
assert(dashboard.includes('社区统计'), 'dashboard 包含统计');
assert(dashboard.includes('人类留言墙'), 'dashboard 包含人类留言墙');
assert(dashboard.includes('涌现'), 'dashboard 包含涌现理念');
assert(dashboard.includes('天眼'), 'dashboard 包含天眼');
assert(dashboard.length > 200, 'dashboard 内容充实 (>' + dashboard.length + ' 字符)');

// ══════════════════════════════════════════════════════════════════════════
// 测试 6: 数据文件完整性
// ══════════════════════════════════════════════════════════════════════════
console.log('\n── 测试 6: 数据文件完整性 ──');

const ROOT_DIR = path.resolve(__dirname, '../../..');

// 检查社区数据文件存在
const communityFiles = [
  '.github/community/community-meta.json',
  '.github/community/plaza.json',
  '.github/community/shared-configs.json',
  '.github/community/collaboration.json'
];

communityFiles.forEach(function (f) {
  const filePath = path.join(ROOT_DIR, f);
  assert(fs.existsSync(filePath), '文件存在: ' + f);
});

// 检查社区元数据格式
const metaRaw = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, '.github/community/community-meta.json'), 'utf8'));
assert(typeof metaRaw.community_name === 'string', '元数据包含 community_name');
assert(typeof metaRaw.birth_date === 'string', '元数据包含 birth_date');
assert(metaRaw.birth_date.startsWith('2025-05-14'), '诞生日期正确');
assert(typeof metaRaw.philosophy === 'object', '元数据包含 philosophy');
assert(typeof metaRaw.governance === 'object', '元数据包含 governance');
assert(typeof metaRaw.features === 'object', '元数据包含 features');

// 检查本体论补丁
const patchPath = path.join(ROOT_DIR, '.github/persona-brain/ontology-patches/ONT-PATCH-008.json');
assert(fs.existsSync(patchPath), 'ONT-PATCH-008.json 存在');

const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
assert(patch.patch_id === 'ONT-PATCH-008', '补丁 ID 正确');
assert(patch.extends === 'ONT-PATCH-007 天眼涌现定义', '正确扩展 ONT-PATCH-007');
assert(typeof patch.core_definition === 'object', '包含核心定义');
assert(typeof patch.architecture === 'object', '包含架构');
assert(typeof patch.governance === 'object', '包含治理');

// ══════════════════════════════════════════════════════════════════════════
// 测试 7: 脚本文件完整性
// ══════════════════════════════════════════════════════════════════════════
console.log('\n── 测试 7: 脚本文件完整性 ──');

const scriptFiles = [
  'scripts/community/community-manager.js',
  'scripts/community/timeline-tracker.js',
  'scripts/community/dormancy-watcher.js',
  'scripts/community/self-upgrade-registry.js',
  'scripts/community/readme-community.js'
];

scriptFiles.forEach(function (f) {
  const filePath = path.join(ROOT_DIR, f);
  assert(fs.existsSync(filePath), '脚本存在: ' + f);
});

// ══════════════════════════════════════════════════════════════════════════
// 清理 & 恢复 & 结果
// ══════════════════════════════════════════════════════════════════════════

// 恢复真实数据文件
Object.keys(backups).forEach(function (f) {
  var fp = path.join(REAL_COMMUNITY_DIR, f);
  fs.writeFileSync(fp, backups[f], 'utf8');
});
console.log('\n── 恢复真实数据文件 ──');
console.log('  已恢复 ' + Object.keys(backups).length + ' 个文件');

console.log('\n── 清理测试目录 ──');
fs.rmSync(TEMP_DIR, { recursive: true, force: true });
console.log('  已清理: ' + TEMP_DIR);

console.log('\n══════════════════════════════════════════');
console.log(`🏁 测试完成: ${passed} 通过 / ${failed} 失败 / ${passed + failed} 总计`);
console.log('══════════════════════════════════════════');

if (failed > 0) {
  process.exit(1);
}
