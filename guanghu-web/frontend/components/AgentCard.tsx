import Link from 'next/link';
import type { Agent } from '@/lib/api';

export default function AgentCard({ agent }: { agent: Agent }) {
  const sc = agent.status === '在线' ? 'bg-green-500' : agent.status === '任务中' ? 'bg-yellow-500' : 'bg-gray-400';
  return (
    <Link href={`/agents/${agent.id}`}>
      <div className="bg-white rounded-lg border border-gh-border p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gh-primary/10 flex items-center justify-center text-lg">{agent.icon}</div>
          <div className="flex-1 min-w-0"><h3 className="font-medium text-gh-text text-sm truncate">{agent.name}</h3><p className="text-xs text-gh-muted font-mono">{agent.code}</p></div>
          <span className={`w-2.5 h-2.5 rounded-full ${sc} flex-shrink-0`} />
        </div>
        {agent.currentTask && <p className="text-xs text-gh-muted line-clamp-2">{agent.currentTask}</p>}
      </div>
    </Link>
  );
}
