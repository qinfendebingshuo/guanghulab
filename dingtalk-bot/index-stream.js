require('dotenv').config();
const { DWClient, TOPIC_ROBOT, EventAck } = require('dingtalk-stream');
const { handleMessage } = require('./message-router');

const client = new DWClient({
  clientId: process.env.DINGTALK_APP_KEY,
  clientSecret: process.env.DINGTALK_APP_SECRET,
});

client.registerCallbackListener(TOPIC_ROBOT, async (res) => {
  console.log("[DEBUG] raw:", JSON.stringify(res).substring(0,300));
  const { messageType, text, senderNick, conversationId, sessionWebhook } = res.data;
  console.log(`[Stream] 收到消息 from ${senderNick}: ${text?.content}`);

  try {
    const replyText = await handleMessage({
      msgtype: messageType,
      text: { content: text?.content || '' },
      senderNick,
      conversationId,
      sessionWebhook,
    });

    if (replyText && sessionWebhook) {
      const axios = require('axios');
      await axios.post(sessionWebhook, {
        msgtype: 'text',
        text: { content: replyText },
      });
    }
  } catch (err) {
    console.error('[Stream] 处理消息出错:', err);
  }

  return EventAck.SUCCESS;
});

client.connect().then(() => {
  console.log('🚀 M-DINGTALK Phase 8 Stream 模式已启动');
}).catch(err => {
  console.error('[Stream] 启动失败:', err);
  process.exit(1);
});
