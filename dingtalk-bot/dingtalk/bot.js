// dingtalk/bot.js
// Phase 2 - 钉钉机器人

function sendMessage(message) {
  console.log('[DingTalk] 发送消息:', message);
  return { status: 'sent' };
}

module.exports = { sendMessage };
