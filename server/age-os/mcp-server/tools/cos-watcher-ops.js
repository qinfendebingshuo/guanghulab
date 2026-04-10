/**
 * ═══════════════════════════════════════════════════════════
 * 🔭 COS桶轮询守护 MCP 工具
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 提供MCP工具接口用于查询和控制COS轮询守护进程。
 *
 * 工具清单:
 *   cosWatcherStatus       — 查看轮询守护进程状态
 *   cosWatcherTriggerScan  — 手动触发一次COS桶扫描
 *   cosWatcherResetIndex   — 重置文件索引
 */

'use strict';

const cosWatcher = require('../cos-watcher');

/**
 * cosWatcherStatus — 查看轮询守护进程状态
 *
 * input: {} (无参数)
 *
 * output:
 *   enabled: boolean          — 是否运行中
 *   started_at: string|null   — 启动时间
 *   last_scan: string|null    — 上次扫描时间
 *   scan_count: number        — 总扫描次数
 *   errors: number            — 错误次数
 *   last_error: string|null   — 最后一次错误信息
 *   is_scanning: boolean      — 是否正在扫描
 *   index_summary: object     — 索引统计
 *   recent_events: array      — 最近事件列表
 */
async function cosWatcherStatus(_input) {
  return cosWatcher.getStatus();
}

/**
 * cosWatcherTriggerScan — 手动触发一次COS桶扫描
 *
 * 不等待定时任务，立即执行一次完整扫描。
 *
 * input: {} (无参数)
 *
 * output:
 *   同 cosWatcherStatus 的输出（扫描后的最新状态）
 */
async function cosWatcherTriggerScan(_input) {
  return cosWatcher.triggerScan();
}

/**
 * cosWatcherResetIndex — 重置文件索引
 *
 * 清空所有已知文件索引。下次扫描时会将所有现有文件视为"新文件"。
 * 谨慎使用：可能导致重复处理已有文件。
 *
 * input: {} (无参数)
 *
 * output:
 *   reset: boolean — 是否成功重置
 */
async function cosWatcherResetIndex(_input) {
  return cosWatcher.resetIndex();
}

module.exports = {
  cosWatcherStatus,
  cosWatcherTriggerScan,
  cosWatcherResetIndex
};
