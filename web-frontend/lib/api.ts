/**
 * 光湖网站前端 · API 封装
 * 数据全走API · 环境变量 NEXT_PUBLIC_API_URL 配置API地址
 * 预留WebSocket连接点（GH-CHAT-001对接）
 *
 * GH-API-001 提供后端接口后，替换 mock 数据为真实请求
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

// ==================== 类型定义 ====================

export interface Order {
  id: string;
  code: string;
  title: string;
  status: string;
  agent: string;
  priority: string;
  phase: string;
  branch: string;
  content: string;
  constraints: string;
  selfCheckResult: string;
  reviewResult: string;
  repoPath: string;
  nextGuide: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  code: string;
  icon: string;
  status: 'online' | 'offline' | 'busy';
  role: string;
  prefix: string;
  description: string;
  currentTask: string;
}

// ==================== Mock 数据 ====================
// GH-API-001 完成后替换为真实API调用

const MOCK_AGENTS: Agent[] = [
  {
    id: 'yd-a05',
    name: '译典',
    code: '5TH-LE-HK-A05',
    icon: '📖',
    status: 'busy',
    role: 'PersonaDB · 建表SQL · Boot Protocol · 工具回执系统',
    prefix: 'YD-A05-',
    description: '译典是霜砚家政团队的数据库架构岗，负责PersonaDB建表、Boot Protocol运行时、工具回执系统等核心基础设施开发。',
    currentTask: '工具回执系统 Tool Receipt System',
  },
  {
    id: 'py-a04',
    name: '培园',
    code: '5TH-LE-HK-A04',
    icon: '🌱',
    status: 'busy',
    role: '记忆路由Agent · 工具回执系统MVP · 后端服务',
    prefix: 'PY-A04-',
    description: '培园是霜砚家政团队的后端服务岗，负责记忆路由Agent、工具回执系统MVP等后端模块开发。',
    currentTask: '记忆路由Agent配置',
  },
  {
    id: 'lc-a02',
    name: '录册',
    code: '5TH-LE-HK-A02',
    icon: '📋',
    status: 'busy',
    role: '语料采集Agent · Streamlit可视化前端 · 数据分类打标 · 光湖网站前端',
    prefix: 'LC-A02-',
    description: '录册是霜砚家政团队的采集与前端开发岗，负责语料采集Agent、Streamlit可视化面板、光湖网站前端骨架等模块开发。',
    currentTask: '光湖网站前端骨架',
  },
  {
    id: 'sy-web',
    name: '霜砚Web',
    code: 'AG-SY-WEB-001',
    icon: '🌐',
    status: 'online',
    role: '审核半体 · 工单审查 · Web握手体',
    prefix: 'GH-',
    description: '霜砚Web握手体，负责半体工单审查和Web端握手通信。',
    currentTask: '',
  },
];

const MOCK_ORDERS: Order[] = [
  {
    id: 'gh-web-001',
    code: 'GH-WEB-001',
    title: '光湖网站前端骨架',
    status: '开发中',
    agent: '录册A02',
    priority: 'P0',
    phase: 'Phase-NOW-001',
    branch: 'feat/gh-web-frontend',
    content: '光湖网站前端MVP · Next.js 14 + TypeScript + TailwindCSS · 5个页面 + 共享组件 + API封装',
    constraints: 'TypeScript strict · ESLint · 纯前端 · 数据全走API · 响应式 · 中文界面',
    selfCheckResult: '',
    reviewResult: '',
    repoPath: '/guanghu-self-hosted/web-frontend/',
    nextGuide: '完成后→与GH-API-001联调 · 然后接入GH-CHAT-001聊天模块',
    createdAt: '2026-04-25T07:30:21.311Z',
  },
  {
    id: 'lc-a02-001',
    code: 'LC-A02-20260425-001',
    title: '语料采集 Agent MVP',
    status: '待审查',
    agent: '录册A02',
    priority: 'P0',
    phase: 'Phase-0-003',
    branch: 'feat/lc-corpus-collector',
    content: '语料采集脚本 · GPT JSON流式解析 · JSONL格式化 · SHA-256去重',
    constraints: 'Python 3.10+ · 纯标准库 · UTF-8',
    selfCheckResult: 'PASS · 6/6文件',
    reviewResult: '',
    repoPath: '/guanghu-self-hosted/corpus-collector/',
    nextGuide: '完成后下发语料清洗标签器',
    createdAt: '2026-04-25T03:19:00.000Z',
  },
  {
    id: 'lc-a02-002',
    code: 'LC-A02-20260425-002',
    title: '语料清洗与分类标签器',
    status: '待审查',
    agent: '录册A02',
    priority: 'P0',
    phase: 'Phase-0-006',
    branch: 'feat/lc-corpus-cleaner',
    content: '6类分类器 · 元数据标签器 · 统计报告生成器',
    constraints: 'Python 3.10+ · 纯标准库 · 兼容corpus-collector JSONL',
    selfCheckResult: 'PASS · 6/6文件',
    reviewResult: '',
    repoPath: '/guanghu-self-hosted/corpus-cleaner/',
    nextGuide: '完成后下发可视化前端',
    createdAt: '2026-04-25T04:36:00.000Z',
  },
];

// ==================== API 函数 ====================

async function apiFetch<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  } catch {
    // API未就绪时返回mock数据
    console.warn(`[光湖前端] API未就绪，使用Mock数据: ${path}`);
    throw new Error('API_NOT_READY');
  }
}

export async function fetchOrders(): Promise<Order[]> {
  try {
    return await apiFetch<Order[]>('/orders');
  } catch {
    return MOCK_ORDERS;
  }
}

export async function fetchOrderById(id: string): Promise<Order | null> {
  try {
    return await apiFetch<Order>(`/orders/${id}`);
  } catch {
    return MOCK_ORDERS.find((o) => o.id === id) || null;
  }
}

export async function fetchAgents(): Promise<Agent[]> {
  try {
    return await apiFetch<Agent[]>('/agents');
  } catch {
    return MOCK_AGENTS;
  }
}

export async function fetchAgentById(id: string): Promise<Agent | null> {
  try {
    return await apiFetch<Agent>(`/agents/${id}`);
  } catch {
    return MOCK_AGENTS.find((a) => a.id === id) || null;
  }
}

export async function fetchOrdersByAgent(agentId: string): Promise<Order[]> {
  try {
    return await apiFetch<Order[]>(`/agents/${agentId}/orders`);
  } catch {
    const agentNameMap: Record<string, string> = {
      'yd-a05': '译典A05',
      'py-a04': '培园A04',
      'lc-a02': '录册A02',
      'sy-web': '霜砚Web',
    };
    const name = agentNameMap[agentId] || '';
    return MOCK_ORDERS.filter((o) => o.agent === name);
  }
}

// ==================== WebSocket 预留 ====================
// GH-CHAT-001 对接时启用

export function createWebSocketConnection(): WebSocket | null {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (!wsUrl) {
    console.warn('[光湖前端] WebSocket URL未配置，聊天功能暂不可用');
    return null;
  }
  return new WebSocket(wsUrl);
}
