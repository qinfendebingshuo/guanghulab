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

// 日志目录(自动创建)
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ===== 热身检查函数 =====
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

function checkMemory() {
  var total = os.totalmem();
  var free = os.freemem();
  var used = total - free;
  var usagePercent = Math.round((used / total) * 100);
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

function checkFileSystem() {
  var testFile = path.join(__dirname, '.warmup-test');
  try {
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

// ===== 日志写入(新增) =====
function getLogFilePath() {
  var date = new Date().toISOString().split('T')[0];
  return path.join(LOG_DIR, 'warmup-' + date + '.log');
}

function writeWarmupLog(result) {
  var logFile = getLogFilePath();
  var logEntry = '[' + new Date().toISOString() + '] ' + JSON.stringify(result) + '\n';
  try {
    fs.appendFileSync(logFile, logEntry);
    console.log('[WARMUP-LOG] 已写入: logs/warmup-' + new Date().toISOString().split('T')[0] + '.log');
  } catch (err) {
    console.log('[WARMUP-LOG] ⚠️ 写入失败:', err.message);
  }
}

// ===== 统一检查运行器 =====
function runChecks() {
  return [checkRuntime(), checkMemory(), checkFileSystem(), checkNetwork()];
}

// ===== 自动热身 + 重试(新增) =====
function autoWarmup(maxRetries) {
  if (!maxRetries) maxRetries = 3;
  var attempt = 1;
  function tryOnce() {
    console.log('[AUTO-WARMUP] 尝试第' + attempt + '次...');
    var startTime = Date.now();
    var checks = runChecks();
    var allPassed = checks.every(function(c) { return c.status === 'success'; });
    var elapsed = Date.now() - startTime;
    var result = {
      module: 'M14-ColdstartWarmup',
      timestamp: new Date().toISOString(),
      trigger: 'auto',
      status: allPassed ? 'WARM' : 'PARTIAL',
      attempt: attempt,
      maxRetries: maxRetries,
      elapsed_ms: elapsed,
      checks: checks,
      summary: checks.map(function(c) { return c.name + ':' + c.status; }).join(' | ')
    };
    writeWarmupLog(result);
    if (allPassed) {
      console.log('[AUTO-WARMUP] 热身成功!(第' + attempt + '次)');
      return;
    }
    if (attempt < maxRetries) {
      console.log('[AUTO-WARMUP] ⚠️ 未完全通过,2秒后重试...');
      attempt++;
      setTimeout(tryOnce, 2000);
    } else {
      console.log('[AUTO-WARMUP] ❌ 达到最大重试次数(' + maxRetries + '),请检查系统');
    }
  }
  tryOnce();
}

// ===== API 端点 =====
// POST /api/coldstart - 手动触发热身
app.post('/api/coldstart', function(req, res) {
  console.log('[COLDSTART] 手动热身开始...');
  var startTime = Date.now();
  var checks = runChecks();
  var allPassed = checks.every(function(c) { return c.status === 'success'; });
  var elapsed = Date.now() - startTime;
  var result = {
    module: 'M14-ColdstartWarmup',
    timestamp: new Date().toISOString(),
    trigger: 'manual',
    status: allPassed ? 'WARM' : 'PARTIAL',
    elapsed_ms: elapsed,
    checks: checks,
    summary: checks.map(function(c) { return c.name + ':' + c.status; }).join(' | ')
  };
  writeWarmupLog(result);
  console.log('[COLDSTART] 热身完成:', result.summary, '(' + elapsed + 'ms)');
  res.json(result);
});

// GET /api/coldstart/status - 服务状态
app.get('/api/coldstart/status', function(req, res) {
  res.json({
    module: 'M14-ColdstartWarmup',
    version: '1.1.0',
    serverStartTime: SERVER_START_TIME.toISOString(),
    currentTime: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - SERVER_START_TIME.getTime()) / 1000),
    port: PORT,
    ready: true,
    logDir: 'logs/'
  });
});

// GET /api/coldstart/logs - 查看热身日志(新增)
app.get('/api/coldstart/logs', function(req, res) {
  try {
    var files = fs.readdirSync(LOG_DIR)
      .filter(function(f) { return f.startsWith('warmup-') && f.endsWith('.log'); })
      .sort()
      .reverse();
    if (files.length === 0) {
      return res.json({ logs: [], message: '暂无日志记录' });
    }
    var latestFile = path.join(LOG_DIR, files[0]);
    var content = fs.readFileSync(latestFile, 'utf8');
    var lines = content.trim().split('\n').map(function(line) {
      try {
        var match = line.match(/^\[(.+?)\] (.+)$/);
        if (match) {
          return { time: match[1], data: JSON.parse(match[2]) };
        }
      } catch (e) {}
      return { raw: line };
    });
    res.json({
      file: files[0],
      totalLogFiles: files.length,
      entries: lines,
      allFiles: files
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET / - 根路径欢迎页
app.get('/', function(req, res) {
  res.json({
    service: 'HoloLake Coldstart Warmup System',
    version: '1.1.0',
    features: ['auto-warmup-on-start', 'file-logging', 'retry-mechanism'],
    endpoints: [
      'POST /api/coldstart - 手动触发热身',
      'GET /api/coldstart/status - 查看服务状态',
      'GET /api/coldstart/logs - 查看热身日志'
    ]
  });
});

// 启动服务器
app.listen(PORT, function() {
  console.log('='.repeat(50));
  console.log('🌊 HoloLake Coldstart Warmup System v1.1');
  console.log('📡 服务运行在: http://localhost:' + PORT);
  console.log('🔥 POST /api/coldstart 手动热身');
  console.log('📋 GET /api/coldstart/logs 查看日志');
  console.log('='.repeat(50));
  // 启动时自动热身(最多重试3次)
  autoWarmup(3);
});