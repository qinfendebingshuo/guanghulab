import { StatusBadge } from './StatusBadge';
import type { Order } from '@/lib/api';

interface OrderCardProps {
  order: Order;
}

export function OrderCard({ order }: OrderCardProps) {
  return (
    <a
      href={`/orders/${order.id}`}
      className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between">
        <h3 className="text-sm font-semibold text-gray-800 line-clamp-2">{order.title}</h3>
        <StatusBadge status={order.status} />
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span>{order.agent}</span>
        <span>·</span>
        <span>{order.priority}</span>
        {order.branch && (
          <>
            <span>·</span>
            <span className="font-mono">{order.branch}</span>
          </>
        )}
      </div>
    </a>
  );
}
