require('dotenv').config();
const express = require('express');
const path = require('path');
const handleWebhook = require('./webhook');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        time: new Date().toISOString(),
        webhook_path: '/webhook'
    });
});

app.get('/', (req, res) => {
    res.json({
        message: '钉钉机器人服务运行中',
        mode: 'webhook',
        time: new Date().toLocaleString('zh-CN')
    });
});

app.post('/webhook', handleWebhook);

app.listen(PORT, () => {
    console.log(`之之秋秋机器人启动：http://localhost:${PORT}`);
    console.log(`Webhook: http://localhost:${PORT}/webhook`);
});
