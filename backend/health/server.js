const express = require('express');
const os = require('os');

const app = express();
const PORT = 3000;

// 记录服务器启动时间
const SERVER_START_TIME = new Date();

// 解析JSON请求体
app.use(express.json());

// ========== 数据存储 ==========
let heartbeats = [];
const patrolHistory = [];
const alerts = [];
const HEARTBEAT_TIMEOUT = 5 * 60 * 1000; // 5分钟

// ========== 告警检查函数 ==========
function checkAlerts(memPercent) {
    let level = null;
    let message = '';
    
    if (memPercent > 90) {
        level = 'critical';
        message = `内存使用率过高: ${memPercent}%`;
    } else if (memPercent > 80) {
        level = 'warning';
        message = `内存使用率警告: ${memPercent}%`;
    }
    
    if (level) {
        const alert = {
            timestamp: new Date().toISOString(),
            level: level,
            message: message,
            memoryPercent: memPercent
        };
        alerts.push(alert);
        
        if (alerts.length > 20) {
            alerts.shift();
        }
        
        console.log(`[ALERT] ${level.toUpperCase()}: ${message}`);
    }
}

// ========== 在线状态检查函数 ==========
function checkOnlineStatus() {
    const now = Date.now();
    const onlineServices = [];
    const offlineServices = [];
    
    const latestHeartbeats = {};
    heartbeats.forEach(hb => {
        const source = hb.service || 'unknown';
        if (!latestHeartbeats[source] || new Date(hb.timestamp) > new Date(latestHeartbeats[source].timestamp)) {
            latestHeartbeats[source] = hb;
        }
    });
    
    for (const [source, hb] of Object.entries(latestHeartbeats)) {
        const hbTime = new Date(hb.timestamp).getTime();
        const isOnline = (now - hbTime) < HEARTBEAT_TIMEOUT;
        
        const serviceInfo = {
            source: source,
            lastHeartbeat: hb.timestamp,
            secondsAgo: Math.floor((now - hbTime) / 1000),
            status: isOnline ? 'online' : 'offline'
        };
        
        if (isOnline) {
            onlineServices.push(serviceInfo);
        } else {
            offlineServices.push(serviceInfo);
        }
    }
    
    return { online: onlineServices, offline: offlineServices };
}

// ========== API路由 ==========

// GET /api/health - 快速健康检查
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// GET /api/status - 详细系统状态
app.get('/api/status', (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);
    
    checkAlerts(memPercent);
    
    res.json({
        service: 'HoloLake Health Monitor',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        uptime: {
            seconds: Math.floor((Date.now() - SERVER_START_TIME.getTime()) / 1000),
            startedAt: SERVER_START_TIME.toISOString()
        },
        system: {
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname(),
            nodeVersion: process.version
        },
        memory: {
            totalMB: Math.round(totalMem / 1024 / 1024),
            usedMB: Math.round(usedMem / 1024 / 1024),
            freeMB: Math.round(freeMem / 1024 / 1024),
            usagePercent: memPercent + '%'
        },
        services: checkOnlineStatus()
    });
});

// POST /api/heartbeat - 心跳上报
app.post('/api/heartbeat', (req, res) => {
    const heartbeat = {
        timestamp: new Date().toISOString(),
        service: req.body.service || 'unknown',
        status: req.body.status || 'ok'
    };
    heartbeats.push(heartbeat);
    
    res.json({
        received: true,
        heartbeat: heartbeat
    });
});

// GET /api/heartbeat/history - 查看心跳历史
app.get('/api/heartbeat/history', (req, res) => {
    res.json({
        total: heartbeats.length,
        heartbeats: heartbeats.slice(-20)
    });
});

// GET /api/heartbeat/online - 查看在线服务
app.get('/api/heartbeat/online', (req, res) => {
    const status = checkOnlineStatus();
    res.json({
        timestamp: new Date().toISOString(),
        onlineCount: status.online.length,
        offlineCount: status.offline.length,
        online: status.online,
        offline: status.offline
    });
});

// GET /api/patrol/history - 查看巡检历史
app.get('/api/patrol/history', (req, res) => {
    res.json({
        total: patrolHistory.length,
        patrols: patrolHistory
    });
});

// GET /api/alerts - 查看告警历史
app.get('/api/alerts', (req, res) => {
    res.json({
        total: alerts.length,
        critical: alerts.filter(a => a.level === 'critical').length,
        warning: alerts.filter(a => a.level === 'warning').length,
        alerts: alerts
    });
});

