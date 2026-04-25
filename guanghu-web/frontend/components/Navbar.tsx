'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: '首页', icon: '🌊' },
  { href: '/orders', label: '工单', icon: '📋' },
  { href: '/agents', label: 'Agent', icon: '🤖' },
  { href: '/chat', label: '聊天', icon: '💬' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gh-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🌊</span>
            <span className="font-bold text-gh-text text-lg">光湖</span>
            <span className="text-xs text-gh-muted hidden sm:inline">GuangHu Lab</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) ? 'bg-gh-primary/10 text-gh-primary' : 'text-gh-muted hover:bg-gray-100 hover:text-gh-text'}`}>
                <span className="mr-1">{item.icon}</span>{item.label}
              </Link>
            ))}
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-md text-gh-muted hover:bg-gray-100" aria-label="菜单">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">{menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}</svg>
          </button>
        </div>
        {menuOpen && <div className="md:hidden pb-3 space-y-1">{navItems.map((item) => (<Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={`block px-3 py-2 rounded-md text-sm font-medium ${pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) ? 'bg-gh-primary/10 text-gh-primary' : 'text-gh-muted hover:bg-gray-100'}`}><span className="mr-2">{item.icon}</span>{item.label}</Link>))}</div>}
      </div>
    </nav>
  );
}
