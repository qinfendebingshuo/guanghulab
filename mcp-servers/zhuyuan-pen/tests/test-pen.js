#!/usr/bin/env node
// 神笔马良 · 自检
// 不依赖任何三方测试框架. 失败抛出非零退出码.
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PEN = require('../src/server.js');

const TMP_NAME = `test-pen-${Date.now().toString(36)}`;
const PENNED_DIR = path.resolve(__dirname, '..', 'penned');

function cleanup() {
  const d = path.join(PENNED_DIR, TMP_NAME);
  if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
}
process.on('exit', cleanup);

// 1. capabilities 至少有 fs.read / fs.write / shell.run
const caps = PEN.penCapabilities();
assert.ok(caps['fs.read'], 'capability fs.read missing');
assert.ok(caps['fs.write'], 'capability fs.write missing');
assert.ok(caps['shell.run'], 'capability shell.run missing');
assert.ok(caps['http.get'], 'capability http.get missing');
assert.ok(caps['llm.chat'], 'capability llm.chat missing');

// 2. write a JS tool
const w1 = PEN.penWrite({
  name: TMP_NAME,
  description: 'self-test tool',
  language: 'js',
  capabilities: ['fs.read', 'shell.run', 'nonexistent.cap'],
});
assert.strictEqual(w1.ok, true);
assert.deepStrictEqual(w1.meta.capabilities.sort(), ['fs.read', 'shell.run']);
assert.deepStrictEqual(w1.meta.missing_capabilities, ['nonexistent.cap']);
assert.ok(fs.existsSync(path.join(PENNED_DIR, TMP_NAME, 'index.js')));
assert.ok(fs.existsSync(path.join(PENNED_DIR, TMP_NAME, 'tool.meta.json')));
assert.ok(fs.existsSync(path.join(PENNED_DIR, TMP_NAME, 'README.md')));

// 3. list contains it
const list = PEN.penList();
assert.ok(list.find((t) => t.name === TMP_NAME), 'penList should include tool');

// 4. write same name again → throws
let threw = false;
try { PEN.penWrite({ name: TMP_NAME, language: 'js' }); } catch { threw = true; }
assert.ok(threw, 'duplicate name should throw');

// 5. invalid name
threw = false;
try { PEN.penWrite({ name: 'BadName', language: 'js' }); } catch { threw = true; }
assert.ok(threw, 'invalid name should throw');

// 6. register
const reg = PEN.penRegister(TMP_NAME);
assert.strictEqual(reg.ok, true);
assert.ok(reg.total >= 1);
assert.ok(fs.existsSync(reg.registry));

// 7. registry.json contains tool
const regJson = JSON.parse(fs.readFileSync(reg.registry, 'utf8'));
assert.ok(regJson.tools.find((t) => t.name === TMP_NAME));

// Clean registry to avoid polluting the repo
const regPath = reg.registry;
const cleaned = JSON.parse(fs.readFileSync(regPath, 'utf8'));
cleaned.tools = (cleaned.tools || []).filter((t) => t.name !== TMP_NAME);
if (cleaned.tools.length === 0) {
  fs.unlinkSync(regPath);
} else {
  fs.writeFileSync(regPath, JSON.stringify(cleaned, null, 2));
}

console.log('✅ all pen tests passed');