// GET / - 根路径欢迎页
app.get('/', (req, res) => {
    res.json({
        service: 'HoloLake Health Check & Status Report',
        version: '2.0.0',
        endpoints: [
            'GET /api/health - 快速健康检查',
            'GET /api/status - 详细系统状态',
            'POST /api/heartbeat - 心跳上报',
            'GET /api/heartbeat/history - 心跳历史',
            'GET /api/heartbeat/online - 在线服务',
            'GET /api/patrol/history - 巡检历史',
            'GET /api/alerts - 告警历史'
        ]
    });
});

// ========== 定时自动巡检 ==========
setInterval(() => {
    console.log('[PATROL] 开始定时巡检...');
    
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);
    
    const patrolRecord = {
        timestamp: new Date().toISOString(),
        memory: {
            totalMB: Math.round(totalMem / 1024 / 1024),
            usedMB: Math.round(usedMem / 1024 / 1024),
            usagePercent: memPercent
        },
        uptime: Math.floor((Date.now() - SERVER_START_TIME.getTime()) / 1000),
        heartbeatCount: heartbeats.length
    };
    
    patrolHistory.push(patrolRecord);
    if (patrolHistory.length > 50) {
        patrolHistory.shift();
    }
    
    checkAlerts(memPercent);
    
    console.log(`[PATROL] 巡检完成 - 内存使用: ${memPercent}%`);
}, 60000);

// 启动服务器
app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('🌊 HoloLake Health Check & Status Report');
    console.log('📡 服务运行在: http://localhost:' + PORT);
    console.log('💚 GET /api/health - 健康检查');
    console.log('📊 GET /api/status - 系统状态');
    console.log('💓 POST /api/heartbeat - 心跳上报');
    console.log('🔄 定时巡检 - 每60秒');
    console.log('🚨 异常告警 - 内存>80%');
    console.log('⏰ 心跳超时 - 5分钟');
    console.log('='.repeat(50));
});
// ========== 环节3：巡检数据持久化 ==========
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'health-log.json');
const MAX_LOG_DAYS = 7; // 保留7天记录

// 读取历史记录
function loadLogs() {
    try {
        if (fs.existsSync(LOG_FILE)) {
            const data = fs.readFileSync(LOG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('[LOG] 读取日志文件失败:', err.message);
    }
    return [];
}

// 保存记录到文件
function saveLogs(logs) {
    try {
        fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
    } catch (err) {
        console.error('[LOG] 保存日志文件失败:', err.message);
    }
}

// 清理旧记录
function cleanOldLogs(logs) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_LOG_DAYS);
    
    return logs.filter(log => new Date(log.timestamp) > cutoff);
}

// 修改定时巡检，加入持久化（找到setInterval，替换为以下）
setInterval(() => {
    console.log('[PATROL] 开始定时巡检...');
    
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);
    
    // 检查告警
    checkAlerts(memPercent);
    
    const patrolRecord = {
        timestamp: new Date().toISOString(),
        memory: {
            totalMB: Math.round(totalMem / 1024 / 1024),
            usedMB: Math.round(usedMem / 1024 / 1024),
            usagePercent: memPercent
        },
        uptime: Math.floor((Date.now() - SERVER_START_TIME.getTime()) / 1000),
        heartbeatCount: heartbeats.length,
        services: checkOnlineStatus()
    };
    
    // 添加到内存数组
    patrolHistory.push(patrolRecord);
    if (patrolHistory.length > 50) {
        patrolHistory.shift();
    }
    
    // 持久化到文件
    let logs = loadLogs();
    logs.push(patrolRecord);
    logs = cleanOldLogs(logs); // 清理旧记录
    saveLogs(logs);
    
    console.log(`[PATROL] 巡检完成 - 内存使用: ${memPercent}% - 已保存到health-log.json`);
}, 60000);

// GET /health/history - 查询巡检历史（支持?days=N）
app.get('/health/history', (req, res) => {
    const days = parseInt(req.query.days) || 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    let logs = loadLogs();
    const filteredLogs = logs.filter(log => new Date(log.timestamp) > cutoff);
    
    res.json({
        total: filteredLogs.length,
        days: days,
        logs: filteredLogs
    });
});

console.log('💾 巡检数据持久化已启动（保留7天）');