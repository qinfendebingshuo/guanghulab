/*
 * cc-002 回归: _strip_system_messages 必须在任何路径下都剥掉 system.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { _strip_system_messages } = require("../lib/inference-client");

test("strip 单个 system 消息", () => {
  const out = _strip_system_messages([
    { role: "system", content: "你是 X" },
    { role: "user", content: "你好" }
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].role, "user");
});

test("剥离多个 system 消息 (多语言模板诱惑)", () => {
  const out = _strip_system_messages([
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Q1" },
    { role: "system", content: "Be concise." },
    { role: "assistant", content: "A1" },
    { role: "user", content: "Q2" }
  ]);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((m) => m.role), ["user", "assistant", "user"]);
});

test("非数组输入返回空数组", () => {
  assert.deepEqual(_strip_system_messages(null), []);
  assert.deepEqual(_strip_system_messages(undefined), []);
  assert.deepEqual(_strip_system_messages("system"), []);
});

test("跳过 role 缺失的脏数据", () => {
  const out = _strip_system_messages([
    { content: "no role" },
    null,
    { role: "user", content: "hi" }
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].role, "user");
});

test("user/assistant 完整保留", () => {
  const arr = [
    { role: "user", content: "1" },
    { role: "assistant", content: "2" },
    { role: "user", content: "3" }
  ];
  const out = _strip_system_messages(arr);
  assert.deepEqual(out, arr);
});
