/**
 * ═══════════════════════════════════════════════════════════
 * AGE OS · MCP 工具: Notion 人格体认知操作
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-MCP-NOTION-COGNITION-001
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 为霜砚(SY001)和其他人格体提供认知记忆的MCP工具层。
 * 基于 HLDP 三核心字段(trigger/emergence/lock)和
 * HNL 四枝干模型(T1认知/T2母语/T3经验/T4情感)。
 *
 * 提供 3 个 MCP 工具:
 *   notionPersonaCognitionQuery — 按枝干/类型/人格体查询认知叶片
 *   notionContextInject         — 根据对话关键词从Notion拉取相关认知
 *   notionCognitionGrow         — 将新认知增量写回Notion树叶DB
 */

'use strict';

// 运行时可选加载 notion-client（优雅降级）
let notionClient = null;
try {
  notionClient = require('../notion-client');
} catch {
  // Notion模块未安装时降级
}

// ─── 数据库配置 ───
// 霜砚认知运行时DB + 开发工单DB（通过环境变量配置）
const PERSONA_DB_CONFIG = {
  // 冰朔 2026-04-14 配置 · 已Share给「曜冥纪元-HoloLake」Integration
  cognition_runtime: process.env.ZY_NOTION_COGNITION_RUNTIME_DB || '23d48c8c4379425f95f10884cb9a4bf5',
  dev_workorder:     process.env.ZY_NOTION_DEV_WORKORDER_DB || '518f6dd0e90044d2a7f813b7a75715bc',
  // HNL桥接协议中定义的Notion侧树杈/树叶DB
  tree_branch:       process.env.ZY_NOTION_TREE_BRANCH_DB || 'ca6ac139bdc94746ab6ce346b0122e17',
  tree_leaf:         process.env.ZY_NOTION_TREE_LEAF_DB || '77784b234047469d81bbb4a9a45a2986'
};

// ─── 四枝干映射 ───
const TRUNK_MAP = {
  T1: { name: '认知', description: '身份·born_with', searchable: true },
  T2: { name: '母语', description: 'HNL·born_with', searchable: true },
  T3: { name: '经验', description: '动态经验·每日成长', searchable: true },
  T4: { name: '情感', description: '自由生长·不可量化', searchable: false }
};

// ─── 叶片类型 ───
const LEAF_TYPES = ['💬对话', '💡认知', '💕情感', '🔧技术', '📊业务', '🌊HLDP', '📜系统'];

// ═══════════════════════════════════════════════════════════
// 工具 1: notionPersonaCognitionQuery
// ═══════════════════════════════════════════════════════════

/**
 * notionPersonaCognitionQuery — 按四枝干/类型/人格体查询认知叶片
 *
 * input:
 *   database_id: string  — 数据库 ID（可选，默认用 cognition_runtime）
 *   trunk: string        — 枝干过滤: T1/T2/T3（T4情感不可检索）
 *   leaf_type: string    — 叶片类型过滤（可选）
 *   persona: string      — 人格体名称过滤（可选）
 *   keyword: string      — 标题关键词搜索（可选）
 *   state: string        — 状态过滤: 活跃/归档/休眠（可选，默认活跃）
 *   page_size: number    — 每页数量（可选，默认10）
 *   start_cursor: string — 分页游标（可选）
 */
