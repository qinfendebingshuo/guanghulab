import type { NextConfig } from 'next';

/**
 * 光湖网站 · Next.js统一配置
 * GH-INT-001 · 前端+API+聊天集成
 *
 * API代理: /api/* → GH-API-001后端
 * WebSocket: 客户端直连WS服务(通过NEXT_PUBLIC_WS_URL)
 */
const nextConfig: NextConfig = {
  // API路由代理到后端服务
  async rewrites() {
    const apiUrl = process.env.API_UPSTREAM_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },

  // CORS headers for development
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.CORS_ORIGIN || '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization' },
        ],
      },
    ];
  },

  // 输出standalone模式便于容器化部署
  output: 'standalone',
};

export default nextConfig;
