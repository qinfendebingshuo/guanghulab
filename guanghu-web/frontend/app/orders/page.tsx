'use client';

import { useEffect, useState } from 'react';
import { fetchOrders, type Order } from '@/lib/api';
import OrderCard from '@/components/OrderCard';
import StatusBadge from '@/components/StatusBadge';

type ViewMode = 'board' | 'table';
const STATUS_COLUMNS = ['待开发', '开发中', '自检中', '待审查', '审核中', '已完成', '已关闭'];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders().then((data) => { setOrders(data); setLoading(false); });
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-gh-muted">加载中...</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gh-text">📋 工单看板</h1>
        <div className="flex gap-2">
          <button onClick={() => setViewMode('board')} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'board' ? 'bg-gh-primary text-white' : 'bg-white text-gh-muted border border-gh-border hover:bg-gray-50'}`}>看板</button>
          <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'table' ? 'bg-gh-primary text-white' : 'bg-white text-gh-muted border border-gh-border hover:bg-gray-50'}`}>表格</button>
        </div>
      </div>
      {viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {STATUS_COLUMNS.map((status) => {
            const col = orders.filter((o) => o.status === status);
            return (<div key={status} className="space-y-3"><div className="flex items-center gap-2 pb-2 border-b border-gh-border"><StatusBadge status={status} /><span className="text-xs text-gh-muted">{col.length}</span></div>{col.map((o) => (<OrderCard key={o.id} order={o} compact />))}</div>);
          })}
        </div>
      ) : (
        <div className="overflow-x-auto"><table className="w-full bg-white rounded-lg border border-gh-border"><thead><tr className="border-b border-gh-border bg-gray-50"><th className="px-4 py-3 text-left text-sm font-medium text-gh-muted">编号</th><th className="px-4 py-3 text-left text-sm font-medium text-gh-muted">标题</th><th className="px-4 py-3 text-left text-sm font-medium text-gh-muted">状态</th><th className="px-4 py-3 text-left text-sm font-medium text-gh-muted">优先级</th><th className="px-4 py-3 text-left text-sm font-medium text-gh-muted">负责</th><th className="px-4 py-3 text-left text-sm font-medium text-gh-muted">分支</th></tr></thead><tbody>{orders.map((o) => (<tr key={o.id} className="border-b border-gh-border hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/orders/${o.id}`}><td className="px-4 py-3 text-sm font-mono text-gh-primary">{o.code}</td><td className="px-4 py-3 text-sm text-gh-text font-medium">{o.title}</td><td className="px-4 py-3"><StatusBadge status={o.status} /></td><td className="px-4 py-3 text-sm">{o.priority}</td><td className="px-4 py-3 text-sm text-gh-muted">{o.assignee}</td><td className="px-4 py-3 text-sm font-mono text-gh-muted">{o.branch}</td></tr>))}</tbody></table></div>
      )}
    </div>
  );
}
