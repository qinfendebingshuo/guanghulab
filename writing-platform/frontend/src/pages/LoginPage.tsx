import { useNavigate } from 'react-router-dom';
import PhoneLogin from '../components/PhoneLogin';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const handleSuccess = (data: { token: string; user: any }) => {
    setAuth(data.token, data.user);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen pt-16 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-4xl">🌟</span>
          <h1 className="text-2xl font-bold text-ink-800 mt-3">欢迎回来</h1>
          <p className="text-ink-500 text-sm mt-1">登录光湖码字平台</p>
        </div>

        <div className="bg-white rounded-2xl shadow-soft p-8 border border-ink-100">
          <PhoneLogin onSuccess={handleSuccess} buttonLabel="登录" />
        </div>

        <p className="text-center text-sm text-ink-400 mt-4">
          还没有账号？{' '}
          <a href="/writing/register" className="text-brand-600 hover:underline">
            立即注册
          </a>
        </p>
      </div>
    </div>
  );
}
