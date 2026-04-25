import type { Agent } from '@/lib/api';

interface AgentCardProps {
  agent: Agent;
  showDetail?: boolean;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  online: { color: 'bg-green-400', label: '在线' },
  offline: { color: 'bg-gray-400', label: '离线' },
  busy: { color: 'bg-yellow-400', label: '任务中' },
};

export function AgentCard({ agent, showDetail }: AgentCardProps) {
  const statusInfo = statusConfig[agent.status] || statusConfig.offline;

  return (
    <a
      href={`/agents/${agent.id}`}
      className="block rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl">{agent.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-800">{agent.name}</h3>
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${statusInfo.color}`}
              title={statusInfo.label}
            />
          </div>
          <p className="mt-0.5 font-mono text-xs text-gray-400">{agent.code}</p>
        </div>
      </div>

      {showDetail && agent.role && (
        <p className="mt-3 text-sm text-gray-600">{agent.role}</p>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          statusInfo.color === 'bg-green-400'
            ? 'bg-green-50 text-green-700'
            : statusInfo.color === 'bg-yellow-400'
              ? 'bg-yellow-50 text-yellow-700'
              : 'bg-gray-100 text-gray-600'
        }`}>
          {statusInfo.label}
        </span>
        {agent.currentTask && (
          <span className="truncate">当前: {agent.currentTask}</span>
        )}
      </div>
    </a>
  );
}
