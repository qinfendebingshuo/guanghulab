/**
 * Notion 数据库 ID 映射配置
 *
 * 所有 ID 通过环境变量传入，禁止硬编码
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

module.exports = {
  // 主控台（开发者当前任务）
  controlPanel: process.env.NOTION_CONTROL_PANEL_DB_ID || '',

  // SYSLOG 收件箱
  syslogInbox: process.env.NOTION_SYSLOG_DB_ID || '',

  // Agent 注册表
  agentRegistry: process.env.NOTION_AGENT_REGISTRY_DB_ID || '',

  // 工单簿
  ticketBook: process.env.NOTION_TICKET_DB_ID || '',

  // 维护日志
  maintenanceLog: process.env.NOTION_MAINTENANCE_DB_ID || '',

  // 指令回执追踪表
  receiptTracker: process.env.RECEIPT_DB_ID || '',

  // 模块指纹注册表
  moduleRegistry: process.env.NOTION_MODULE_REGISTRY_DB_ID || '',
};
