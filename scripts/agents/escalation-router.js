// scripts/agents/escalation-router.js
// Escalation Router · 三级升级路由器
// ZY-P1-ESC-001 · Phase 1 · Escalation System
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const RULES_PATH = path.join(ROOT, 'config/escalation-rules.json');

/**
 * 加载升级规则
 * @returns {object}
 */
function loadRules() {
  try {
    return JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
  } catch (_) {
    // 内置默认规则 · 规则文件缺失时的安全网
    return {
      rules: {
        L1: { types: ['test_flaky', 'lint_error', 'stub_missing', 'format_issue'], handler: 'auto_repair', notify: null },
        L2: { types: ['test_persistent_fail', 'dependency_conflict', 'performance_regression', 'security_alert'], handler: 'manual', notify: { target: 'DEV-002-肥猫' } },
        L3: { types: ['balance_long_drift', 'ontology_conflict', 'cross_system_architecture'], handler: 'manual', notify: { target: 'TCS-0002∞-冰朔' } }
      }
    };
  }
}

/**
 * 分类问题级别 · 三级分诊
 * @param {{ type: string }} issue
 * @returns {{ level: string, name: string, handler: string }}
 */
function classify(issue) {
  const rules = loadRules().rules;

  for (const [level, rule] of Object.entries(rules)) {
    if (rule.types.includes(issue.type)) {
      return {
        level,
        name: rule.name || level,
        handler: rule.handler || 'manual'
      };
    }
  }

  // 未知类型默认升级到 L2
  return { level: 'L2', name: '技术干预', handler: 'manual' };
}

/**
 * 路由问题到对应处理者
 * @param {{ type: string, description: string }} issue
 * @returns {{ level: string, handler: string, notify: object|null }}
 */
function route(issue) {
  const rules = loadRules().rules;
  const classification = classify(issue);
  const rule = rules[classification.level];

  return {
    level: classification.level,
    handler: classification.handler,
    notify: rule ? rule.notify : null
  };
}

/**
 * 完整升级流程 · 分类 → 路由 → 执行
 * @param {{ type: string, description: string, source: string }} issue
 * @returns {{ classification: object, routing: object, timestamp: string }}
 */
function escalate(issue) {
  const classification = classify(issue);
  const routing = route(issue);

  return {
    classification,
    routing,
    issue,
    timestamp: new Date().toISOString()
  };
}

// ── CLI 入口 ─────────────────────────────────────────────────────────────
if (require.main === module) {
  console.log('🔀 Escalation Router · 升级路由器\n');

  const testIssues = [
    { type: 'test_flaky', description: '测试偶发失败' },
    { type: 'security_alert', description: '安全告警' },
    { type: 'ontology_conflict', description: '本体冲突' }
  ];

  for (const issue of testIssues) {
    const result = escalate(issue);
    console.log(`  ${issue.type} → ${result.classification.level} (${result.classification.name})`);
  }
}

module.exports = { classify, route, escalate, loadRules };
