const express = require('express');
const axios = require('axios');
const https = require('https');

const router = express.Router();

// 读取环境变量
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

// 创建忽略证书验证的 httpsAgent
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// 测试路由
router.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Notion 路由正常',
    token_configured: !!NOTION_TOKEN
  });
});

// 读取数据库
router.get('/database/:databaseId', async (req, res) => {
  try {
    const databaseId = req.params.databaseId;
    
    if (!NOTION_TOKEN) {
      return res.status(500).json({ error: 'NOTION_TOKEN 未配置' });
    }

    const response = await axios.get(
      `https://api.notion.com/v1/databases/${databaseId}`,
      {
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28'
        },
        httpsAgent: httpsAgent
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Notion API 错误:', error.message);
    res.status(500).json({ 
      error: error.message,
      detail: error.response?.data || null
    });
  }
});

module.exports = router;
