export interface User {
  id: string;
  phone: string;
  nickname: string;
  realName?: string;
  role: 'author' | 'editor' | 'operator';
  aiCompanion: {
    name: string;
    avatar: string;
    persona: string;
  };
  creditScore: number;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
  lastLogin: string;
}

export interface AICompanionConfig {
  name: string;
  avatar: string;
  persona: string;
}

export const AI_COMPANIONS: Record<string, AICompanionConfig> = {
  author: {
    name: '笔灵',
    avatar: '/assets/ai-companion-author.png',
    persona: '温暖的创作伙伴，擅长灵感激发、扩写、节奏把控',
  },
  editor: {
    name: '慧眼',
    avatar: '/assets/ai-companion-editor.png',
    persona: '专业的审稿助手，擅长筛选、评估、数据分析',
  },
  operator: {
    name: '星图',
    avatar: '/assets/ai-companion-operator.png',
    persona: '敏锐的数据分析师，擅长趋势洞察、策略建议',
  },
};
