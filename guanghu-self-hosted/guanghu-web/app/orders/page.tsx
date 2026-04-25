'use client';

import { useEffect, useState } from 'react';
import { OrderCard } from '@/components/OrderCard';
import { StatusBadge } from '@/components/StatusBadge';
import { fetchOrders } from '@/lib/api';
import type { Order } from '@/lib/api';

type ViewMode = 'board' | 'table';

const STATUS_COLUMNS = ['待开发', '开发中', '自检中', '待审查', '审核中', '已完成', '暂缓'] as const;

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders()
      .then(setOrders)
      .catch((err) => console.error('加载工单失败:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="py-8 text-center text-gray-500">加载中…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">📋 工单看板</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('board')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              viewMode === 'board'
                ? 'bg-guanghu-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            看板视图
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              viewMode === 'table'
                ? 'bg-guanghu-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            表格视图
          </button>
        </div>
      </div>

      {viewMode === 'board' && (
        <div className="grid auto-cols-fr grid-flow-col gap-4 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((status) => {
            const items = orders.filter((o) => o.status === status);
            return (
              <div key={status} className="min-w-[240px] rounded-xl bg-gray-50 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <StatusBadge status={status} />
                  <span className="text-xs text-gray-400">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'table' && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">编号</th>
                <th className="px-4 py-3">任务标题</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">负责Agent</th>
                <th className="px-4 py-3">优先级</th>
                <th className="px-4 py-3">阶段编号</th>
                <th className="px-4 py-3">分支名</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="cursor-pointer transition hover:bg-gray-50"
                  onClick={() => (window.location.href = `/orders/${order.id}`)}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{order.code}</td>
                  <td className="px-4 py-3 font-medium">{order.title}</td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3">{order.agent}</td>
                  <td className="px-4 py-3">{order.priority}</td>
                  <td className="px-4 py-3 font-mono text-xs">{order.phase}</td>
                  <td className="px-4 py-3 font-mono text-xs">{order.branch}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
