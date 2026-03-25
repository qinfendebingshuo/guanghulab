import { useState, type FormEvent } from 'react';
import { api } from '../services/api';

interface PhoneLoginProps {
  onSuccess: (data: { token: string; user: any }) => void;
  buttonLabel?: string;
  children?: React.ReactNode;
}

export default function PhoneLogin({
  onSuccess,
  buttonLabel = '登录',
  children,
}: PhoneLoginProps) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
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
    if (!phone || !code) {
      setError('请填写手机号和验证码');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await api.login(phone, code);
      onSuccess(data);
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm mx-auto">
      <div>
        <label className="block text-sm text-ink-600 mb-1">手机号</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="请输入手机号"
          maxLength={11}
          className="w-full px-4 py-2.5 rounded-xl border border-ink-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-ink-800"
        />
      </div>

      <div>
        <label className="block text-sm text-ink-600 mb-1">验证码</label>
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

      {children}

      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 rounded-xl font-medium transition-colors"
      >
        {loading ? '处理中...' : buttonLabel}
      </button>
    </form>
  );
}
