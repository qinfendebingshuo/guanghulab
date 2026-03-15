/**
 * M-DINGTALK · index-stream.js · v1.0
 * 开发者：之之（DEV-004）
 * 功能：钉钉 Stream 模式机器人主入口
 * 修改日期：2026-03-15
 */
require('dotenv').config();
const { DWClient, TOPIC_ROBOT, EventAck } = require('dingtalk-stream');

const client = new DWClient({
  clientId: process.env.DINGTALK_APP_KEY,
  clientSecret: process.env.DINGTALK_APP_SECRET,
});

client.registerCallbackListener(TOPIC_ROBOT, async (res) => {
  console.log("[DEBUG] 收到原始回调:", JSON.stringify(res).substring(0, 100));
  try {
    const msgData = res.data || res;
    const senderNick = msgData.senderNick || msgData.senderId || '未知用户';
    const content = msgData.text?.content || msgData.content?.content || '';
    const sessionWebhook = msgData.sessionWebhook;

    console.log(`[Stream] 收到消息 | 发送者：${senderNick} | 内容：${content.trim()}`);

    // 尝试写入 Notion SYSLOG
    try {
      const { Client } = require('@notionhq/client');
      const notion = new Client({ auth: process.env.NOTION_TOKEN });
      await notion.pages.create({
        parent: { database_id: process.env.NOTION_SYSLOG_DB_ID },
        properties: {
          '标题': {
            title: [{ text: { content: `[钉钉消息] ${senderNick}: ${content.trim().substring(0, 50)}` } }]
          }
        }
      });
      console.log('[Notion] SYSLOG 写入成功');
    } catch (notionErr) {
      console.error('[Notion] 写入失败: ', notionErr.message);
    }

    // AI 回复
    if (process.env.LLM_API_KEY && sessionWebhook) {
      const axios = require('axios');
      const llmRes = await axios.post(
        `${process.env.LLM_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`,
        {
          model: process.env.LLM_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: process.env.BOT_SYSTEM_PROMPT || '你是之之秋秋，一个温馨聊天的钉钉机器人。' },
            { role: 'user', content: content.replace(`@${msgData.robotCode || ''}`, '').trim() }
          ],
          max_tokens: 500
        },
        {
          headers: { 'Authorization': `Bearer ${process.env.LLM_API_KEY}` }
        }
      );
      const reply = llmRes.data.choices[0].message.content;
      await axios.post(sessionWebhook, {
        msgtype: 'text',
        text: { content: reply }
      });
      console.log(`[Stream] 回复已发送, 长度: ${reply.length}`);
    }
  } catch (err) {
    console.error('[Stream] 处理出错: ', err.message);
  }
  return EventAck.SUCCESS;
});

client.connect();
console.log('M-DINGTALK Phase 9 - Stream 模式已启动');
