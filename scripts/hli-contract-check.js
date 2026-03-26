#!/usr/bin/env node
// scripts/hli-contract-check.js
// HLI 接口契约校验 — 验证所有 schema 文件结构完整性
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.resolve(__dirname, '../src/schemas/hli');

let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ❌ ${message}`);
  }
}

console.log('🔍 HLI 接口契约校验\n');

// 扫描所有域目录
const domains = fs.readdirSync(SCHEMA_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

for (const domain of domains) {
  const domainDir = path.join(SCHEMA_DIR, domain);
  const schemaFiles = fs.readdirSync(domainDir).filter(f => f.endsWith('.schema.json'));

  for (const file of schemaFiles) {
    const filePath = path.join(domainDir, file);
    const relPath = `src/schemas/hli/${domain}/${file}`;

    let schema;
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      schema = JSON.parse(content);
    } catch (e) {
      failed++;
      console.error(`  ❌ ${relPath}: JSON 解析失败 — ${e.message}`);
      continue;
    }

    console.log(`  📋 ${relPath}`);

    // 必须包含 hli_id
    check(
      typeof schema.hli_id === 'string' && schema.hli_id.startsWith('HLI-'),
      `${relPath}: 缺少有效的 hli_id`
    );

    // route 和 method：如存在则校验格式
    if (schema.route !== undefined) {
      check(
        typeof schema.route === 'string' && schema.route.startsWith('/hli/'),
        `${relPath}: route 格式无效（应以 /hli/ 开头）`
      );
    }

    if (schema.method !== undefined) {
      check(
        typeof schema.method === 'string',
        `${relPath}: method 格式无效`
      );
    }

    // 必须包含 input 和 output
    check(
      schema.input !== undefined,
      `${relPath}: 缺少 input 定义`
    );

    check(
      schema.output !== undefined,
      `${relPath}: 缺少 output 定义`
    );
  }
}

console.log(`\n📊 契约校验: ${passed} 通过, ${failed} 失败`);

if (failed > 0) {
  console.error('❌ HLI Contract Check FAILED');
  process.exit(1);
} else {
  console.log('✅ HLI Contract Check PASSED');
}
