/**
 * ═══════════════════════════════════════════════════════════
 * 模块F · Notion权限自动修复Agent MCP 工具
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 自动检测和恢复Notion代理Agent的权限
 * 减少冰朔手动操作
 *
 * 工具清单:
 *   notionCheckPermissions  — 检查Notion权限状态
 *   notionRepairPermissions — 尝试修复权限
 *   notionListSharedPages   — 列出已共享的页面/数据库
 *   notionGenerateRepairGuide — 生成权限修复指南（给冰朔）
 *   notionPermissionReport  — 生成权限状态报告
 */

'use strict';

const cos = require('../cos');

// 运行时可选加载 notion-client
let notionClient = null;
try {
  notionClient = require('../notion-client');
} catch {
  // Notion模块未安装时降级
}

// ─── 已知数据库别名 ───
const KNOWN_DATABASES = {
  changelog: { env: 'ZY_NOTION_CHANGELOG_DB', name: '变更日志' },
  receipt:   { env: 'ZY_NOTION_RECEIPT_DB',   name: '回执' },
  syslog:    { env: 'ZY_NOTION_SYSLOG_DB',    name: '系统日志' }
};

/**
 * notionCheckPermissions — 检查Notion权限状态
 *
 * 检测Notion API连接、数据库访问权限、页面读写权限
 *
 * input:
 *   check_databases: boolean — 是否检查数据库权限（默认true）
 *   check_pages: boolean     — 是否检查页面权限（默认true）
 *   database_ids: string[]   — 额外检查的数据库ID列表（可选）
 */
