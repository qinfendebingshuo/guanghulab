interface Message { id: string; sender: string; senderIcon?: string; text: string; timestamp: string; type: 'text' | 'command' | 'system'; }

export default function ChatMessage({ message }: { message: Message }) {
  if (message.type === 'system') {
    return <div className="text-center text-xs text-gh-muted py-1">{message.text}</div>;
  }
  const isCommand = message.type === 'command';
  return (
    <div className="flex gap-3 py-1">
      <div className="w-8 h-8 rounded-full bg-gh-primary/10 flex items-center justify-center text-sm flex-shrink-0">{message.senderIcon || message.sender.charAt(0)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2"><span className="text-sm font-medium text-gh-text">{message.sender}</span><span className="text-xs text-gh-muted">{new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span></div>
        <p className={`text-sm mt-0.5 ${isCommand ? 'font-mono text-gh-primary bg-gh-primary/5 rounded px-2 py-1 inline-block' : 'text-gh-text'}`}>{message.text}</p>
      </div>
    </div>
  );
}
