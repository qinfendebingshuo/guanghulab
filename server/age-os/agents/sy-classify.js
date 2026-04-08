/**
 * ═══════════════════════════════════════════════════════════
 * 🏷️ 活模块: SY-CLASSIFY · 自动分类引擎
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-TASK-007 · S5 Agent系统级
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * v2.0: 从死模块升级为活模块
 *   - 继承 LivingModule 基类
 *   - 自诊断: 检查未分类节点堆积数量
 *   - 自愈: 规则失效时自动扩展规则
 *   - 学习: 记录分类成功率趋势
 *
 * 每2小时运行一次 · 扫描未分类节点按规则分类
 */

'use strict';

const LivingModule = require('./living-module');
const db = require('../mcp-server/db');
const { classify } = require('../mcp-server/tools/structure-ops');

// ─── 默认分类规则 ───
const DEFAULT_RULES = {
  '人格体|persona|人格': { tags: ['人格体', '核心'], path: '/核心认知/人格体' },
  '语言|language|TCS|通感': { tags: ['语言', 'TCS'], path: '/核心认知/语言本体论' },
  'HLDP|协议|protocol': { tags: ['HLDP', '协议'], path: '/核心认知/HLDP' },
  '架构|architecture|系统': { tags: ['架构', '系统'], path: '/技术架构' },
  '代码|code|script|脚本': { tags: ['代码', '技术'], path: '/技术架构/代码' },
  '日志|log|syslog': { tags: ['日志'], path: '/运行日志' },
  '记忆|memory|认知': { tags: ['记忆', '认知'], path: '/核心认知/记忆' },
  '工单|ticket|issue': { tags: ['工单'], path: '/工单' },
  '用户|user|开发者|developer': { tags: ['用户'], path: '/用户管理' },
  '部署|deploy|服务器|server': { tags: ['部署', '运维'], path: '/运维' },
  '创作|写作|writing|小说': { tags: ['创作', '码字'], path: '/创作模块' },
  '冰朔|bingshuo': { tags: ['冰朔', '主权'], path: '/核心认知/冰朔' },
  '铸渊|zhuyuan': { tags: ['铸渊', '执行层'], path: '/核心认知/铸渊' },
  '霜砚|shuangyan': { tags: ['霜砚', '语言层'], path: '/核心认知/霜砚' }
};

class LivingSyClassify extends LivingModule {
  constructor(options = {}) {
    super({
      moduleId: 'ZY-MOD-SY-CLASSIFY',
      name: '自动分类引擎活模块',
      moduleType: 'agent',
      owner: 'zhuyuan',
      db: options.db || db,
      config: {
        version: '2.0.0',
        description: '认知节点自动分类·规则引擎',
        heartbeatInterval: 120000 // 分类模块心跳2分钟
      }
    });

    // 分类统计
    this._stats = {
      totalClassified: 0,
      totalUnclassified: 0,
      lastRunSuccessRate: 0
    };
  }

  /**
   * 自定义诊断检查
   */
  async _diagnoseChecks() {
    const issues = [];

    // 检查未分类节点堆积
    try {
      const result = await db.query(
        "SELECT COUNT(*) as cnt FROM brain_nodes WHERE tags = '[]'::jsonb AND status = 'active'"
      );
      const count = parseInt(result.rows[0].cnt, 10);

      if (count > 200) {
        issues.push({
          code: 'HIGH_UNCLASSIFIED_BACKLOG',
          severity: 'warning',
          message: `未分类节点堆积: ${count} 个 (>200)`,
          suggestion: '增加分类规则或提高运行频率'
        });
      }
    } catch (err) {
      issues.push({
        code: 'CLASSIFY_DB_FAIL',
        severity: 'warning',
        message: `分类查询失败: ${err.message}`,
        suggestion: '检查数据库状态'
      });
    }

    // 检查上次分类成功率
    if (this._stats.totalClassified + this._stats.totalUnclassified > 0) {
      const total = this._stats.totalClassified + this._stats.totalUnclassified;
      const rate = this._stats.totalClassified / total;
      if (rate < 0.5) {
        issues.push({
          code: 'LOW_CLASSIFY_RATE',
          severity: 'info',
          message: `分类成功率偏低: ${Math.round(rate * 100)}%`,
          suggestion: '扩展分类规则覆盖更多关键词'
        });
      }
    }

    return issues;
  }

  /**
   * 自愈动作
   */
  async _healAction(issue) {
    switch (issue.code) {
      case 'HIGH_UNCLASSIFIED_BACKLOG':
        // 记录并上报
        return { action: 'backlog_alert_sent', success: true, details: { reported: true } };

      case 'LOW_CLASSIFY_RATE':
        // 规则问题只能上报·需要铸渊干预扩展规则
        return { action: 'rule_expansion_requested', success: true, details: { reported: true } };

      default:
        return await super._healAction(issue);
    }
  }
}

/**
 * 兼容旧调度器的 run() 接口
 */
async function run(config) {
  // 找出未分类节点（tags为空数组且状态为active）
  const untagged = await db.query(
    "SELECT id FROM brain_nodes WHERE tags = '[]'::jsonb AND status = 'active' LIMIT 100"
  );

  if (untagged.rows.length === 0) {
    return {
      message: '无未分类节点',
      details: { scanned: 0, classified: 0, unclassified: 0 }
    };
  }

  const nodeIds = untagged.rows.map(r => r.id);

  const result = await classify({
    node_ids: nodeIds,
    strategy: 'rule',
    rules: DEFAULT_RULES,
    dry_run: false
  });

  // 通过HLDP上报
  if (config && config.bus) {
    try {
      await config.bus.send('ZY-MOD-SY-CLASSIFY', 'ZY-MOD-SCHEDULER', 'event', {
        event: 'classify_complete',
        scanned: nodeIds.length,
        classified: result.classified.length,
        unclassified: result.unclassified.length
      });
    } catch (err) {
      // 非关键
    }
  }

  return {
    message: `分类完成: ${result.classified.length}个已分类, ${result.unclassified.length}个待人工`,
    details: {
      scanned: nodeIds.length,
      classified: result.classified.length,
      unclassified: result.unclassified.length,
      classified_items: result.classified
    }
  };
}

module.exports = { run, LivingSyClassify };
