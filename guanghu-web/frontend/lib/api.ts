const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ==================== Types ====================
export interface Agent {
  id: string; name: string; code: string; icon: string;
  status: '在线' | '任务中' | '离线'; description: string; currentTask?: string;
}

export interface Order {
  id: string; code: string; title: string; status: string; priority: string;
  assignee: string; branch: string; repoPath: string; phase: string;
  devContent?: string; constraints?: string; selfCheck?: string;
  reviewResult?: string; commitHash?: string; createdAt: string;
}

// ==================== Mock Data ====================
const mockAgents: Agent[] = [
  { id: 'a02', name: '录册A02', code: '5TH-LE-HK-A02', icon: '📋', status: '任务中', description: '采集与前端开发岗', currentTask: 'GH-WEB-001' },
  { id: 'a01', name: '译典A01', code: '5TH-LE-HK-A01', icon: '📖', status: '在线', description: '后端与协议开发岗', currentTask: 'GH-API-001' },
  { id: 'a03', name: '培园A03', code: '5TH-LE-HK-A03', icon: '🌱', status: '在线', description: '训练与评估岗' },
  { id: 'sy-web', name: '霜砚Web', code: 'AG-SY-WEB-001', icon: '🤝', status: '在线', description: '审核半体' },
];

const mockOrders: Order[] = [
  { id: 'gh-web-001', code: 'GH-WEB-001', title: '光湖网站前端骨架', status: '开发中', priority: 'P0', assignee: '录册A02', branch: 'feat/gh-web-frontend', repoPath: '/web-frontend/', phase: 'Phase-NOW-001', createdAt: '2026-04-25' },
  { id: 'gh-chat-001', code: 'GH-CHAT-001', title: '光湖聊天界面', status: '已完成', priority: 'P0', assignee: '录册A02', branch: 'feat/gh-web-chat', repoPath: '/web-chat/', phase: 'Phase-NOW-002', createdAt: '2026-04-25' },
  { id: 'gh-int-001', code: 'GH-INT-001', title: '三模块集成', status: '开发中', priority: 'P0', assignee: '录册A02', branch: 'feat/gh-integration', repoPath: '/guanghu-web/', phase: 'Phase-NOW-006', createdAt: '2026-04-25' },
];

// ==================== API Functions ====================
async function apiFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return await res.json();
  } catch {
    console.warn(`[API] ${path} 不可用，使用Mock`);
    return fallback;
  }
}

export const fetchAgents = (): Promise<Agent[]> => apiFetch('/agents', mockAgents);
export const fetchAgentById = (id: string): Promise<Agent | null> => apiFetch(`/agents/${id}`, mockAgents.find((a) => a.id === id) || null);
export const fetchOrders = (): Promise<Order[]> => apiFetch('/orders', mockOrders);
export const fetchOrderById = (id: string): Promise<Order | null> => apiFetch(`/orders/${id}`, mockOrders.find((o) => o.id === id) || null);

// Chat messages API
export const fetchChatMessages = (channel: string): Promise<Message[]> => apiFetch(`/chat/messages?channel=${channel}`, []);
export const sendChatMessage = async (msg: { channel: string; sender: string; text: string }): Promise<void> => {
  try { await fetch(`${API_BASE}/chat/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(msg) }); } catch { console.warn('[API] 发送失败'); }
};

interface Message { id: string; channel: string; sender: string; text: string; timestamp: string; }
