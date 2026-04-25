'use client';

import { useEffect, useState } from 'react';
import { AgentCard } from '@/components/AgentCard';
import { fetchAgents } from '@/lib/api';
import type { Agent } from '@/lib/api';

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents()
      .then(setAgents)
      .catch((err) => console.error('加载Agent列表失败:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">🤖 Agent 列表</h1>
      <p className="text-sm text-gray-500">所有已注册的Agent · 点击查看详情</p>

      {loading ? (
        <p className="py-8 text-center text-gray-500">加载中…</p>
      ) : agents.length === 0 ? (
        <p className="py-8 text-center text-gray-500">暂无Agent数据 · 请确认API已连接</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} showDetail />
          ))}
        </div>
      )}
    </div>
  );
}
