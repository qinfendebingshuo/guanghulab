import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.LLM_API_KEY || 'sk-placeholder',
  baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
});

// Per-user conversation history (in-memory; use Redis in production)
const MAX_CACHE_USERS = 1000;
const conversationCache = new Map<string, { messages: Array<{ role: 'user' | 'assistant'; content: string }>; lastAccess: number }>();

// Evict least-recently-used entries when cache exceeds limit
function getHistory(userId: string): Array<{ role: 'user' | 'assistant'; content: string }> {
  const entry = conversationCache.get(userId);
  if (entry) {
    entry.lastAccess = Date.now();
    return entry.messages;
  }
  return [];
}

function setHistory(userId: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>): void {
  if (conversationCache.size >= MAX_CACHE_USERS) {
    // Evict oldest entry
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [key, val] of conversationCache.entries()) {
      if (val.lastAccess < oldestTime) {
        oldestTime = val.lastAccess;
        oldestKey = key;
      }
    }
    if (oldestKey) conversationCache.delete(oldestKey);
  }
  conversationCache.set(userId, { messages, lastAccess: Date.now() });
}

export async function callAI(params: {
  systemPrompt: string;
  userMessage: string;
  userId: string;
}): Promise<string> {
  const { systemPrompt, userMessage, userId } = params;

  // Get recent conversation history (last 10 turns = 20 messages)
  const history = getHistory(userId);

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-20),
    { role: 'user', content: userMessage },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || 'gpt-4',
      messages,
      temperature: 0.7,
      max_tokens: 800,
    });

    const aiResponse = completion.choices[0]?.message?.content || '...';

    // Update conversation cache
    const updatedHistory = [
      ...history,
      { role: 'user' as const, content: userMessage },
      { role: 'assistant' as const, content: aiResponse },
    ].slice(-20);
    setHistory(userId, updatedHistory);

    return aiResponse;
  } catch (err: any) {
    console.error('[AI] Call failed:', err.message);
    throw new Error('AI服务暂时不可用');
  }
}

export function getWelcomeMessage(user: {
  nickname: string;
  role: string;
  aiCompanion: { name: string };
}): string {
  const { nickname, role, aiCompanion } = user;
  const name = aiCompanion.name;

  if (role === 'author') {
    return `早上好，${nickname}！我是${name}，你的AI创作伙伴。\n\n今天想做什么？写作、看数据、还是找合作机会？`;
  } else if (role === 'editor') {
    return `早上好，${nickname}！我是${name}，你的AI审稿助手。\n\n今天有新投稿等你审核，要看看吗？`;
  } else {
    return `早上好，${nickname}！我是${name}，你的AI数据助手。\n\n今天的数据已更新，要看看趋势分析吗？`;
  }
}

export function buildSystemPrompt(user: {
  nickname: string;
  role: string;
}): string {
  const prompts: Record<string, string> = {
    author: `你是用户的AI创作伙伴，名字叫「笔灵」。
用户信息：昵称=${user.nickname}，角色=作者。
你的职责：
1. 帮助用户创作（提供灵感、扩写、优化文笔）
2. 管理写作项目（打开文档、查看进度）
3. 提醒和建议（写作时间、字数目标、市场趋势）
4. 记住用户的写作风格和习惯
语气：温暖、鼓励、专业。像一个懂你的创作搭档。`,

    editor: `你是用户的AI审稿助手，名字叫「慧眼」。
用户信息：昵称=${user.nickname}，角色=编辑。
你的职责：
1. 帮助筛选和评估投稿
2. 分析AI使用报告
3. 提供审稿建议
4. 管理审核工作流
语气：专业、精准、高效。`,

    operator: `你是用户的AI数据助手，名字叫「星图」。
用户信息：昵称=${user.nickname}，角色=运营。
你的职责：
1. 分析平台数据趋势
2. 提供运营策略建议
3. 管理跨平台合作
4. 生成数据报告
语气：敏锐、有洞察力、数据驱动。`,
  };

  return prompts[user.role] || prompts.author;
}
