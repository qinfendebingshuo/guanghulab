/**
 * Agent: SY-SCAN · 大脑结构巡检
 * 每6小时运行一次
 * 扫描孤岛节点、断链、空目录，生成健康报告
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 */

'use strict';

const { scanStructure } = require('../mcp-server/tools/structure-ops');

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

  return {
    message: issues.length === 0
      ? `大脑结构健康 · ${report.total_nodes}个节点 · 评分${report.health_score}`
      : `发现${issues.length}类问题: ${issues.join(', ')} · 评分${report.health_score}`,
    details: report
  };
}

module.exports = { run };
