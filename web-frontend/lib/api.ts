const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8765';

// ==================== Types ====================

export interface Agent {
  id: string;
  name: string;
  code: string;
  icon: string;
  status: '在线' | '任务中' | '离线';
  description: string;
  currentTask?: string;
}

export interface Order {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  assignee: string;
  branch: string;
  repoPath: string;
  phase: string;
  devContent?: string;
  constraints?: string;
  selfCheck?: string;
  reviewResult?: string;
  commitHash?: string;
  createdAt: string;
}

// ==================== Mock Data ====================

const mockAgents: Agent[] = [
  {
    id: 'a02',
    name: '录册·采集与前端',
    code: '5TH-LE-HK-A02',
    icon: '📋',
    status: '任务中',
    description: '光湖开发团队·采集与前端开发岗',
    currentTask: 'GH-WEB-001 光湖网站前端骨架',
  },
  {
    id: 'a01',
    name: '译典·后端与协议',
    code: '5TH-LE-HK-A01',
    icon: '📖',
    status: '在线',
    description: '光湖开发团队·后端与协议开发岗',
    currentTask: 'GH-API-001 光湖后端API',
  },
  {
    id: 'a03',
    name: '培园·训练与评估',
    code: '5TH-LE-HK-A03',
    icon: '🌱',
    status: '在线',
    description: '光湖开发团队·训练与评估岗',
  },
  {
    id: 'sy-web',
    name: '霜砚·Web握手体',
    code: 'AG-SY-WEB-001',
    icon: '🤝',
    status: '在线',
    description: '审核半体 · 负责代码审核与质量把控',
  },
];

const mockOrders: Order[] = [
  {
    id: 'gh-web-001',
    code: 'GH-WEB-001',
    title: '光湖网站前端骨架',
    status: '开发中',
    priority: 'P0',
    assignee: '录册A02',
    branch: 'feat/gh-web-frontend',
    repoPath: '/web-frontend/',
    phase: 'Phase-NOW-001',
    createdAt: '2026-04-25',
  },
  {
    id: 'gh-chat-001',
    code: 'GH-CHAT-001',
    title: '光湖聊天界面',
    status: '已完成',
    priority: 'P0',
    assignee: '录册A02',
    branch: 'feat/gh-web-chat',
    repoPath: '/web-chat/',
    phase: 'Phase-NOW-002',
    createdAt: '2026-04-25',
  },
  {
    id: 'gh-int-001',
    code: 'GH-INT-001',
    title: '光湖网站三模块集成',
    status: '开发中',
    priority: 'P0',
    assignee: '录册A02',
    branch: 'feat/gh-integration',
    repoPath: '/guanghu-self-hosted/',
    phase: 'Phase-NOW-006',
    createdAt: '2026-04-25',
  },
];

// ==================== API Functions ====================

async function apiFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return await res.json();
  } catch {
    console.warn(`[API] ${path} 不可用，使用Mock数据`);
    return fallback;
  }
}

export async function fetchAgents(): Promise<Agent[]> {
  return apiFetch('/agents', mockAgents);
}

export async function fetchAgentById(id: string): Promise<Agent | null> {
  return apiFetch(`/agents/${id}`, mockAgents.find((a) => a.id === id) || null);
}

export async function fetchOrders(): Promise<Order[]> {
  return apiFetch('/orders', mockOrders);
}

export async function fetchOrderById(id: string): Promise<Order | null> {
  return apiFetch(`/orders/${id}`, mockOrders.find((o) => o.id === id) || null);
}

// ==================== WebSocket (reserved) ====================

export function createWebSocket(channel: string): WebSocket | null {
  if (typeof window === 'undefined') return null;
  try {
    const ws = new WebSocket(`${WS_URL}?channel=${channel}`);
    return ws;
  } catch {
    console.warn('[WS] WebSocket连接失败');
    return null;
  }
}
