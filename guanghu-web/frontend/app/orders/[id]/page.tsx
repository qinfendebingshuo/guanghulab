'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchOrderById, type Order } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';

export default function OrderDetailPage() {
  const params = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) { fetchOrderById(params.id as string).then((d) => { setOrder(d); setLoading(false); }); }
  }, [params.id]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-gh-muted">加载中...</div></div>;
  if (!order) return <div className="text-center py-20"><p className="text-gh-muted">工单不存在</p><Link href="/orders" className="text-gh-primary hover:underline mt-2 inline-block">返回</Link></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/orders" className="text-gh-primary hover:underline text-sm">← 返回工单看板</Link>
      <div className="bg-white rounded-lg border border-gh-border p-6">
        <div className="flex items-start justify-between mb-6"><div><span className="text-sm font-mono text-gh-primary">{order.code}</span><h1 className="text-2xl font-bold text-gh-text mt-1">{order.title}</h1></div><StatusBadge status={order.status} /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <InfoRow label="优先级" value={order.priority} />
          <InfoRow label="负责Agent" value={order.assignee} />
          <InfoRow label="分支" value={order.branch} mono />
          <InfoRow label="仓库路径" value={order.repoPath} mono />
          <InfoRow label="阶段" value={order.phase} />
          <InfoRow label="创建时间" value={order.createdAt} />
        </div>
        {order.devContent && <Section title="开发内容"><p className="text-sm text-gh-text whitespace-pre-wrap">{order.devContent}</p></Section>}
        {order.selfCheck && <Section title="自检结果"><pre className="text-sm bg-gray-50 rounded p-4 overflow-x-auto">{order.selfCheck}</pre></Section>}
        {order.reviewResult && <Section title="审核结果"><pre className="text-sm bg-gray-50 rounded p-4 overflow-x-auto">{order.reviewResult}</pre></Section>}
        {order.commitHash && <Section title="Git信息"><span className="font-mono text-sm text-gh-primary">{order.commitHash.slice(0, 8)}</span></Section>}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return <div><span className="text-sm text-gh-muted">{label}</span><div className={`text-sm text-gh-text mt-0.5 ${mono ? 'font-mono' : ''}`}>{value || '-'}</div></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mb-6"><h3 className="text-sm font-semibold text-gh-text mb-2 border-b border-gh-border pb-1">{title}</h3>{children}</div>;
}
