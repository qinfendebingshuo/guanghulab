interface StatusBadgeProps {
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  '待开发': 'bg-gray-100 text-gray-700',
  '开发中': 'bg-blue-100 text-blue-700',
  '自检中': 'bg-orange-100 text-orange-700',
  '待审查': 'bg-yellow-100 text-yellow-700',
  '审核中': 'bg-purple-100 text-purple-700',
  '已完成': 'bg-green-100 text-green-700',
  '暂缓': 'bg-gray-200 text-gray-500',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-700';

  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}
