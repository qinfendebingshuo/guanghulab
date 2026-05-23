#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * 🏛️ 铸渊主权服务器应用 · Zhuyuan Sovereign Server
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-SVR-002
 * 端口: 3800
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 修改记录:
 * 2026-04-23 - 新增三节点Agent联邦握手协议
 */

'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execSync } = require('child_process');

// ─── 新增联邦握手协议模块 ───
const { FederationManager } = require('./modules/agent-federation');

// 创建Express应用
const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '../sites')));

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    server: os.hostname(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 其他现有路由...

// 创建HTTP服务器
const server = app.listen(3800, () => {
  console.log(`铸渊服务器运行中: http://localhost:3800`);
  
  // 初始化联邦握手服务
  FederationManager.initFederation(server);
});

// 错误处理
process.on('unhandledRejection', (err) => {
  console.error('未处理的Promise拒绝:', err);
});

process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});