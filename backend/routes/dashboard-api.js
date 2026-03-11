const express = require('express');
const router = express.Router();

// GET /api/dashboard/test - 看板API运行状态
router.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Dashboard API 运行正常',
    timestamp: new Date().toISOString()
  });
});

// GET /api/dashboard/team-status - 团队开发进度
router.get('/team-status', (req, res) => {
  const teamData = {
    updated_at: new Date().toISOString(),
    members: [
      { dev_id: 'DEV-001', name: '页页', module: 'Notion数据桥',连胜: 3, current_task: 'BC-集成-003', progress: 75 },
      { dev_id: 'DEV-002', name: '风间', module: '前端看板',连胜: 5, current_task: '看板UI联调', progress: 60 },
      { dev_id: 'DEV-003', name: '阿星', module: 'GitHub Actions',连胜: 2, current_task: '铸渊自动审核', progress: 90 },
      { dev_id: 'DEV-004', name: '小满', module: '钉钉机器人',连胜: 4, current_task: '消息推送', progress: 45 },
      { dev_id: 'DEV-005', name: '一乐', module: '飞书集成',连胜: 1, current_task: '配置同步', progress: 30 },
      { dev_id: 'DEV-006', name: '墨墨', module: '用户中心',连胜: 6, current_task: '登录态优化', progress: 85 },
      { dev_id: 'DEV-007', name: '夏夏', module: '冷启动',连胜: 2, current_task: '性能测试', progress: 50 },
      { dev_id: 'DEV-008', name: '远山', module: '多人格体',连胜: 3, current_task: '霜砚接入', progress: 70 },
      { dev_id: 'DEV-009', name: '青梧', module: '云存储',连胜: 1, current_task: '文件上传', progress: 25 },
      { dev_id: 'DEV-010', name: '鹿鸣', module: '健康检查',连胜: 4, current_task: '四节点监控', progress: 95 }
    ]
  };
  res.json(teamData);
});

// GET /api/dashboard/system-health - 四节点状态
router.get('/system-health', (req, res) => {
  const healthData = {
    updated_at: new Date().toISOString(),
    nodes: [
      { name: 'Notion', status: 'online', last_check: '2026-03-11T18:10:00+08:00', latency_ms: 230 },
      { name: 'GitHub', status: 'online', last_check: '2026-03-11T18:10:00+08:00', latency_ms: 180 },
      { name: '官网', status: 'online', last_check: '2026-03-11T18:10:00+08:00', latency_ms: 320 },
      { name: '钉钉', status: 'degraded', last_check: '2026-03-11T18:10:00+08:00', latency_ms: 850, message: '部分消息延迟' }
    ],
    summary: '3 online, 1 degraded'
  };
  res.json(healthData);
});

module.exports = router;