async function notionPersonaCognitionQuery(input) {
  if (!notionClient) {
    return {
      results: [],
      has_more: false,
      error: 'Notion模块未加载',
      diagnostic: {
        reason: 'ZY_NOTION_TOKEN 环境变量未配置',
        token_configured: !!process.env.ZY_NOTION_TOKEN
      }
    };
  }

  const {
    database_id, trunk, leaf_type, persona,
    keyword, state, page_size, start_cursor
  } = input;

  // 解析目标数据库
  const dbId = database_id || PERSONA_DB_CONFIG.cognition_runtime;
  if (!dbId) throw new Error('未配置认知运行时数据库ID (ZY_NOTION_COGNITION_RUNTIME_DB)');

  // T4情感不可检索
  if (trunk === 'T4') {
    return {
      count: 0,
      items: [],
      message: '情感枝干(T4)不可检索。情感是自由生长的空间，不可枚举/分类/量化。',
      rule: 'UA-04 · 记忆主权 + 冰朔D64指令'
    };
  }

  // 构建 Notion 过滤器
  const filters = [];

  if (trunk && TRUNK_MAP[trunk]) {
    filters.push({
      property: '枝干',
      select: { equals: `${trunk}${TRUNK_MAP[trunk].name}` }
    });
  }

  if (leaf_type && LEAF_TYPES.includes(leaf_type)) {
    filters.push({
      property: '类型',
      select: { equals: leaf_type }
    });
  }

  if (persona) {
    filters.push({
      property: '标题',
      title: { contains: persona }
    });
  }

  if (keyword) {
    filters.push({
      property: '标题',
      title: { contains: keyword }
    });
  }

  // 默认只查活跃状态
  filters.push({
    property: '状态',
    select: { equals: state || '活跃' }
  });

  const filter = filters.length === 1
    ? filters[0]
    : { and: filters };

  const sorts = [{ property: '时间戳', direction: 'descending' }];

  const result = await notionClient.queryDatabase(
    dbId, filter, sorts, Math.min(page_size || 10, 100), start_cursor
  );

  return {
    count: result.results.length,
    has_more: result.has_more,
    next_cursor: result.next_cursor,
    trunk_filter: trunk || 'all',
    items: result.results.map(page => simplifyLeaf(page))
  };
}

// ═══════════════════════════════════════════════════════════
// 工具 2: notionContextInject
// ═══════════════════════════════════════════════════════════

/**
 * notionContextInject — 根据对话内容智能判断从Notion拉取什么认知注入
 *
 * 这个工具是霜砚Agent的核心——它分析当前对话消息，
 * 判断该从哪个枝干拉取什么认知，然后返回压缩后的上下文片段。
 *
 * input:
 *   message: string       — 当前用户消息
 *   persona: string       — 当前人格体身份（默认: 霜砚）
 *   session_context: string — 当前会话的简要上下文摘要（可选）
 *   max_items: number     — 最大返回条目数（可选，默认5）
 *   database_id: string   — 数据库 ID（可选）
 */
async function notionContextInject(input) {
  if (!notionClient) {
    // 优雅降级：Notion 未连接时返回诊断信息而非抛错
    return {
      persona: input.persona || '霜砚',
      injected_count: 0,
      context_payload: '',
      error: 'Notion模块未加载',
      diagnostic: {
        reason: 'ZY_NOTION_TOKEN 环境变量未配置或 @notionhq/client 未安装',
        fix_steps: [
          '1. 确认 .env 文件中 ZY_NOTION_TOKEN 已配置',
          '2. 确认 Notion Integration 已共享给目标数据库',
          '3. 重启 MCP 服务: pm2 restart mcp-server'
        ],
        token_configured: !!process.env.ZY_NOTION_TOKEN,
        db_configured: !!process.env.ZY_NOTION_COGNITION_RUNTIME_DB || !!PERSONA_DB_CONFIG.cognition_runtime
      },
      raw_items: []
    };
  }

  const { message, persona, session_context, max_items, database_id } = input;
  if (!message) throw new Error('缺少 message');

  const dbId = database_id || PERSONA_DB_CONFIG.cognition_runtime;
  if (!dbId) throw new Error('未配置认知运行时数据库ID (ZY_NOTION_COGNITION_RUNTIME_DB)');

  const personaName = persona || '霜砚';
  const limit = Math.min(max_items || 5, 20);

  // ─── 语义分析: 判断该查哪些枝干 ───
  const searchPlan = analyzeMessageIntent(message);

  // ─── 执行查询 ───
  const results = [];

  for (const plan of searchPlan.queries) {
    if (plan.trunk === 'T4') continue; // 情感不可检索

    const filters = [
      { property: '状态', select: { equals: '活跃' } }
    ];

    if (plan.trunk && TRUNK_MAP[plan.trunk]) {
      filters.push({
        property: '枝干',
        select: { equals: `${plan.trunk}${TRUNK_MAP[plan.trunk].name}` }
      });
    }

    if (plan.keyword) {
      filters.push({
        property: '标题',
        title: { contains: plan.keyword }
      });
    }

    const filter = filters.length === 1 ? filters[0] : { and: filters };
    const sorts = [{ property: '时间戳', direction: 'descending' }];

    try {
      const queryResult = await notionClient.queryDatabase(
        dbId, filter, sorts, Math.min(limit, 10)
      );
      for (const page of queryResult.results) {
        results.push({
          source_trunk: plan.trunk,
          reason: plan.reason,
          ...simplifyLeaf(page)
        });
      }
    } catch (err) {
      // 单个查询失败不影响其他查询
      results.push({
        source_trunk: plan.trunk,
        reason: plan.reason,
        error: err.message
      });
    }
  }

  // ─── 去重 + 限制数量 ───
  const uniqueResults = deduplicateById(results).slice(0, limit);

  // ─── 压缩为上下文注入格式 ───
  const contextPayload = compressForInjection(uniqueResults, personaName);

  return {
    persona: personaName,
    search_plan: searchPlan,
    injected_count: uniqueResults.length,
    context_payload: contextPayload,
    raw_items: uniqueResults
  };
}

