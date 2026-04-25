import Link from 'next/link';
import StatusBadge from './StatusBadge';
import type { Order } from '@/lib/api';

interface OrderCardProps {
  order: Order;
  compact?: boolean;
}

export default function OrderCard({ order, compact = false }: OrderCardProps) {
  return (
    <Link href={`/orders/${order.id}`}>
      <div className="bg-white rounded-lg border border-gh-border p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs font-mono text-gh-primary">{order.code}</span>
          {!compact && <StatusBadge status={order.status} />}
        </div>
        <h3 className={`font-medium text-gh-text ${compact ? 'text-sm' : 'text-base'} mb-1`}>
          {order.title}
        </h3>
        {!compact && (
          <div className="flex items-center gap-3 mt-3 text-xs text-gh-muted">
            <span>🤖 {order.assignee}</span>
            <span className="font-mono">{order.priority}</span>
          </div>
        )}
        {compact && (
          <div className="text-xs text-gh-muted mt-1">{order.assignee}</div>
        )}
      </div>
    </Link>
  );
}
