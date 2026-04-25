/**
 * 光湖网站 · 统一API封装
 * GH-INT-001 集成: GH-WEB-001(前端) + GH-API-001(后端) + GH-CHAT-001(聊天)
 *
 * API请求通过Next.js rewrites代理到后端:
 *   /api/* → API_UPSTREAM_URL/*
 * WebSocket直连聊天后端:
 *   NEXT_PUBLIC_WS_URL → ws_server.py
 *
 * 后端未就绪时自动fallback到Mock数据
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

export interface ChatMessageRecord {
  id: string;
  channel: string;
  sender: string;
  content: string;
  role: 'user' | 'agent' | 'system';
  timestamp: string;
}

// ==================== Mock 数据 ====================

const MOCK_AGENTS: Agent[] = [
  {
    id: 'yd-a05', name: '译典', code: '5TH-LE-HK-A05', icon: '📖',
    status: 'busy', role: 'PersonaDB · 建表SQL · Boot Protocol · 工具回执系统',
    prefix: 'YD-A05-', description: '译典是霜砚家政团队的数据库架构岗。', currentTask: '工具回执系统',
  },
  {
    id: 'py-a04', name: '培园', code: '5TH-LE-HK-A04', icon: '🌱',
    status: 'busy', role: '记忆路由Agent · 后端API服务 · 工具回执系统MVP',
    prefix: 'PY-A04-', description: '培园是霜砚家政团队的后端服务岗。', currentTask: '后端API服务',
  },
  {
    id: 'lc-a02', name: '录册', code: '5TH-LE-HK-A02', icon: '📋',
    status: 'busy', role: '语料采集Agent · 光湖网站前端 · 数据分类打标',
    prefix: 'LC-A02-', description: '录册是霜砚家政团队的采集与前端开发岗。', currentTask: '光湖网站三模块集成',
  },
  {
    id: 'sy-web', name: '霜砚Web', code: 'AG-SY-WEB-001', icon: '🌐',
    status: 'online', role: '审核半体 · 工单审查 · Web握手体',
    prefix: 'GH-', description: '霜砚Web握手体，负责半体工单审查和Web端握手通信。', currentTask: '',
  },
];

const MOCK_ORDERS: Order[] = [
  {
    id: 'gh-web-001', code: 'GH-WEB-001', title: '光湖网站前端骨架',
    status: '待审查', agent: '录册A02', priority: 'P0', phase: 'Phase-NOW-001',
    branch: 'feat/gh-web-frontend', content: '光湖网站前端MVP · Next.js 14 + TypeScript + TailwindCSS',
    constraints: 'TypeScript strict · ESLint · 纯前端 · 数据全走API', selfCheckResult: 'PASS · 20/20文件',
    reviewResult: '', repoPath: '/guanghu-self-hosted/web-frontend/', nextGuide: '完成后→与GH-API-001联调',
    createdAt: '2026-04-25T07:30:21.311Z',
  },
  {
    id: 'gh-int-001', code: 'GH-INT-001', title: '光湖网站三模块集成(前端+API+聊天)',
    status: '开发中', agent: '录册A02', priority: 'P0', phase: 'Phase-NOW-006',
    branch: 'feat/gh-integration', content: '将GH-WEB-001+GH-API-001+GH-CHAT-001集成为完整光湖网站',
    constraints: '三模块共享Next.js+TailwindCSS · 统一端口分配 · CORS配置', selfCheckResult: '',
    reviewResult: '', repoPath: '/guanghu-self-hosted/', nextGuide: '完成后→部署到测试服务器 · 端到端验收',
    createdAt: '2026-04-25T07:46:11.257Z',
  },
];

// ==================== API 函数 ====================

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function fetchOrders(): Promise<Order[]> {
  try { return await apiFetch<Order[]>('/orders'); }
  catch { console.warn('[光湖] API未就绪，使用Mock数据'); return MOCK_ORDERS; }
}

export async function fetchOrderById(id: string): Promise<Order | null> {
  try { return await apiFetch<Order>(`/orders/${id}`); }
  catch { return MOCK_ORDERS.find((o) => o.id === id) || null; }
}

export async function fetchAgents(): Promise<Agent[]> {
  try { return await apiFetch<Agent[]>('/agents'); }
  catch { return MOCK_AGENTS; }
}

export async function fetchAgentById(id: string): Promise<Agent | null> {
  try { return await apiFetch<Agent>(`/agents/${id}`); }
  catch { return MOCK_AGENTS.find((a) => a.id === id) || null; }
}

export async function fetchOrdersByAgent(agentId: string): Promise<Order[]> {
  try { return await apiFetch<Order[]>(`/agents/${agentId}/orders`); }
  catch {
    const agentNameMap: Record<string, string> = {
      'yd-a05': '译典A05', 'py-a04': '培园A04', 'lc-a02': '录册A02', 'sy-web': '霜砚Web',
    };
    const name = agentNameMap[agentId] || '';
    return MOCK_ORDERS.filter((o) => o.agent === name);
  }
}

// ==================== 消息持久化API(GH-INT-001新增) ====================

export async function fetchChatHistory(channel: string, limit = 50): Promise<ChatMessageRecord[]> {
  try { return await apiFetch<ChatMessageRecord[]>(`/chat/messages?channel=${channel}&limit=${limit}`); }
  catch { return []; }
}

export async function postChatMessage(msg: Omit<ChatMessageRecord, 'id'>): Promise<ChatMessageRecord | null> {
  try {
    const res = await fetch(`${API_BASE}/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  } catch { return null; }
}

// ==================== WebSocket 工厂 ====================

export function createWebSocketConnection(): WebSocket | null {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (!wsUrl) {
    console.warn('[光湖] WebSocket URL未配置，聊天功能暂不可用');
    return null;
  }
  return new WebSocket(wsUrl);
}
