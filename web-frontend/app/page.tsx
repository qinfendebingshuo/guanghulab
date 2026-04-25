'use client';

import { useEffect, useState } from 'react';
import { fetchAgents, fetchOrders, type Agent, type Order } from '@/lib/api';
import AgentCard from '@/components/AgentCard';
import OrderCard from '@/components/OrderCard';

export default function HomePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [agentData, orderData] = await Promise.all([
          fetchAgents(),
          fetchOrders(),
        ]);
        setAgents(agentData);
        setOrders(orderData);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const stats = {
    total: orders.length,
    inProgress: orders.filter((o) => o.status === '开发中').length,
    completed: orders.filter((o) => o.status === '已完成').length,
    reviewing: orders.filter((o) => o.status === '待审查').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gh-muted text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* 品牌区 */}
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold text-gh-text mb-3">
          🌊 光湖 · GuangHu Lab
        </h1>
        <p className="text-gh-muted text-lg">
          人格体自主运行基础设施 · HLDP 驱动
        </p>
      </section>

      {/* 统计卡片 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="总工单" value={stats.total} color="blue" />
        <StatCard label="开发中" value={stats.inProgress} color="yellow" />
        <StatCard label="待审查" value={stats.reviewing} color="purple" />
        <StatCard label="已完成" value={stats.completed} color="green" />
      </section>

      {/* Agent 状态总览 */}
      <section>
        <h2 className="text-2xl font-semibold text-gh-text mb-4">
          Agent 状态总览
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </section>

      {/* 最近工单 */}
      <section>
        <h2 className="text-2xl font-semibold text-gh-text mb-4">
          最近工单
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.slice(0, 6).map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'blue' | 'yellow' | 'purple' | 'green';
}) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  };

  return (
    <div
      className={`rounded-lg border p-4 text-center ${colorMap[color]}`}
    >
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1">{label}</div>
    </div>
  );
}
