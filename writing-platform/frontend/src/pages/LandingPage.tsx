import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pen, BarChart3, Handshake } from 'lucide-react';
import AICompanion from '../components/AICompanion';

const WELCOME_TEXT =
  '你好！我是你的AI创作伙伴。\n无论你是作者、编辑还是运营，\n我都能陪你一起工作。';

function useTypewriter(text: string, speed = 60) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayed, done };
}

const features = [
  {
    icon: Pen,
    title: 'AI码字',
    sub: 'AI陪你写',
    desc: '不代替你写',
    color: 'from-brand-400 to-brand-600',
  },
  {
    icon: BarChart3,
    title: '透明追踪',
    sub: '全程留痕',
    desc: '创意归你',
    color: 'from-emerald-400 to-emerald-600',
  },
  {
    icon: Handshake,
    title: '跨平台',
    sub: '自由合作',
    desc: '信誉说话',
    color: 'from-amber-400 to-amber-600',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { displayed, done } = useTypewriter(WELCOME_TEXT, 50);

  const handleRoleClick = (role: string) => {
    navigate(`/register?role=${role}`);
  };

  return (
    <div className="min-h-screen pt-16">
      {/* Hero section */}
      <section className="relative px-4 py-16 sm:py-24 flex flex-col items-center text-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/60 via-white to-white -z-10" />

        <AICompanion name="AI创作伙伴" size="lg" />

        {/* Typewriter welcome */}
        <div className="mt-8 mb-10 min-h-[5rem]">
          <p className="text-lg sm:text-xl text-ink-700 leading-relaxed whitespace-pre-line">
            "{displayed}
            {!done && <span className="animate-pulse">|</span>}"
          </p>
        </div>

        {/* Role selection buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {[
            { key: 'author', label: '我是作者', emoji: '🖊️' },
            { key: 'editor', label: '我是编辑', emoji: '📊' },
            { key: 'operator', label: '我是运营', emoji: '🤝' },
          ].map((r) => (
            <button
              key={r.key}
              onClick={() => handleRoleClick(r.key)}
              className="px-8 py-3 bg-white border-2 border-ink-200 hover:border-brand-400 hover:shadow-soft rounded-2xl text-ink-700 hover:text-brand-600 transition-all duration-200 font-medium"
            >
              <span className="mr-2">{r.emoji}</span>
              {r.label}
            </button>
          ))}
        </div>
      </section>

      {/* Features section */}
      <section className="px-4 py-16 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-ink-800 mb-10">
            ✨ 三大核心能力
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="flex flex-col items-center text-center p-6 rounded-2xl border border-ink-100 hover:shadow-soft transition-shadow"
              >
                <div
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-4`}
                >
                  <f.icon size={28} />
                </div>
                <h3 className="font-bold text-ink-800 text-lg">{f.title}</h3>
                <p className="text-sm text-ink-500 mt-1">{f.sub}</p>
                <p className="text-xs text-ink-400 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats section */}
      <section className="px-4 py-12 bg-ink-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-lg font-semibold text-ink-600 mb-6">📈 平台数据</h2>
          <div className="flex flex-col sm:flex-row justify-center gap-8 sm:gap-16">
            {[
              { label: '注册作者', value: '--' },
              { label: '今日新作', value: '--' },
              { label: 'AI使用透明度', value: '100%' },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center">
                <span className="text-3xl font-bold text-brand-600">{s.value}</span>
                <span className="text-sm text-ink-500 mt-1">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 text-center text-sm text-ink-400 border-t border-ink-100">
        © 2026 光湖纪元 · 国作登字-2026-A-00037559
      </footer>
    </div>
  );
}
