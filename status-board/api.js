const MOCK_DATA = {
  status: {
    system_status: 'running',
    version: 'v0.4.0',
    uptime: '72h 15m',
    api_calls_today: 142,
    active_developers: 6,
    last_deploy: '2026-03-04 02:00'
  },
  developers: [
    { id: 'DEV-001', name: '页页', module: '后端中间层', status: 'active', progress: 100, phase: '环节5·HTTP联调' },
    { id: 'DEV-002', name: '肥猫', module: 'M01登录界面', status: 'waiting', progress: 60, phase: '环节1·等SYSLOG' },
    { id: 'DEV-003', name: '燕樊', module: 'M15云盘系统', status: 'waiting', progress: 55, phase: '环节1·等SYSLOG' },
    { id: 'DEV-004', name: '之之', module: '钉钉机器人', status: 'waiting', progress: 20, phase: '环节0·等SYSLOG' },
    { id: 'DEV-005', name: '小草莓', module: '系统状态看板', status: 'active', progress: 85, phase: '环节2·API接入' },
    { id: 'DEV-009', name: '花尔', module: 'M05用户中心', status: 'waiting', progress: 40, phase: '环节1·等SYSLOG' },
    { id: 'DEV-010', name: '桔子', module: 'M06工单管理', status: 'active', progress: 35, phase: '环节1·广播待出' },
    { id: 'DEV-011', name: '匆匆那年', module: 'BC-000 DEVlog', status: 'waiting', progress: 10, phase: '环节0·等SYSLOG' }
  ],
  broadcasts: [
    { id: 'DEV-012', module: 'M05用户中心', phase: '环节1', status: '等SYSLOG', time: '03-04 08:45' },
    { id: 'BC-看板-002', dev: '小草莓', module: '系统状态看板', phase: '环节2', status: '执行中', time: '03-04 08:50' },
    { id: 'BC-集成-001-M13', dev: '小草莓', module: 'M13协作调度', phase: '环节1', status: '已完成', time: '03-04 08:38' }
  ]
};

async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function apiGet(endpoint, mockKey) {
  try {
    const res = await fetchWithTimeout(API_CONFIG.BASE_URL + endpoint, API_CONFIG.TIMEOUT);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return { data: await res.json(), isLive: true };
  } catch (err) {
    console.warn('[HoloLake] API未就绪，使用模拟数据：', err.message);
    return { data: MOCK_DATA[mockKey], isLive: false };
  }
}

async function loadAllData() {
  const [statusRes, devRes, bcRes] = await Promise.all([
    apiGet(API_CONFIG.ENDPOINTS.STATUS, 'status'),
    apiGet(API_CONFIG.ENDPOINTS.DEVELOPERS, 'developers'),
    apiGet(API_CONFIG.ENDPOINTS.BROADCASTS, 'broadcasts')
  ]);
  return {
    status: statusRes.data,
    developers: devRes.data,
    broadcasts: bcRes.data,
    isLive: statusRes.isLive && devRes.isLive && bcRes.isLive
  };
}
