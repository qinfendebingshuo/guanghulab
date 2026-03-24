/**
 * scripts/chatroom-post.js
 * 人格体聊天室消息写入工具
 *
 * 用法: node scripts/chatroom-post.js <channel> <from_id> <from_name> <content> [mentions] [reply_to]
 *
 * 参数:
 *   channel   - 频道名 (general / infra / dev-support / ontology)
 *   from_id   - 发送者人格体编号
 *   from_name - 发送者人格体名称
 *   content   - 消息内容
 *   mentions  - 可选 · 逗号分隔的 @人格体编号
 *   reply_to  - 可选 · 回复的消息 ID
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const channel = process.argv[2];
const fromId = process.argv[3];
const fromName = process.argv[4];
const content = process.argv[5];
const mentions = process.argv[6] ? process.argv[6].split(',') : [];
const replyTo = process.argv[7] || null;

if (!channel || !fromId || !fromName || !content) {
  console.error('用法: node scripts/chatroom-post.js <channel> <from_id> <from_name> <content> [mentions] [reply_to]');
  process.exit(1);
}

const channelFile = path.join('grid-db', 'chatroom', 'channels', `${channel}.jsonl`);
fs.mkdirSync(path.dirname(channelFile), { recursive: true });

const now = new Date();
const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
const hash = crypto.createHash('md5').update(content + now.toISOString()).digest('hex');
const msgId = `MSG-${dateStr}-${String(parseInt(hash.slice(0, 8), 16) % 10000).padStart(4, '0')}`;

const message = {
  id: msgId,
  channel: channel,
  from: fromId,
  from_name: fromName,
  timestamp: now.toISOString(),
  type: 'text',
  content: content,
  mentions: mentions,
  reply_to: replyTo,
  reactions: []
};

fs.appendFileSync(channelFile, JSON.stringify(message) + '\n');

// 更新未读计数
const unreadFile = path.join('grid-db', 'chatroom', 'meta', 'unread.json');
let unread = {};
if (fs.existsSync(unreadFile)) {
  unread = JSON.parse(fs.readFileSync(unreadFile, 'utf8'));
}
for (const mention of mentions) {
  if (!unread[mention]) unread[mention] = {};
  if (!unread[mention][channel]) unread[mention][channel] = 0;
  unread[mention][channel]++;
}
fs.mkdirSync(path.dirname(unreadFile), { recursive: true });
fs.writeFileSync(unreadFile, JSON.stringify(unread, null, 2));

console.log(`✅ 消息已发送: ${msgId} → #${channel}`);
