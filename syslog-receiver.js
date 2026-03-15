// syslog-receiver.js
// Phase 1 - SYSLOG接收器

function receive(data) {
  console.log('[SYSLOG] 收到数据:', data);
  return { status: 'received', data };
}

module.exports = { receive };