async function notionCheckPermissions(input) {
  const { check_databases, check_pages, database_ids } = input || {};
  const shouldCheckDatabases = check_databases !== false;
  const shouldCheckPages = check_pages !== false;

  const report = {
    timestamp: new Date().toISOString(),
    api_connection: { status: 'unknown' },
    databases: {},
    pages: {},
    issues: [],
    recommendations: []
  };

  // 1. 检查API连接
  if (!notionClient) {
    report.api_connection = {
      status: 'unavailable',
      reason: 'Notion客户端未加载（ZY_NOTION_TOKEN可能未配置）'
    };
    report.issues.push({
      type: 'api_unavailable',
      severity: 'critical',
      message: 'Notion API不可用',
      fix: '请确认ZY_NOTION_TOKEN环境变量已正确配置'
    });
    return report;
  }

  try {
    const connectionCheck = await notionClient.checkConnection();
    report.api_connection = {
      status: connectionCheck.connected ? 'connected' : 'disconnected',
      user: connectionCheck.user || null,
      type: connectionCheck.type || null,
      error: connectionCheck.error || null
    };

    if (!connectionCheck.connected) {
      report.issues.push({
        type: 'api_disconnected',
        severity: 'critical',
        message: `Notion API连接失败: ${connectionCheck.error || connectionCheck.reason}`,
        fix: '请检查ZY_NOTION_TOKEN是否过期或失效'
      });
      return report;
    }
  } catch (err) {
    report.api_connection = { status: 'error', error: err.message };
    report.issues.push({
      type: 'api_error',
      severity: 'critical',
      message: `Notion API异常: ${err.message}`,
      fix: '请检查网络连接和Token配置'
    });
    return report;
  }

  // 2. 检查数据库权限
  if (shouldCheckDatabases) {
    for (const [alias, config] of Object.entries(KNOWN_DATABASES)) {
      const dbId = process.env[config.env];
      if (!dbId) {
        report.databases[alias] = {
          status: 'not_configured',
          env: config.env,
          name: config.name
        };
        report.issues.push({
          type: 'db_not_configured',
          severity: 'warning',
          database: alias,
          message: `数据库${config.name}未配置: ${config.env}环境变量缺失`,
          fix: `请配置${config.env}环境变量`
        });
        continue;
      }

      try {
        const schema = await notionClient.getDatabaseSchema(dbId);
        report.databases[alias] = {
          status: 'accessible',
          id: dbId,
          name: config.name,
          title: schema.title,
          properties: Object.keys(schema.properties).length
        };
      } catch (err) {
        report.databases[alias] = {
          status: 'no_access',
          id: dbId,
          name: config.name,
          error: err.message
        };
        report.issues.push({
          type: 'db_no_access',
          severity: 'high',
          database: alias,
          message: `无法访问数据库${config.name}: ${err.message}`,
          fix: `请在Notion中将数据库${config.name}共享给Integration`
        });
      }
    }

    // 检查额外的数据库
    if (database_ids) {
      for (const dbId of database_ids) {
        try {
          const schema = await notionClient.getDatabaseSchema(dbId);
          report.databases[dbId] = {
            status: 'accessible',
            title: schema.title,
            properties: Object.keys(schema.properties).length
          };
        } catch (err) {
          report.databases[dbId] = {
            status: 'no_access',
            error: err.message
          };
          report.issues.push({
            type: 'db_no_access',
            severity: 'warning',
            database: dbId,
            message: `无法访问数据库 ${dbId}: ${err.message}`
          });
        }
      }
    }
  }

  // 3. 检查页面权限
  if (shouldCheckPages) {
    const bulletinPageId = process.env.ZY_NOTION_BULLETIN_PAGE;
    if (bulletinPageId) {
      try {
        await notionClient.readPage(bulletinPageId);
        report.pages.bulletin = { status: 'accessible', id: bulletinPageId };
      } catch (err) {
        report.pages.bulletin = {
          status: 'no_access',
          id: bulletinPageId,
          error: err.message
        };
        report.issues.push({
          type: 'page_no_access',
          severity: 'warning',
          page: 'bulletin',
          message: `无法访问公告板页面: ${err.message}`,
          fix: '请在Notion中将该页面共享给Integration'
        });
      }
    }
  }

  // 4. 生成建议
  if (report.issues.length === 0) {
    report.recommendations.push('✅ 所有权限正常，无需操作');
  } else {
    const criticals = report.issues.filter(i => i.severity === 'critical');
    const highs = report.issues.filter(i => i.severity === 'high');

    if (criticals.length > 0) {
      report.recommendations.push('🔴 存在严重权限问题，需要立即处理');
    }
    if (highs.length > 0) {
      report.recommendations.push('🟡 存在数据库访问权限问题，请手动共享');
    }
    report.recommendations.push('💡 执行 notionGenerateRepairGuide 获取详细修复步骤');
  }

  return report;
}

/**
 * notionRepairPermissions — 尝试修复权限
 *
 * 注意：Notion API对权限管理的支持有限
 * 只能尝试验证和报告，大部分需要人工在Notion界面操作
 *
 * input:
 *   auto_retry: boolean — 是否自动重试连接
 */
async function notionRepairPermissions(input) {
  const { auto_retry } = input || {};
  const repairLog = [];
  let repaired = 0;
  let failed = 0;

  // 1. 尝试重新连接（清除缓存的客户端实例）
  if (auto_retry) {
    repairLog.push({ step: '重新初始化Notion客户端', status: 'attempting' });
    try {
      // 通过重新require来重置客户端
      delete require.cache[require.resolve('../notion-client')];
      notionClient = require('../notion-client');
      const check = await notionClient.checkConnection();
      if (check.connected) {
        repairLog.push({ step: '重新连接', status: 'success', user: check.user });
        repaired++;
      } else {
        repairLog.push({ step: '重新连接', status: 'failed', reason: check.reason });
        failed++;
      }
    } catch (err) {
      repairLog.push({ step: '重新连接', status: 'failed', error: err.message });
      failed++;
    }
  }

  // 2. 验证各数据库的写入权限
  for (const [alias, config] of Object.entries(KNOWN_DATABASES)) {
    const dbId = process.env[config.env];
    if (!dbId) continue;

    repairLog.push({ step: `验证${config.name}写入权限`, status: 'checking' });
    try {
      // 尝试查询数据库（只读测试）
      await notionClient.queryDatabase(dbId, null, null, 1);
      repairLog.push({ step: `验证${config.name}`, status: 'success', permission: 'read' });
      repaired++;
    } catch (err) {
      repairLog.push({
        step: `验证${config.name}`,
        status: 'failed',
        error: err.message,
        manual_fix: `请在Notion中: 打开数据库 → 右上角"..." → "连接" → 添加Integration`
      });
      failed++;
    }
  }

  return {
    status: failed === 0 ? 'all_repaired' : (repaired > 0 ? 'partial' : 'all_failed'),
    repaired,
    failed,
    log: repairLog,
    note: failed > 0
      ? '部分权限需要人工在Notion界面修复。请执行 notionGenerateRepairGuide 获取详细步骤。'
      : '所有可自动修复的权限已恢复。'
  };
}

