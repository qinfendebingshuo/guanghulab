const express = require('express');
const axios = require('axios');
const router = express.Router();

const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const BASE_URL = 'https://open.feishu.cn/open-apis';

// 获取飞书 tenant_access_token
async function getToken() {
  const response = await axios.post(
    BASE_URL + '/auth/v3/tenant_access_token/internal',
    {
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET
    }
  );
  return response.data.tenant_access_token;
}

router.get('/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: '飞书路由正常', 
    app_id_configured: !!FEISHU_APP_ID,
    app_secret_configured: !!FEISHU_APP_SECRET
  });
});

// 发送消息到飞书群
router.post('/broadcast', async (req, res) => {
  try {
    const { chat_id, title, content } = req.body;
    const token = await getToken();
    const response = await axios.post(
      BASE_URL + '/im/v1/messages?receive_id_type=chat_id',
      {
        receive_id: chat_id,
        msg_type: 'text',
        content: JSON.stringify({ text: title + '\n\n' + content })
      },
      {
        headers: { 'Authorization': 'Bearer ' + token }
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message, detail: err.response ? err.response.data : null });
  }
});

module.exports = router;