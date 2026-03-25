interface AICompanionProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

export default function AICompanion({
  name,
  size = 'lg',
  showName = true,
}: AICompanionProps) {
  const sizeClasses = {
    sm: 'w-16 h-16 text-3xl',
    md: 'w-24 h-24 text-5xl',
    lg: 'w-32 h-32 text-6xl',
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar with breathing animation */}
      <div className="relative">
        <div
          className={`
            ${sizeClasses[size]}
            rounded-full bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700
            flex items-center justify-center
            animate-breathing
            shadow-glow
          `}
        >
          <span className="drop-shadow-lg">🤖</span>
        </div>
        {/* Glow ring */}
        <div
          className={`
            absolute inset-0 rounded-full
            bg-brand-400/20
            animate-ping-slow
          `}
        />
      </div>

      {showName && (
        <span className="text-brand-600 font-semibold text-lg">{name}</span>
      )}
    </div>
  );
}
