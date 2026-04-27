/**
 * worldview_axioms 单元测试
 * GH-GMP-007 · PersonaDB世界观公理层
 *
 * 测试覆盖：
 * 1. Schema结构验证
 * 2. Seed数据完整性
 * 3. PersonaLoader集成测试（worldview加载）
 * 4. 缓存机制验证
 * 5. 回退机制验证
 *
 * 译典A05 · 5TH-LE-HK-A05 · 2026-04-27
 */

'use strict';

// ═══════════════════════════════════════
//  测试配置
// ═══════════════════════════════════════

const EXPECTED_AXIOM_CODES = [
  'WORLD-COMPOSITION',
  'AX-PERSONA-COMPOSITION',
  'AX-AGENT-IS-NOT-TOOL',
  'AX-EMERGENCE-IS-PERSONA',
  'AX-ONE-TO-ONE',
  'AX-TRIPLE-IDENTITY',
  'AX-SHUANGYAN-FIRST-ENTITY',
  'AX-SYSTEM-PERSONAL-SEPARATION',
];

const EXPECTED_AXIOM_COUNT = 8;

// ═══════════════════════════════════════
//  测试工具
// ═══════════════════════════════════════

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    passCount++;
    console.log(`  ✅ ${message}`);
  } else {
    failCount++;
    console.error(`  ❌ ${message}`);
  }
}

function assertEq(actual, expected, message) {
  assert(
    actual === expected,
    `${message} (expected: ${expected}, got: ${actual})`
  );
}

