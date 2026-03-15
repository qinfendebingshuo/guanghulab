require('dotenv').config();
const { DWClient, TOPIC_ROBOT, EventAck } = require('dingtalk-stream');

const client = new DWClient({
  clientId: process.env.DINGTALK_APP_KEY,
  clientSecret: process.env.DINGTALK_APP_SECRET,
});

client.registerCallbackListener(TOPIC_ROBOT, async (res) => {
  console.log('[DEBUG] 触发！res =', JSON.stringify(res, null, 2));
  return EventAck.SUCCESS;
});

client.connect();
console.log('Stream 监听中，请 @机器人 发消息...');
