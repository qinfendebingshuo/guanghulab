// ══ BC-集成-005 新增: 开发者详情 ══
const express = require('express');
const router = express.Router();
const axios = require('axios');

// GET /api/dashboard/dev/:id
router.get('/dev/:id', async function(req, res) {
  try {
    var devId = req.params.id;
    var resp = await axios.post(
      'https://api.notion.com/v1/databases/' + process.env.DASHBOARD_DATABASE_ID + '/query',
      {
        filter: {
          property: '孕育者',
          rich_text: { contains: devId }
        }
      },
      {
        headers: {
          'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );
    var results = resp.data.results;
    if (results.length === 0) {
      return res.json({ source: 'notion', data: null, message: '未找到该开发者' });
    }
    var devModules = results.map(function(page) {
      var p = page.properties;
      function gt(prop) {
        if (!prop) return '';
        if (prop.title) return prop.title.map(function(t) {return t.plain_text;}).join('');
        if (prop.rich_text) return prop.rich_text.map(function(t) {return t.plain_text;}).join('');
        if (prop.select) return prop.select ? prop.select.name : '';
        if (prop.status) return prop.status ? prop.status.name : '';
        if (prop.checkbox !== undefined) return prop.checkbox;
        return '';
      }
      return {
        name: gt(p['名称']),
        developer: gt(p['孕育者']),
        status: gt(p['对接状态']),
        version: gt(p['当前版本']),
        persona: gt(p['宝宝人格体']),
        notes: gt(p['备注']),
        type: gt(p['类型'])
      };
    });
    res.json({ source: 'notion', dev_id: devId, data: devModules });
  } catch (err) {
    console.log('❌ 开发者详情查询失败：', err.message);
    res.json({ source: 'fallback', data: {} });
  }
});

// GET /api/dashboard/modules
router.get('/modules', async function(req, res) {
  try {
    var resp = await axios.post(
      'https://api.notion.com/v1/databases/' + process.env.MODULE_DATABASE_ID + '/query',
      {},
      {
        headers: {
          'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );
    var modules = resp.data.results.map(function(page) {
      var p = page.properties;
      function gt(prop) {
        if (!prop) return '';
        if (prop.title) return prop.title.map(function(t){return t.plain_text;}).join('');
        if (prop.rich_text) return prop.rich_text.map(function(t){return t.plain_text;}).join('');
        if (prop.select) return prop.select ? prop.select.name : '';
        if (prop.multi_select) return prop.multi_select.map(function(s){return s.name;}).join(', ');
        return '';
      }
      return {
        module_id: gt(p['模块编号']),
        name: gt(p['模块名称']),
        status: gt(p['状态']),
        developer: gt(p['执行者']),
        tags: gt(p['功能标签']),
        domain: gt(p['数据域'])
      };
    });
    res.json({ source: 'notion', data: modules });
  } catch (err) {
    console.log('❌ 模块列表查询失败：', err.message);
    res.json({ source: 'fallback', data: {} });
  }
});

module.exports = router;
