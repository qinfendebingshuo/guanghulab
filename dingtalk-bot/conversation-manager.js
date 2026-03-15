// 对话上下文管理器 · conversation-manager.js · v1.0
// HoloLake · M-DINGTALK Phase 8
// DEV-004 之之 × 秋秋
// 功能：对话历史存储 · 上下文窗口管理 · 多用户隔离
//

var fs = require('fs');
var path = require('path');

// 对话存储目录
var CONVERSATION_DIR = path.join(__dirname, 'conversations');
if (!fs.existsSync(CONVERSATION_DIR)) {
    fs.mkdirSync(CONVERSATION_DIR, { recursive: true });
}

// 配置
var MAX_HISTORY = 20;        // 每个用户最多保留20轮对话
var MAX_CONTEXT_TOKENS = 3000; // 上下文窗口大小（估算字符数）
var EXPIRE_HOURS = 24;       // 对话24小时后过期

// ===== 获取用户对话文件路径 =====
function getConversationPath(userId) {
    var safeId = (userId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(CONVERSATION_DIR, safeId + '.json');
}

// ===== 加载对话历史 =====
function loadHistory(userId) {
    var filePath = getConversationPath(userId);
    try {
        if (!fs.existsSync(filePath)) return [];
        var data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        // 过滤过期消息
        var now = Date.now();
        var expireMs = EXPIRE_HOURS * 60 * 60 * 1000;
        var valid = (data.messages || []).filter(function(msg) {
            return (now - msg.timestamp) < expireMs;
        });
        return valid;
    } catch (err) {
        console.error('[ConvMgr] 加载历史失败:', err.message);
        return [];
    }
}

// ===== 保存对话历史 =====
function saveHistory(userId, messages) {
    var filePath = getConversationPath(userId);
    try {
        // 只保留最近N轮
        var trimmed = messages.slice(-MAX_HISTORY * 2);
        fs.writeFileSync(filePath, JSON.stringify({
            userid: userId,
            updatedAt: new Date().toISOString(),
            messages: trimmed
        }, null, 2), 'utf8');
    } catch (err) {
        console.error('[ConvMgr] 保存历史失败:', err.message);
    }
}

// ====== 添加消息 ======
function addMessage(userId, role, content) {
    var messages = loadHistory(userId);
    messages.push({
        role: role,
        content: content,
        timestamp: Date.now()
    });
    saveHistory(userId, messages);
    return messages;
}

// ====== 构建上下文窗口（给LLM用） ======
function buildContext(userId, currentMessage) {
    var history = loadHistory(userId);
    var contextMessages = [];
    var totalChars = 0;
    
    // 从最新的开始往回取，直到超过上下文窗口
    for (var i = history.length - 1; i >= 0; i--) {
        var msg = history[i];
        var msgChars = (msg.content || '').length;
        if (totalChars + msgChars > MAX_CONTEXT_TOKENS) break;
        contextMessages.unshift({
            role: msg.role,
            content: msg.content
        });
        totalChars += msgChars;
    }
    
    // 添加当前消息
    contextMessages.push({
        role: 'user',
        content: currentMessage
    });
    
    return contextMessages;
}

// ===== 清除用户对话历史 =====
function clearHistory(userId) {
    var filePath = getConversationPath(userId);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return true;
    } catch (err) {
        return false;
    }
}

// ===== 获取活跃对话统计 =====
function getStats() {
    try {
        var files = fs.readdirSync(CONVERSATION_DIR).filter(function(f) {
            return f.endsWith('.json');
        });
        return {
            activeUsers: files.length,
            conversationDir: CONVERSATION_DIR
        };
    } catch (err) {
        return {
            activeUsers: 0,
            conversationDir: CONVERSATION_DIR
        };
    }
}

module.exports = {
    loadHistory: loadHistory,
    saveHistory: saveHistory,
    addMessage: addMessage,
    buildContext: buildContext,
    clearHistory: clearHistory,
    getStats: getStats
};
