'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { OrderCard } from '@/components/OrderCard';
import { fetchAgentById, fetchOrdersByAgent } from '@/lib/api';
import type { Agent, Order } from '@/lib/api';

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchAgentById(id), fetchOrdersByAgent(id)])
      .then(([agentData, orderData]) => { setAgent(agentData); setOrders(orderData); })
      .catch((err) => console.error('加载Agent详情失败:', err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="py-8 text-center text-gray-500">加载中…</p>;
  if (!agent) return <p className="py-8 text-center text-gray-500">Agent未找到</p>;

  const statusColor: Record<string, string> = { online: 'bg-green-400', offline: 'bg-gray-400', busy: 'bg-yellow-400' };

  return (
    <div className="space-y-6">
      <a href="/agents" className="text-sm text-guanghu-primary hover:underline">← 返回Agent列表</a>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="text-5xl">{agent.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-800">{agent.name}</h1>
              <span className={`inline-block h-3 w-3 rounded-full ${statusColor[agent.status] || 'bg-gray-400'}`} title={agent.status} />
            </div>
            <p className="mt-1 font-mono text-sm text-gray-400">{agent.code}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><p className="text-xs text-gray-400">角色</p><p className="mt-0.5 text-sm font-medium text-gray-800">{agent.role}</p></div>
          <div><p className="text-xs text-gray-400">当前状态</p><p className="mt-0.5 text-sm font-medium capitalize text-gray-800">{agent.status}</p></div>
          <div><p className="text-xs text-gray-400">编号前缀</p><p className="mt-0.5 font-mono text-sm font-medium text-gray-800">{agent.prefix}</p></div>
        </div>
        {agent.description && (
          <div className="mt-4"><p className="text-xs text-gray-400">人格信息</p><p className="mt-1 text-sm leading-relaxed text-gray-700">{agent.description}</p></div>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-800">当前任务</h2>
        {orders.filter((o) => o.status !== '已完成').length === 0
          ? <p className="text-sm text-gray-500">暂无进行中的任务</p>
          : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{orders.filter((o) => o.status !== '已完成').map((order) => <OrderCard key={order.id} order={order} />)}</div>
        }
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-800">历史工单</h2>
        {orders.filter((o) => o.status === '已完成').length === 0
          ? <p className="text-sm text-gray-500">暂无已完成工单</p>
          : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{orders.filter((o) => o.status === '已完成').map((order) => <OrderCard key={order.id} order={order} />)}</div>
        }
      </div>
    </div>
  );
}
