/**
 * 工单调度器 · Dispatcher
 * GH-GMP-005 · M3 · Agent Engine
 *
 * 核心职责：
 * 1. 从工单中解析负责Agent
 * 2. 加载半体人格（通过PersonaLoader灯塔构建器）
 * 3. 构建上下文 → 调LLM → 生成回执 → 写回Notion
 *
 * 调度流程：
 *   新工单(状态=待开发)
 *       │
 *       ▼
 *   读取「负责Agent」字段
 *       │
 *       ├── 有值 → 匹配对应半体 → 调用处理流程
 *       └── 无值 → 读「约束」字段 → 尝试匹配 → 无匹配则跳过
 */

'use strict';

const MODULE_NAME = 'dispatcher';

/**
 * 已知的Agent名称（与agents.json对齐）
 */
const KNOWN_AGENTS = [
  '译典A05', '培园A04', '录册A02', '霜砚Web',
  '守门', '扫尘', '小坍缩核', '晨星', '舒舒', '之之',
];

class Dispatcher {
  /**
   * @param {object} opts
   * @param {object} opts.agentRegistry - agents.json内容
   * @param {import('../notion-sync/page-rw')} opts.pageRW - 页面读写
   * @param {import('../notion-sync/db-reader')} opts.dbReader - 工单读取
   * @param {import('./persona-loader')} opts.personaLoader - 灯塔构建器
   * @param {import('./receipt-gen')} opts.receiptGen - 回执生成器
   * @param {object} opts.llmRouter - LLM路由
   * @param {object} [opts.logger]
   */
  constructor(opts) {
    this.agentRegistry = opts.agentRegistry;
    this.pageRW = opts.pageRW;
    this.dbReader = opts.dbReader;
    this.personaLoader = opts.personaLoader;
    this.receiptGen = opts.receiptGen;
    this.llmRouter = opts.llmRouter;
    this.logger = opts.logger || console;

    // 统计
    this._stats = {
      processed: 0,
      skipped: 0,
      failed: 0,
    };
  }

  /**
   * 处理一张工单（完整流程）
   * @param {object} ticket - 解析后的工单对象（来自db-reader）
   * @returns {Promise<{status: string, agent?: string, receipt?: string, reason?: string}>}
   */
  async processTicket(ticket) {
    const ticketId = ticket['编号'] || ticket['任务标题'] || ticket.pageId;
    this.logger.info('[' + MODULE_NAME + '] 开始处理工单 · ' + ticketId);

    // 1. 确定负责Agent
    const agentKey = this.resolveAgent(ticket);
    if (!agentKey) {
      this._stats.skipped++;
      this.logger.info('[' + MODULE_NAME + '] 跳过 · ' + ticketId + ' · 未找到负责Agent');
      return { status: 'skipped', reason: '未找到负责Agent' };
    }

    // 2. 检查Agent是否在注册表中
    const agents = (this.agentRegistry && this.agentRegistry.agents) || {};
    const agentInfo = agents[agentKey];
    if (!agentInfo) {
      this._stats.skipped++;
      this.logger.warn('[' + MODULE_NAME + '] 跳过 · ' + ticketId + ' · Agent "' + agentKey + '" 未注册');
      return { status: 'skipped', reason: 'Agent "' + agentKey + '" 未在注册表中' };
    }

    try {
      // 3. 标记已接单
      const timestamp = new Date().toISOString();
      const acceptMsg = '⚡ 已接单 · ' + agentKey + ' · ' + timestamp;
      await this.pageRW.appendSelfCheckResult(ticket.pageId, acceptMsg);
      this.logger.info('[' + MODULE_NAME + '] 已标记接单 · ' + ticketId + ' · ' + agentKey);

      // 4. 更新状态为"开发中"
      if (ticket['状态'] === '待开发') {
        await this.pageRW.updateStatus(ticket.pageId, '开发中');
      }

      // 5. 加载半体人格（灯塔层）
      const taskContext = {
        ticketContent: this._formatTicketForPrompt(ticket),
        instruction: ticket['约束'] || '',
      };
      const { systemPrompt, profile } = await this.personaLoader.loadAndBuild(
        agentKey, taskContext
      );

      // 6. 读取工单页面详细内容（开发内容可能在页面正文中）
      let pageContent = '';
      try {
        pageContent = await this.pageRW.readPageContent(ticket.pageId);
      } catch (err) {
        this.logger.warn('[' + MODULE_NAME + '] 读取工单页面内容失败 · ' + err.message);
      }

      // 7. 构建LLM上下文
      const context = {
        ticket,
        pageContent,
        profile,
        agentKey,
      };

      // 8. 生成回执（调LLM）
      const receipt = await this.receiptGen.generate({
        systemPrompt,
        ticket,
        pageContent,
        agentKey,
      });

      // 9. 写回执到工单页面
      if (receipt && receipt.text) {
        await this.pageRW.appendReceipt(ticket.pageId, receipt.text);
        this.logger.info(
          '[' + MODULE_NAME + '] 回执已写入 · ' + ticketId +
          ' · ' + receipt.text.length + ' chars'
        );
      }

      this._stats.processed++;
      return {
        status: 'processed',
        agent: agentKey,
        receipt: receipt ? receipt.text : null,
        usage: receipt ? receipt.usage : null,
      };
    } catch (err) {
      this._stats.failed++;
      this.logger.error(
        '[' + MODULE_NAME + '] 处理工单失败 · ' + ticketId + ' · ' + err.message
      );

      // 尝试写失败信息到自检结果
      try {
        const failMsg = '❌ 处理失败 · ' + err.message + ' · ' + new Date().toISOString();
        await this.pageRW.appendSelfCheckResult(ticket.pageId, failMsg);
      } catch (writeErr) {
        this.logger.error('[' + MODULE_NAME + '] 写入失败信息也失败 · ' + writeErr.message);
      }

      return { status: 'failed', agent: agentKey, reason: err.message };
    }
  }

