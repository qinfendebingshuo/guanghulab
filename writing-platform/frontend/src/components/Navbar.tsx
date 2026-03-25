import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LogOut, User } from 'lucide-react';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-ink-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-brand-700">
          <span className="text-2xl">🌟</span>
          <span>光湖码字</span>
          <span className="text-xs text-ink-400 font-normal hidden sm:inline">
            · AI创作伙伴平台
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <>
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 text-sm text-ink-600 hover:text-brand-600 transition-colors"
              >
                <User size={16} />
                <span>{user.nickname}（{user.role === 'author' ? '作者' : user.role === 'editor' ? '编辑' : '运营'}）</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-sm text-ink-400 hover:text-red-500 transition-colors"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">退出</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm text-ink-600 hover:text-brand-600 transition-colors px-3 py-1.5"
              >
                登录
              </Link>
              <Link
                to="/register"
                className="text-sm bg-brand-600 text-white hover:bg-brand-700 transition-colors px-4 py-1.5 rounded-full"
              >
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
