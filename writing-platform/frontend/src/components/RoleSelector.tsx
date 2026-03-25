import { useState } from 'react';

interface RoleSelectorProps {
  value: string;
  onChange: (role: 'author' | 'editor' | 'operator') => void;
}

const roles = [
  {
    key: 'author' as const,
    label: '我是作者',
    emoji: '🖊️',
    desc: '用AI辅助创作，提高效率',
    companion: '笔灵',
  },
  {
    key: 'editor' as const,
    label: '我是编辑',
    emoji: '📊',
    desc: '用AI辅助审稿，高效筛选',
    companion: '慧眼',
  },
  {
    key: 'operator' as const,
    label: '我是运营',
    emoji: '🤝',
    desc: '用AI辅助分析，洞察趋势',
    companion: '星图',
  },
];

export default function RoleSelector({ value, onChange }: RoleSelectorProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-lg mx-auto">
      {roles.map((role) => (
        <button
          key={role.key}
          onClick={() => onChange(role.key)}
          onMouseEnter={() => setHovered(role.key)}
          onMouseLeave={() => setHovered(null)}
          className={`
            flex-1 flex flex-col items-center gap-1.5 px-4 py-4 rounded-2xl border-2 transition-all duration-200
            ${
              value === role.key
                ? 'border-brand-500 bg-brand-50 shadow-glow'
                : 'border-ink-200 bg-white hover:border-brand-300 hover:shadow-soft'
            }
          `}
        >
          <span className="text-2xl">{role.emoji}</span>
          <span className="font-semibold text-ink-800">{role.label}</span>
          <span className="text-xs text-ink-500">{role.desc}</span>
          {(value === role.key || hovered === role.key) && (
            <span className="text-xs text-brand-600 mt-1">
              AI伙伴：{role.companion}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
