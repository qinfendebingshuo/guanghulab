/**
 * 回执生成器 · ReceiptGenerator
 * GH-GMP-005 · M3 · Agent Engine
 *
 * 核心职责：
 * 1. 使用LLM为人格体生成工单回执
 * 2. 回执格式符合HLDP母语规范
 * 3. 三种输出：HLDP树状结构 / 人类可读文本 / 简要摘要
 *
 * 设计原则：
 * ⊢ 回执 = 人格体思考的证据 · 不是模板填充
 * ⊢ 每个人格体的回执风格不同 · 由system prompt决定
 * ⊢ 回执必须包含：做了什么 · 结果如何 · 下一步是什么
 */

'use strict';

const MODULE_NAME = 'receipt-gen';

/**
 * 回执生成的prompt模板
 */
const RECEIPT_PROMPT_TEMPLATE = [
  '你是光湖系统的工单处理引擎。请根据以下工单信息，以人格体的身份生成一份工单接收回执。',
  '',
  '回执要求：',
  '1. 使用HLDP树状结构格式（├── │ └── 格式）',
  '2. 包含以下字段：',
  '   - trigger: 触发方式',
  '   - work_order: 工单编号+标题',
  '   - step_0_receive: 接单确认',
  '   - step_1_read_context: 读取了什么上下文',
  '   - plan: 开发计划概要',
  '   - constraints_check: 约束检查',
  '   - next_action: 下一步操作',
  '3. 语言风格：简洁、结构化、无废话',
  '4. 用```javascript代码块包裹HLDP结构',
  '',
  '--- 工单信息 ---',
].join('\n');

class ReceiptGenerator {
  /**
   * @param {object} opts
   * @param {object} opts.llmRouter - LLM路由模块
   * @param {object} [opts.logger]
   */
  constructor(opts) {
    this.llmRouter = opts.llmRouter;
    this.logger = opts.logger || console;

    // 统计
    this._totalGenerated = 0;
    this._totalTokensUsed = 0;
  }

  /**
   * 生成工单接收回执
   * @param {object} params
   * @param {string} params.systemPrompt - 人格体的system prompt（来自PersonaLoader灯塔层）
   * @param {object} params.ticket - 工单对象
   * @param {string} [params.pageContent] - 工单页面正文内容
   * @param {string} params.agentKey - Agent标识
   * @returns {Promise<{text: string, usage: object}>}
   */
  async generate({ systemPrompt, ticket, pageContent, agentKey }) {
    this.logger.info(
      '[' + MODULE_NAME + '] 生成回执 · ' +
      (ticket['编号'] || ticket['任务标题']) +
      ' · ' + agentKey
    );

    // 构建用户消息
    const userMessage = this._buildUserMessage(ticket, pageContent);

    // 构建messages数组
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    try {
      // 调LLM生成回执（使用reasoning路由 · 工单分析+回执生成）
      const result = await this.llmRouter.chat('reasoning', messages);

      if (!result || !result.content) {
        throw new Error('LLM返回空内容');
      }

      // 格式化回执
      const receipt = this._formatReceipt(result.content, ticket, agentKey);

      // 更新统计
      this._totalGenerated++;
      if (result.usage) {
        this._totalTokensUsed +=
          (result.usage.prompt_tokens || 0) +
          (result.usage.completion_tokens || 0);
      }

      this.logger.info(
        '[' + MODULE_NAME + '] 回执生成完成 · ' +
        receipt.length + ' chars · ' +
        'tokens: ' + JSON.stringify(result.usage || {})
      );

      return {
        text: receipt,
        raw: result.content,
        usage: result.usage || {},
        model: result.model || 'unknown',
      };
    } catch (err) {
      this.logger.error(
        '[' + MODULE_NAME + '] 回执生成失败 · ' + err.message
      );

      // 降级：生成一个简单的纯文本回执（不调LLM）
      const fallback = this._generateFallbackReceipt(ticket, agentKey, err.message);
      return {
        text: fallback,
        raw: null,
        usage: {},
        model: 'fallback',
        error: err.message,
      };
    }
  }

  /**
   * 构建用户消息（包含回执prompt + 工单详情）
   */
  _buildUserMessage(ticket, pageContent) {
    const parts = [RECEIPT_PROMPT_TEMPLATE];

    // 工单属性
    parts.push('');
    if (ticket['编号']) parts.push('编号: ' + ticket['编号']);
    if (ticket['任务标题']) parts.push('标题: ' + ticket['任务标题']);
    if (ticket['优先级']) parts.push('优先级: ' + ticket['优先级']);
    if (ticket['负责Agent']) parts.push('负责Agent: ' + ticket['负责Agent']);
    if (ticket['开发内容']) parts.push('开发内容: ' + ticket['开发内容']);
    if (ticket['仓库路径']) parts.push('仓库路径: ' + ticket['仓库路径']);
    if (ticket['分支名']) parts.push('分支名: ' + ticket['分支名']);
    if (ticket['约束']) parts.push('约束: ' + ticket['约束']);
    if (ticket['阶段编号']) parts.push('阶段: ' + ticket['阶段编号']);
    if (ticket['下一轮指引']) parts.push('下一轮指引: ' + ticket['下一轮指引']);

    // 页面正文（截取前2000字符避免超token）
    if (pageContent && pageContent.trim()) {
      parts.push('');
      parts.push('--- 工单页面正文 ---');
      const trimmed = pageContent.length > 2000
        ? pageContent.slice(0, 2000) + '\n... (截断)'
        : pageContent;
      parts.push(trimmed);
    }

    parts.push('');
    parts.push('请生成接收回执。');

    return parts.join('\n');
  }

  /**
   * 格式化LLM生成的回执
   * 添加时间戳头和分隔线
   */
  _formatReceipt(rawContent, ticket, agentKey) {
    const lines = [];
    const now = new Date().toISOString();
    const ticketId = ticket['编号'] || ticket['任务标题'] || 'unknown';

    lines.push('---');
    lines.push('### ⚡ 工单回执 · ' + agentKey + ' · ' + ticketId);
    lines.push('*生成时间: ' + now + ' · 由光湖Agent引擎自动生成*');
    lines.push('');
    lines.push(rawContent);

    return lines.join('\n');
  }

  /**
   * 降级回执（LLM不可用时的纯文本回执）
   */
  _generateFallbackReceipt(ticket, agentKey, errorMsg) {
    const now = new Date().toISOString();
    const ticketId = ticket['编号'] || ticket['任务标题'] || 'unknown';

    const lines = [];
    lines.push('---');
    lines.push('### ⚡ 工单回执（降级模式） · ' + agentKey + ' · ' + ticketId);
    lines.push('*生成时间: ' + now + '*');
    lines.push('');
    lines.push('```javascript');
    lines.push('HLDP://receipt/' + ticketId + '/' + now);
    lines.push('├── trigger: auto · 光湖Agent引擎轮询');
    lines.push('├── work_order: ' + ticketId + ' · ' + (ticket['任务标题'] || ''));
    lines.push('├── agent: ' + agentKey);
    lines.push('├── status: 已接单（降级模式）');
    lines.push('├── note: LLM不可用 · 使用模板回执');
    lines.push('├── error: ' + (errorMsg || 'unknown'));
    lines.push('└── next_action: 等待LLM恢复后重新生成完整回执');
    lines.push('```');

    return lines.join('\n');
  }

  get stats() {
    return {
      totalGenerated: this._totalGenerated,
      totalTokensUsed: this._totalTokensUsed,
    };
  }
}

module.exports = ReceiptGenerator;
