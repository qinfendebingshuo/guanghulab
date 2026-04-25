'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { fetchOrderById } from '@/lib/api';
import type { Order } from '@/lib/api';

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderById(id)
      .then(setOrder)
      .catch((err) => console.error('加载工单详情失败:', err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="py-8 text-center text-gray-500">加载中…</p>;
  if (!order) return <p className="py-8 text-center text-gray-500">工单未找到</p>;

  return (
    <div className="space-y-6">
      <a href="/orders" className="text-sm text-guanghu-primary hover:underline">← 返回工单看板</a>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 font-mono text-sm text-gray-400">{order.code}</p>
            <h1 className="text-2xl font-bold text-gray-800">{order.title}</h1>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoItem label="负责Agent" value={order.agent} />
          <InfoItem label="优先级" value={order.priority} />
          <InfoItem label="阶段编号" value={order.phase} />
          <InfoItem label="分支名" value={order.branch} />
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">开发内容</h2>
        <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
          {order.content}
        </pre>
      </div>

      {order.constraints && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-800">约束</h2>
          <p className="text-sm leading-relaxed text-gray-700">{order.constraints}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-800">自检结果</h2>
          <p className="text-sm text-gray-700">{order.selfCheckResult || '暂无'}</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-800">审核结果</h2>
          <p className="text-sm text-gray-700">{order.reviewResult || '暂无'}</p>
        </div>
      </div>

      {order.branch && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-800">Git 信息</h2>
          <p className="text-sm text-gray-700">分支：<code className="rounded bg-gray-100 px-2 py-0.5 font-mono">{order.branch}</code></p>
          <p className="mt-2 text-sm text-gray-700">仓库路径：<code className="rounded bg-gray-100 px-2 py-0.5 font-mono">{order.repoPath || '未指定'}</code></p>
        </div>
      )}

      {order.nextGuide && (
        <div className="rounded-xl border border-guanghu-accent/20 bg-cyan-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-guanghu-accent">下一轮指引</h2>
          <p className="text-sm text-gray-700">{order.nextGuide}</p>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 font-medium text-gray-800">{value || '-'}</p>
    </div>
  );
}
