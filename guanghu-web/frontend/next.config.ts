import type { NextConfig } from 'next';

// GH-INT-001: 集成配置 · API代理 + CORS
const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return [
      // 前后端对接: 所有 /api/* 请求代理到 FastAPI
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
      // 聊天消息API: /chat/messages → FastAPI
      {
        source: '/chat/messages/:path*',
        destination: `${apiUrl}/chat/messages/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;
