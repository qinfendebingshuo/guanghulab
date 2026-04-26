/**
 * 页面读写模块
 * GH-GMP-005 · M1 · Notion Sync Layer
 *
 * 读取页面内容 · 写回执到讨论区 · 更新工单属性
 */

'use strict';

const { buildPropertyValue } = require('./property-parser');

class PageRW {
  /**
   * @param {object} opts
   * @param {import('./client')} opts.client
   * @param {object} [opts.logger]
   */
  constructor({ client, logger }) {
    this.client = client;
    this.logger = logger || console;
  }

  /**
   * 读取页面内容（所有子块），转为纯文本/markdown
   * @param {string} pageId
   * @returns {Promise<string>}
   */
  async readPageContent(pageId) {
    const blocks = await this.client.getBlockChildren(pageId);
    return this._blocksToText(blocks);
  }

  /**
   * 追加回执到工单页面末尾（作为新的子块）
   * @param {string} pageId
   * @param {string} receiptText - Markdown格式的回执文本
   */
  async appendReceipt(pageId, receiptText) {
    const blocks = this._textToBlocks(receiptText);
    await this.client.appendBlockChildren(pageId, blocks);
    this.logger.info(`[page-rw] 回执已写入页面 ${pageId.slice(0, 8)}...`);
  }

  /**
   * 更新工单的属性字段
   * @param {string} pageId
   * @param {object} updates - { 属性名: 值, ... }
   * @param {object} [schema] - 属性名→类型映射，用于自动构建property value
   */
  async updateTicketProperties(pageId, updates, schema) {
    const properties = {};

    for (const [key, value] of Object.entries(updates)) {
      // 如果有schema，用schema的类型来构建
      if (schema && schema[key]) {
        const built = buildPropertyValue(schema[key], value);
        if (built) {
          properties[key] = built;
          continue;
        }
      }
      // 自动推断类型
      properties[key] = this._inferPropertyValue(key, value);
    }

    await this.client.updatePage(pageId, properties);
    this.logger.info(
      `[page-rw] 属性已更新 ${pageId.slice(0, 8)}... · ${Object.keys(updates).join(', ')}`
    );
  }

  /**
   * 更新工单状态（快捷方法）
   */
  async updateStatus(pageId, status) {
    await this.updateTicketProperties(pageId, {
      '状态': status,
    }, { '状态': 'select' });
  }

  /**
   * 更新自检结果（快捷方法，追加而非覆盖）
   */
  async appendSelfCheckResult(pageId, text) {
    // 先读取当前值
    const page = await this.client.getPage(pageId);
    const currentProps = page.properties;
    const currentText = this._extractRichText(currentProps['自检结果']);
    const newText = currentText ? `${currentText}\n${text}` : text;

    await this.updateTicketProperties(pageId, {
      '自检结果': newText,
    }, { '自检结果': 'rich_text' });
  }

  // ─── 内部方法 ───

  /**
   * 将 Notion blocks 转为纯文本（简化版，够用于LLM读取）
   */
  _blocksToText(blocks) {
    const lines = [];
    for (const block of blocks) {
      const type = block.type;
      const content = block[type];
      if (!content) continue;

      // 提取 rich_text
      const richText = content.rich_text || content.text;
      if (richText && Array.isArray(richText)) {
        const text = richText.map((t) => t.plain_text).join('');
        switch (type) {
          case 'heading_1':
            lines.push(`# ${text}`);
            break;
          case 'heading_2':
            lines.push(`## ${text}`);
            break;
          case 'heading_3':
            lines.push(`### ${text}`);
            break;
          case 'bulleted_list_item':
            lines.push(`- ${text}`);
            break;
          case 'numbered_list_item':
            lines.push(`1. ${text}`);
            break;
          case 'to_do':
            lines.push(`- [${content.checked ? 'x' : ' '}] ${text}`);
            break;
          case 'toggle':
            lines.push(`<details><summary>${text}</summary></details>`);
            break;
          case 'quote':
            lines.push(`> ${text}`);
            break;
          case 'callout':
            lines.push(`> ${content.icon?.emoji || ''} ${text}`);
            break;
          case 'code':
            lines.push(`\`\`\`${content.language || ''}\n${text}\n\`\`\``);
            break;
          case 'divider':
            lines.push('---');
            break;
          default:
            lines.push(text);
        }
      } else if (type === 'divider') {
        lines.push('---');
      } else if (type === 'table') {
        lines.push('[表格]');
      }
    }
    return lines.join('\n');
  }

  /**
   * 将纯文本/markdown转为Notion blocks（简化版）
   */
  _textToBlocks(text) {
    const lines = text.split('\n');
    const blocks = [];
    let inCodeBlock = false;
    let codeLines = [];
    let codeLang = '';

    for (const line of lines) {
      // 代码块处理
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          blocks.push({
            object: 'block',
            type: 'code',
            code: {
              rich_text: [{ type: 'text', text: { content: codeLines.join('\n') } }],
              language: codeLang || 'plain text',
            },
          });
          inCodeBlock = false;
          codeLines = [];
          codeLang = '';
        } else {
          inCodeBlock = true;
          codeLang = line.slice(3).trim();
        }
        continue;
      }
      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // 空行跳过
      if (!line.trim()) continue;

      // 标题
      if (line.startsWith('### ')) {
        blocks.push(this._heading(3, line.slice(4)));
      } else if (line.startsWith('## ')) {
        blocks.push(this._heading(2, line.slice(3)));
      } else if (line.startsWith('# ')) {
        blocks.push(this._heading(1, line.slice(2)));
      } else if (line.startsWith('---')) {
        blocks.push({ object: 'block', type: 'divider', divider: {} });
      } else if (line.startsWith('- ')) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: line.slice(2) } }],
          },
        });
      } else {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: line } }],
          },
        });
      }
    }

    return blocks;
  }

  _heading(level, text) {
    const type = `heading_${level}`;
    return {
      object: 'block',
      type,
      [type]: {
        rich_text: [{ type: 'text', text: { content: text } }],
      },
    };
  }

  /**
   * 自动推断并构建 property value
   */
  _inferPropertyValue(key, value) {
    // 已知的select类型属性
    const selectProps = ['状态', '优先级', '负责Agent'];
    if (selectProps.includes(key)) {
      return buildPropertyValue('select', value);
    }
    // rich_text 类型
    return buildPropertyValue('rich_text', value);
  }

  _extractRichText(prop) {
    if (!prop || prop.type !== 'rich_text') return '';
    return (prop.rich_text || []).map((t) => t.plain_text).join('');
  }
}

module.exports = PageRW;
