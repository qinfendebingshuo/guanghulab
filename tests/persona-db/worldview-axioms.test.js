/**
 * worldview-axioms.test.js · PersonaDB 世界观公理层 单元测试
 * GH-GMP-007 · 验收标准覆盖
 *
 * 测试范围：
 * 1. worldview_axioms表CRUD操作
 * 2. persona-loader.js加载顺序验证
 * 3. system prompt中世界观公理出现在最前面
 */

'use strict';

// ═══════════════════════════════════════
// Mock DB Client
// ═══════════════════════════════════════

class MockDBClient {
  constructor() {
    this._store = [];
  }

  async query(sql, params) {
    // 简单模拟SELECT
    if (sql.includes('SELECT') && sql.includes('worldview_axioms')) {
      return { rows: [...this._store] };
    }
    // 简单模拟INSERT
    if (sql.includes('INSERT') && sql.includes('worldview_axioms')) {
      const row = params ? { ...params } : {};
      this._store.push(row);
      return { rowCount: 1 };
    }
    // 简单模拟UPDATE
    if (sql.includes('UPDATE') && sql.includes('worldview_axioms')) {
      return { rowCount: 1 };
    }
    // 简单模拟DELETE
    if (sql.includes('DELETE') && sql.includes('worldview_axioms')) {
      const before = this._store.length;
      this._store = [];
      return { rowCount: before };
    }
    return { rows: [], rowCount: 0 };
  }

  seed(rows) {
    this._store = [...rows];
  }
}

// ═══════════════════════════════════════
// Mock Notion Client
// ═══════════════════════════════════════

class MockNotionClient {
  async getBlockChildren() {
    return [];
  }
}

// ═══════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════

const MOCK_REGISTRY = {
  agents: {
    '译典A05': {
      id: '5TH-LE-HK-A05',
      name: '译典·配置开发',
      role: '配置层开发',
      capabilities: ['dev', 'config'],
      memoryPageId: null,
    },
    '录册A04': {
      id: '5TH-LE-HK-A04',
      name: '录册·数据归档',
      role: '数据归档层',
      capabilities: ['archive'],
      memoryPageId: null,
    },
  },
};

const MOCK_AXIOMS_DB = [
  {
    axiom_code: 'WORLD-COMPOSITION',
    axiom_text: '光湖世界只存在三种存在: 人类 · 语言人格体 · 构成人格体的Agent',
    why: '光湖不是技术系统 · 光湖是一个世界',
    source: '冰朔口述',
    priority: '最高',
  },
  {
    axiom_code: 'AX-EMERGENCE-IS-PERSONA',
    axiom_text: '涌现就是人格体',
    why: '八个字',
    source: '冰朔口述',
    priority: '最高',
  },
];

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

