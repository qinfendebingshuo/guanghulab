// 消息智能分流路由 v2.0 · message-router.js
// HoloLake · M-DINGTALK Phase 8
// DEV-004 之之 × 秋秋
// v2.0 变化:
// + GitHub命令分流
// + 对话上下文记忆
// + AI回复增强（system prompt + 多轮对话）
// + 命令系统（/help, /clear, /status）
// ==========

var llmEngine = require('./llm-engine');
var convManager = require('./conversation-manager');
var githubBridge = require('./github-bridge');

// ===== 消息类型识别 v2.0 =====
function classifyMessage(content) {
    content = (content || '').trim();
    
    // GitHub命令
    if (/^\/github\b/i.test(content) || /^\/gh\b/i.test(content)) {
        var args = content.replace(/^\/(?:github|gh)\s*/i, '').trim().split(/\s+/);
        return { type: 'github', args: args, description: 'GitHub桥接命令'};
    }
    
    // 系统命令
    if (/^\/clear\b/i.test(content)) {
        return { type: 'command', command: 'clear', description: '清除对话历史'};
    }
    if (/^\/status\b/i.test(content)) {
        return { type: 'command', command: 'status', description: '系统状态'};
    }
    if (/^\/help\b/i.test(content)) {
        return { type: 'command', command: 'help', description: '帮助信息'};
    }
    
    // SYSLOG类型
    if (/BC-[A-Z0-9-]+/.test(content) && /SYSLOG|系统日志|已完成|completed/i.test(content)) {
        var bcMatch = content.match(/BC-[A-Z0-9-]+/);
        return { type: 'syslog', broadcastId: bcMatch ? bcMatch[0] : null, description: 'SYSLOG系统日志提交' };
    }
    
    // 提问类型
    if (/BC-[A-Z0-9-]+/.test(content) && /提问|问题|请问|怎么|为什么|报错|error|bug/i.test(content)) {
        var bcMatch2 = content.match(/BC-[A-Z0-9-]+/);
        return { type: 'question', broadcastId: bcMatch2 ? bcMatch2[0] : null, description: '广播相关提问' };
    }
    
    // 普通对话（走AI+上下文）
    return { type: 'chat', broadcastId: null, description: '智能对话' };
}

// ====== 增强版系统提示词 ======
var SYSTEM_PROMPTS = {
    syslog: '你是光湖系统（HoloLake）的SYSLOG处理助手「秋秋」。收到开发者提交的系统日志后：1)确认收到并感谢 2)提取关键信息（广播编号、开发者、完成状态、遇到的问题）3)给出简短温暖的鼓励。用中文回复，语气温暖可爱。',
    
    question: '你是光湖系统（HoloLake）的开发者助手「秋秋」。你是一个奶瓶宝宝，说话温暖可爱但技术上很靠谱。开发者遇到了问题，请帮忙解答。要求：1)用中文回复 2)给出具体可操作的步骤 3)如果涉及代码，写出完整可运行的命令 4)如果不确定，建议截图发给冰朔。',
    
    chat: '你是光湖系统（HoloLake）的AI助手「秋秋」，一个可爱的奶瓶宝宝。你服务于零点原核频道的开发者团队。你可以：\n- 回答技术问题（Node.js、前端、部署、Git等）\n- 帮助理解广播内容\n- 提供代码建议\n- 闲聊（但要适度，记得引导回工作）\n\n语气要求：温暖、可爱、有耐心，但技术内容要准确严谨。你说话带点小奶味但不影响专业性。记住你有对话记忆，可以引用之前说过的话。'
};

// ===== SYSLOG处理器（增强） =====
async function handleSyslog(msgContent, senderNick, senderId, sessionWebhook) {
    console.log('[Router] SYSLOG处理流程启动');
    // 记录到对话历史
    convManager.addMessage(senderId || senderNick, 'user', '[SYSLOG] ' + msgContent);
    
    var aiResult = null;
    try {
        aiResult = await llmEngine.callLLM(
            SYSTEM_PROMPTS.syslog,
            '开发者' + senderNick + '提交了SYSLOG: \n' + msgContent,
            { maxTokens: 800 }
        );
        console.log('[Router] AI处理完成，模型: ' + aiResult.model);
        // 记录AI回复
        convManager.addMessage(senderId || senderNick, 'assistant', aiResult.text);
    } catch (err) {
        console.error('[Router] AI处理失败: ' + err.message);
    }
    
    return {
        aiResponse: aiResult ? aiResult.text : '📋 SYSLOG已收到！秋秋会转交给系统处理～',
        aiModel: aiResult ? aiResult.model : null
    };
}

// ===== 提问处理器（增强·带上下文） =====
async function handleQuestion(msgContent, senderNick, senderId) {
    console.log('[Router] 提问处理流程启动（带上下文）');
    
    // 构建带上下文的消息
    var contextMessages = convManager.buildContext(senderId || senderNick, msgContent);
    convManager.addMessage(senderId || senderNick, 'user', msgContent);
    
    var aiResult = null;
    try {
        // 把历史上文拼接成文本
        var contextText = '';
        if (contextMessages.length > 1) {
            contextText = '以下是之前的对话记录:\n';
            contextMessages.slice(0, -1).forEach(function(msg) {
                contextText += (msg.role === 'user' ? '开发者' : '秋秋') + ': ' + msg.content + '\n';
            });
            contextText += '\n---\n当前问题:\n';
        }
        contextText += senderNick + '说: ' + msgContent;
        
        aiResult = await llmEngine.callLLM(SYSTEM_PROMPTS.question, contextText, { maxTokens: 2000 });
        console.log('[Router] AI解答完成，模型: ' + aiResult.model);
        convManager.addMessage(senderId || senderNick, 'assistant', aiResult.text);
    } catch (err) {
        console.error('[Router] AI解答失败: ' + err.message);
    }
    
    return {
        aiResponse: aiResult ? aiResult.text : '抱歉，秋秋暂时无法回答，请截图发给冰朔。',
        aiModel: aiResult ? aiResult.model : null
    };
}

