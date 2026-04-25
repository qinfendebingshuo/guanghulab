'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchAgentById, fetchOrders, type Agent, type Order } from '@/lib/api';
import OrderCard from '@/components/OrderCard';
import Link from 'next/link';

export default function AgentDetailPage() {
  const params = useParams();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      Promise.all([fetchAgentById(params.id as string), fetchOrders()]).then(([a, o]) => {
        setAgent(a); setOrders(o.filter((x) => x.assignee === a?.name)); setLoading(false);
      });
    }
  }, [params.id]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-gh-muted">加载中...</div></div>;
  if (!agent) return <div className="text-center py-20"><p className="text-gh-muted">Agent不存在</p><Link href="/agents" className="text-gh-primary hover:underline mt-2 inline-block">返回</Link></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/agents" className="text-gh-primary hover:underline text-sm">← 返回 Agent 列表</Link>
      <div className="bg-white rounded-lg border border-gh-border p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gh-primary/10 flex items-center justify-center text-2xl">{agent.icon}</div>
          <div><h1 className="text-2xl font-bold text-gh-text">{agent.name}</h1><p className="text-sm text-gh-muted font-mono">{agent.code}</p></div>
          <div className="ml-auto"><span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${agent.status === '在线' ? 'bg-green-100 text-green-700' : agent.status === '任务中' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}><span className={`w-2 h-2 rounded-full ${agent.status === '在线' ? 'bg-green-500' : agent.status === '任务中' ? 'bg-yellow-500' : 'bg-gray-400'}`} />{agent.status}</span></div>
        </div>
        <div className="mb-6"><h3 className="text-sm font-semibold text-gh-text mb-2">人格信息</h3><p className="text-sm text-gh-muted">{agent.description}</p></div>
        {agent.currentTask && <div className="mb-6"><h3 className="text-sm font-semibold text-gh-text mb-2">当前任务</h3><p className="text-sm text-gh-text">{agent.currentTask}</p></div>}
      </div>
      {orders.length > 0 && <div><h2 className="text-xl font-semibold text-gh-text mb-4">历史工单</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{orders.map((o) => <OrderCard key={o.id} order={o} />)}</div></div>}
    </div>
  );
}
