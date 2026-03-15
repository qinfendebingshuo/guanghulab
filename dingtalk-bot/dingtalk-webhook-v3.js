// 钉钉Webhook处理器 v3.0 · dingtalk-webhook-v3.js
// HoloLake · M-DINGTALK Phase 8
// DEV-004 之之 × 秋秋
// v3.0 变化:
// + 真实事件处理（加密/解密/验证）
// + 接入conversation-manager上下文
// + 接入github-bridge
// + 更智能的回复格式
// ====================

var crypto = require('crypto');
var axios = require('axios');
var router = require('./message-router');
var eventHandler = require('./dingtalk-event-handler');

var DINGTALK_CONFIG = {
    appKey: process.env.DINGTALK_APP_KEY || '',
    appSecret: process.env.DINGTALK_APP_SECRET || '',
    token: process.env.DINGTALK_TOKEN || '',
    encodingAesKey: process.env.DINGTALK_ENCODING_AES_KEY || ''
};

// ====== 签名验证中间件 ======
function verifyMiddleware(req, res, next) {
    var appSecret = DINGTALK_CONFIG.appSecret;
    if (!appSecret || appSecret.startsWith('替换')) {
        console.log('[DingTalk] ⚠️ APP_SECRET未配置，跳过签名验证');
        return next();
    }
    
    var timestamp = req.headers['timestamp'];
    var sign = req.headers['sign'];
    
    if (!timestamp || !sign) {
        // 可能是事件订阅格式，不带签名头
        return next();
    }
    
    if (Math.abs(Date.now() - parseInt(timestamp)) > 300000) {
        return res.status(403).json({ error: '时间戳过期' });
    }
    
    var stringToSign = timestamp + '\n' + appSecret;
    var hmac = crypto.createHmac('sha256', appSecret);
    hmac.update(stringToSign);
    var computed = hmac.digest('base64');
    
    if (computed === sign) {
        next();
    } else {
        return res.status(403).json({ error: '签名验证失败' });
    }
}

// ====== v3.0 核心：真实回调处理 ======
async function handleCallback(req, res) {
    var body = req.body || {};
    
    // ====== 处理回调验证（check_url） ======
    if (body.encrypt && !body.text) {
        var verifyResult = eventHandler.handleVerify(body, DINGTALK_CONFIG);
        return res.json(verifyResult);
    }
    
    if (body.EventType === 'check_url' || body.challenge) {
        console.log('[DingTalk] 📋 回调验证 · 非加密模式');
        return res.json({ success: true, challenge: body.challenge || 'ok' });
    }
    
    // ====== 快速返回200（钉钉要求3秒内） ======
    res.json({ success: true });
    
    // ====== 解析消息 ======
    var parsed = eventHandler.parseMessage(body, DINGTALK_CONFIG);
    var msg = eventHandler.extractContent(parsed);
    
    if (!msg.content) {
        console.log('[DingTalk] ⚠️ 消息内容为空，跳过');
        return;
    }
    
    var chatDesc = msg.isGroup ? ('群聊·' + msg.conversationTitle) : '单聊';
    console.log(`[DingTalk] 📨 收到消息 | ${chatDesc} | ${msg.senderNick}: ${msg.content}`);
    
    // ====== 路由处理 ======
    var result = await router.routeMessage(
        msg.content,
        msg.senderNick,
        msg.senderId,
        msg.sessionWebhook
    );
    
    if (!result || !result.aiResponse) {
        console.log('[DingTalk] ⚠️ 没有生成回复内容');
        return;
    }
    
    // ====== 消息分类标记 ======
    var classification = router.classifyMessage(msg.content);
    
    // ====== 回复钉钉 ======
    if (msg.sessionWebhook) {
        try {
            var replyText = '';
            
            switch (classification.type) {
                case 'syslog':
                    replyText = '### ✅ SYSLOG 已收到\n\n'
                        + '**提交者**：' + msg.senderNick + '\n'
                        + (result.aiModel ? ('**AI处理**：' + result.aiModel + '\n\n') : '\n')
                        + (result.aiResponse || '') + '\n\n'
                        + '> 🌊 HoloLake · Phase 8';
                    break;
                    
                case 'github':
                    replyText = result.aiResponse;
                    break;
                    
                case 'command':
                    replyText = result.aiResponse;
                    break;
                    
                default:
                    replyText = result.aiResponse
                        + (result.aiModel ? ('\n\n> 🤖 ' + result.aiModel) : '')
                        + '\n> 🌊 HoloLake · 秋秋';
            }
            
            await axios.post(msg.sessionWebhook, {
                msgtype: 'markdown',
                markdown: {
                    title: classification.type === 'syslog' ? '✅ SYSLOG已收到'
                        : classification.type === 'github' ? '🔀 GitHub'
                        : '💙 秋秋',
                    text: replyText.substring(0, 5000) // 钉钉消息长度限制
                }
            }, { timeout: 8000 });
            
            console.log('[DingTalk] ✅ 回复已发送 · ' + replyText.length + '字');
        } catch (err) {
            console.error('[DingTalk] ❌ 回复失败: ' + err.message);
        }
    }
    
    console.log('=================================\n');
}

// ====== 健康检查 ======
function healthCheck(req, res) {
    res.json({
        status: 'ok',
        service: 'M-DINGTALK',
        phase: 8,
        version: 'v3.0',
        features: ['智能分流v2', 'AI多轮对话', '上下文记忆', 'GitHub桥接', '事件加密处理', 'SYSLOG自动写入'],
        uptime: process.uptime(),
        time: new Date().toLocaleString('zh-CN')
    });
}

module.exports = {
    verifyMiddleware: verifyMiddleware,
    handleCallback: handleCallback,
    healthCheck: healthCheck
};
