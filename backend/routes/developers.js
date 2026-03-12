const express = require('express');
const axios = require('axios');
const router = express.Router();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DEVELOPERS_DB_ID = process.env.DEVELOPERS_DB_ID || '';
const NOTION_VERSION = '2022-06-28';
const BASE_URL = 'https://api.notion.com/v1';

const headers = () => ({
  'Authorization': 'Bearer ' + NOTION_TOKEN,
  'Content-Type': 'application/json',
  'Notion-Version': NOTION_VERSION
});

// Validate DEV-XXX format
const DEV_ID_RE = /^DEV-\d{3,}$/;

// Notion database property names (match your Notion schema)
const PROP = {
  DEV_ID: 'DEV编号',
  DEV_ID_ALT: 'DEV ID',
  TITLE: '标题',
  NAME: '姓名',
  NAME_ALT: '名称',
  ROLE: '角色',
  JOB_TITLE: '职位',
  JOB_TITLE_ALT: '岗位',
  EMAIL: '邮箱',
  GITHUB: 'GitHub',
  STATUS: '状态',
};

// Build Notion filter query for developer lookup by DEV ID
function devIdFilter(devId) {
  return {
    or: [
      { property: PROP.DEV_ID, title: { equals: devId } },
      { property: PROP.DEV_ID_ALT, title: { equals: devId } },
      { property: PROP.TITLE, title: { equals: devId } }
    ]
  };
}

// Health check
router.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    message: '开发者路由正常',
    notion_configured: !!NOTION_TOKEN,
    db_configured: !!DEVELOPERS_DB_ID
  });
});

// Extract developer info from a Notion page result
function extractDevInfo(page) {
  const props = page.properties || {};
  const getText = (prop) => {
    if (!prop) return '';
    if (prop.title) return prop.title.map(t => t.plain_text).join('');
    if (prop.rich_text) return prop.rich_text.map(t => t.plain_text).join('');
    if (prop.select) return prop.select.name;
    if (prop.email) return prop.email || '';
    return '';
  };

  return {
    id: page.id,
    devId: getText(props[PROP.DEV_ID] || props[PROP.DEV_ID_ALT] || props[PROP.TITLE]),
    name: getText(props[PROP.NAME] || props[PROP.NAME_ALT]),
    role: getText(props[PROP.ROLE]),
    title: getText(props[PROP.JOB_TITLE] || props[PROP.JOB_TITLE_ALT]),
    email: getText(props[PROP.EMAIL]),
    github: getText(props[PROP.GITHUB]),
    status: getText(props[PROP.STATUS]),
    notionUrl: page.url || ''
  };
}

// GET /api/v1/developers/:devId — Look up developer by DEV-XXX ID from Notion
router.get('/:devId', async (req, res) => {
  const devId = (req.params.devId || '').trim().toUpperCase();

  if (!DEV_ID_RE.test(devId)) {
    return res.status(400).json({ error: '开发者编号格式不正确，请使用 DEV-XXX 格式' });
  }

  if (!NOTION_TOKEN) {
    return res.status(503).json({ error: 'Notion API 未配置', devId: devId, fallback: true });
  }

  if (!DEVELOPERS_DB_ID) {
    return res.status(503).json({ error: '开发者数据库未配置', devId: devId, fallback: true });
  }

  try {
    const response = await axios.post(
      BASE_URL + '/databases/' + DEVELOPERS_DB_ID + '/query',
      { filter: devIdFilter(devId), page_size: 1 },
      { headers: headers() }
    );

    const results = response.data.results || [];
    if (results.length > 0) {
      const dev = extractDevInfo(results[0]);
      return res.json({ found: true, developer: dev });
    }

    return res.json({ found: false, devId: devId, message: '未在 Notion 中找到该开发者，将使用默认配置' });
  } catch (err) {
    const errStatus = err.response ? err.response.status : 500;
    const detail = err.response ? err.response.data : null;
    return res.status(errStatus >= 400 && errStatus < 600 ? errStatus : 500).json({
      error: '查询 Notion 失败: ' + err.message,
      devId: devId,
      fallback: true,
      detail: detail
    });
  }
});

// POST /api/v1/developers — Register a new developer in Notion
router.post('/', async (req, res) => {
  const { devId, name } = req.body || {};

  if (!devId || !DEV_ID_RE.test(devId)) {
    return res.status(400).json({ error: '开发者编号格式不正确' });
  }

  if (!NOTION_TOKEN || !DEVELOPERS_DB_ID) {
    return res.status(503).json({ error: 'Notion 未配置', devId: devId, fallback: true });
  }

  try {
    // Check if already exists
    const checkResp = await axios.post(
      BASE_URL + '/databases/' + DEVELOPERS_DB_ID + '/query',
      { filter: devIdFilter(devId), page_size: 1 },
      { headers: headers() }
    );

    if (checkResp.data.results && checkResp.data.results.length > 0) {
      return res.json({ created: false, message: '开发者已存在', developer: extractDevInfo(checkResp.data.results[0]) });
    }

    // Create new developer page
    const newPage = await axios.post(
      BASE_URL + '/pages',
      {
        parent: { database_id: DEVELOPERS_DB_ID },
        properties: {
          [PROP.TITLE]: { title: [{ text: { content: devId } }] },
          [PROP.NAME]: { rich_text: [{ text: { content: name || devId } }] },
          [PROP.ROLE]: { select: { name: '开发者' } },
          [PROP.STATUS]: { select: { name: '活跃' } }
        }
      },
      { headers: headers() }
    );

    return res.json({ created: true, message: '开发者已自动注册', developer: extractDevInfo(newPage.data) });
  } catch (err) {
    const detail = err.response ? err.response.data : null;
    return res.status(500).json({
      error: '注册失败: ' + err.message,
      devId: devId,
      fallback: true,
      detail: detail
    });
  }
});

module.exports = router;