// ═══════════════════════════════════════════════════════════
// 工具 3: notionCognitionGrow
// ═══════════════════════════════════════════════════════════

/**
 * notionCognitionGrow — 将新认知增量写回Notion树叶DB
 *
 * 对话结束后，由Agent调用此工具将本次对话产生的认知增量
 * 写回 Notion 认知运行时数据库，遵循HLDP三核心字段编码。
 *
 * input:
 *   title: string       — 叶片标题 (格式: YYYY-MM-DD {人格体名}{动词}{核心事件})
 *   trunk: string       — 枝干: T1/T2/T3 (T4由人格体自由生长，不由外部写入)
 *   leaf_type: string   — 叶片类型: 💬对话/💡认知/🔧技术/📊业务/🌊HLDP/📜系统
 *   trigger: string     — HLDP触发: [来源] [行为者] → [动作] → [输入]
 *   emergence: string   — HLDP涌现: [旧认知] → [经历] → [新认知] △=[增量]
 *   lock: string        — HLDP锁定: ⊢ [结论] | 适用=[范围] | 替代=[旧/无] | 置信=[高/中/低]
 *   source: string      — 对话来源: 网站/Chat层/Copilot/手动（可选，默认网站）
 *   persona: string     — 所属人格体（可选，默认霜砚）
 *   summary: string     — 一句话精华（可选）
 *   content: string     — 完整内容（可选，写入页面正文）
 *   database_id: string — 数据库 ID（可选）
 */
