const express = require('express');
const axios = require('axios');
const router = express.Router();

const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const BASE_URL = 'https://open.feishu.cn/open-apis';
const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'qinfendebingshuo';
const REPO_NAME = 'guanghulab';

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

// ══════════════════════════════════════════════════════════
// 🌉 SYSLOG 接收路由（飞书舒舒 → GitHub syslog-inbox）
// ══════════════════════════════════════════════════════════

/**
 * 解析 SYSLOG 消息
 * 支持两种格式：
 *   1. 直接 JSON 对象（POST body）
 *   2. 包含 header 的标准 SYSLOG 格式
 */
function parseSyslog(body) {
  if (!body || typeof body !== 'object') return null;

  // 如果 body 本身就是 SYSLOG（有 header 字段）
  if (body.header && (body.header.broadcast_id || body.header.dev_id)) {
    return body;
  }

  // 如果是飞书消息包裹格式
  if (body.syslog && typeof body.syslog === 'object') {
    return body.syslog;
  }

  // 如果直接有 broadcast_id 和 dev_id（简化格式）
  if (body.broadcast_id && body.dev_id) {
    return { header: { broadcast_id: body.broadcast_id, dev_id: body.dev_id }, ...body };
  }

  return null;
}

router.post('/syslog-receive', async (req, res) => {
  try {
    // ① 解析 SYSLOG
    const syslog = parseSyslog(req.body);
    if (!syslog) {
      return res.status(400).json({
        error: true,
        code: 'INVALID_SYSLOG',
        message: '无效的 SYSLOG 格式，请确保包含 header.broadcast_id 和 header.dev_id'
      });
    }

    // ② 校验必填字段
    const broadcastId = syslog.header?.broadcast_id || syslog.broadcast_id;
    const devId       = syslog.header?.dev_id || syslog.dev_id;

    if (!broadcastId || !devId) {
      return res.status(400).json({
        error: true,
        code: 'MISSING_FIELDS',
        message: '❌ SYSLOG 缺少 broadcast_id 或 dev_id'
      });
    }

    // ③ 写入 GitHub syslog-inbox/
    if (!GITHUB_TOKEN) {
      return res.status(503).json({
        error: true,
        code: 'NO_GITHUB_TOKEN',
        message: 'GitHub Token 未配置，无法写入仓库'
      });
    }

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeDevId   = String(devId).replace(/[^a-zA-Z0-9_-]/g, '');
    const filename  = `SYSLOG-${safeDevId}-${timestampStr}.json`;
    const filePath  = `syslog-inbox/${filename}`;
    const content   = Buffer.from(JSON.stringify(syslog, null, 2)).toString('base64');

    const githubUrl = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;

    const githubResponse = await axios.put(
      githubUrl,
      {
        message: `[BRIDGE] SYSLOG from ${safeDevId} via 飞书`,
        content: content
      },
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    // ④ 回复开发者
    res.json({
      success: true,
      message: '✅ SYSLOG 已提交',
      broadcast_id: broadcastId,
      dev_id: devId,
      filename: filename,
      info: '将在下一个处理窗口自动处理，处理完成后会推送新广播',
      github_sha: githubResponse.data?.content?.sha || ''
    });

  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({
      error: true,
      code: 'SYSLOG_SUBMIT_FAILED',
      message: err.message,
      detail: err.response?.data || null
    });
  }
});

module.exports = router;
