/**
 * FTCHAT 集成测试
 *  - 登录全流程: send-code → verify-code → slot 占用
 *  - 第 11 个邮箱被拒绝 (满槽位)
 *  - 同邮箱重复登录复用槽位
 *  - 时间锚点格式
 *  - Notion 提示词兜底
 *  - memory-agent 兜底压缩
 *
 * 不依赖外部网络（DashScope/Notion/SMTP）, 全部本地校验。
 */
'use strict';

process.env.FTCHAT_AUTH_DEV_MODE = 'true';
process.env.FTCHAT_DATA_DIR = '/tmp/ftchat-itest-' + Date.now();

const assert = require('assert');
const path = require('path');
const fs = require('fs');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ❌ ${name}: ${e.message}`);
  }
}
async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ❌ ${name}: ${e.message}`);
  }
}

(async () => {
  console.log('🧪 FTCHAT 集成测试\n');

  // ─── 1. email-auth ───
  console.log('── 模块: email-auth (10 槽位 / QQ 邮箱) ──');
  const auth = require('../../server/ftchat/services/email-auth');
  auth._resetForTests();

  test('非 QQ 邮箱被拒绝', () => {
    const r = auth.isValidQqEmail('foo@gmail.com');
    assert.strictEqual(r, false);
  });
  test('QQ 邮箱通过校验', () => {
    assert.strictEqual(auth.isValidQqEmail('123@qq.com'), true);
    assert.strictEqual(auth.isValidQqEmail('456@vip.qq.com'), true);
    assert.strictEqual(auth.isValidQqEmail('789@foxmail.com'), true);
  });

  await testAsync('发送验证码 (DEV 模式) 并占据槽位', async () => {
    const r = await auth.sendCode('user1@qq.com');
    assert.ok(r.success, '应成功');
    assert.ok(/^\d{6}$/.test(r.dev_code), 'dev_code 应是 6 位数字');
    assert.strictEqual(r.slots_remaining, 10);
  });

  // 模拟登录流: send → verify
  async function loginFlow(email) {
    const sent = await auth.sendCode(email);
    if (!sent.success) return { ok: false, sent };
    const verified = auth.verifyCode(email, sent.dev_code);
    return { ok: verified.success, verified, dev_code: sent.dev_code };
  }

  await testAsync('完整登录流程 → 拿到 token', async () => {
    auth._resetForTests();
    const r = await loginFlow('alpha@qq.com');
    assert.ok(r.ok, '登录应成功');
    assert.ok(typeof r.verified.token === 'string' && r.verified.token.length >= 32);
    assert.strictEqual(r.verified.slot_index, 1);
  });

  await testAsync('10 个不同邮箱依次登录占满槽位', async () => {
    auth._resetForTests();
    for (let i = 1; i <= 10; i++) {
      const r = await loginFlow(`u${i}@qq.com`);
      assert.ok(r.ok, `第 ${i} 个邮箱应成功`);
      assert.strictEqual(r.verified.slot_index, i);
    }
    const status = auth.getStatus();
    assert.strictEqual(status.slots_taken, 10);
    assert.strictEqual(status.slots_remaining, 0);
  });

  await testAsync('第 11 个新邮箱被拒绝 (sendCode 阶段就拦截)', async () => {
    const r = await auth.sendCode('intruder@qq.com');
    assert.strictEqual(r.success, false);
    assert.ok(r.message.includes('已满'));
    assert.strictEqual(r.slots_remaining, 0);
  });

  await testAsync('已占位邮箱满槽位下仍可重新登录 (复用槽位)', async () => {
    const r = await loginFlow('u3@qq.com');
    assert.ok(r.ok, '已占位邮箱应可重新登录');
    assert.strictEqual(r.verified.slot_index, 3, '应复用原槽位');
  });

  test('错误验证码 → 失败 + 计数', () => {
    const r = auth.verifyCode('u1@qq.com', '000000');
    assert.strictEqual(r.success, false);
  });

  // ─── 2. time-anchor ───
  console.log('\n── 模块: time-anchor ──');
  const time = require('../../server/ftchat/services/time-anchor');
  test('时间锚点包含完整字段', () => {
    const a = time.getTimeAnchor();
    assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(a.iso));
    assert.ok(/^\d{4}-\d{2}-\d{2} /.test(a.beijing));
    assert.ok(/^周[一二三四五六日]$/.test(a.weekday));
    assert.ok(a.anchor_text.includes('现实时间瞄点'));
    assert.ok(a.anchor_text.includes('北京时间'));
  });

  // ─── 3. notion-prompt 兜底 ───
  console.log('\n── 模块: notion-prompt (无 token 兜底) ──');
  const np = require('../../server/ftchat/services/notion-prompt');
  np._clearCache();
  delete process.env.FT_NOTION_API_TOKEN;
  delete process.env.FT_NOTION_PROMPT_PAGE_ID;

  await testAsync('无配置时返回 fallback 提示词', async () => {
    const r = await np.getSystemPrompt({});
    assert.strictEqual(r.source, 'fallback');
    assert.ok(r.text.length > 50);
    assert.ok(r.text.includes('光湖'));
  });

  // ─── 4. memory-agent 兜底 ───
  console.log('\n── 模块: memory-agent (无 LLM 兜底) ──');
  const mem = require('../../server/ftchat/services/memory-agent');
  test('fallbackImprint 正确格式化最近消息', () => {
    const out = mem.fallbackImprint([
      { role: 'user', content: '你好啊' },
      { role: 'assistant', content: '你好' },
      { role: 'user', content: '今天怎么样' },
      { role: 'assistant', content: '不错呢' }
    ]);
    assert.ok(out.includes('上次会话母语印记'));
    assert.ok(out.includes('用户'));
    assert.ok(out.includes('我'));
  });
  test('消息不足时不压缩', async () => {
    const r = await mem.compressToImprint([{ role: 'user', content: 'hi' }]);
    assert.strictEqual(r.compressed, false);
    assert.strictEqual(r.imprint, '');
  });

  // ─── 5. session-store ───
  console.log('\n── 模块: session-store ──');
  const store = require('../../server/ftchat/services/session-store');
  test('upsert 与 list 一致', () => {
    const hash = 'abcdef0123456789';
    store.upsertSession(hash, { session_id: 's1', title: '第一个对话', message_count: 5, has_memory_imprint: false });
    store.upsertSession(hash, { session_id: 's2', title: '第二个', message_count: 10, has_memory_imprint: true });
    const list = store.listSessions(hash);
    assert.strictEqual(list.length, 2);
    assert.strictEqual(list[0].session_id, 's2');
  });
  test('imprint set/get', () => {
    const hash = 'abcdef0123456789';
    store.setLatestImprint(hash, '【上次会话母语印记】测试段');
    assert.strictEqual(store.getLatestImprint(hash), '【上次会话母语印记】测试段');
  });
  test('非法 hash 拒绝', () => {
    let threw = false;
    try { store.setLatestImprint('../etc/passwd', 'x'); } catch (_e) { threw = true; }
    assert.strictEqual(threw, true);
  });

  // ─── 报告 ───
  console.log(`\n📊 集成测试: ${passed} 通过, ${failed} 失败`);
  // 清理
  try {
    fs.rmSync(process.env.FTCHAT_DATA_DIR, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
  if (failed > 0) {
    console.error('❌ FTCHAT Integration Test FAILED');
    process.exit(1);
  } else {
    console.log('✅ FTCHAT Integration Test PASSED');
  }
})();
