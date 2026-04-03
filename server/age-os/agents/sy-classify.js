/**
 * Agent: SY-CLASSIFY · 自动分类引擎
 * 每2小时运行一次
 * 扫描未分类节点(tags为空)，按规则分类，规则搞不定的标记待人工
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 */

'use strict';

const db = require('../mcp-server/db');
const { classify } = require('../mcp-server/tools/structure-ops');

// ─── 默认分类规则 ───
// 格式: "关键词1|关键词2": { tags: [...], path: "/路径" }
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

module.exports = { run };
