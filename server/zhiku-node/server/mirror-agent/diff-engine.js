/**
 * ═══════════════════════════════════════════════════════════
 * ZY-MIRROR-AGENT · Step 2 · 差异感知 — Diff 引擎
 * ═══════════════════════════════════════════════════════════
 *
 * 将最新快照与上一次快照做 diff：
 *   - 发现上游版本变更
 *   - 发现新增/下架书目
 *   - 发现数据源可用性变化
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { MIRROR_CONFIG } = require('./config');

/**
 * 加载快照文件
 */
function loadSnapshot(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 获取某数据源最近的两个快照路径（最新 + 上一次）
 */
function getLastTwoSnapshots(sourceId) {
  const dir = MIRROR_CONFIG.snapshot_dir;
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith(sourceId + '_') && f.endsWith('.json'))
      .sort()
      .reverse();

    return {
      latest: files.length > 0 ? path.join(dir, files[0]) : null,
      previous: files.length > 1 ? path.join(dir, files[1]) : null
    };
  } catch {
    return { latest: null, previous: null };
  }
}

/**
 * 对比两个快照，生成差异报告
 *
 * 差异类型：
 *   - upstream_updated    — 上游项目有新版本/新提交
 *   - source_online       — 数据源从离线变为在线
 *   - source_offline      — 数据源从在线变为离线
 *   - books_added         — 发现新书目
 *   - books_removed       — 书目下架/消失
 *   - first_snapshot      — 首次快照，无历史对比
 */
function diffSnapshots(latestSnap, previousSnap) {
  const diff = {
    source_id: latestSnap.source_id,
    source_name: latestSnap.source_name,
    diff_at: new Date().toISOString(),
    latest_snapshot_at: latestSnap.snapshot_at,
    previous_snapshot_at: previousSnap ? previousSnap.snapshot_at : null,
    changes: [],
    severity: 'none' // none | info | action_needed | critical
  };

  // 首次快照
  if (!previousSnap) {
    diff.changes.push({
      type: 'first_snapshot',
      description: '首次快照，建立基线',
      detail: {
        reachable: latestSnap.probe?.reachable || false,
        upstream: latestSnap.upstream,
        sample_count: latestSnap.sample_books?.reduce((sum, s) => sum + s.count, 0) || 0
      }
    });
    diff.severity = 'info';
    return diff;
  }

  // 1. 上游版本对比
  if (latestSnap.upstream && previousSnap.upstream) {
    const latestTag = latestSnap.upstream.tag || latestSnap.upstream.sha;
    const prevTag = previousSnap.upstream.tag || previousSnap.upstream.sha;

    if (latestTag && prevTag && latestTag !== prevTag) {
      diff.changes.push({
        type: 'upstream_updated',
        description: `上游项目已更新: ${prevTag} → ${latestTag}`,
        detail: {
          previous: previousSnap.upstream,
          latest: latestSnap.upstream
        }
      });
      diff.severity = 'action_needed';
    }
  } else if (latestSnap.upstream && !previousSnap.upstream) {
    diff.changes.push({
      type: 'upstream_updated',
      description: '首次检测到上游版本信息',
      detail: { latest: latestSnap.upstream }
    });
    diff.severity = 'info';
  }

  // 2. 可用性变化
  const latestReachable = latestSnap.probe?.reachable || false;
  const prevReachable = previousSnap.probe?.reachable || false;

  if (latestReachable && !prevReachable) {
    diff.changes.push({
      type: 'source_online',
      description: '数据源恢复在线'
    });
    diff.severity = Math.max(diff.severity === 'action_needed' ? 2 : 0, 1) ? diff.severity : 'info';
  } else if (!latestReachable && prevReachable) {
    diff.changes.push({
      type: 'source_offline',
      description: `数据源离线: ${latestSnap.probe?.error || '未知原因'}`
    });
    diff.severity = 'critical';
  }

  // 3. 书目变化对比
  const latestBooks = extractBookIds(latestSnap);
  const prevBooks = extractBookIds(previousSnap);

  const added = latestBooks.filter(b => !prevBooks.some(p => p.id === b.id));
  const removed = prevBooks.filter(b => !latestBooks.some(l => l.id === b.id));

  if (added.length > 0) {
    diff.changes.push({
      type: 'books_added',
      description: `发现 ${added.length} 本新书`,
      detail: added.slice(0, 10) // 最多列 10 本
    });
    if (diff.severity === 'none') diff.severity = 'info';
  }

  if (removed.length > 0) {
    diff.changes.push({
      type: 'books_removed',
      description: `${removed.length} 本书消失/下架`,
      detail: removed.slice(0, 10)
    });
    if (diff.severity === 'none') diff.severity = 'info';
  }

  // 无变化
  if (diff.changes.length === 0) {
    diff.changes.push({
      type: 'no_change',
      description: '无变化'
    });
  }

  return diff;
}

/**
 * 从快照中提取书目 ID 列表（用于对比）
 */
function extractBookIds(snapshot) {
  if (!snapshot.sample_books || !Array.isArray(snapshot.sample_books)) return [];

  const books = [];
  for (const group of snapshot.sample_books) {
    if (group.sample && Array.isArray(group.sample)) {
      for (const book of group.sample) {
        if (book.id) {
          books.push({ id: String(book.id), title: book.title || '' });
        }
      }
    }
  }
  return books;
}

/**
 * 对单个数据源执行差异分析
 */
function analyzeSource(sourceId) {
  const { latest, previous } = getLastTwoSnapshots(sourceId);
  if (!latest) return null;

  const latestSnap = loadSnapshot(latest);
  const previousSnap = previous ? loadSnapshot(previous) : null;

  if (!latestSnap) return null;

  return diffSnapshots(latestSnap, previousSnap);
}

/**
 * 对所有数据源执行差异分析
 */
function analyzeAll(sourceIds) {
  const results = [];
  for (const id of sourceIds) {
    const diff = analyzeSource(id);
    if (diff) results.push(diff);
  }
  return results;
}

module.exports = {
  loadSnapshot,
  getLastTwoSnapshots,
  diffSnapshots,
  extractBookIds,
  analyzeSource,
  analyzeAll
};
