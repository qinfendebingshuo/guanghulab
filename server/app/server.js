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
const federation = require('./modules/agent-federation');

// 原有代码保持不变...

// ═══════════════════════════════════════════════════════════
// 新增联邦握手协议
// ═══════════════════════════════════════════════════════════
const server = app.listen(3800, () => {
  console.log(`铸渊服务器运行中: http://localhost:3800`);
  
  // 初始化联邦握手服务
  federation.initFederation(server);
});

// 原有代码保持不变...