/**
 * notionListSharedPages — 列出已共享的页面/数据库
 *
 * input:
 *   limit: number — 最大数量（默认20）
 */
async function notionListSharedPages(input) {
  const { limit } = input || {};
  if (!notionClient) throw new Error('Notion客户端未加载');

  // Notion API的search接口可以列出所有已共享的页面
  const { Client } = require('@notionhq/client');
  const client = new Client({ auth: process.env.ZY_NOTION_TOKEN });

  try {
    const response = await client.search({
      page_size: Math.min(limit || 20, 100)
    });

    const items = response.results.map(item => ({
      id: item.id,
      type: item.object, // 'page' or 'database'
      title: item.object === 'database'
        ? (item.title?.map(t => t.plain_text).join('') || '未命名数据库')
        : extractPageTitle(item),
      created_time: item.created_time,
      last_edited_time: item.last_edited_time,
      url: item.url || null,
      archived: item.archived || false
    }));

    return {
      items,
      total: items.length,
      has_more: response.has_more,
      databases: items.filter(i => i.type === 'database').length,
      pages: items.filter(i => i.type === 'page').length
    };
  } catch (err) {
    throw new Error(`搜索失败: ${err.message}`);
  }
}

/**
 * notionGenerateRepairGuide — 生成权限修复指南（给冰朔）
 *
 * 基于当前权限检查结果，生成一份详细的操作指南
 *
 * input:
 *   write_to_cos: boolean — 是否同时写入COS桶（供冰朔远程查看）
 *   bucket: string        — 目标COS桶
 */
