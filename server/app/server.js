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
 * 2026-04-23 - 新增三节点Agent联邦路由
 */

'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execSync } = require('child_process');

// ─── 新增联邦Agent模块 ───
const federation = require('./modules/agent-federation');

// 原有代码保持不变...

// ═══════════════════════════════════════════════════════════
// 新增联邦Agent API路由
// ═══════════════════════════════════════════════════════════
app.post('/api/federation/register', limiter, (req, res) => {
  try {
    const result = federation.registerAgent(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ 
      error: true, 
      code: 'FEDERATION_ERROR',
      message: err.message 
    });
  }
});

app.post('/api/federation/broadcast', limiter, (req, res) => {
  try {
    const result = federation.broadcastMessage(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ 
      error: true, 
      code: 'BROADCAST_ERROR',
      message: err.message 
    });
  }
});

app.get('/api/federation/status', limiter, (req, res) => {
  try {
    const result = federation.getStatus();
    res.json(result);
  } catch (err) {
    res.status(400).json({ 
      error: true, 
      code: 'STATUS_ERROR',
      message: err.message 
    });
  }
});

// 原有代码保持不变...