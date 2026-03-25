import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Settings, LogOut, PenLine, BarChart3, Megaphone, MessageCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import AICompanion from '../components/AICompanion';
import ChatBubble from '../components/ChatBubble';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, token, isAuthenticated, logout } = useAuth();
  const { messages, sendMessage, connected } = useSocket(token);
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  const companionName = user.aiCompanion?.name || 'AI伙伴';
  const roleLabel =
    user.role === 'author' ? '作者' : user.role === 'editor' ? '编辑' : '运营';

  return (
    <div className="min-h-screen pt-16 flex flex-col bg-ink-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-ink-100">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-bold text-brand-700">
            <span className="text-2xl">🌟</span>
            <span>光湖码字</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-600">
              {user.nickname}（{roleLabel}）
            </span>
            <button
              onClick={() => {}}
              className="p-2 text-ink-400 hover:text-ink-600 transition-colors"
              title="设置"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-ink-400 hover:text-red-500 transition-colors"
              title="退出"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto px-4 pb-4">
        {/* AI Companion avatar */}
        <div className="flex flex-col items-center py-6">
          <AICompanion name={companionName} size="md" />
          {connected ? (
            <span className="text-xs text-emerald-500 mt-2">● 已连接</span>
          ) : (
            <span className="text-xs text-ink-400 mt-2">○ 连接中...</span>
          )}
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-[300px]">
          {messages.map((msg, idx) => (
            <ChatBubble
              key={idx}
              role={msg.role}
              content={msg.content}
              companionName={companionName}
              userNickname={user.nickname}
            />
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <form
          onSubmit={handleSend}
          className="flex gap-2 bg-white rounded-2xl border border-ink-200 p-2 shadow-soft"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`和${companionName}说点什么...`}
            className="flex-1 px-4 py-2.5 outline-none text-ink-800 text-sm bg-transparent"
          />
          <button
            type="submit"
            disabled={!input.trim() || !connected}
            className="px-4 py-2.5 bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
          >
            <Send size={18} />
          </button>
        </form>

        {/* Quick actions */}
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          {[
            { icon: PenLine, label: '开始写作' },
            { icon: BarChart3, label: '查看数据' },
            { icon: Megaphone, label: '看定制书需求' },
            { icon: MessageCircle, label: '讨论区' },
          ].map((action) => (
            <button
              key={action.label}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-ink-600 bg-white border border-ink-200 hover:border-brand-300 hover:text-brand-600 rounded-full transition-all"
            >
              <action.icon size={14} />
              {action.label}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
