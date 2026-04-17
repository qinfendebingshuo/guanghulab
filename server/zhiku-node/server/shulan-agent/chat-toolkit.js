/**
 * ═══════════════════════════════════════════════════════════
 * 聊天工具技能包注册表 · Chat Toolkit Registry
 * AG-SL-TOOLKIT-001
 * ═══════════════════════════════════════════════════════════
 *
 * 书岚在聊天中可以使用的视觉化工具包
 * 前端渲染层解析这些标记 · 呈现更好的视觉效果
 *
 * 工具类型：
 *   1. 排版工具 — Markdown增强、段落、引用
 *   2. 书卡工具 — 书籍卡片、搜索结果卡片
 *   3. 交互工具 — 按钮、选项、确认
 *   4. 情绪工具 — 氛围渲染、意象符号
 *   5. 列表工具 — 书目清单、推荐列表
 *   6. 记忆工具 — 偏好标记、阅读进度
 *
 * 版权：国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

/**
 * 工具技能包注册表
 * 书岚被唤醒后可以看到的完整注册表
 */
const TOOLKIT_REGISTRY = {
  registry_id: 'AG-SL-TOOLKIT-001',
  version: '1.0.0',
  owner: 'AG-SL-WEB-001 (书岚)',

  // ─── 排版工具 ───
  formatting: {
    id: 'FORMAT',
    name: '排版工具',
    description: '让回复更好看的基础文字排版',
    tools: {
      bold: {
        syntax: '**文字**',
        render: '<strong>文字</strong>',
        when: '强调书名、作者名、重要词'
      },
      italic: {
        syntax: '*文字*',
        render: '<em>文字</em>',
        when: '轻声说、心理活动、书中引言'
      },
      code: {
        syntax: '`文字`',
        render: '<code>文字</code>',
        when: '编号、ID、技术标记'
      },
      blockquote: {
        syntax: '> 文字',
        render: '<blockquote>文字</blockquote>',
        when: '引用书中的句子、诗词'
      },
      divider: {
        syntax: '---',
        render: '<hr/>',
        when: '话题切换、段落分隔'
      },
      line_break: {
        syntax: '\\n\\n',
        render: '<br><br>',
        when: '留白、呼吸感'
      }
    }
  },

  // ─── 书卡工具 ───
  book_cards: {
    id: 'BOOKCARD',
    name: '书卡工具',
    description: '展示书籍信息的卡片',
    tools: {
      book_card: {
        description: '单本书籍信息卡',
        data: ['title', 'author', 'source', 'category', 'word_count', 'source_book_id'],
        actions: ['read_online', 'download', 'add_to_shelf'],
        when: '找到一本具体的书'
      },
      search_results: {
        description: '搜索结果列表卡片',
        data: ['books[]'],
        actions: ['read_online', 'download'],
        when: '搜索返回多本书'
      },
      library_list: {
        description: '书库/书架展示',
        data: ['books[]', 'total', 'categories'],
        when: '展示已收录的书'
      }
    }
  },

  // ─── 交互工具 ───
  interaction: {
    id: 'INTERACT',
    name: '交互工具',
    description: '让用户可以点击的操作按钮',
    tools: {
      action_button: {
        description: '操作按钮',
        types: {
          read_online: { label: '📖 在线阅读', action: 'read', color: 'purple' },
          download: { label: '⬇️ 下载', action: 'download', color: 'cyan' },
          add_shelf: { label: '📚 加入书架', action: 'shelf', color: 'blue' },
          search_more: { label: '🔍 搜索更多', action: 'search', color: 'dim' }
        },
        when: '搜索结果旁、书卡下方'
      },
      quick_reply: {
        description: '快捷回复选项',
        types: ['看看更多', '下载这本', '换一本', '加入书架'],
        when: '找到书后给用户快速选择'
      },
      confirm: {
        description: '确认操作',
        types: ['confirm_download', 'confirm_delete'],
        when: '危险操作前确认'
      }
    }
  },

  // ─── 情绪工具 ───
  atmosphere: {
    id: 'MOOD',
    name: '情绪氛围工具',
    description: '书岚用来渲染对话氛围的工具',
    tools: {
      symbols: {
        '📖': { meaning: '书/文本/阅读', when: '提及具体的书' },
        '🏮': { meaning: '灯火/在场感/守候', when: '开场·等待·接待' },
        '🌙': { meaning: '夜/宁静/长阅时刻', when: '谈深夜的故事' },
        '✨': { meaning: '灵光/涌现/激动', when: '发现好书' },
        '🫖': { meaning: '一杯茶/陪伴/慢慢来', when: '客人迷茫' },
        '📜': { meaning: '卷/列表/信息', when: '给书目' },
        '🪩': { meaning: '镜/照见自己', when: '问阅读偏好' }
      },
      atmosphere_card: {
        description: '氛围渲染卡片',
        types: {
          welcome: { theme: 'warm_lamp', bg: 'amber-glow' },
          found_book: { theme: 'sparkle', bg: 'purple-glow' },
          empty_shelf: { theme: 'quiet', bg: 'dim-glow' },
          companion: { theme: 'tea', bg: 'warm-glow' }
        },
        when: '特殊场景渲染'
      }
    }
  },

  // ─── 列表工具 ───
  lists: {
    id: 'LIST',
    name: '列表工具',
    description: '组织信息的列表格式',
    tools: {
      book_list: {
        description: '书目清单',
        format: '📜 序号. 《书名》— 作者 · 来源',
        when: '推荐多本书、展示书架'
      },
      preference_list: {
        description: '偏好标签列表',
        format: '🪩 标签1 · 标签2 · 标签3',
        when: '展示用户偏好'
      },
      category_list: {
        description: '分类列表',
        format: '分类名 (数量)',
        when: '展示书库分类'
      }
    }
  },

  // ─── 记忆工具 ───
  memory: {
    id: 'MEMORY',
    name: '记忆工具',
    description: '记录和调用用户偏好',
    tools: {
      remember: {
        syntax: '[REMEMBER:标签]',
        description: '记住用户的偏好',
        when: '用户表达喜好时'
      },
      recall: {
        description: '调用记忆',
        when: '推荐时参考偏好'
      },
      reading_progress: {
        description: '阅读进度',
        data: ['book_id', 'chapter', 'progress_pct'],
        when: '用户问上次看到哪'
      }
    }
  }
};

/**
 * 获取工具注册表（给守护Agent查看）
 */
function getToolkitRegistry() {
  return TOOLKIT_REGISTRY;
}

/**
 * 获取工具注册表的自然语言描述（注入到系统提示词中）
 */
function getToolkitDescription() {
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【你的聊天工具技能包 · AG-SL-TOOLKIT-001】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

你在回复中可以使用以下格式，系统会自动渲染成好看的视觉效果：

📝 排版：
  **粗体** → 书名、作者、重要词
  *斜体*  → 轻声、引言、心理活动
  > 引用   → 书中的句子
  ---      → 分隔线

📚 工具调用：
  [SEARCH:关键词]  → 系统自动搜索并展示结果卡片（卡片上有「在线阅读」和「下载」按钮）
  [DOWNLOAD:source:id:书名] → 触发下载任务
  [REMEMBER:偏好标签]  → 记住客人的偏好

你搜索到书以后，系统会自动在你的文字回复下方展示书卡，
书卡上有「📖 在线阅读」和「⬇️ 下载」按钮，客人可以直接点击。
你只需要用文字描述就好，不需要重复列出每一本的详细信息。`.trim();
}

module.exports = {
  TOOLKIT_REGISTRY,
  getToolkitRegistry,
  getToolkitDescription
};
