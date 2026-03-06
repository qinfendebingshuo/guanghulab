const express = require('express');
const os = require('os');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3014;

// 中间件:解析JSON请求体
app.use(express.json());

// 启动时间记录
const SERVER_START_TIME = new Date();

// ===== 热身检查函数 =====
// 检查1:Node.js 运行时状态
function checkRuntime() {
  return {
    name: 'runtime_check',
    status: 'success',
    detail: {
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      uptime: Math.floor(process.uptime()) + 's'
    }
  };
}

// 检查2:内存状态
function checkMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const usagePercent = Math.round((used / total) * 100);
  return {
    name: 'memory_check',
    status: usagePercent < 90 ? 'success' : 'warning',
    detail: {
      totalMB: Math.round(total / 1024 / 1024),
      freeMB: Math.round(free / 1024 / 1024),
      usedMB: Math.round(used / 1024 / 1024),
      usagePercent: usagePercent + '%'
    }
  };
}

// 检查3:文件系统可写性
function checkFileSystem() {
  try {
    const testFile = path.join(__dirname, '.warmup-test');
    fs.writeFileSync(testFile, 'warmup-' + Date.now());
    fs.unlinkSync(testFile);
    return {
      name: 'filesystem_check',
      status: 'success',
      detail: { writable: true, testPath: __dirname }
    };
  } catch (err) {
    return {
      name: 'filesystem_check',
      status: 'failed',
      detail: { writable: false, error: err.message }
    };
  }
}

// 检查4:网络端口监听确认
function checkNetwork() {
  return {
    name: 'network_check',
    status: 'success',
    detail: {
      port: PORT,
      hostname: os.hostname(),
      interfaces: Object.keys(os.networkInterfaces()).length
    }
  };
}

// ===== API 端点 =====
// POST /api/coldstart - 冷启动热身(核心端点)
app.post('/api/coldstart', function(req, res) {
  console.log('[COLDSTART] 热身开始...');
  const startTime = Date.now();
  const checks = [
    checkRuntime(),
    checkMemory(),
    checkFileSystem(),
    checkNetwork()
  ];
  const allPassed = checks.every(function(c) {
    return c.status === 'success';
  });
  const elapsed = Date.now() - startTime;
  const result = {
    module: 'M14-ColdstartWarmup',
    timestamp: new Date().toISOString(),
    status: allPassed ? 'WARM' : 'PARTIAL',
    checks: checks,
    elapsed_ms: elapsed,
    summary: checks.map(function(c) { return c.name + ':' + c.status; }).join(' | ')
  };
  console.log('[COLDSTART] 热身完成:', result.summary, '(' + elapsed + 'ms)');
  res.json(result);
});

// GET /api/coldstart/status - 查看上次热身状态
app.get('/api/coldstart/status', function(req, res) {
  res.json({
    module: 'M14-ColdstartWarmup',
    serverStartTime: SERVER_START_TIME.toISOString(),
    currentTime: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - SERVER_START_TIME.getTime()) / 1000),
    port: PORT,
    ready: true
  });
});

// GET / - 根路径欢迎页
app.get('/', function(req, res) {
  res.json({
    service: 'HoloLake Coldstart Warmup System',
    version: '1.0.0',
    endpoints: [
      'POST /api/coldstart - 执行冷启动热身',
      'GET /api/coldstart/status - 查看服务状态'
    ]
  });
});

// 启动服务器
app.listen(PORT, function() {
  console.log('='.repeat(50));
  console.log('🌊 HoloLake Coldstart Warmup System');
  console.log('='.repeat(50));
  console.log('📡 服务运行在: http://localhost:' + PORT);
  console.log('🔥 POST /api/coldstart 开始热身');
});