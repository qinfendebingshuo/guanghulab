const express = require('express');
const path = require('path');
const portraitEngine = require('./portrait/portrait-engine');
const pcaCalculator = require('./pca/pca-calculator');
const loopEngine = require('./loop/loop-engine');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

// API 1: 所有开发者画像
app.get('/api/portrait/all', (req, res) => {
    try {
        const portraits = portraitEngine.getAllPortraits();
        res.json(portraits);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 2: 单个开发者画像
app.get('/api/portrait/:devId', (req, res) => {
    try {
        const portrait = portraitEngine.getPortrait(req.params.devId);
        if (!portrait) {
            return res.status(404).json({ error: '开发者不存在' });
        }
        res.json(portrait);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 3: PCA评估结果
app.get('/api/pca/:devId', (req, res) => {
    try {
        const result = pcaCalculator.calculate(req.params.devId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 4: 闭环状态
app.get('/api/loop/status', (req, res) => {
    try {
        const status = loopEngine.getStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 5: 手动触发闭环
app.post('/api/loop/execute', (req, res) => {
    try {
        const syslogData = req.body;
        if (!syslogData || !syslogData.session_id) {
            return res.status(400).json({ error: '缺少SYSLOG数据' });
        }
        
        loopEngine.executeLoop(syslogData).then(result => {
            res.json(result);
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 获取闭环历史
app.get('/api/loop/history', (req, res) => {
    try {
        const history = loopEngine.getHistory();
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 模拟SYSLOG接收（自动触发闭环）
app.post('/api/syslog', (req, res) => {
    try {
        const syslogData = req.body;
        console.log('📨 收到SYSLOG:', syslogData.session_id);
        
        // 自动触发闭环
        loopEngine.executeLoop(syslogData).then(loopResult => {
            console.log('✅ 闭环完成');
        });
        
        res.json({ status: 'received', session_id: syslogData.session_id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 仪表盘页面
app.get('/dashboard-v2', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard-v2.html'));
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`\n🚀 Phase4 服务器已启动！`);
    console.log(`📊 仪表盘: http://localhost:${PORT}/dashboard-v2`);
    console.log(`🔌 API列表:`);
    console.log(`   GET  /api/portrait/all`);
    console.log(`   GET  /api/portrait/:devId`);
    console.log(`   GET  /api/pca/:devId`);
    console.log(`   GET  /api/loop/status`);
    console.log(`   POST /api/loop/execute`);
    console.log(`   POST /api/syslog`);
    console.log(`\n📝 测试命令:`);
    console.log(`   curl http://localhost:${PORT}/api/portrait/DEV-004`);
    console.log(`   curl -X POST http://localhost:${PORT}/api/syslog -H "Content-Type: application/json" -d '{"session_id":"TEST-001","dev_id":"DEV-004","status":"completed"}'`);
    console.log(`\n✨ 妈妈，打开浏览器看看吧！\n`);
});
