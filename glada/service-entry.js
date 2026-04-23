#!/usr/bin/env node
/**
 * GLADA Service Entry · service-entry.js
 *
 * 轻量包装器：在 service.js 启动前，自动注入 web 扩展
 * （CORS · 映川人格对话 · 系统状态仪表盘）
 *
 * 原理：拦截 Express app.listen()，在监听前注入 web-extensions 路由
 * 这样不需要修改 service.js 本体
 *
 * PM2 入口：ecosystem.config.js → script: 'service-entry.js'
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

const express = require('express');
const _origListen = express.application.listen;
let _patched = false;

// 拦截 app.listen()，在监听前注入 web 扩展
express.application.listen = function(...args) {
  if (!_patched) {
    _patched = true;
    try {
      require('./web-extensions')(this);
      console.log('[GLADA] ✅ Web扩展已注入（CORS · 映川对话 · 系统状态）');
      console.log('[GLADA]    POST /api/glada/chat/yingchuan  映川对话');
      console.log('[GLADA]    GET  /api/glada/system-status   系统状态');
    } catch(e) {
      console.warn('[GLADA] ⚠️ web-extensions加载跳过:', e.message);
    }
  }
  return _origListen.apply(this, args);
};

// 启动原始 GLADA 服务
require('./service');
