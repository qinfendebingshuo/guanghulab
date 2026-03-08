const express = require('express');
const axios = require('axios');
const router = express.Router();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_VERSION = '2022-06-28';
const BASE_URL = 'https://api.notion.com/v1';

const headers = () => ({
  'Authorization': 'Bearer ' + NOTION_TOKEN,
  'Content-Type': 'application/json',
  'Notion-Version': NOTION_VERSION
});

router.get('/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Notion 路由正常', 
    token_configured: !!NOTION_TOKEN 
  });
});

router.get('/database/:id', async (req, res) => {
  try {
    const response = await axios.post(
      BASE_URL + '/databases/' + req.params.id + '/query',
      {},
      { headers: headers() }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message, detail: err.response ? err.response.data : null });
  }
});

router.get('/page/:id', async (req, res) => {
  try {
    const response = await axios.get(
      BASE_URL + '/pages/' + req.params.id,
      { headers: headers() }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message, detail: err.response ? err.response.data : null });
  }
});

router.post('/page', async (req, res) => {
  try {
    const response = await axios.post(
      BASE_URL + '/pages',
      req.body,
      { headers: headers() }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message, detail: err.response ? err.response.data : null });
  }
});

module.exports = router;