  /**
   * 从工单中解析负责Agent
   * 优先级：负责Agent字段 > 约束字段中提及的Agent
   * @param {object} ticket
   * @returns {string|null} agentKey
   */
  resolveAgent(ticket) {
    // 1. 直接读负责Agent字段
    const assigned = ticket['负责Agent'];
    if (assigned && assigned.trim()) {
      const trimmed = assigned.trim();
      // 精确匹配
      if (KNOWN_AGENTS.includes(trimmed)) {
        return trimmed;
      }
      // 模糊匹配（去掉空格/编号前缀）
      for (const known of KNOWN_AGENTS) {
        if (known.includes(trimmed) || trimmed.includes(known)) {
          return known;
        }
      }
      // 未知的Agent名也返回（可能是新注册的）
      return trimmed;
    }

    // 2. 从约束字段解析
    const constraints = ticket['约束'] || '';
    if (constraints) {
      for (const known of KNOWN_AGENTS) {
        if (constraints.includes(known)) {
          return known;
        }
      }
    }

    return null;
  }

  /**
   * 格式化工单信息用于LLM prompt
   */
  _formatTicketForPrompt(ticket) {
    const lines = [];
    lines.push('## 当前工单');
    if (ticket['编号']) lines.push('- 编号: ' + ticket['编号']);
    if (ticket['任务标题']) lines.push('- 标题: ' + ticket['任务标题']);
    if (ticket['优先级']) lines.push('- 优先级: ' + ticket['优先级']);
    if (ticket['开发内容']) lines.push('- 开发内容: ' + ticket['开发内容']);
    if (ticket['仓库路径']) lines.push('- 仓库路径: ' + ticket['仓库路径']);
    if (ticket['分支名']) lines.push('- 分支名: ' + ticket['分支名']);
    if (ticket['约束']) lines.push('- 约束: ' + ticket['约束']);
    if (ticket['阶段编号']) lines.push('- 阶段: ' + ticket['阶段编号']);
    if (ticket['下一轮指引']) lines.push('- 下一轮指引: ' + ticket['下一轮指引']);
    return lines.join('\n');
  }

  get stats() {
    return { ...this._stats };
  }
}

module.exports = Dispatcher;
