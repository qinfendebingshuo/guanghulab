'use client';

import { useState } from 'react';

/**
 * 统一导航栏
 * GH-INT-001: 合并GH-WEB-001导航 + 新增聊天入口(GH-CHAT-001)
 */
const NAV_ITEMS = [
  { label: '首页', href: '/' },
  { label: '工单看板', href: '/orders' },
  { label: 'Agent列表', href: '/agents' },
  { label: '💬 聊天', href: '/chat' },
];

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-2 text-lg font-bold text-guanghu-primary">
          🌊 光湖
        </a>

        <div className="hidden gap-6 sm:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-gray-600 transition hover:text-guanghu-primary"
            >
              {item.label}
            </a>
          ))}
        </div>

        <button
          className="sm:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-gray-100 px-4 py-3 sm:hidden">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block py-2 text-sm font-medium text-gray-600 hover:text-guanghu-primary"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}
