'use client';

import { useEffect, useState } from 'react';
import { AgentCard } from '@/components/AgentCard';
import { fetchAgents, fetchOrders } from '@/lib/api';
import type { Agent, Order } from '@/lib/api';

export default function HomePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState({ total: 0, developing: 0, completed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [agentList, orderList] = await Promise.all([
          fetchAgents(),
          fetchOrders(),
        ]);
        setAgents(agentList);
        setStats({
          total: orderList.length,
          developing: orderList.filter((o: Order) => o.status === '开发中').length,
          completed: orderList.filter((o: Order) => o.status === '已完成').length,
        });
      } catch (err) {
        console.error('加载数据失败:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-8">
      {/* 品牌区 */}
      <section className="rounded-2xl bg-gradient-to-r from-guanghu-primary to-guanghu-secondary p-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold sm:text-4xl">🌊 光湖 · GuangHu Lab</h1>
        <p className="mt-2 text-lg opacity-90">
          人格体自主运行基础设施 · Agent开发团队的新家
        </p>
      </section>

      {/* 统计卡片 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="工单总数" value={stats.total} icon="📋" />
        <StatCard label="开发中" value={stats.developing} icon="🔧" />
        <StatCard label="已完成" value={stats.completed} icon="✅" />
      </section>

      {/* Agent 状态总览 */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-gray-800">Agent 状态总览</h2>
        {loading ? (
          <p className="text-gray-500">加载中…</p>
        ) : agents.length === 0 ? (
          <p className="text-gray-500">暂无Agent数据 · 请确认API已连接</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md">
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}