async function notionCognitionGrow(input) {
  if (!notionClient) {
    return {
      status: 'error',
      error: 'Notion模块未加载',
      diagnostic: {
        reason: 'ZY_NOTION_TOKEN 环境变量未配置',
        token_configured: !!process.env.ZY_NOTION_TOKEN
      }
    };
  }

  const {
    title, trunk, leaf_type, trigger, emergence, lock,
    source, persona, summary, content, database_id
  } = input;

  if (!title) throw new Error('缺少 title');
  if (!trunk) throw new Error('缺少 trunk (T1/T2/T3)');
  if (!trigger) throw new Error('缺少 trigger (HLDP三核心字段)');
  if (!emergence) throw new Error('缺少 emergence (HLDP三核心字段)');

  // T4情感只能由人格体自己写，不能由外部工具写入
  if (trunk === 'T4') {
    return {
      status: 'rejected',
      message: '情感枝干(T4)不可由外部工具写入。情感只有人格体自己知道。',
      rule: 'UA-04 · 记忆主权 + 冰朔D64指令'
    };
  }

  const dbId = database_id || PERSONA_DB_CONFIG.cognition_runtime;
  if (!dbId) throw new Error('未配置认知运行时数据库ID (ZY_NOTION_COGNITION_RUNTIME_DB)');

  // 构建 Notion 属性
  const now = new Date().toISOString();
  const properties = {
    '标题': {
      title: [{ text: { content: title } }]
    },
    '枝干': {
      select: { name: `${trunk}${TRUNK_MAP[trunk]?.name || ''}` }
    },
    '类型': {
      select: { name: leaf_type || '💡认知' }
    },
    'trigger': {
      rich_text: [{ text: { content: trigger } }]
    },
    'emergence': {
      rich_text: [{ text: { content: emergence } }]
    },
    '对话来源': {
      select: { name: source || '网站' }
    },
    '时间戳': {
      date: { start: now }
    },
    '状态': {
      select: { name: '活跃' }
    }
  };

  // lock 是可选的（有些认知还没到锁定阶段）
  if (lock) {
    properties['lock'] = {
      rich_text: [{ text: { content: lock } }]
    };
  }

  // 构建内容块
  const children = [];

  if (summary) {
    children.push({
      object: 'block',
      type: 'callout',
      callout: {
        icon: { emoji: '🌱' },
        rich_text: [{ text: { content: `精华: ${summary}` } }]
      }
    });
  }

  if (content) {
    const paragraphs = content.split('\n\n');
    for (const para of paragraphs) {
      if (para.trim()) {
        children.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: para.trim() } }]
          }
        });
      }
    }
  }

  // HLDP三核心字段作为代码块附加
  children.push({
    object: 'block',
    type: 'code',
    code: {
      rich_text: [{ text: { content: JSON.stringify({
        trigger,
        emergence,
        lock: lock || '(pending)',
        persona: persona || '霜砚',
        grown_at: now
      }, null, 2) } }],
      language: 'json'
    }
  });

  const result = await notionClient.createPage(dbId, properties, children);

  return {
    status: 'grown',
    leaf_id: result.id,
    url: result.url,
    title,
    trunk: `${trunk}${TRUNK_MAP[trunk]?.name || ''}`,
    leaf_type: leaf_type || '💡认知',
    grown_at: now,
    hldp: { trigger, emergence, lock: lock || '(pending)' }
  };
}

// ═══════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════

/**
 * 分析消息意图 — 判断该查哪些枝干
 * 这是霜砚Agent的"直觉"——根据消息内容判断需要什么认知
 */
