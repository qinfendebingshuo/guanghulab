// scripts/update-memory.js
// 用途：CI 完成后更新 memory.json 统计数据和事件日志

const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(__dirname, '../.github/brain/memory.json');

const memory = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));

const eventType = process.env.MEMORY_EVENT_TYPE || 'ci_run';
const result = process.env.MEMORY_EVENT_RESULT || 'unknown';
const prNumber = process.env.MEMORY_PR_NUMBER || null;
const ref = process.env.GITHUB_REF || '';
const actor = process.env.GITHUB_ACTOR || 'unknown';
const runId = process.env.GITHUB_RUN_ID || null;

const event = {
  timestamp: new Date().toISOString(),
  type: eventType,
  result,
  actor,
  ref,
};

if (prNumber) event.pr_number = prNumber;
if (runId) event.run_id = runId;

// 更新计数器
if (eventType === 'ci_run') {
  memory.stats.ci_runs = (memory.stats.ci_runs || 0) + 1;
} else if (eventType === 'pr_review') {
  memory.stats.pr_reviews = (memory.stats.pr_reviews || 0) + 1;
}

// 保留最近 100 条事件
memory.events.push(event);
if (memory.events.length > 100) {
  memory.events = memory.events.slice(-100);
}

memory.last_updated = new Date().toISOString();

fs.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2) + '\n', 'utf8');

console.log(`✅ memory.json 已更新 · 事件: ${eventType}(${result}) · CI总次数: ${memory.stats.ci_runs} · PR审核次数: ${memory.stats.pr_reviews}`);
