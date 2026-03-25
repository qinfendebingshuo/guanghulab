import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import RoleSelector from '../components/RoleSelector';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuth();

  const [role, setRole] = useState<'author' | 'editor' | 'operator'>(
    (searchParams.get('role') as any) || 'author'
  );
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [realName, setRealName] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    if (!/^1\d{10}$/.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }
    setError('');
    try {
      await api.sendCode(phone);
      setCodeSent(true);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message || '验证码发送失败');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone || !code || !nickname) {
      setError('请填写所有必填字段');
      return;
    }
    if ((role === 'editor' || role === 'operator') && !realName) {
      setError('编辑和运营角色需要填写真实姓名');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await api.register({ phone, code, nickname, realName, role });
      setAuth(data.token, data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-16 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <span className="text-4xl">🌟</span>
          <h1 className="text-2xl font-bold text-ink-800 mt-3">加入光湖码字</h1>
          <p className="text-ink-500 text-sm mt-1">选择你的角色，开始AI创作之旅</p>
        </div>

        <div className="bg-white rounded-2xl shadow-soft p-8 border border-ink-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Role selection */}
            <div>
              <label className="block text-sm text-ink-600 mb-3 text-center">
                选择角色
              </label>
              <RoleSelector value={role} onChange={setRole} />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm text-ink-600 mb-1">手机号 *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号"
                maxLength={11}
                className="w-full px-4 py-2.5 rounded-xl border border-ink-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-ink-800"
              />
            </div>

            {/* Verification code */}
            <div>
              <label className="block text-sm text-ink-600 mb-1">验证码 *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6位验证码"
                  maxLength={6}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-ink-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-ink-800"
                />
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={countdown > 0}
                  className="px-4 py-2.5 text-sm bg-brand-50 text-brand-600 hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors whitespace-nowrap"
                >
                  {countdown > 0 ? `${countdown}s` : codeSent ? '重发' : '获取验证码'}
                </button>
              </div>
            </div>

            {/* Nickname */}
            <div>
              <label className="block text-sm text-ink-600 mb-1">笔名/昵称 *</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="输入你的笔名"
                maxLength={20}
                className="w-full px-4 py-2.5 rounded-xl border border-ink-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-ink-800"
              />
            </div>

            {/* Real name (conditional) */}
            <div>
              <label className="block text-sm text-ink-600 mb-1">
                真实姓名 {role !== 'author' ? '*' : '（选填）'}
              </label>
              <input
                type="text"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="输入真实姓名"
                maxLength={20}
                className="w-full px-4 py-2.5 rounded-xl border border-ink-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-ink-800"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 rounded-xl font-medium transition-colors"
            >
              {loading ? '注册中...' : '注册并开始'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-ink-400 mt-4">
          已有账号？{' '}
          <a href="/writing/login" className="text-brand-600 hover:underline">
            立即登录
          </a>
        </p>
      </div>
    </div>
  );
}
