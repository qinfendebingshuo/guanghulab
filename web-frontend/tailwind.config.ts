import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'gh-primary': '#2563eb',
        'gh-secondary': '#1e40af',
        'gh-accent': '#3b82f6',
        'gh-bg': '#f8fafc',
        'gh-card': '#ffffff',
        'gh-border': '#e2e8f0',
        'gh-text': '#1e293b',
        'gh-muted': '#64748b',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
