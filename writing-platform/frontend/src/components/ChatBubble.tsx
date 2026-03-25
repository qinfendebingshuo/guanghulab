interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  companionName?: string;
  userNickname?: string;
}

export default function ChatBubble({
  role,
  content,
  companionName = 'AI',
  userNickname = '你',
}: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
          ${isUser ? 'bg-brand-100 text-brand-700' : 'bg-gradient-to-br from-brand-400 to-brand-600 text-white'}
        `}
      >
        {isUser ? userNickname.charAt(0) : '🤖'}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
          ${
            isUser
              ? 'bg-brand-600 text-white rounded-tr-md'
              : 'bg-ink-50 text-ink-800 rounded-tl-md'
          }
        `}
      >
        {!isUser && (
          <span className="text-xs text-brand-500 font-medium block mb-1">
            {companionName}
          </span>
        )}
        {content}
      </div>
    </div>
  );
}
