// scripts/neural/analyze-digest.js
// 🧬 天眼日报分析引擎
// 输入：最新日报 + 历史日报（最近7天）+ 分析规则
// 输出：工单列表（如果有需要处理的问题）

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DIGEST_DIR = 'data/neural-reports/daily-digest';
const RULES_PATH = 'skyeye/neural-analysis-rules.json';
const WORK_ORDER_DIR = 'data/neural-reports/work-orders';
const TERMINAL_STATUSES = ['CLOSED', 'ESCALATED', 'VERIFIED'];

function loadJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function getRecentDigests(days) {
  days = days || 7;
  if (!fs.existsSync(DIGEST_DIR)) return [];
  return fs.readdirSync(DIGEST_DIR)
    .filter(function(f) { return f.endsWith('.json') && f !== '.gitkeep'; })
    .sort().reverse().slice(0, days)
    .map(function(f) { return loadJSON(path.join(DIGEST_DIR, f)); })
    .filter(Boolean);
}

function evaluateCondition(digest, condition) {
  var field = condition.field;
  var operator = condition.operator;
  var value = condition.value;

  var fieldValue = field.split('.').reduce(function(obj, key) {
    if (key === '*') return obj;
    return obj ? obj[key] : undefined;
  }, digest);

  switch (operator) {
    case 'equals': return fieldValue === value;
    case 'not_empty': return Array.isArray(fieldValue) ? fieldValue.length > 0 : !!fieldValue;
    case 'greater_than': return (fieldValue || 0) > value;
    case 'greater_than_percent': {
      var ofField = condition.of.split('.').reduce(function(o, k) { return o ? o[k] : undefined; }, digest);
      return ofField > 0 && (fieldValue / ofField * 100) > value;
    }
    case 'contains': return JSON.stringify(fieldValue || '').indexOf(value) !== -1;
    default: return false;
  }
}

function detectTrends(digests, trendRules) {
  var alerts = [];
  if (digests.length < 3) return alerts;

  for (var i = 0; i < trendRules.length; i++) {
    var rule = trendRules[i];
    if (rule.name === 'failure_rate_rising') {
      var rates = digests.slice(0, 3).map(function(d) { return d.failure_rate_percent; });
      if (rates[0] > rates[1] && rates[1] > rates[2]) {
        alerts.push({
          type: 'trend_alert', rule: rule.name, severity: rule.severity,
          description: rule.description, data: { rates_last_3_days: rates }
        });
      }
    }
    if (rule.name === 'workflow_going_silent') {
      var latestMap = digests[0] ? digests[0].brain_summary : null;
      if (latestMap) {
        var brains = Object.entries(latestMap);
        for (var b = 0; b < brains.length; b++) {
          var brain = brains[b][0];
          var summary = brains[b][1];
          var workflows = summary.workflows || [];
          for (var w = 0; w < workflows.length; w++) {
            var wf = workflows[w];
            var allSilent = digests.slice(0, 3).every(function(d) {
              var bSummary = d.brain_summary ? d.brain_summary[brain] : null;
              var bwf = bSummary ? (bSummary.workflows || []).find(function(x) { return x.id === wf.id; }) : null;
              return !bwf || bwf.runs === 0;
            });
            if (allSilent && wf.runs === 0) {
              alerts.push({
                type: 'silence_alert', rule: rule.name, severity: rule.severity,
                description: wf.name + ' 连续 3 天无运行记录',
                data: { workflow_id: wf.id, brain: brain }
              });
            }
          }
        }
      }
    }
  }
  return alerts;
}

function generateWorkOrders(digest, rules, trendAlerts) {
  var workOrders = [];
  var now = new Date().toISOString();

  var severityEntries = Object.entries(rules.severity_rules);
  for (var s = 0; s < severityEntries.length; s++) {
    var severity = severityEntries[s][0];
    var rule = severityEntries[s][1];
    for (var c = 0; c < rule.conditions.length; c++) {
      var condition = rule.conditions[c];
      if (evaluateCondition(digest, condition)) {
        workOrders.push({
          id: 'WO-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex'),
          created: now,
          source: 'neural-analysis-engine',
          source_digest: digest.digest_id,
          severity: severity.split('_')[0].toUpperCase(),
          title: '[' + severity.split('_')[0].toUpperCase() + '] ' + condition.field + ' 触发 ' + rule.description,
          description: '日报 ' + digest.digest_id + ' 中 ' + condition.field + ' 触发了 ' + rule.description + ' 规则',
          action: rule.action,
          notify: rule.notify,
          timeout_hours: rule.timeout_hours,
          status: 'pending'
        });
        break;
      }
    }
  }

  for (var t = 0; t < trendAlerts.length; t++) {
    var alert = trendAlerts[t];
    workOrders.push({
      id: 'WO-TREND-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex'),
      created: now,
      source: 'neural-trend-detection',
      source_digest: digest.digest_id,
      severity: alert.severity,
      title: '[趋势] ' + alert.description,
      description: JSON.stringify(alert.data),
      action: 'investigate_trend',
      status: 'pending'
    });
  }

  return workOrders;
}

function main() {
  console.log('\n━━━ 🧬 天眼日报分析引擎启动 ━━━\n');

  var rules = loadJSON(RULES_PATH);
  if (!rules) {
    console.log('❌ 分析规则文件不存在，跳过');
    return;
  }

  var digests = getRecentDigests(7);
  if (digests.length === 0) {
    console.log('⚠️ 无日报数据，跳过');
    return;
  }

  var latest = digests[0];
  console.log('📊 分析日报: ' + latest.digest_id);
  console.log('   整体健康: ' + latest.overall_health);
  console.log('   历史对比: ' + digests.length + ' 天数据\n');

  var trendAlerts = detectTrends(digests, (rules.trend_detection || {}).rules || []);
  console.log('📈 趋势告警: ' + trendAlerts.length + ' 个');

  var workOrders = generateWorkOrders(latest, rules, trendAlerts);
  console.log('📋 生成工单: ' + workOrders.length + ' 个\n');

  if (workOrders.length > 0) {
    fs.mkdirSync(WORK_ORDER_DIR, { recursive: true });
    var date = latest.digest_id.replace('NEURAL-DIGEST-', '');
    fs.writeFileSync(
      path.join(WORK_ORDER_DIR, 'work-orders-' + date + '.json'),
      JSON.stringify({ date: date, work_orders: workOrders }, null, 2)
    );
    console.log('💾 工单已保存到 ' + WORK_ORDER_DIR + '/');
  }

  for (var i = 0; i < workOrders.length; i++) {
    console.log('  ' + workOrders[i].severity + ' | ' + workOrders[i].title);
  }

  console.log('\n━━━ 分析完成 ━━━\n');
}

main();
