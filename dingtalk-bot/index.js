require('dotenv').config({ path: '/opt/guanghulab-dingtalk/dingtalk-bot/.env' });
var express = require('express');
var axios = require('axios');
var app = express();
var PORT = process.env.PORT || 3007;

// 引入 v3 webhook 处理器
var dingtalkWebhook = require('./dingtalk-webhook-v3');

app.use(require('cors')());
app.use(require('body-parser').json());

// 健康检查
app.get('/dingtalk/callback', dingtalkWebhook.healthCheck);

// 消息回调（使用签名验证中间件 + 处理器）
app.post('/dingtalk/callback', 
    dingtalkWebhook.verifyMiddleware, 
    dingtalkWebhook.handleCallback
);

// ======= Phase 8 新增API路由 =======
var llmEngine = require('./llm-engine');
var githubBridge = require('./github-bridge');
var convManager = require('./conversation-manager');

// LLM引擎状态
app.get('/api/dingtalk/llm-status', async function(req, res) {
    try {
        var status = await llmEngine.healthCheck();
        res.json(status);
    } catch (err) {
        res.json({ status: 'error', error: err.message });
    }
});

// GitHub桥接状态
app.get('/api/dingtalk/github-status', async function(req, res) {
    try {
        var status = await githubBridge.healthCheck();
        res.json(status);
    } catch (err) {
        res.json({ status: 'error', error: err.message });
    }
});

// 对话引擎统计
app.get('/api/dingtalk/conv-stats', function(req, res) {
    res.json(convManager.getStats());
});

// 综合系统状态
app.get('/api/dingtalk/system-status', async function(req, res) {
    try {
        var llmStatus = await llmEngine.healthCheck();
        var ghStatus = await githubBridge.healthCheck();
        var convStats = convManager.getStats();
        res.json({
            service: 'M-DINGTALK',
            phase: 8,
            version: 'v3.0',
            llm: llmStatus,
            github: ghStatus,
            conversations: convStats,
            uptime: process.uptime(),
            time: new Date().toLocaleString('zh-CN')
        });
    } catch (err) {
        res.json({ status: 'error', error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 M-DINGTALK Phase 8 v3.0 启动，端口：' + PORT);
});

process.stdin.resume();
process.on('uncaughtException', (err) => { 
    console.error('❌ 未捕获异常:', err.message);
});
