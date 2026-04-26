/**
 * 工单数据库读取器
 * GH-GMP-005 · M1 · Notion Sync Layer
 *
 * 读取半体工单数据库，解析工单属性
 */

'use strict';

const { parseAllProperties } = require('./property-parser');

/**
 * 工单字段映射（Notion属性名 → 工单对象键名）
 * 保持与半体工单数据库schema完全一致
 */
const TICKET_FIELDS = [
  '任务标题', '编号', '状态', '优先级', '负责Agent',
  '开发内容', '约束', '仓库路径', '分支名', '阶段编号',
  '自检结果', '审核结果', '下一轮指引', '创建时间',
];

class DBReader {
  /**
   * @param {object} opts
   * @param {import('./client')} opts.client - NotionSyncClient实例
   * @param {string} opts.databaseId - 半体工单数据库ID
   * @param {object} [opts.logger]
   */
  constructor({ client, databaseId, logger }) {
    this.client = client;
    this.databaseId = databaseId;
    this.logger = logger || console;
  }

  /**
   * 查询指定状态的工单
   * @param {string} status - 如 '待开发', '开发中', '待审查'
   * @returns {Promise<Array>}
   */
  async queryByStatus(status) {
    const filter = {
      property: '状态',
      select: { equals: status },
    };
    const sorts = [{ property: '创建时间', direction: 'descending' }];
    const results = await this.client.queryDatabaseAll(
      this.databaseId, filter, sorts
    );
    return results.map((page) => this._parseTicket(page));
  }

  /**
   * 查询指定Agent负责的工单
   * @param {string} agentName - 如 '译典A05'
   * @param {string} [status] - 可选状态过滤
   */
  async queryByAgent(agentName, status) {
    const conditions = [
      {
        property: '负责Agent',
        select: { equals: agentName },
      },
    ];
    if (status) {
      conditions.push({
        property: '状态',
        select: { equals: status },
      });
    }
    const filter = conditions.length === 1
      ? conditions[0]
      : { and: conditions };
    const results = await this.client.queryDatabaseAll(
      this.databaseId, filter
    );
    return results.map((page) => this._parseTicket(page));
  }

  /**
   * 查询最近更新的工单（用于轮询检测变更）
   * @param {string} since - ISO 8601 时间戳
   */
  async queryUpdatedSince(since) {
    const filter = {
      timestamp: 'last_edited_time',
      last_edited_time: { after: since },
    };
    const sorts = [{ timestamp: 'last_edited_time', direction: 'descending' }];
    const results = await this.client.queryDatabaseAll(
      this.databaseId, filter, sorts
    );
    return results.map((page) => this._parseTicket(page));
  }

  /**
   * 查询待处理工单（状态=待开发 且 有负责Agent）
   */
  async queryPendingTickets() {
    const filter = {
      and: [
        { property: '状态', select: { equals: '待开发' } },
        { property: '负责Agent', select: { is_not_empty: true } },
      ],
    };
    const results = await this.client.queryDatabaseAll(
      this.databaseId, filter
    );
    return results.map((page) => this._parseTicket(page));
  }

  /**
   * 获取单个工单（通过页面ID）
   */
  async getTicket(pageId) {
    const page = await this.client.getPage(pageId);
    return this._parseTicket(page);
  }

  /**
   * 解析 Notion page → 工单对象
   */
  _parseTicket(page) {
    const props = parseAllProperties(page.properties);
    return {
      pageId: page.id,
      url: page.url,
      lastEditedTime: page.last_edited_time,
      createdTime: page.created_time,
      ...props,
    };
  }
}

module.exports = DBReader;