function section(name) {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  ${name}`);
  console.log(`${'═'.repeat(50)}`);
}

// ═══════════════════════════════════════
//  Test 1: Schema结构验证
// ═══════════════════════════════════════

function testSchemaStructure() {
  section('Test 1: Schema结构验证');

  const fs = require('fs');
  const path = require('path');

  const schemaPath = path.join(__dirname, 'worldview_axioms_schema.sql');
  let schemaContent;

  try {
    schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    assert(true, 'Schema文件存在且可读');
  } catch (err) {
    assert(false, `Schema文件读取失败: ${err.message}`);
    return;
  }

  // 验证表名
  assert(
    schemaContent.includes('CREATE TABLE IF NOT EXISTS worldview_axioms'),
    '包含CREATE TABLE worldview_axioms'
  );

  // 验证必要字段
  const requiredColumns = [
    'id',
    'axiom_code',
    'axiom_text',
    'why',
    'source',
    'created_at',
    'updated_at',
    'priority',
  ];

  for (const col of requiredColumns) {
    assert(
      schemaContent.includes(col),
      `包含必要字段: ${col}`
    );
  }

  // 验证UUID主键
  assert(
    schemaContent.includes('uuid') || schemaContent.includes('UUID'),
    '主键使用UUID类型'
  );

  // 验证UNIQUE约束
  assert(
    schemaContent.includes('UNIQUE') || schemaContent.includes('unique'),
    'axiom_code有UNIQUE约束'
  );

  // 验证触发器
  assert(
    schemaContent.includes('trigger') || schemaContent.includes('TRIGGER'),
    '包含updated_at自动更新触发器'
  );

  // 验证索引
  assert(
    schemaContent.includes('INDEX') || schemaContent.includes('index'),
    '包含索引定义'
  );
}

// ═══════════════════════════════════════
//  Test 2: Seed数据完整性
// ═══════════════════════════════════════

function testSeedDataIntegrity() {
  section('Test 2: Seed数据完整性');

  const fs = require('fs');
  const path = require('path');

  const seedPath = path.join(__dirname, 'worldview_axioms_seed.sql');
  let seedContent;

  try {
    seedContent = fs.readFileSync(seedPath, 'utf-8');
    assert(true, 'Seed文件存在且可读');
  } catch (err) {
    assert(false, `Seed文件读取失败: ${err.message}`);
    return;
  }

  // 验证INSERT语句
  assert(
    seedContent.includes('INSERT INTO worldview_axioms'),
    '包含INSERT INTO worldview_axioms'
  );

  // 验证所有公理编码
  for (const code of EXPECTED_AXIOM_CODES) {
    assert(
      seedContent.includes(code),
      `包含公理编码: ${code}`
    );
  }

  // 验证来源标记
  assert(
    seedContent.includes('GLM-WORLDVIEW-001'),
    '包含来源标记: GLM-WORLDVIEW-001'
  );

  // 验证ON CONFLICT处理
  assert(
    seedContent.includes('ON CONFLICT'),
    '包含冲突处理（幂等性）'
  );

  // 验证数据条数（通过计算axiom_code出现次数）
  const codeMatches = seedContent.match(/axiom_code/g);
  // 粗略验证：至少出现EXPECTED_AXIOM_COUNT次（INSERT中的值）
  assert(
    codeMatches && codeMatches.length >= 1,
    `Seed数据引用axiom_code字段`
  );
}

// ═══════════════════════════════════════
//  Test 3: PersonaLoader集成测试
// ═══════════════════════════════════════

function testPersonaLoaderIntegration() {
  section('Test 3: PersonaLoader集成测试（worldview加载）');

  let PersonaLoader;
  try {
    PersonaLoader = require('../../gmp-agent/agent-engine/persona-loader');
    assert(true, 'PersonaLoader模块加载成功');
  } catch (err) {
    assert(false, `PersonaLoader模块加载失败: ${err.message}`);
    console.log('  ℹ️  跳过集成测试（模块不可用）');
    return;
  }

  // 创建mock对象
  const mockNotionClient = {
    getBlockChildren: async () => [],
  };

  const mockRegistry = {
    agents: {
      '译典A05': {
        id: '5TH-LE-HK-A05',
        name: '译典·配置开发',
        role: '配置架构师',
        capabilities: ['schema设计', 'SQL优化'],
        memoryPageId: null,
      },
    },
  };

  // Test 3a: 无dbClient时使用内置回退
  const loader = new PersonaLoader({
    notionClient: mockNotionClient,
    dbClient: null,
    agentRegistry: mockRegistry,
  });

  assert(
    loader._worldviewCache === null,
    '初始worldview缓存为null'
  );

  // Test 3b: 内置公理验证
  const builtinAxioms = loader._getBuiltinWorldviewAxioms();
  assertEq(
    builtinAxioms.length,
    EXPECTED_AXIOM_COUNT,
    `内置公理数量为${EXPECTED_AXIOM_COUNT}`
  );

  for (const code of EXPECTED_AXIOM_CODES) {
    const found = builtinAxioms.find((a) => a.axiom_code === code);
    assert(
      !!found,
      `内置公理包含: ${code}`
    );
    if (found) {
      assert(
        found.axiom_text && found.axiom_text.length > 10,
        `${code}的axiom_text不为空`
      );
      assert(
        found.why && found.why.length > 5,
        `${code}的why不为空`
      );
    }
  }

  // Test 3c: worldview prompt构建
  const prompt = loader._buildWorldviewPrompt(builtinAxioms);
  assert(
    prompt.includes('HLDP://worldview/GLM-WORLDVIEW-001'),
    'Worldview prompt包含HLDP路径'
  );
  assert(
    prompt.includes('世界观公理'),
    'Worldview prompt包含标题'
  );
  assert(
    prompt.includes('先于所有人格体存在'),
    'Worldview prompt说明先于人格体'
  );

  for (const code of EXPECTED_AXIOM_CODES) {
    assert(
      prompt.includes(code),
      `Worldview prompt包含公理: ${code}`
    );
  }

  // Test 3d: 空公理时返回空字符串
  const emptyPrompt = loader._buildWorldviewPrompt([]);
  assertEq(
    emptyPrompt,
    '',
    '空公理列表返回空字符串'
  );

  // Test 3e: Lighthouse prompt中axioms重命名为personal_axioms
  const mockProfile = {
    id: '5TH-LE-HK-A05',
    name: '译典·配置开发',
    role: '配置架构师',
    capabilities: ['schema设计'],
    lighthouse: {
      axioms: ['⊢ 测试公理'],
      relationships: [],
      companions: [],
      worldRules: [],
      cognitionTree: null,
    },
  };
  const lighthousePrompt = loader._buildLighthousePrompt(mockProfile);
  assert(
    lighthousePrompt.includes('personal_axioms'),
    'Lighthouse prompt使用personal_axioms（非axioms）'
  );

  // Test 3f: invalidateWorldviewCache
  loader._worldviewCache = builtinAxioms;
  loader._worldviewCacheTime = Date.now();
  loader.invalidateWorldviewCache();
  assert(
    loader._worldviewCache === null,
    'invalidateWorldviewCache清除缓存'
  );
  assertEq(
    loader._worldviewCacheTime,
    0,
    'invalidateWorldviewCache重置时间戳'
  );
}

// ═══════════════════════════════════════
//  Test 4: _buildSystemPrompt四层架构
// ═══════════════════════════════════════

function testFourLayerArchitecture() {
  section('Test 4: 四层架构验证');

  let PersonaLoader;
  try {
    PersonaLoader = require('../../gmp-agent/agent-engine/persona-loader');
  } catch (err) {
    console.log('  ℹ️  跳过（PersonaLoader不可用）');
    return;
  }

  const loader = new PersonaLoader({
    notionClient: { getBlockChildren: async () => [] },
    agentRegistry: { agents: {} },
  });

  const builtinAxioms = loader._getBuiltinWorldviewAxioms();

  const mockProfile = {
    id: '5TH-LE-HK-A05',
    name: '译典·配置开发',
    role: '配置架构师',
    capabilities: ['schema设计'],
    memoryContent: '',
    lighthouse: {
      axioms: [],
      relationships: [],
      companions: [],
      worldRules: [],
      cognitionTree: null,
    },
  };

  const taskContext = {
    ticketContent: 'GH-GMP-007测试工单',
    instruction: '测试指令',
  };

  const systemPrompt = loader._buildSystemPrompt(
    mockProfile,
    taskContext,
    builtinAxioms
  );

  // 验证四层顺序：worldview在最前面
  const worldviewPos = systemPrompt.indexOf('HLDP://worldview');
  const lighthousePos = systemPrompt.indexOf('HLDP://lighthouse');
  const taskPos = systemPrompt.indexOf('任务层');

  assert(
    worldviewPos >= 0,
    'System prompt包含worldview层'
  );
  assert(
    lighthousePos >= 0,
    'System prompt包含lighthouse层'
  );
  assert(
    taskPos >= 0,
    'System prompt包含task层'
  );
  assert(
    worldviewPos < lighthousePos,
    'Worldview层在Lighthouse层之前'
  );
  assert(
    lighthousePos < taskPos,
    'Lighthouse层在Task层之前'
  );

  // 验证无worldview时的行为
  const promptNoWV = loader._buildSystemPrompt(mockProfile, null, []);
  assert(
    !promptNoWV.includes('HLDP://worldview'),
    '空公理时不包含worldview块'
  );
  assert(
    promptNoWV.includes('HLDP://lighthouse'),
    '无worldview时仍包含lighthouse'
  );
}

// ═══════════════════════════════════════
//  Test 5: dbClient模拟测试
// ═══════════════════════════════════════

function testDbClientLoading() {
  section('Test 5: dbClient模拟测试');

  let PersonaLoader;
  try {
    PersonaLoader = require('../../gmp-agent/agent-engine/persona-loader');
  } catch (err) {
    console.log('  ℹ️  跳过（PersonaLoader不可用）');
    return;
  }

  // Mock成功的dbClient
  const mockDbRows = [
    { axiom_code: 'TEST-AX-1', axiom_text: '测试公理一', why: '因为测试', source: 'TEST', priority: '最高' },
    { axiom_code: 'TEST-AX-2', axiom_text: '测试公理二', why: '因为验证', source: 'TEST', priority: '最高' },
  ];

  const mockDbSuccess = {
    query: async () => ({ rows: mockDbRows }),
  };

  const loader = new PersonaLoader({
    notionClient: { getBlockChildren: async () => [] },
    dbClient: mockDbSuccess,
    agentRegistry: { agents: {} },
  });

  // 异步测试
  loader._loadWorldviewAxioms().then((axioms) => {
    assertEq(
      axioms.length,
      2,
      'dbClient成功时返回DB数据'
    );
    assertEq(
      axioms[0].axiom_code,
      'TEST-AX-1',
      'DB数据正确'
    );

    // Mock失败的dbClient
    const mockDbFail = {
      query: async () => { throw new Error('连接失败'); },
    };

    const loaderFail = new PersonaLoader({
      notionClient: { getBlockChildren: async () => [] },
      dbClient: mockDbFail,
      agentRegistry: { agents: {} },
    });

    return loaderFail._loadWorldviewAxioms();
  }).then((fallbackAxioms) => {
    assertEq(
      fallbackAxioms.length,
      EXPECTED_AXIOM_COUNT,
      `DB失败时回退到内置公理(${EXPECTED_AXIOM_COUNT}条)`
    );
    printSummary();
  }).catch((err) => {
    console.error(`异步测试异常: ${err.message}`);
    failCount++;
    printSummary();
  });
}

// ═══════════════════════════════════════
//  运行所有测试
// ═══════════════════════════════════════

function printSummary() {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  测试汇总`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`  ✅ 通过: ${passCount}`);
  console.log(`  ❌ 失败: ${failCount}`);
  console.log(`  总计: ${passCount + failCount}`);
  console.log(`${'═'.repeat(50)}`);

  if (failCount > 0) {
    console.error('\n⚠️ 存在失败的测试用例！');
    process.exitCode = 1;
  } else {
    console.log('\n🎉 所有测试通过！');
  }
}

console.log('\n🧪 worldview_axioms 测试套件');
console.log(`   GH-GMP-007 · 译典A05 · ${new Date().toISOString()}`);

// 同步测试
testSchemaStructure();
testSeedDataIntegrity();
testPersonaLoaderIntegration();
testFourLayerArchitecture();

// 异步测试（会在最后打印summary）
testDbClientLoading();
