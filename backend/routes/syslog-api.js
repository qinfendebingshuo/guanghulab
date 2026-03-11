const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');

const router = express.Router();

// 读取环境变量
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const SYSLOG_DATABASE_ID = process.env.SYSLOG_DATABASE_ID || process.env.NOTION_DATABASE_ID; // 如果没有单独配置，先用 NOTION_DATABASE_ID

// 创建忽略证书验证的 httpsAgent（和 notion.js 一样）
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// 确保日志目录存在
const LOG_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// GET /api/syslog/test - 测试端点
router.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'SYSLOG 接收端点正常',
    notion_configured: !!NOTION_TOKEN,
    database_id_configured: !!SYSLOG_DATABASE_ID
  });
});

// POST /api/syslog/receive - 接收 SYSLOG
router.post('/receive', async (req, res) => {
  try {
    const { dev_id, task_id, completed, summary, timestamp } = req.body;

    // 校验必填字段
    if (!dev_id || !task_id) {
      return res.status(400).json({
        status: 'error',
        message: 'dev_id 和 task_id 为必填项'
      });
    }

    // 准备要写入 Notion 的数据
    const notionPageData = {
      parent: { database_id: SYSLOG_DATABASE_ID },
      properties: {
        '标题': {
          title: [
            {
              text: {
                content: `SYSLOG-${dev_id}-${task_id}`
              }
            }
          ]
        },
        'DEV编号': {
          select: {
            name: dev_id
          }
        },
        '任务编号': {
          rich_text: [
            {
              text: {
                content: task_id
              }
            }
          ]
        },
        '完成状态': {
          select: {
            name: completed === true ? '已完成' : (completed === false ? '未完成' : '进行中')
          }
        },
        '摘要': {
          rich_text: [
            {
              text: {
                content: summary || ''
              }
            }
          ]
        },
        '接收时间': {
          date: {
            start: timestamp || new Date().toISOString()
          }
        },
        '来源': {
          rich_text: [
            {
              text: {
                content: '铸渊'
              }
            }
          ]
        }
      }
    };

    // 尝试写入 Notion
    if (NOTION_TOKEN && SYSLOG_DATABASE_ID) {
      try {
        const response = await axios.post(
          'https://api.notion.com/v1/pages',
          notionPageData,
          {
            headers: {
              'Authorization': `Bearer ${NOTION_TOKEN}`,
              'Content-Type': 'application/json',
              'Notion-Version': '2022-06-28'
            },
            httpsAgent: httpsAgent
          }
        );

        return res.json({
          status: 'ok',
          written_to: 'notion',
          notion_page_id: response.data.id
        });
      } catch (notionError) {
        console.error('Notion 写入失败，写入本地日志:', notionError.message);
        
        // 写入本地日志文件
        const logFile = path.join(LOG_DIR, `syslog-pending-${Date.now()}.json`);
        fs.writeFileSync(logFile, JSON.stringify({
          ...req.body,
          received_at: new Date().toISOString(),
          notion_error: notionError.message
        }, null, 2));

        return res.json({
          status: 'ok',
          written_to: 'local',
          reason: 'Notion 写入失败，已存为本地日志',
          local_file: logFile
        });
      }
    } else {
      // 没有配置 Notion，直接存本地
      const logFile = path.join(LOG_DIR, `syslog-pending-${Date.now()}.json`);
      fs.writeFileSync(logFile, JSON.stringify({
        ...req.body,
        received_at: new Date().toISOString()
      }, null, 2));

      return res.json({
        status: 'ok',
        written_to: 'local',
        reason: 'Notion 未配置，已存为本地日志',
        local_file: logFile
      });
    }
  } catch (error) {
    console.error('SYSLOG 接收错误:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
