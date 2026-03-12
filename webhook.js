// 之秋秋机器人 - webhook处理器
const { queryDeveloper, queryModule, queryRecentSyslogs, queryStats } = require('./utils/queryApi');

module.exports = async (req, res) => {
    try {
        const { text, senderStaffId, conversationId } = req.body;

        if (text && text.content) {
            // 先处理查询指令
            const command = text.content.trim();
            let reply = null;
            
            // 查询指令判断
            if (command.startsWith('查DEV-')) {
                const match = command.match(/DEV-\d+/);
                if (match) {
                    const result = await queryDeveloper(match[0]);
                    reply = result.message;
                } else {
                    reply = '❌ 格式不对，试试：查DEV-004';
                }
            }
            else if (command.startsWith('查M-')) {
                const match = command.match(/M-[A-Z]+/);
                if (match) {
                    const result = await queryModule(match[0]);
                    reply = result.message;
                } else {
                    reply = '❌ 格式不对，试试：查M-DINGTALK';
                }
            }
            else if (command === '查最近') {
                const result = await queryRecentSyslogs(5);
                reply = result.message;
            }
            else if (command === '查全部' || command === '全局统计') {
                const result = await queryStats();
                reply = result.message;
            }
            else if (command === '帮助' || command === 'help') {
                reply = `📚 秋秋机器人指令帮助：
• 查DEV-004 - 查询开发者状态
• 查M-DINGTALK - 查询模块进度
• 查最近 - 查看最近5条SYSLOG
• 查全部 / 全局统计 - 查看全局统计
• 帮助 - 显示本帮助`;
            }
            
            // 如果不是查询指令，才交给AI处理
            if (!reply) {
                // 这里调用原来的AI处理函数
                const { processWithAI } = require('./ai');
                reply = await processWithAI(text.content);
            }

            // 返回回复
            res.json({
                msgtype: 'text',
                text: {
                    content: reply
                }
            });
        } else {
            res.json({ 
                msgtype: 'text', 
                text: { 
                    content: '收到' 
                } 
            });
        }
    } catch (error) {
        console.error('webhook处理错误:', error);
        res.json({
            msgtype: 'text',
            text: {
                content: '❌ 服务器开小差了，稍后再试'
            }
        });
    }
};
