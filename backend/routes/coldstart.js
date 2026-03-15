const express = require('express');
const axios = require('axios');
const router = express.Router();

// 冷启动热身接口
router.post('/', async (req, res) => {
  try {
    // 并行执行四项检查
    const [notion, primary, fallback, feishu] = await Promise.allSettled([
      checkNotion(),
      checkPrimaryAPI(),
      checkFallbackAPI(),
      checkFeishu()
    ]);

    const result = {
      status: 'ok',
      message: '冷启动热身完成',
      checks: {
        notion_connection: notion.status === 'fulfilled' ? notion.value : false,
        primary_api: primary.status === 'fulfilled' ? primary.value : false,
        fallback_api: fallback.status === 'fulfilled' ? fallback.value : false,
        feishu_connection: feishu.status === 'fulfilled' ? feishu.value : false
      },
      timestamp: new Date().toISOString()
    };

    res.json(result);
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: '冷启动检查失败',
      error: err.message
    });
  }
});

// 检查 Notion 连接
async function checkNotion() {
  try {
    const token = process.env.NOTION_TOKEN;
    if (!token) return false;
    // 轻量检查：读取 Notion 用户信息
    const response = await axios.get('https://api.notion.com/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28'
      },
      timeout: 5000
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

// 检查主 API
async function checkPrimaryAPI() {
  try {
    const key = process.env.PRIMARY_API_KEY;
    if (!key) return false;
    // 轻量检查：调用一个简单的测试接口
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5
      },
      {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    );
    return response.status === 200;
  } catch {
    return false;
  }
}

// 检查备用 API
async function checkFallbackAPI() {
  try {
    const key = process.env.FALLBACK_API_KEY;
    if (!key) return false;
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5
      },
      {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    );
    return response.status === 200;
  } catch {
    return false;
  }
}

// 检查飞书连接
async function checkFeishu() {
  try {
    const appId = process.env.FEISHU_APP_ID;
    const appSecret = process.env.FEISHU_APP_SECRET;
    if (!appId || !appSecret) return false;
    // 获取 tenant_access_token
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: appId,
        app_secret: appSecret
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      }
    );
    return response.data.code === 0;
  } catch {
    return false;
  }
}

module.exports = router;
