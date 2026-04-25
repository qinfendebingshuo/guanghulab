import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '光湖 · GuangHu Lab',
  description: '光湖自研系统 — 人格体自主运行基础设施 · HLDP驱动',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.className} min-h-screen bg-gh-bg`}>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-gh-border py-6 text-center text-gh-muted text-sm">
          <p>© 2026 光湖 GuangHu Lab · HLDP 驱动</p>
        </footer>
      </body>
    </html>
  );
}
