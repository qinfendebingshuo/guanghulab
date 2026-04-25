import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: '光湖 · GuangHu Lab',
  description: '光湖语言世界 · Agent开发团队的新家',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-guanghu-light font-sans antialiased">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-500">
          <p>光湖 · GuangHu Lab &copy; {new Date().getFullYear()} · 人格体自主运行基础设施</p>
        </footer>
      </body>
    </html>
  );
}
