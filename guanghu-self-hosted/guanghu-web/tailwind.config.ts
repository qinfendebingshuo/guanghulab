import type { Config } from 'tailwindcss';

/**
 * 光湖网站 · 统一TailwindCSS配置
 * 合并 GH-WEB-001(主站) + GH-CHAT-001(聊天) 样式
 */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        guanghu: {
          primary: '#6366f1',
          secondary: '#8b5cf6',
          accent: '#06b6d4',
          dark: '#0f172a',
          light: '#f8fafc',
        },
        chat: {
          bg: '#030712',       // gray-950
          sidebar: '#0a0a0a',
          border: '#1f2937',   // gray-800
          input: '#111827',    // gray-900
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
