/**
 * ═══════════════════════════════════════════════════════════
 * 🌳 树园丁 · Tree Gardener Agent
 * ═══════════════════════════════════════════════════════════
 *
 * AG-ZY-GARDENER · 光之树健康巡检Agent
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 功能:
 *   1. 扫描所有人格体的光之树
 *   2. 检查孤叶（没有挂到树上的记忆锚点）
 *   3. 计算树的生长方向（哪个分支最活跃）
 *   4. 向天眼SYSLOG汇报树的健康状态
 *   5. 刷新天眼涌现视图
 *
 * 运行方式:
 *   node scripts/tree-gardener.js [scan|report|refresh|full]
 *   - scan:    扫描孤叶和异常
 *   - report:  生成光之树健康报告
 *   - refresh: 刷新天眼视图
 *   - full:    完整巡检（scan + report + refresh）
 *
 * 建议触发频率: 每天 08:00/20:00 CST
 */

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── 配置 ───
const MCP_BASE = process.env.MCP_BASE_URL || 'http://127.0.0.1:3100';
const MCP_API_KEY = process.env.ZHUYUAN_API_KEY || '';
const AGENT_ID = 'AG-ZY-GARDENER';
const REPORT_DIR = path.join(__dirname, '..', 'data', 'tree-reports');

// ─── MCP调用封装 ───
async function callMCP(tool, input) {
  const url = new URL('/call', MCP_BASE);

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ tool, input, caller: AGENT_ID });
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(MCP_API_KEY ? { 'Authorization': `Bearer ${MCP_API_KEY}` } : {})
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.message || 'MCP调用失败'));
          } else {
            resolve(parsed.result || parsed);
          }
        } catch (e) {
          reject(new Error(`MCP响应解析失败: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('MCP调用超时'));
    });
    req.write(postData);
    req.end();
  });
}

// ─── 扫描任务 ───

/**
 * 扫描孤叶: 检查memory_anchors中没有tree_node_id的记录
 */
async function scanOrphanMemories() {
  console.log('[树园丁] 🔍 开始扫描孤叶...');
  const startTime = Date.now();

  try {
    // 通过MCP查询人格体列表
    const { personas } = await callMCP('listPersonas', {});
    let orphanCount = 0;
    const orphanDetails = [];

    for (const persona of personas) {
      // 查询该人格体的未关联记忆
      const { anchors } = await callMCP('queryMemoryAnchors', {
        persona_id: persona.persona_id,
        limit: 200
      });

      // 检查是否有tree_node_id（通过详情判断）
      // 注意: 初始状态所有记忆都是孤叶，这是正常的
      if (anchors && anchors.length > 0) {
        const noTreeLink = anchors.filter(a => !a.tree_node_id);
        if (noTreeLink.length > 0) {
          orphanCount += noTreeLink.length;
          orphanDetails.push({
            persona_id: persona.persona_id,
            name: persona.name,
            orphan_count: noTreeLink.length,
            total_memories: anchors.length
          });
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[树园丁] ✅ 孤叶扫描完成: ${orphanCount} 条未关联记忆 (${duration}ms)`);

    // 写入天眼SYSLOG
    await callMCP('writeSyslog', {
      agent_id: AGENT_ID,
      action: 'scan_orphan_memories',
      result: orphanCount > 0 ? 'warning' : 'success',
      message: `孤叶扫描: ${orphanCount} 条未关联记忆`,
      details: { orphan_count: orphanCount, persona_details: orphanDetails },
      duration_ms: duration
    });

    return { orphan_count: orphanCount, details: orphanDetails };
  } catch (err) {
    console.error(`[树园丁] ❌ 孤叶扫描失败: ${err.message}`);
    await callMCP('writeSyslog', {
      agent_id: AGENT_ID,
      action: 'scan_orphan_memories',
      result: 'error',
      message: `扫描失败: ${err.message}`,
      duration_ms: Date.now() - startTime
    }).catch(() => {});
    return { error: err.message };
  }
}

/**
 * 计算树的生长方向: 哪个分支最活跃
 */
