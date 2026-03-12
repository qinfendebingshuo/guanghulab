// ========== HoloLake 看板 · Mock WebSocket 服务器 ==========
// 运行：node mock-ws-server.js
// 功能：每3秒推送一次模拟数据，处理心跳

const WebSocket = require('ws');
const PORT = 8080;

const wss = new WebSocket.Server({ port: PORT });

console.log(`[Mock WS] 服务器启动，监听端口 ${PORT}`);

// 模拟数据生成函数
function generateMockData() {
  return {
    type: 'dashboard_update',
    timestamp: new Date().toISOString(),
    data: {
      system: {
        system_status: 'running',
        version: 'v0.5.0',
        uptime: '73h 22m',
        api_calls_today: 187,
        active_developers: 7,
        last_deploy: '2026-03-05 08:15'
      },
      developers: [
        { id: 'DEV-001', name: '页页', module: '后端中间层', status: 'active', progress: 100, phase: '环节5·联调' },
        { id: 'DEV-002', name: '肥猫', module: 'M01登录界面', status: 'active', progress: 72, phase: '环节2·等待' },
        { id: 'DEV-003', name: '燕樊', module: 'M15云盘系统', status: 'waiting', progress: 55, phase: '环节1·等SYSLOG' },
        { id: 'DEV-004', name: '之之', module: '钉钉机器人', status: 'waiting', progress: 20, phase: '环节0·等SYSLOG' },
        { id: 'DEV-005', name: '小草莓', module: '系统状态看板', status: 'active', progress: 100, phase: '环节3·WebSocket' },
        { id: 'DEV-009', name: '花尔', module: 'M05用户中心', status: 'active', progress: 48, phase: '环节2·编码' },
        { id: 'DEV-010', name: '桔子', module: 'M06工单管理', status: 'active', progress: 35, phase: '环节1·广播待出' }
      ],
      broadcasts: [
        { id: 'BC-看板-003', dev: '小草莓', module: '系统状态看板', phase: '环节3', status: '执行中', time: '03-05 10:15' },
        { id: 'BC-集成-001-M13', dev: '小草莓', module: 'M13协作调度', phase: '环节1', status: '已完成', time: '03-04 08:38' },
        { id: 'DEV-012', dev: '匆匆那年', module: 'M05用户中心', phase: '环节1', status: '等SYSLOG', time: '03-05 09:22' }
      ]
    }
  };
}

wss.on('connection', (ws) => {
  console.log('[Mock WS] 客户端已连接');

  // 心跳响应
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (e) {
      // 忽略非 JSON 消息
    }
  });

  ws.on('close', () => {
    console.log('[Mock WS] 客户端断开');
  });

  // 每3秒推送一次模拟数据
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(generateMockData()));
    }
  }, 3000);

  // 清理 interval
  ws.on('close', () => clearInterval(interval));
});