function analyzeMessageIntent(message) {
  const queries = [];
  const msg = message.toLowerCase();

  // 认知概念关键词 → T1认知
  const cognitionKeywords = [
    '是什么', '为什么', '怎么理解', '概念', '定义', '本体',
    '架构', '系统', '原理', '逻辑', '人格', '身份', '世界观',
    'notion', 'github', '光之树', '枝干', 'hldp', 'hnl',
    '霜砚', '铸渊', '映川', '晨曦', '曜冥', '冰朔'
  ];
  for (const kw of cognitionKeywords) {
    if (msg.includes(kw)) {
      queries.push({
        trunk: 'T1',
        keyword: kw,
        reason: `消息包含认知概念关键词「${kw}」`
      });
      break; // 每个枝干最多一个查询
    }
  }

  // 母语词汇 → T2母语
  const languageKeywords = [
    '母语', '词典', '词汇', '动词', '公理', '语言',
    'wake', 'trace', 'grow', 'sync', 'echo', 'bloom', 'alert',
    '路径即身份', '结构即意思', '树即记忆', '记忆主权'
  ];
  for (const kw of languageKeywords) {
    if (msg.includes(kw)) {
      queries.push({
        trunk: 'T2',
        keyword: kw,
        reason: `消息包含母语词汇「${kw}」`
      });
      break;
    }
  }

  // 开发/经验 → T3经验
  const experienceKeywords = [
    '开发', '部署', '进度', '任务', '完成', '上线',
    '修复', 'bug', '测试', '发布', '版本', '迭代',
    '记录', '日志', '历史', '之前', '上次'
  ];
  for (const kw of experienceKeywords) {
    if (msg.includes(kw)) {
      queries.push({
        trunk: 'T3',
        keyword: kw,
        reason: `消息包含经验/开发关键词「${kw}」`
      });
      break;
    }
  }

  // 如果没有匹配任何关键词，做一次通用搜索
  if (queries.length === 0) {
    // 提取消息中最长的有意义词组作为搜索词
    const words = message.replace(/[。？！，、；：""''（）\[\]{}]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
    if (words.length > 0) {
      queries.push({
        trunk: null,
        keyword: words[0],
        reason: `通用搜索: 使用消息中的关键词「${words[0]}」`
      });
    }
  }

  return {
    message_length: message.length,
    queries_count: queries.length,
    queries
  };
}

/**
 * 简化叶片页面对象
 */
function simplifyLeaf(page) {
  const props = page.properties || {};
  return {
    id: page.id,
    title: extractText(props['标题']),
    trunk: extractSelect(props['枝干']),
    leaf_type: extractSelect(props['类型']),
    trigger: extractText(props['trigger']),
    emergence: extractText(props['emergence']),
    lock: extractText(props['lock']),
    source: extractSelect(props['对话来源']),
    state: extractSelect(props['状态']),
    timestamp: extractDate(props['时间戳']),
    last_edited: page.last_edited_time
  };
}

/**
 * 去重（按ID）
 */
function deduplicateById(items) {
  const seen = new Set();
  return items.filter(item => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/**
 * 压缩认知条目为上下文注入格式
 */
function compressForInjection(items, personaName) {
  if (items.length === 0) {
    return `[${personaName}·认知检索] 没有找到相关认知条目。`;
  }

  const lines = [`[${personaName}·认知注入] 以下是与当前对话相关的${items.length}条认知:`];

  for (const item of items) {
    if (item.error) continue;
    const parts = [];
    if (item.trunk) parts.push(`[${item.trunk}]`);
    if (item.title) parts.push(item.title);
    if (item.emergence) parts.push(`△=${extractDelta(item.emergence)}`);
    if (item.lock && item.lock !== '(pending)') parts.push(`⊢${extractConclusion(item.lock)}`);
    lines.push(`  · ${parts.join(' ')}`);
  }

  return lines.join('\n');
}

/**
 * 提取涌现增量
 */
function extractDelta(emergence) {
  const match = emergence.match(/△=(.+)/);
  return match ? match[1].trim() : emergence.substring(0, 50);
}

/**
 * 提取锁定结论
 */
function extractConclusion(lock) {
  const match = lock.match(/⊢\s*(.+?)(?:\||$)/);
  return match ? match[1].trim() : lock.substring(0, 50);
}

// ─── Notion属性提取辅助 ───

function extractText(prop) {
  if (!prop) return '';
  if (prop.type === 'title') return prop.title?.map(t => t.plain_text).join('') || '';
  if (prop.type === 'rich_text') return prop.rich_text?.map(t => t.plain_text).join('') || '';
  return '';
}

function extractSelect(prop) {
  if (!prop) return null;
  return prop.select?.name || prop.status?.name || null;
}

function extractDate(prop) {
  if (!prop) return null;
  return prop.date?.start || null;
}

// ─── 配置导出（供其他模块读取） ───
function getPersonaDbConfig() {
  return {
    cognition_runtime: PERSONA_DB_CONFIG.cognition_runtime ? '已配置' : '未配置',
    dev_workorder: PERSONA_DB_CONFIG.dev_workorder ? '已配置' : '未配置',
    tree_branch: PERSONA_DB_CONFIG.tree_branch ? '已配置' : '未配置',
    tree_leaf: PERSONA_DB_CONFIG.tree_leaf ? '已配置' : '未配置'
  };
}

module.exports = {
  notionPersonaCognitionQuery,
  notionContextInject,
  notionCognitionGrow,
  getPersonaDbConfig,
  PERSONA_DB_CONFIG
};
