/**
 * Notion 数据库桥接模块
 * 通过 Notion API 读写数据库，供人格体引擎调用
 *
 * 功能:
 *   - 查询数据库（带过滤/排序）
 *   - 读取页面内容
 *   - 创建页面
 *   - 更新页面属性
 *
 * 需要环境变量: ZY_NOTION_TOKEN
 */
const axios = require('axios');
const config = require('../config');

const NOTION_VERSION = '2022-06-28';

class NotionBridge {
  constructor() {
    this.baseUrl = 'https://api.notion.com/v1';
  }

  _getHeaders() {
    const token = config.notion.token;
    if (!token) throw new Error('Notion API Token 未配置 (ZY_NOTION_TOKEN)');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    };
  }

  /**
   * 查询数据库
   * @param {string} databaseId - 数据库ID
   * @param {object} [filter] - Notion filter 对象
   * @param {Array} [sorts] - Notion sorts 数组
   * @param {number} [pageSize] - 每页数量，默认10
   * @returns {Promise<Array>} 页面列表
   */
  async queryDatabase(databaseId, { filter, sorts, pageSize = 10 } = {}) {
    console.log(`[Notion] 查询数据库: ${databaseId}`);

    const payload = { page_size: pageSize };
    if (filter) payload.filter = filter;
    if (sorts) payload.sorts = sorts;

    try {
      const resp = await axios.post(
        `${this.baseUrl}/databases/${databaseId}/query`,
        payload,
        { headers: this._getHeaders(), timeout: 15000 }
      );

      const results = resp.data.results || [];
      console.log(`[Notion] ✅ 查询到 ${results.length} 条记录`);

      // 简化返回格式
      return results.map(page => this._simplifyPage(page));
    } catch (err) {
      this._handleError('查询数据库', err);
    }
  }

  /**
   * 读取单个页面
   * @param {string} pageId
   * @returns {Promise<object>}
   */
  async getPage(pageId) {
    console.log(`[Notion] 读取页面: ${pageId}`);
    try {
      const resp = await axios.get(
        `${this.baseUrl}/pages/${pageId}`,
        { headers: this._getHeaders(), timeout: 10000 }
      );
      return this._simplifyPage(resp.data);
    } catch (err) {
      this._handleError('读取页面', err);
    }
  }

  /**
   * 读取页面内容块
   * @param {string} pageId
   * @returns {Promise<string>} 纯文本内容
   */
  async getPageContent(pageId) {
    console.log(`[Notion] 读取页面内容: ${pageId}`);
    try {
      const resp = await axios.get(
        `${this.baseUrl}/blocks/${pageId}/children?page_size=100`,
        { headers: this._getHeaders(), timeout: 15000 }
      );
      const blocks = resp.data.results || [];
      return blocks.map(b => this._blockToText(b)).filter(Boolean).join('\n');
    } catch (err) {
      this._handleError('读取页面内容', err);
    }
  }

  /**
   * 创建页面
   * @param {string} databaseId - 父数据库ID
   * @param {object} properties - 属性对象
   * @param {string} [content] - 可选的页面内容文本
   * @returns {Promise<object>}
   */
  async createPage(databaseId, properties, content) {
    console.log(`[Notion] 创建页面到数据库: ${databaseId}`);
    const payload = {
      parent: { database_id: databaseId },
      properties,
    };

    if (content) {
      payload.children = [{
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content } }]
        }
      }];
    }

    try {
      const resp = await axios.post(
        `${this.baseUrl}/pages`,
        payload,
        { headers: this._getHeaders(), timeout: 15000 }
      );
      console.log(`[Notion] ✅ 页面已创建: ${resp.data.id}`);
      return this._simplifyPage(resp.data);
    } catch (err) {
      this._handleError('创建页面', err);
    }
  }

  /**
   * 更新页面属性
   * @param {string} pageId
   * @param {object} properties
   * @returns {Promise<object>}
   */
  async updatePage(pageId, properties) {
    console.log(`[Notion] 更新页面: ${pageId}`);
    try {
      const resp = await axios.patch(
        `${this.baseUrl}/pages/${pageId}`,
        { properties },
        { headers: this._getHeaders(), timeout: 10000 }
      );
      console.log(`[Notion] ✅ 页面已更新: ${pageId}`);
      return this._simplifyPage(resp.data);
    } catch (err) {
      this._handleError('更新页面', err);
    }
  }

  /**
   * 搜索 Notion 内容
   * @param {string} query - 搜索关键词
   * @param {number} [pageSize] - 结果数量
   * @returns {Promise<Array>}
   */
  async search(query, pageSize = 5) {
    console.log(`[Notion] 搜索: "${query}"`);
    try {
      const resp = await axios.post(
        `${this.baseUrl}/search`,
        { query, page_size: pageSize },
        { headers: this._getHeaders(), timeout: 15000 }
      );
      const results = resp.data.results || [];
      console.log(`[Notion] ✅ 搜索到 ${results.length} 条结果`);
      return results.map(r => this._simplifyPage(r));
    } catch (err) {
      this._handleError('搜索', err);
    }
  }

  // ── 内部工具方法 ──────────────────────────────────

  _simplifyPage(page) {
    const props = {};
    if (page.properties) {
      for (const [key, val] of Object.entries(page.properties)) {
        props[key] = this._extractPropertyValue(val);
      }
    }
    return {
      id: page.id,
      url: page.url,
      createdTime: page.created_time,
      lastEditedTime: page.last_edited_time,
      properties: props,
    };
  }

  _extractPropertyValue(prop) {
    if (!prop) return null;
    switch (prop.type) {
      case 'title':
        return prop.title?.map(t => t.plain_text).join('') || '';
      case 'rich_text':
        return prop.rich_text?.map(t => t.plain_text).join('') || '';
      case 'number':
        return prop.number;
      case 'select':
        return prop.select?.name || null;
      case 'multi_select':
        return prop.multi_select?.map(s => s.name) || [];
      case 'status':
        return prop.status?.name || null;
      case 'checkbox':
        return prop.checkbox;
      case 'date':
        return prop.date?.start || null;
      case 'url':
        return prop.url;
      case 'email':
        return prop.email;
      case 'phone_number':
        return prop.phone_number;
      case 'people':
        return prop.people?.map(p => p.name || p.id) || [];
      case 'relation':
        return prop.relation?.map(r => r.id) || [];
      case 'formula':
        return prop.formula?.[prop.formula?.type] || null;
      case 'created_time':
        return prop.created_time;
      case 'last_edited_time':
        return prop.last_edited_time;
      default:
        return `[${prop.type}]`;
    }
  }

  _blockToText(block) {
    const type = block.type;
    const data = block[type];
    if (!data) return '';

    if (data.rich_text) {
      return data.rich_text.map(t => t.plain_text).join('');
    }
    if (type === 'child_database') return `[数据库: ${data.title}]`;
    if (type === 'child_page') return `[子页面: ${data.title}]`;
    if (type === 'divider') return '---';
    return '';
  }

  _handleError(action, err) {
    if (err.response) {
      const msg = err.response.data?.message || JSON.stringify(err.response.data);
      throw new Error(`Notion ${action}失败(${err.response.status}): ${msg}`);
    }
    throw err;
  }
}

module.exports = new NotionBridge();
