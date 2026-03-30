// M-FLOATING-AI · 秋秋 AI 对话后端服务
// DEV-004 之之 · BC-M-FLOATING-AI-005-ZZ · Phase 5

require('dotenv').config();
const http = require('http');
const { sendMessage } = require('./api-client');

const PORT = process.env.PORT || 3004;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  if (req.method === 'POST' && req.url === '/chat') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { message, history } = JSON.parse(body);
        const reply = await sendMessage(message, history || []);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: '秋秋的大脑连接中，稍等一下～💕' }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', persona: '秋秋', port: PORT }));
    return;
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => {
  console.log(`✅ 秋秋的大脑服务已启动，端口 ${PORT}`);
});
