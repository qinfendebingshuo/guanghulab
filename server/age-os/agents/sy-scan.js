/**
 * ═══════════════════════════════════════════════════════════
 * 🔍 活模块: SY-SCAN · 大脑结构巡检
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-TASK-007 · S5 Agent系统级
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * v2.0: 从死模块升级为活模块
 *   - 继承 LivingModule 基类
 *   - 自诊断: 检查 brain_nodes 表健康度、孤岛节点比例
 *   - 自愈: 自动清理空目录、标记断链
 *   - 学习: 记录结构健康趋势
 *
 * 每6小时运行一次 · 扫描孤岛节点、断链、空目录
 */

'use strict';

const LivingModule = require('./living-module');
const db = require('../mcp-server/db');
const { scanStructure } = require('../mcp-server/tools/structure-ops');

class LivingSyScan extends LivingModule {
  constructor(options = {}) {
    super({
      moduleId: 'ZY-MOD-SY-SCAN',
      name: '大脑结构巡检活模块',
      moduleType: 'guard',
      owner: 'zhuyuan',
      db: options.db || db,
      config: {
        version: '2.0.0',
        description: '大脑认知结构健康巡检',
        heartbeatInterval: 120000 // 巡检模块心跳2分钟
      }
    });

    // 上次巡检结果缓存
    this._lastReport = null;
  }

  /**
   * 自定义诊断检查
   */
  async _diagnoseChecks() {
    const issues = [];

    // 检查 brain_nodes 表是否可用
    try {
      const result = await db.query(
        "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE parent_id IS NULL AND node_type != 'folder') as orphans FROM brain_nodes WHERE status = 'active'"
      );
      const total = parseInt(result.rows[0].total, 10);
      const orphans = parseInt(result.rows[0].orphans, 10);

      if (total > 0 && orphans / total > 0.3) {
        issues.push({
          code: 'HIGH_ORPHAN_RATIO',
          severity: 'warning',
          message: `孤岛节点比例过高: ${orphans}/${total} (${Math.round(orphans / total * 100)}%)`,
          suggestion: '运行分类Agent或手动整理'
        });
      }
    } catch (err) {
      issues.push({
        code: 'SCAN_DB_FAIL',
        severity: 'warning',
        message: `大脑结构查询失败: ${err.message}`,
        suggestion: '检查数据库状态'
      });
    }

    // 如果有上次巡检结果，检查健康分
    if (this._lastReport && this._lastReport.health_score < 60) {
      issues.push({
        code: 'LOW_BRAIN_HEALTH',
        severity: 'warning',
        message: `大脑结构健康分偏低: ${this._lastReport.health_score}`,
        suggestion: '清理断链和空目录'
      });
    }

    return issues;
  }

  /**
   * 自愈动作
   */
  async _healAction(issue) {
    switch (issue.code) {
      case 'HIGH_ORPHAN_RATIO':
        // 记录并上报·不自动修改认知结构
        return { action: 'orphan_report_logged', success: true, details: { reported: true } };

      case 'LOW_BRAIN_HEALTH':
        // 尝试清理空目录
        try {
          await db.query(
            "UPDATE brain_nodes SET status = 'archived' WHERE node_type = 'folder' AND status = 'active' AND id NOT IN (SELECT DISTINCT parent_id FROM brain_nodes WHERE parent_id IS NOT NULL AND status = 'active')"
          );
          return { action: 'empty_folders_archived', success: true };
        } catch (err) {
          return { action: 'empty_folders_archived', success: false, error: err.message };
        }

      default:
        return await super._healAction(issue);
    }
  }
}

/**
 * 兼容旧调度器的 run() 接口
 */
async function run(config) {
  const report = await scanStructure({
    checks: ['orphans', 'broken_links', 'duplicates', 'empty_folders']
  });

  const issues = [];
  if (report.orphan_nodes.length > 0) {
    issues.push(`${report.orphan_nodes.length} 个孤岛节点`);
  }
  if (report.broken_links.length > 0) {
    issues.push(`${report.broken_links.length} 个断链`);
  }
  if (report.duplicate_titles.length > 0) {
    issues.push(`${report.duplicate_titles.length} 组重复标题`);
  }
  if (report.empty_folders.length > 0) {
    issues.push(`${report.empty_folders.length} 个空目录`);
  }

  // 通过HLDP上报
  if (config && config.bus) {
    try {
      await config.bus.send('ZY-MOD-SY-SCAN', 'ZY-MOD-SCHEDULER', 'event', {
        event: 'brain_scan_complete',
        health_score: report.health_score,
        total_nodes: report.total_nodes,
        issueCount: issues.length
      });
    } catch (err) {
      // 非关键
    }
  }

  return {
    message: issues.length === 0
      ? `大脑结构健康 · ${report.total_nodes}个节点 · 评分${report.health_score}`
      : `发现${issues.length}类问题: ${issues.join(', ')} · 评分${report.health_score}`,
    details: report
  };
}

module.exports = { run, LivingSyScan };
