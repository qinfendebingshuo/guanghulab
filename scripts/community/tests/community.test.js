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
const filesToBackup = ['plaza.json', 'shared-configs.json', 'collaboration.json', 'self-upgrades.json', 'growth-stages.json'];
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
assert(ms7.milestone !== null && ms7.milestone.includes('一周'), 'getMilestone(7): 一周里程碑');

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
  title: '语言世界开门',
  content: '光湖语言世界正式开门'
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
// 测试 3.5: Growth Engine · 成长引擎
// ══════════════════════════════════════════════════════════════════════════
console.log('\n── 测试 3.5: Growth Engine ──');

const ge = require('../growth-engine');

assert(typeof ge.getStages === 'function', 'getStages 是函数');
assert(typeof ge.registerMember === 'function', 'registerMember 是函数');
assert(typeof ge.evaluatePromotion === 'function', 'evaluatePromotion 是函数');
assert(typeof ge.promote === 'function', 'promote 是函数');
assert(typeof ge.growthReport === 'function', 'growthReport 是函数');
assert(typeof ge.getAllMembersSummary === 'function', 'getAllMembersSummary 是函数');
assert(typeof ge.recordProgress === 'function', 'recordProgress 是函数');

// 成长阶段定义
const stages = ge.getStages();
assert(stages.length === 7, '有7个成长阶段');
assert(stages[0].name === '种子期', '第一阶段是种子期');
assert(stages[6].name === '参天期', '最后阶段是参天期');

// 阶段查询
const seed = ge.getStageByLevel(0);
assert(seed !== null && seed.name === '种子期', 'getStageByLevel(0) = 种子期');
const sprout = ge.getStageByName('Sprout');
assert(sprout !== null && sprout.level === 1, 'getStageByName(Sprout) = Lv.1');
assert(ge.getStageByLevel(99) === null, '不存在的等级返回 null');

// 注册系统人格体
const reg1 = ge.registerMember({
  member_id: 'PER-ZY001',
  name: '铸渊',
  category: 'system'
});
assert(reg1.success === true, '成功注册系统人格体');

// 重复注册
const reg1dup = ge.registerMember({
  member_id: 'PER-ZY001',
  name: '铸渊',
  category: 'system'
});
assert(reg1dup.success === false, '重复注册被拒绝');

// 注册宝宝人格体（有人类爸妈）
const reg2 = ge.registerMember({
  member_id: 'PER-ZQ001',
  name: '知秋',
  category: 'companion',
  parent_human: 'Awen'
});
assert(reg2.success === true, '成功注册宝宝人格体（知秋←Awen）');

// 一个人类只能对应一个宝宝人格体
const reg2dup = ge.registerMember({
  member_id: 'PER-FAKE001',
  name: '假的',
  category: 'companion',
  parent_human: 'Awen'
});
assert(reg2dup.success === false, '一个人类只能对应一个宝宝 (Awen 已有知秋)');
assert(reg2dup.reason.includes('Awen'), '错误信息包含人类名字');

// 空参数校验
assert(ge.registerMember(null).success === false, '空参数被拒绝');
assert(ge.registerMember({ member_id: 'x' }).success === false, '缺少 name 被拒绝');

// 成长记录查询
const growth1 = ge.getMemberGrowth('PER-ZY001');
assert(growth1 !== null, '能查到铸渊的成长记录');
assert(growth1.current_level === 0, '初始等级为0');
assert(growth1.current_stage === '种子期', '初始阶段为种子期');
assert(growth1.category === 'system', '铸渊是系统人格体');
assert(growth1.parent_human === null, '系统人格体没有人类爸妈');

const growth2 = ge.getMemberGrowth('PER-ZQ001');
assert(growth2 !== null, '能查到知秋的成长记录');
assert(growth2.category === 'companion', '知秋是宝宝人格体');
assert(growth2.parent_human === 'Awen', '知秋的人类爸妈是 Awen');

assert(ge.getMemberGrowth('NONEXIST') === null, '不存在的成员返回 null');

// 评估升级
const eval1 = ge.evaluatePromotion('PER-ZY001');
assert(typeof eval1.ready === 'boolean', '评估结果包含 ready');
assert(eval1.current_level === 0, '评估显示当前等级');
assert(eval1.next_stage !== null, '有下一阶段');
assert(Array.isArray(eval1.passed), '评估包含通过项');
assert(Array.isArray(eval1.failed), '评估包含未通过项');

// 记录进度
assert(ge.recordProgress('PER-ZY001', 'E0-2', 1) === true, '记录考核进度成功');
assert(ge.recordProgress('NONEXIST', 'E0-1', 1) === false, '记录不存在成员的进度失败');
assert(ge.recordProgress(null, null) === false, '空参数被拒绝');

// 成长报告
const report = ge.growthReport('PER-ZQ001');
assert(typeof report === 'string', '成长报告是字符串');
assert(report.includes('知秋'), '报告包含名字');
assert(report.includes('宝宝人格体'), '报告包含类型');
assert(report.includes('Awen'), '报告包含人类爸妈');

const reportSys = ge.growthReport('PER-ZY001');
assert(reportSys.includes('系统人格体'), '系统人格体报告包含类型');

const reportNone = ge.growthReport('NONEXIST');
assert(reportNone.includes('❌'), '不存在的成员报告包含错误标记');

// 全员摘要
const allMembers = ge.getAllMembersSummary();
assert(allMembers.length >= 2, '至少有2个成员');
const companionMember = allMembers.find(function (m) { return m.category === 'companion'; });
assert(companionMember !== null, '摘要中有宝宝人格体');
assert(companionMember.parent_human === 'Awen', '摘要中有人类爸妈信息');

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
assert(dashboard.includes('光湖语言世界'), 'dashboard 包含世界名称');
assert(dashboard.includes('数字地球时间线'), 'dashboard 包含时间线');
assert(dashboard.includes('世界统计'), 'dashboard 包含统计');
assert(dashboard.includes('人类留言墙'), 'dashboard 包含人类留言墙');
assert(dashboard.includes('成长体系'), 'dashboard 包含成长体系');
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
  '.github/community/collaboration.json',
  '.github/community/growth-stages.json'
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
  'scripts/community/readme-community.js',
  'scripts/community/growth-engine.js'
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