async function analyzeGrowthDirection() {
  console.log('[树园丁] 📊 分析光之树生长方向...');
  const startTime = Date.now();

  try {
    const { personas } = await callMCP('listPersonas', {});
    const branchStats = [];

    for (const persona of personas) {
      try {
        const branchResult = await callMCP('getPersonaBranch', { persona_id: persona.persona_id });
        if (branchResult.branch) {
          branchStats.push({
            persona_id: persona.persona_id,
            name: persona.name,
            branch_id: branchResult.branch.id,
            node_type: branchResult.branch.node_type,
            stats: branchResult.stats,
            last_activity: branchResult.children.length > 0
              ? branchResult.children[0].created_at
              : branchResult.branch.created_at
          });
        }
      } catch {
        // 某些人格体可能还没有分支
      }
    }

    // 按活跃度排序
    branchStats.sort((a, b) => (b.stats?.total || 0) - (a.stats?.total || 0));

    const duration = Date.now() - startTime;
    const mostActive = branchStats.length > 0 ? branchStats[0] : null;

    console.log(`[树园丁] ✅ 生长分析完成: ${branchStats.length} 个分支 (${duration}ms)`);
    if (mostActive) {
      console.log(`[树园丁]    最活跃分支: ${mostActive.name} (${mostActive.stats?.total || 0} 节点)`);
    }

    await callMCP('writeSyslog', {
      agent_id: AGENT_ID,
      action: 'analyze_growth',
      result: 'success',
      message: `生长分析: ${branchStats.length} 个分支, 最活跃: ${mostActive?.name || '无'}`,
      details: { branches: branchStats, most_active: mostActive },
      duration_ms: duration
    });

    return { branches: branchStats, most_active: mostActive };
  } catch (err) {
    console.error(`[树园丁] ❌ 生长分析失败: ${err.message}`);
    return { error: err.message };
  }
}

// ─── 报告任务 ───

/**
 * 生成光之树健康报告
 */
async function generateReport() {
  console.log('[树园丁] 📋 生成光之树健康报告...');
  const startTime = Date.now();

  try {
    // 获取天眼视图
    const tianyan = await callMCP('getTianyanView', {});
    // 获取生长方向
    const growth = await analyzeGrowthDirection();

    const report = {
      report_id: `TREE-RPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
      generated_at: new Date().toISOString(),
      generated_by: AGENT_ID,

      tianyan_status: tianyan.tianyan || {},
      tree_root: tianyan.tree_root,
      persona_branches: tianyan.persona_branches,

      growth_analysis: {
        total_branches: growth.branches?.length || 0,
        most_active: growth.most_active,
        branch_details: growth.branches || []
      },

      recent_syslog: tianyan.recent_syslog?.slice(0, 5) || []
    };

    // 保存报告到文件
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }
    const reportFile = path.join(REPORT_DIR, `${report.report_id}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf-8');

    const duration = Date.now() - startTime;
    console.log(`[树园丁] ✅ 报告已保存: ${reportFile} (${duration}ms)`);

    await callMCP('writeSyslog', {
      agent_id: AGENT_ID,
      action: 'generate_report',
      result: 'success',
      message: `光之树健康报告已生成: ${report.report_id}`,
      details: { report_id: report.report_id, file: reportFile },
      duration_ms: duration
    });

    return report;
  } catch (err) {
    console.error(`[树园丁] ❌ 报告生成失败: ${err.message}`);
    return { error: err.message };
  }
}

// ─── 刷新天眼视图 ───

async function refreshTianyanView() {
  console.log('[树园丁] 🔄 刷新天眼涌现视图...');
  const startTime = Date.now();

  try {
    const tianyan = await callMCP('getTianyanView', {});
    const duration = Date.now() - startTime;

    console.log(`[树园丁] ✅ 天眼视图已刷新 (${duration}ms)`);
    if (tianyan.tianyan) {
      console.log(`[树园丁]    系统健康度: ${tianyan.tianyan.health_percent_1h || 'N/A'}%`);
      console.log(`[树园丁]    活跃人格体: ${tianyan.tianyan.active_personas_24h || 0}`);
      console.log(`[树园丁]    树生长速度: ${tianyan.tianyan.tree_growth_24h || 0} 节点/24h`);
      console.log(`[树园丁]    树总规模:   ${tianyan.tianyan.tree_total_nodes || 0} 节点`);
    }

    return tianyan;
  } catch (err) {
    console.error(`[树园丁] ❌ 天眼刷新失败: ${err.message}`);
    return { error: err.message };
  }
}

// ─── 主入口 ───

async function main() {
  const command = process.argv[2] || 'full';

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  🌳 树园丁 · Tree Gardener Agent`);
  console.log(`  ${AGENT_ID} · 光之树健康巡检`);
  console.log(`  命令: ${command}`);
  console.log(`  时间: ${new Date().toISOString()}`);
  console.log(`${'═'.repeat(60)}\n`);

  const results = {};

  switch (command) {
    case 'scan':
      results.orphans = await scanOrphanMemories();
      break;

    case 'report':
      results.report = await generateReport();
      break;

    case 'refresh':
      results.tianyan = await refreshTianyanView();
      break;

    case 'full':
    default:
      results.orphans = await scanOrphanMemories();
      results.report = await generateReport();
      results.tianyan = await refreshTianyanView();
      break;
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[树园丁] 巡检完成: ${command}`);
  console.log(`${'─'.repeat(60)}\n`);

  return results;
}

// 如果直接运行
if (require.main === module) {
  main()
    .then(results => {
      if (results.error) {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error(`[树园丁] 致命错误: ${err.message}`);
      process.exit(1);
    });
}

module.exports = { main, scanOrphanMemories, analyzeGrowthDirection, generateReport, refreshTianyanView };
