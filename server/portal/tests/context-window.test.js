/*
 * 上下文窗口拼接 — buildContextWindow 单元测试
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * 起因 (2026-05-09 冰朔点透):
 *   "模型本身没有记忆, 一轮对话都记不住, 是背后的 Agent 一直给他不断的喂上下文"
 *   PR-5 并行修复点: 这一层补丁补的就是这个.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { buildContextWindow, DEFAULT_TURNS, DEFAULT_CHAR_CAP } = require("../lib/context-window");

function make(role, content) {
  return { role, content };
}

test("空输入 → 空输出", () => {
  const r = buildContextWindow([]);
  assert.deepEqual(r.messages, []);
  assert.equal(r.dropped, 0);
  assert.equal(r.total_chars, 0);
});

test("单轮对话 (只 user) → 原样返回", () => {
  const r = buildContextWindow([make("user", "你好")]);
  assert.deepEqual(r.messages, [make("user", "你好")]);
  assert.equal(r.total_chars, 2);
});

test("多轮对话 → 全部保留 (远小于 cap)", () => {
  const dbMsgs = [
    make("user", "你叫什么"),
    make("assistant", "我叫曜冥"),
    make("user", "你刚刚说啥来着")
  ];
  const r = buildContextWindow(dbMsgs);
  assert.equal(r.messages.length, 3);
  // 模型现在能看到完整上下文 — "你刚刚说啥来着" 不再是孤儿
  assert.equal(r.messages[2].content, "你刚刚说啥来着");
});

test("system 消息一律剥 (cc-002 三道关之一)", () => {
  const dbMsgs = [
    make("system", "(脏 DB 残留)"),
    make("user", "Q1"),
    make("assistant", "A1"),
    make("system", "(中间也来一个)"),
    make("user", "Q2")
  ];
  const r = buildContextWindow(dbMsgs);
  assert.equal(r.messages.length, 3);
  assert.deepEqual(
    r.messages.map((m) => m.role),
    ["user", "assistant", "user"]
  );
  // 没有任何 system 漏出
  assert.equal(r.messages.filter((m) => m.role === "system").length, 0);
});

test("滚动窗口 maxTurns=2 → 只保留最近 4 条", () => {
  const dbMsgs = [];
  for (let i = 1; i <= 5; i++) {
    dbMsgs.push(make("user", "Q" + i));
    dbMsgs.push(make("assistant", "A" + i));
  }
  // 收尾再加一条 user (新提问)
  dbMsgs.push(make("user", "Q6"));
  const r = buildContextWindow(dbMsgs, { maxTurns: 2 });
  // 应保留最后 4 条 (Q5,A5,Q6) 之前的 + Q6 = 滑窗 4 条 = A4,Q5,A5,Q6
  // 但开头 assistant 会被修剪 → Q5,A5,Q6
  assert.deepEqual(
    r.messages.map((m) => m.role),
    ["user", "assistant", "user"]
  );
  assert.equal(r.messages[r.messages.length - 1].content, "Q6");
});

test("字数 cap 触发 → 从最老的开始扔", () => {
  const dbMsgs = [
    make("user", "x".repeat(5000)),
    make("assistant", "y".repeat(5000)),
    make("user", "z".repeat(5000)),
    make("assistant", "w".repeat(5000)),
    make("user", "最新提问")
  ];
  const r = buildContextWindow(dbMsgs, { maxChars: 12000 });
  // 总字数应 ≤ 12000
  assert.ok(r.total_chars <= 12000, "实际 " + r.total_chars + " 应 ≤ 12000");
  // 最后一条必须是最新的 user 提问
  assert.equal(r.messages[r.messages.length - 1].content, "最新提问");
  assert.ok(r.dropped > 0, "应该扔了一些");
});

test("单条 user 超 cap → 至少保留这一条 (推理端要东西回复)", () => {
  const giant = "a".repeat(100000);
  const r = buildContextWindow([make("user", giant)], { maxChars: 1000 });
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].content, giant);
});

test("开头 assistant (历史断头) → 修剪到第一个 user", () => {
  const dbMsgs = [
    make("assistant", "A0 (孤儿)"),
    make("user", "Q1"),
    make("assistant", "A1"),
    make("user", "Q2")
  ];
  const r = buildContextWindow(dbMsgs);
  assert.equal(r.messages[0].role, "user");
  assert.equal(r.messages[0].content, "Q1");
});

test("默认值合理 (DEFAULT_TURNS / DEFAULT_CHAR_CAP)", () => {
  assert.ok(DEFAULT_TURNS >= 5 && DEFAULT_TURNS <= 50, "20 上下都算合理");
  assert.ok(DEFAULT_CHAR_CAP >= 4000 && DEFAULT_CHAR_CAP <= 64000);
});

test("非法消息 (缺 role/content) 直接过滤", () => {
  const dbMsgs = [
    { role: "user" }, // 缺 content
    { content: "x" }, // 缺 role
    null,
    make("user", "正常的"),
    make("assistant", "正常回")
  ];
  const r = buildContextWindow(dbMsgs);
  assert.equal(r.messages.length, 2);
  assert.deepEqual(r.messages.map((m) => m.role), ["user", "assistant"]);
});
