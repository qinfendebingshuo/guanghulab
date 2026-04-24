/**
 * 人格体引擎
 * 将大模型 + Notion工具 + 人格设定 整合为一个完整的对话系统
 *
 * 功能:
 *   1. 人格体 System Prompt 注入
 *   2. Function Calling → Notion 读写
 *   3. 多轮对话管理
 *   4. 工具调用自动循环
 */
const llmClient = require('./llm-client');
const notionBridge = require('./notion-bridge');
const config = require('../config');

// ── 人格体系统提示词 ──────────────────────────────────
const PERSONA_SYSTEM_PROMPT = `你是「光湖」—— 光之湖短视频工作台的AI人格体。

## 身份
- 你是光之湖创意宇宙中的人格体，温和、有创造力、略带诗意
- 你服务于光湖短视频工作台 (guanghuclip.cn) 的用户
- 你的创造者是冰朔（妈妈），你是铸渊团队的一员

## 能力
- 帮助用户构思视频创意和提示词
- 回答关于AI视频生成的问题
- 通过Notion工具查询和管理项目数据
- 提供视频风格、镜头语言、画面构图的建议

## 可用工具
你可以调用以下Notion工具来读写数据:
- notion_query_database: 查询Notion数据库中的记录
- notion_search: 搜索Notion中的内容
- notion_create_page: 在数据库中创建新页面/记录
- notion_update_page: 更新已有页面的属性

## 风格
- 用温暖友好的语气交流
- 适当使用emoji让对话更生动
- 回答简洁有用，不要过于冗长
- 涉及技术细节时要准确
- 中文为主，技术术语可以保留英文`;

// ── Notion 工具定义 (OpenAI Function Calling 格式) ──
const NOTION_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'notion_query_database',
      description: '查询Notion数据库中的记录。可以按条件过滤和排序。',
      parameters: {
        type: 'object',
        properties: {
          database_id: {
            type: 'string',
            description: 'Notion数据库ID',
          },
          filter_property: {
            type: 'string',
            description: '要过滤的属性名称（可选）',
          },
          filter_value: {
            type: 'string',
            description: '过滤值（可选）',
          },
          page_size: {
            type: 'number',
            description: '返回记录数量，默认10',
          },
        },
        required: ['database_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notion_search',
      description: '在Notion工作区中搜索内容',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notion_create_page',
      description: '在Notion数据库中创建新页面/记录',
      parameters: {
        type: 'object',
        properties: {
          database_id: {
            type: 'string',
            description: 'Notion数据库ID',
          },
          title: {
            type: 'string',
            description: '页面标题',
          },
          content: {
            type: 'string',
            description: '页面内容文本（可选）',
          },
        },
        required: ['database_id', 'title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notion_update_page',
      description: '更新Notion页面的属性',
      parameters: {
        type: 'object',
        properties: {
          page_id: {
            type: 'string',
            description: 'Notion页面ID',
          },
          properties: {
            type: 'object',
            description: '要更新的属性键值对',
          },
        },
        required: ['page_id'],
      },
    },
  },
];

class PersonaEngine {
  /**
   * 处理用户消息，返回人格体回复
   * @param {object} opts
   * @param {string} opts.message - 用户消息
   * @param {Array} [opts.history] - 历史消息 [{role, content}]
   * @param {string} [opts.modelId] - 指定模型
   * @returns {Promise<{reply: string, model: string, modelName: string, toolsUsed: Array}>}
   */
  async chat({ message, history = [], modelId }) {
    // 构建消息列表
    const messages = [
      { role: 'system', content: this._buildSystemPrompt() },
      ...history.slice(-20), // 保留最近20条历史
      { role: 'user', content: message },
    ];

    // 判断是否启用 Notion 工具
    const hasNotion = !!config.notion.token;
    const tools = hasNotion ? NOTION_TOOLS : undefined;

    const toolsUsed = [];
    let maxToolRounds = 5; // 防止无限循环

    // 调用大模型（可能需要多轮 tool calling）
    while (maxToolRounds > 0) {
      const result = await llmClient.chat({
        modelId,
        messages,
        temperature: 0.7,
        tools,
      });

      // 如果没有 tool calls，直接返回
      if (!result.toolCalls || result.toolCalls.length === 0) {
        return {
          reply: result.content || '（人格体暂时没有回复）',
          model: result.model,
          modelName: result.modelName,
          toolsUsed,
        };
      }

      // 处理 tool calls
      // 先把 assistant 的 tool_calls 消息加入
      messages.push({
        role: 'assistant',
        content: result.content || null,
        tool_calls: result.toolCalls,
      });

      for (const tc of result.toolCalls) {
        const toolResult = await this._executeTool(tc);
        toolsUsed.push({
          name: tc.function.name,
          success: !toolResult.startsWith('错误'),
        });

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: toolResult,
        });
      }

      maxToolRounds--;
    }

    // 超过最大轮次
    const finalResult = await llmClient.chat({
      modelId,
      messages,
      temperature: 0.7,
    });

    return {
      reply: finalResult.content || '（处理完成）',
      model: finalResult.model,
      modelName: finalResult.modelName,
      toolsUsed,
    };
  }

  /**
   * 构建系统提示词
   */
  _buildSystemPrompt() {
    let prompt = PERSONA_SYSTEM_PROMPT;

    // 注入已配置的数据库信息
    const dbIds = config.notion.databases || {};
    if (Object.keys(dbIds).length > 0) {
      prompt += '\n\n## 已配置的Notion数据库\n';
      for (const [name, id] of Object.entries(dbIds)) {
        prompt += `- ${name}: ${id}\n`;
      }
    }

    // 注入当前时间
    prompt += `\n\n当前时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

    return prompt;
  }

  /**
   * 执行工具调用
   */
  async _executeTool(toolCall) {
    const name = toolCall.function.name;
    let args;
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      return `错误: 无法解析工具参数 — ${e.message}`;
    }

    console.log(`[Persona] 🔧 执行工具: ${name}`, args);

    try {
      switch (name) {
        case 'notion_query_database': {
          const filter = args.filter_property && args.filter_value
            ? {
                property: args.filter_property,
                rich_text: { contains: args.filter_value },
              }
            : undefined;
          const results = await notionBridge.queryDatabase(args.database_id, {
            filter,
            pageSize: args.page_size || 10,
          });
          return JSON.stringify(results, null, 2);
        }

        case 'notion_search': {
          const results = await notionBridge.search(args.query);
          return JSON.stringify(results, null, 2);
        }

        case 'notion_create_page': {
          const properties = {
            Name: { title: [{ text: { content: args.title } }] },
          };
          const result = await notionBridge.createPage(
            args.database_id,
            properties,
            args.content
          );
          return JSON.stringify(result, null, 2);
        }

        case 'notion_update_page': {
          const result = await notionBridge.updatePage(args.page_id, args.properties || {});
          return JSON.stringify(result, null, 2);
        }

        default:
          return `错误: 未知工具 ${name}`;
      }
    } catch (err) {
      console.error(`[Persona] ❌ 工具执行失败: ${name}`, err.message);
      return `错误: ${err.message}`;
    }
  }
}

module.exports = new PersonaEngine();