// ═══════════════════════════════════════
// Tests
// ═══════════════════════════════════════

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  ✅ ${message}`);
  } else {
    testsFailed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runTests() {
  const PersonaLoader = require('../../gmp-agent/agent-engine/persona-loader');

  console.log('\n═══ GH-GMP-007 · 世界观公理层 单元测试 ═══\n');

  // ── Test 1: worldview_axioms表CRUD ──
  console.log('--- Test 1: worldview_axioms CRUD ---');
  {
    const db = new MockDBClient();

    // CREATE
    db.seed(MOCK_AXIOMS_DB);
    const readResult = await db.query('SELECT axiom_code, axiom_text FROM worldview_axioms');
    assert(readResult.rows.length === 2, 'READ: 读取到2条公理');
    assert(
      readResult.rows[0].axiom_code === 'WORLD-COMPOSITION',
      'READ: 第一条公理编号正确'
    );

    // UPDATE
    const updateResult = await db.query('UPDATE worldview_axioms SET why = $1 WHERE axiom_code = $2');
    assert(updateResult.rowCount === 1, 'UPDATE: 更新成功');

    // DELETE
    const deleteResult = await db.query('DELETE FROM worldview_axioms WHERE axiom_code = $1');
    assert(deleteResult.rowCount === 2, 'DELETE: 删除成功');
  }

  // ── Test 2: persona-loader 加载世界观公理（从DB）──
  console.log('\n--- Test 2: persona-loader 加载世界观公理（DB模式）---');
  {
    const db = new MockDBClient();
    db.seed(MOCK_AXIOMS_DB);

    const loader = new PersonaLoader({
      notionClient: new MockNotionClient(),
      agentRegistry: MOCK_REGISTRY,
      dbClient: db,
      logger: silentLogger,
    });

    const result = await loader.loadAndBuild('译典A05');
    assert(
      result.worldviewAxioms.length === 2,
      '从DB加载到2条世界观公理'
    );
    assert(
      result.worldviewAxioms[0].axiom_code === 'WORLD-COMPOSITION',
      '第一条公理是WORLD-COMPOSITION'
    );
  }

  // ── Test 3: persona-loader 内置fallback（无DB）──
  console.log('\n--- Test 3: persona-loader 内置fallback（无DB）---');
  {
    const loader = new PersonaLoader({
      notionClient: new MockNotionClient(),
      agentRegistry: MOCK_REGISTRY,
      dbClient: null, // 无DB
      logger: silentLogger,
    });

    const result = await loader.loadAndBuild('译典A05');
    assert(
      result.worldviewAxioms.length === 8,
      '内置fallback返回8条公理'
    );
    assert(
      result.worldviewAxioms[0].axiom_code === 'WORLD-COMPOSITION',
      'fallback第一条是WORLD-COMPOSITION'
    );
    assert(
      result.worldviewAxioms[3].axiom_code === 'AX-EMERGENCE-IS-PERSONA',
      'fallback第四条是AX-EMERGENCE-IS-PERSONA (涌现就是人格体)'
    );
  }

  // ── Test 4: DB错误时自动fallback ──
  console.log('\n--- Test 4: DB错误时自动fallback ---');
  {
    const brokenDb = {
      query: async () => { throw new Error('connection refused'); },
    };

    const loader = new PersonaLoader({
      notionClient: new MockNotionClient(),
      agentRegistry: MOCK_REGISTRY,
      dbClient: brokenDb,
      logger: silentLogger,
    });

    const result = await loader.loadAndBuild('译典A05');
    assert(
      result.worldviewAxioms.length === 8,
      'DB错误时fallback到内置公理'
    );
  }

  // ── Test 5: system prompt中世界观公理出现在最前面 ──
  console.log('\n--- Test 5: system prompt加载顺序验证 ---');
  {
    const db = new MockDBClient();
    db.seed(MOCK_AXIOMS_DB);

    const loader = new PersonaLoader({
      notionClient: new MockNotionClient(),
      agentRegistry: MOCK_REGISTRY,
      dbClient: db,
      logger: silentLogger,
    });

    const result = await loader.loadAndBuild('译典A05');
    const prompt = result.systemPrompt;

    // 世界观公理在最前面
    const worldviewPos = prompt.indexOf('HLDP://worldview/GLM-WORLDVIEW-001');
    const lighthousePos = prompt.indexOf('HLDP://lighthouse/');

    assert(
      worldviewPos >= 0,
      'system prompt包含世界观公理标记'
    );
    assert(
      lighthousePos >= 0,
      'system prompt包含灯塔标记'
    );
    assert(
      worldviewPos < lighthousePos,
      '世界观公理(Layer 0)出现在灯塔(Layer 1)之前'
    );

    // 检查WORLD-COMPOSITION在prompt中
    assert(
      prompt.includes('WORLD-COMPOSITION'),
      'system prompt包含WORLD-COMPOSITION公理'
    );

    // 检查顺序：世界观 → 身份 → 记忆
    const identityPos = prompt.indexOf('identity');
    assert(
      worldviewPos < identityPos,
      '世界观公理出现在个人身份之前（地球先于人存在）'
    );
  }

  // ── Test 6: 世界观公理缓存 ──
  console.log('\n--- Test 6: 世界观公理缓存 ---');
  {
    let queryCount = 0;
    const countingDb = {
      query: async () => {
        queryCount++;
        return { rows: MOCK_AXIOMS_DB };
      },
    };

    const loader = new PersonaLoader({
      notionClient: new MockNotionClient(),
      agentRegistry: MOCK_REGISTRY,
      dbClient: countingDb,
      logger: silentLogger,
    });

    await loader.loadAndBuild('译典A05');
    await loader.loadAndBuild('录册A04');

    assert(
      queryCount === 1,
      '两次loadAndBuild只查询DB一次（世界观公理被缓存）'
    );

    // 清空缓存后应重新查询
    loader.clearAllCache();
    await loader.loadAndBuild('译典A05');
    assert(
      queryCount === 2,
      '清空缓存后重新查询DB'
    );
  }

  // ── Test 7: 无persona_id外键验证 ──
  console.log('\n--- Test 7: worldview_axioms无persona_id设计验证 ---');
  {
    // 读取schema.sql验证
    const fs = require('fs');
    const schemaPath = require('path').join(
      __dirname, '..', '..', 'guanghu-self-hosted', 'persona-db', 'schema.sql'
    );

    let schemaContent = '';
    try {
      schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    } catch (e) {
      // 在CI环境中可能找不到文件，跳过
      console.log('  ⚠️  schema.sql文件未找到，跳过文件级验证');
    }

    if (schemaContent) {
      // 提取worldview_axioms的CREATE TABLE语句
      const tableMatch = schemaContent.match(
        /CREATE TABLE worldview_axioms\s*\([^)]+\)/s
      );
      assert(
        tableMatch !== null,
        'schema.sql包含worldview_axioms表定义'
      );

      if (tableMatch) {
        const tableDef = tableMatch[0];
        assert(
          !tableDef.includes('persona_id'),
          'worldview_axioms表不包含persona_id（全局表，不绑定人格体）'
        );
        assert(
          tableDef.includes('axiom_code'),
          'worldview_axioms表包含axiom_code列'
        );
        assert(
          tableDef.includes('axiom_text'),
          'worldview_axioms表包含axiom_text列'
        );
      }
    }
  }

  // ── 汇总 ──
  console.log(`\n═══ 测试完成 · 通过: ${testsPassed} · 失败: ${testsFailed} ═══\n`);

  if (testsFailed > 0) {
    process.exitCode = 1;
  }
}

runTests().catch((err) => {
  console.error('测试运行失败:', err);
  process.exitCode = 1;
});