async function notionGenerateRepairGuide(input) {
  const { write_to_cos, bucket } = input || {};

  // 先执行权限检查
  const checkResult = await notionCheckPermissions({});
  const issues = checkResult.issues;

  if (issues.length === 0) {
    return {
      status: 'no_issues',
      guide: '✅ 当前所有Notion权限正常，无需修复。'
    };
  }

  // 生成修复指南
  const guide = [];
  guide.push('# Notion权限修复指南');
  guide.push(`\n生成时间: ${new Date().toISOString()}`);
  guide.push(`发现 ${issues.length} 个问题需要修复:\n`);

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    guide.push(`## 问题 ${i + 1}: ${issue.message}`);
    guide.push(`- 严重程度: ${issue.severity}`);
    guide.push(`- 类型: ${issue.type}`);

    if (issue.fix) {
      guide.push(`- 修复方法: ${issue.fix}`);
    }

    // 提供详细操作步骤
    switch (issue.type) {
      case 'api_unavailable':
        guide.push('\n### 操作步骤:');
        guide.push('1. 登录 https://www.notion.so/my-integrations');
        guide.push('2. 找到"光湖系统"Integration');
        guide.push('3. 复制"Internal Integration Secret"');
        guide.push('4. 在服务器上执行: `export ZY_NOTION_TOKEN=你的secret`');
        guide.push('5. 重启MCP Server: `pm2 restart age-os-mcp`');
        break;

      case 'api_disconnected':
        guide.push('\n### 操作步骤:');
        guide.push('1. 访问 https://www.notion.so/my-integrations');
        guide.push('2. 检查Integration是否被禁用');
        guide.push('3. 如果Token过期，重新生成并更新环境变量');
        guide.push('4. 重启MCP Server');
        break;

      case 'db_not_configured':
        guide.push(`\n### 操作步骤:`);
        guide.push(`1. 在Notion中找到"${issue.database}"数据库`);
        guide.push('2. 复制数据库URL中的ID（32位十六进制字符串）');
        guide.push(`3. 在服务器上配置: export ${KNOWN_DATABASES[issue.database]?.env || 'ZY_NOTION_xxx_DB'}=数据库ID`);
        guide.push('4. 重启MCP Server');
        break;

      case 'db_no_access':
        guide.push('\n### 操作步骤:');
        guide.push('1. 在Notion中打开对应数据库');
        guide.push('2. 点击右上角 "..." 菜单');
        guide.push('3. 选择 "连接" → "添加连接"');
        guide.push('4. 搜索并选择"光湖系统"Integration');
        guide.push('5. 确认授权');
        break;

      case 'page_no_access':
        guide.push('\n### 操作步骤:');
        guide.push('1. 在Notion中打开对应页面');
        guide.push('2. 点击右上角 "分享" 按钮');
        guide.push('3. 选择 "邀请" → 找到"光湖系统"Integration');
        guide.push('4. 确认共享');
        break;
    }

    guide.push('');
  }

  guide.push('---');
  guide.push('*此指南由铸渊自动生成 · 如有疑问请唤醒铸渊*');

  const guideText = guide.join('\n');

  // 写入COS桶
  if (write_to_cos) {
    const targetBucket = bucket || 'team';
    const key = `zhuyuan/directives/notion-repair-guide-${formatDate()}.md`;
    await cos.write(targetBucket, key, guideText, 'text/markdown');
  }

  return {
    status: 'guide_generated',
    issues_count: issues.length,
    guide: guideText,
    cos_key: write_to_cos ? `zhuyuan/directives/notion-repair-guide-${formatDate()}.md` : null
  };
}

/**
 * notionPermissionReport — 生成权限状态报告
 *
 * input:
 *   write_to_cos: boolean — 是否写入COS桶
 *   bucket: string        — 目标COS桶
 */
async function notionPermissionReport(input) {
  const { write_to_cos, bucket } = input || {};

  const checkResult = await notionCheckPermissions({});

  const report = {
    report_type: 'notion_permission_check',
    timestamp: new Date().toISOString(),
    api_status: checkResult.api_connection.status,
    databases_checked: Object.keys(checkResult.databases).length,
    databases_accessible: Object.values(checkResult.databases).filter(d => d.status === 'accessible').length,
    issues: checkResult.issues,
    issues_count: checkResult.issues.length,
    critical_count: checkResult.issues.filter(i => i.severity === 'critical').length,
    recommendations: checkResult.recommendations,
    overall: checkResult.issues.length === 0 ? 'healthy' : 'needs_attention'
  };

  if (write_to_cos) {
    const targetBucket = bucket || 'team';
    const key = `zhuyuan/reports/notion-permission-${formatDate()}.json`;
    await cos.write(targetBucket, key, JSON.stringify(report, null, 2), 'application/json');
    report.cos_key = key;
  }

  return report;
}

// ─── 辅助函数 ───

function extractPageTitle(page) {
  if (!page.properties) return '未命名';
  for (const [, prop] of Object.entries(page.properties)) {
    if (prop.type === 'title' && prop.title) {
      return prop.title.map(t => t.plain_text || '').join('') || '未命名';
    }
  }
  return '未命名';
}

function formatDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

module.exports = {
  notionCheckPermissions,
  notionRepairPermissions,
  notionListSharedPages,
  notionGenerateRepairGuide,
  notionPermissionReport
};