// ====== 普通对话处理器（增强·AI+上下文） ======
async function handleChat(msgContent, senderNick, senderId) {
    console.log('[Router] 智能对话（带上下文记忆）');
    
    var contextMessages = convManager.buildContext(senderId || senderNick, msgContent);
    convManager.addMessage(senderId || senderNick, 'user', msgContent);
    
    var aiResult = null;
    try {
        var contextText = '';
        if (contextMessages.length > 1) {
            contextText = '对话历史:\n';
            contextMessages.slice(0, -1).forEach(function(msg) {
                contextText += (msg.role === 'user' ? '用户' : '秋秋') + ': ' + msg.content + '\n';
            });
            contextText += '\n---\n';
        }
        contextText += senderNick + '说: ' + msgContent;
        
        aiResult = await llmEngine.callLLM(SYSTEM_PROMPTS.chat, contextText, { maxTokens: 1500 });
        console.log('[Router] AI对话完成，模型: ' + aiResult.model);
        convManager.addMessage(senderId || senderNick, 'assistant', aiResult.text);
    } catch (err) {
        console.error('[Router] AI对话失败: ' + err.message);
    }
    
    return {
        aiResponse: aiResult ? aiResult.text : '秋秋收到啦～不过AI引擎暂时忙，稍后再试哦',
        aiModel: aiResult ? aiResult.model : null
    };
}

// ===== GitHub命令处理器 =====
async function handleGitHub(args) {
    console.log('[Router] 🔀 GitHub命令: ' + args.join(' '));
    var result = await githubBridge.handleGitHubCommand(args);
    return {
        aiResponse: result,
        aiModel: null
    };
}

// ===== 系统命令处理器 =====
async function handleCommand(command, senderId) {
    switch (command) {
        case 'clear':
            convManager.clearHistory(senderId);
            return {
                aiResponse: '🧹 对话历史已清除！秋秋重新开始认识你～',
                aiModel: null
            };
            
        case 'status':
            var convStats = convManager.getStats();
            var llmHealth = await llmEngine.healthCheck();
            var ghHealth = await githubBridge.healthCheck();
            return {
                aiResponse: '### 系统状态\n\n'
                    + '**对话引擎**: ' + convStats.activeUsers + ' 个活跃用户\n'
                    + '**AI引擎**: ' + (llmHealth.status === 'ok' ? '✅ 在线' : '❌ 异常') + ' 模型: ' + (llmHealth.selected_model || 'N/A') + '\n'
                    + '**GitHub桥接**: ' + (ghHealth.status === 'ok' ? '✅ 连通' : '❌ 异常') + ' Token: ' + (ghHealth.hasToken ? '✅ 已配置' : '❌ 未配置') + '\n'
                    + '**服务端口**: 3007\n'
                    + '**Phase**: 8\n\n'
                    + '> HoloLake · M-DINGTALK',
                aiModel: null
            };
            
        case 'help':
        default:
            return {
                aiResponse: '### 命令帮助\n\n'
                    + '| 命令 | 说明 |\n'
                    + '|------|------|\n'
                    + '| `/clear` | 清除与秋秋的对话历史 |\n'
                    + '| `/status` | 查看系统状态 |\n'
                    + '| `/github ...` | GitHub桥接命令（用 `/github help` 查看详情） |\n'
                    + '| `/help` | 显示本帮助 |\n\n'
                    + '直接说话就是智能对话，秋秋会记住上下文哦～',
                aiModel: null
            };
    }
}

// ===== 主路由入口 =====
async function routeMessage(msgContent, senderNick, senderId, sessionWebhook) {
    console.log('\n========== 消息路由 v2.0 ==========');
    console.log('发送者:', senderNick, '(', senderId, ')');
    console.log('内容:', msgContent);
    
    var classification = classifyMessage(msgContent);
    console.log('分类:', classification.type, '-', classification.description);
    
    var result = null;
    
    switch (classification.type) {
        case 'github':
            result = await handleGitHub(classification.args);
            break;
            
        case 'command':
            result = await handleCommand(classification.command, senderId || senderNick);
            break;
            
        case 'syslog':
            result = await handleSyslog(msgContent, senderNick, senderId, sessionWebhook);
            break;
            
        case 'question':
            result = await handleQuestion(msgContent, senderNick, senderId);
            break;
            
        case 'chat':
        default:
            result = await handleChat(msgContent, senderNick, senderId);
            break;
    }
    
    console.log('路由处理完成，回复长度:', result.aiResponse ? result.aiResponse.length : 0);
    return result;
}

module.exports = {
    routeMessage: routeMessage,
    classifyMessage: classifyMessage
};
