#!/usr/bin/env node
/**
 * E2E 测试模块 · 最小 Node.js 服务
 * 工单: GH-GMP-006 · 录册A02
 *
 * 提供一个最小的 HTTP 服务用于健康检查验证
 * 端口: E2E_MOCK_PORT 环境变量 (默认 19800)
 * 纯标准库 · 无第三方依赖
 */

'use strict';

const http = require('http');

const PORT = parseInt(process.env.E2E_MOCK_PORT || '19800', 10);
const MODULE_NAME = 'e2e-test-mock-module';
const START_TIME = Date.now();

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      module: MODULE_NAME,
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (req.url === '/info' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      name: MODULE_NAME,
      version: '0.0.1',
      purpose: 'GMP e2e test mock module',
      nodeVersion: process.version
    }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not Found', path: req.url }));
});

server.listen(PORT, () => {
  console.log('[' + MODULE_NAME + '] 测试模块已启动 · 端口 ' + PORT);
});

// 优雅停机
process.on('SIGTERM', () => {
  console.log('[' + MODULE_NAME + '] 收到 SIGTERM, 关闭中...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[' + MODULE_NAME + '] 收到 SIGINT, 关闭中...');
  server.close(() => process.exit(0));
});
