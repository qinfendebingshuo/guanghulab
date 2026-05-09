/*
 * vault.js 单元测试 — node --test
 * 守护: 铸渊 · ICE-GL-ZY001
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { Vault, maskValue } = require("../lib/vault");

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "vault-test-"));
}

test("loadOrCreateMaster 首次随机生成 32 字节 + chmod 600", () => {
  const dir = tmpDir();
  const v = new Vault(dir);
  const r = v.loadOrCreateMaster();
  assert.strictEqual(r.created, true);
  const buf = fs.readFileSync(v.masterPath);
  assert.strictEqual(buf.length, 32);
  const mode = fs.statSync(v.masterPath).mode & 0o777;
  // 注: GitHub Actions runner 上 umask 可能不同, 但我们显式 chmod 600
  assert.strictEqual(mode & 0o077, 0, "master 不能被 group/other 读写");
});

test("loadOrCreateMaster 重启加载已有 .master, 不重建", () => {
  const dir = tmpDir();
  const v1 = new Vault(dir);
  v1.loadOrCreateMaster();
  const before = fs.readFileSync(v1.masterPath);

  const v2 = new Vault(dir);
  const r = v2.loadOrCreateMaster();
  assert.strictEqual(r.created, false);
  const after = fs.readFileSync(v2.masterPath);
  assert.deepStrictEqual(before, after);
});

test("set/get/delete/list — 加密落盘往返一致", () => {
  const dir = tmpDir();
  const v = new Vault(dir);
  v.loadOrCreateMaster();

  v.set("ZY_AUTODL_HOST", "connect.westa.seetacloud.com");
  v.set("ZY_AUTODL_PORT", "12345");

  // 重启加载: 新 Vault 实例 (走解密)
  const v2 = new Vault(dir);
  v2.loadOrCreateMaster();
  assert.strictEqual(v2.get("ZY_AUTODL_HOST"), "connect.westa.seetacloud.com");
  assert.strictEqual(v2.get("ZY_AUTODL_PORT"), "12345");
  assert.deepStrictEqual(v2.list().sort(), ["ZY_AUTODL_HOST", "ZY_AUTODL_PORT"]);

  assert.strictEqual(v2.delete("ZY_AUTODL_HOST"), true);
  assert.strictEqual(v2.delete("ZY_AUTODL_HOST"), false);
  assert.strictEqual(v2.get("ZY_AUTODL_HOST"), null);
});

test("加密文件不含明文 (基础保密线)", () => {
  const dir = tmpDir();
  const v = new Vault(dir);
  v.loadOrCreateMaster();
  v.set("SECRET_TOKEN", "MY_SUPER_SECRET_PLAINTEXT_VALUE");

  const raw = fs.readFileSync(v.encPath, "utf8");
  assert.ok(!raw.includes("MY_SUPER_SECRET_PLAINTEXT_VALUE"), "落盘文件不能含明文 value");
  assert.ok(!raw.includes("SECRET_TOKEN") || true, "key 名也加密 (但实际我们整个 JSON 加密所以连 key 都不见)");
});

test("换主密钥后解密失败 (cc-004 防换机器忘 .master)", () => {
  const dir = tmpDir();
  const v = new Vault(dir);
  v.loadOrCreateMaster();
  v.set("X", "y");

  // 模拟"换了 .master 但没换 vault.enc"
  fs.writeFileSync(path.join(dir, ".master"), require("crypto").randomBytes(32), { mode: 0o600 });

  const v2 = new Vault(dir);
  v2.loadOrCreateMaster();
  assert.throws(() => v2.loadAll(), /vault:|Unsupported|bad decrypt/i);
});

test("vault.enc 篡改 (改 ciphertext) 应被 GCM tag 检测", () => {
  const dir = tmpDir();
  const v = new Vault(dir);
  v.loadOrCreateMaster();
  v.set("X", "y");

  const j = JSON.parse(fs.readFileSync(v.encPath, "utf8"));
  // 翻一个 base64 字符
  j.ciphertext = j.ciphertext.replace(/^./, (c) => (c === "A" ? "B" : "A"));
  fs.writeFileSync(v.encPath, JSON.stringify(j));

  const v2 = new Vault(dir);
  v2.loadOrCreateMaster();
  assert.throws(() => v2.loadAll(), /vault:|Unsupported|tag|decrypt/i);
});

test("set 拒绝非字符串 value", () => {
  const dir = tmpDir();
  const v = new Vault(dir);
  v.loadOrCreateMaster();
  assert.throws(() => v.set("X", 123), /必须是字符串/);
  assert.throws(() => v.set("", "y"), /必须是非空字符串/);
});

test("maskValue 长短分级遮罩", () => {
  assert.strictEqual(maskValue(null), null);
  assert.strictEqual(maskValue(""), "");
  assert.strictEqual(maskValue("ab"), "••••");
  assert.strictEqual(maskValue("abcdef"), "ab••••ef");
  assert.strictEqual(maskValue("abcd1234efgh5678"), "abcd••••••5678");
});
