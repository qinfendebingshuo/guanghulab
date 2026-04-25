const statusStyles: Record<string, string> = {
  '待开发': 'bg-gray-100 text-gray-700',
  '开发中': 'bg-blue-100 text-blue-700',
  '自检中': 'bg-indigo-100 text-indigo-700',
  '待审查': 'bg-purple-100 text-purple-700',
  '审核中': 'bg-orange-100 text-orange-700',
  '已完成': 'bg-green-100 text-green-700',
  '已关闭': 'bg-red-100 text-red-700',
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const style = statusStyles[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}
