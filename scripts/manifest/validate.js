#!/usr/bin/env node
/**
 * function-manifest 校验器 (零依赖)
 *
 * 校验:
 *   1. JSON 合法
 *   2. 必填字段齐全 (ZY-FN/ZY-SVR 编号格式)
 *   3. 引用一致性: function.host_server 必须存在于 servers
 *      function.modules 必须出现在 modules_index.id (如有 modules_index)
 *      active_routes.*.active_fn 必须存在于 functions
 *   4. 中文名/动机字段非空 (created_for / display_name_zh)
 *
 * 用法:
 *   node scripts/manifest/validate.js
 *   node scripts/manifest/validate.js --strict   (失败退出 1)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(REPO_ROOT, '.github/brain/architecture/function-manifest.json');
const SCHEMA_PATH = path.join(REPO_ROOT, '.github/brain/architecture/function-manifest.schema.json');

const RE_SVR = /^ZY-SVR-[A-Z0-9]+$/;
const RE_FN = /^ZY-FN-[A-Z0-9]+$/;
const RE_M = /^M-[A-Z0-9-]+$/;

const errors = [];
const warnings = [];

function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch (e) {
  console.error('❌ manifest 解析失败:', e.message);
  process.exit(1);
}
try {
  JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
} catch (e) {
  err('schema 解析失败: ' + e.message);
}

const servers = Array.isArray(manifest.servers) ? manifest.servers : [];
const functions = Array.isArray(manifest.functions) ? manifest.functions : [];
const modulesIndex = Array.isArray(manifest.modules_index) ? manifest.modules_index : [];
const activeRoutes = manifest.active_routes && typeof manifest.active_routes === 'object' ? manifest.active_routes : {};

// 1. servers
const serverIds = new Set();
for (const s of servers) {
  if (!s.id || !RE_SVR.test(s.id)) err(`server id 不合法: ${JSON.stringify(s.id)}`);
  if (serverIds.has(s.id)) err(`server id 重复: ${s.id}`);
  serverIds.add(s.id);
  if (!s.display_name_zh) err(`server ${s.id} 缺少 display_name_zh`);
  if (!s.status) err(`server ${s.id} 缺少 status`);
  if (!s.template_version) warn(`server ${s.id} 缺少 template_version`);
}

// 2. functions
const fnIds = new Set();
const moduleIds = new Set(modulesIndex.map((m) => m.id));
for (const fn of functions) {
  if (!fn.id || !RE_FN.test(fn.id)) err(`function id 不合法: ${JSON.stringify(fn.id)}`);
  if (fnIds.has(fn.id)) err(`function id 重复: ${fn.id}`);
  fnIds.add(fn.id);
  if (!fn.display_name_zh) err(`function ${fn.id} 缺少 display_name_zh (人类记忆主键, 必填)`);
  if (!fn.created_for) err(`function ${fn.id} 缺少 created_for (开发动机, 必填)`);
  if (!fn.host_server) err(`function ${fn.id} 缺少 host_server`);
  else if (!serverIds.has(fn.host_server)) err(`function ${fn.id} host_server "${fn.host_server}" 未登记`);
  if (!fn.domain) warn(`function ${fn.id} 缺少 domain`);
  if (!fn.status) err(`function ${fn.id} 缺少 status`);
  if (!Array.isArray(fn.modules)) err(`function ${fn.id} modules 必须是数组`);
  else {
    for (const mid of fn.modules) {
      if (!RE_M.test(mid)) err(`function ${fn.id} 模块编号不合法: ${mid}`);
      if (modulesIndex.length && !moduleIds.has(mid)) {
        warn(`function ${fn.id} 引用模块 ${mid} 未在 modules_index 登记`);
      }
    }
  }
  if (!Array.isArray(fn.aliases) || fn.aliases.length === 0) {
    warn(`function ${fn.id} 缺少 aliases (自然语言匹配会变弱)`);
  }
}

// 3. active_routes
for (const [domain, route] of Object.entries(activeRoutes)) {
  if (!route || typeof route !== 'object') {
    err(`active_routes[${domain}] 不是对象`);
    continue;
  }
  if (!route.active_fn) err(`active_routes[${domain}] 缺少 active_fn`);
  else if (!fnIds.has(route.active_fn)) err(`active_routes[${domain}].active_fn "${route.active_fn}" 未登记`);
  if (route.host_server && !serverIds.has(route.host_server)) {
    err(`active_routes[${domain}].host_server "${route.host_server}" 未登记`);
  }
  // host_server 一致性
  const fn = functions.find((f) => f.id === route.active_fn);
  if (fn && route.host_server && fn.host_server !== route.host_server) {
    err(`active_routes[${domain}] host_server 与 function ${fn.id} 不一致 (route=${route.host_server}, fn=${fn.host_server})`);
  }
}

// 4. registered_functions vs host_server 反查
for (const s of servers) {
  const expected = functions.filter((f) => f.host_server === s.id).map((f) => f.id).sort();
  const declared = (s.registered_functions || []).slice().sort();
  if (JSON.stringify(expected) !== JSON.stringify(declared)) {
    warn(`server ${s.id} registered_functions 与 functions[].host_server 反查不一致 (declared=${declared.join(',')||'-'}, actual=${expected.join(',')||'-'})`);
  }
}

const strict = process.argv.includes('--strict');
const summary = {
  manifest_path: MANIFEST_PATH,
  servers: servers.length,
  functions: functions.length,
  modules_index: modulesIndex.length,
  errors: errors.length,
  warnings: warnings.length
};

if (errors.length) {
  console.error('❌ manifest 校验失败:');
  errors.forEach((e) => console.error('   ✗ ' + e));
}
if (warnings.length) {
  console.warn('⚠ 警告:');
  warnings.forEach((w) => console.warn('   ! ' + w));
}
console.log(JSON.stringify(summary, null, 2));

if (errors.length) {
  process.exit(1);
}
if (strict && warnings.length) process.exit(1);
process.exit(0);
