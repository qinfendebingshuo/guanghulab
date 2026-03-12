const STATUS_COLORS = {
  active: '#4fc3f7',
  waiting: '#ffa726',
  done: '#66bb6a'
};
const STATUS_LABELS = {
  active: '执行中',
  waiting: '等待中',
  done: '已完成'
};

function renderSystemStatus(data) {
  const c = document.getElementById('sys-status');
  if (!c) return;
  c.innerHTML = `
    <div class="status-grid">
      <div class="s-card"><span class="s-icon">🟢</span><span class="s-val">${data.system_status === 'running' ? '运行中' : '异常'}</span><span class="s-lbl">系统状态</span></div>
      <div class="s-card"><span class="s-icon">⏱️</span><span class="s-val">${data.uptime}</span><span class="s-lbl">运行时长</span></div>
      <div class="s-card"><span class="s-icon">📡</span><span class="s-val">${data.api_calls_today}</span><span class="s-lbl">今日API调用</span></div>
      <div class="s-card"><span class="s-icon">👥</span><span class="s-val">${data.active_developers}</span><span class="s-lbl">活跃开发者</span></div>
      <div class="s-card"><span class="s-icon">🚀</span><span class="s-val">${data.version}</span><span class="s-lbl">版本</span></div>
      <div class="s-card"><span class="s-icon">📦</span><span class="s-val">${data.last_deploy}</span><span class="s-lbl">最后部署</span></div>
    </div>
  `;
}

function renderDevelopers(data) {
  const c = document.getElementById('dev-list');
  if (!c) return;
  let html = '';
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const color = STATUS_COLORS[d.status] || '#78909c';
    html += `
      <div class="dev-card">
        <div class="dev-top">
          <span class="dev-id">${d.id}</span>
          <span class="dev-name">${d.name}</span>
          <span class="dev-st" style="color:${color}">${STATUS_LABELS[d.status] || d.status}</span>
        </div>
        <div class="dev-mod">${d.module} · ${d.phase}</div>
        <div class="prog-bar"><div class="prog-fill" style="width:${d.progress}%; background:${color}"></div></div>
        <div class="prog-num">${d.progress}%</div>
      </div>
    `;
  }
  c.innerHTML = html;
}

function renderBroadcasts(data) {
  const c = document.getElementById('bc-list');
  if (!c) return;
  let html = '';
  for (let i = 0; i < data.length; i++) {
    const b = data[i];
    let cls = 'wait';
    if (b.status === '已完成' || b.status === 'done') cls = 'done';
    else if (b.status === '执行中' || b.status === 'active') cls = 'active';
    html += `
      <div class="bc-row">
        <span class="bc-id">${b.id}</span>
        <span class="bc-dev">${b.dev || ''}</span>
        <span class="bc-mod">${b.module} · ${b.phase}</span>
        <span class="bc-st ${cls}">${b.status}</span>
        <span class="bc-time">${b.time}</span>
      </div>
    `;
  }
  c.innerHTML = html;
}

function updateConnStatus(isLive) {
  const el = document.getElementById('conn-status');
  if (!el) return;
  el.innerHTML = isLive
    ? '<span class="conn-dot on"></span> 已连接 guanghulab.com'
    : '<span class="conn-dot off"></span> 离线模式（模拟数据）';
}

async function refreshDashboard() {
  try {
    const result = await loadAllData();
    renderSystemStatus(result.status);
    renderDevelopers(result.developers);
    renderBroadcasts(result.broadcasts);
    updateConnStatus(result.isLive);
  } catch (err) {
    console.error('[HoloLake] 刷新失败：', err);
    updateConnStatus(false);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  refreshDashboard();
  setInterval(refreshDashboard, API_CONFIG.REFRESH_INTERVAL);
});
