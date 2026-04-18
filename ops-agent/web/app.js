/**
 * 铸渊运维守卫 · 前端逻辑 v2.0
 * 编号: ZY-OPS-WEB-002
 * 版权: 国作登字-2026-A-00037559
 *
 * Phase 2 增强:
 *   - 多轮对话（会话保持）
 *   - 工具调用显示
 *   - 系统信息面板
 *   - Markdown 渲染增强
 *   - 打字指示器
 */

'use strict';

// ── API 配置 ──────────────────────────────

const API_BASE = window.location.origin;
const REFRESH_INTERVAL = 30000;
const SYSINFO_INTERVAL = 60000;

// ── 会话管理 ──────────────────────────────

let currentSessionId = null;

// ── DOM 引用 ──────────────────────────────

const el = {
  connectionDot: document.getElementById('connectionDot'),
  connectionText: document.getElementById('connectionText'),
  statChecks: document.getElementById('statChecks'),
  statRepairs: document.getElementById('statRepairs'),
  statOpenTickets: document.getElementById('statOpenTickets'),
  statChats: document.getElementById('statChats'),
  chatMessages: document.getElementById('chatMessages'),
  chatInput: document.getElementById('chatInput'),
  btnSend: document.getElementById('btnSend'),
  btnClearChat: document.getElementById('btnClearChat'),
  btnNewSession: document.getElementById('btnNewSession'),
  sessionInfo: document.getElementById('sessionInfo'),
  ticketsList: document.getElementById('ticketsList'),
  btnQuickCheck: document.getElementById('btnQuickCheck'),
  btnDeepCheck: document.getElementById('btnDeepCheck'),
  lastCheckTime: document.getElementById('lastCheckTime'),
  eventsList: document.getElementById('eventsList'),
  sysinfoContent: document.getElementById('sysinfoContent'),
  btnRefreshSysInfo: document.getElementById('btnRefreshSysInfo')
};

// ── SSE 实时连接 ──────────────────────────

let eventSource = null;

function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }

  try {
    eventSource = new EventSource(`${API_BASE}/ops/events`);

    eventSource.onopen = () => {
      el.connectionDot.className = 'status-dot online';
      el.connectionText.textContent = '已连接';
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSSEEvent(data);
      } catch { /* ignore parse errors */ }
    };

    eventSource.onerror = () => {
      el.connectionDot.className = 'status-dot offline';
      el.connectionText.textContent = '连接断开';
      setTimeout(connectSSE, 5000);
    };
  } catch {
    el.connectionDot.className = 'status-dot offline';
    el.connectionText.textContent = '连接失败';
    setTimeout(connectSSE, 10000);
  }
}

function handleSSEEvent(data) {
  switch (data.type) {
    case 'new_ticket':
      addEventLog('🎫 新工单', data.ticket?.title || '', 'warning');
      loadTickets();
      break;
    case 'ticket_updated':
      loadTickets();
      break;
    case 'check_complete':
      addEventLog(
        data.healthy ? '✅ 巡检通过' : '⚠️ 巡检发现问题',
        data.summary || '',
        data.healthy ? 'success' : 'warning'
      );
      loadStats();
      break;
    case 'daily_report':
      addEventLog('📊 每日报告', data.summary || '', 'info');
      break;
    case 'connected':
      addEventLog('🔗 已连接', data.message || '', 'info');
      break;
  }
}

function addEventLog(title, detail, level) {
  const div = document.createElement('div');
  div.className = `event-item event-${level || 'info'}`;
  div.innerHTML = `
    <span class="event-time">${new Date().toLocaleTimeString('zh-CN')}</span>
    <span class="event-title">${escapeHtml(title)}</span>
    <span class="event-detail">${escapeHtml(detail).slice(0, 120)}</span>
  `;
  el.eventsList.prepend(div);

  while (el.eventsList.children.length > 30) {
    el.eventsList.removeChild(el.eventsList.lastChild);
  }
}

// ── API 请求 ──────────────────────────────

async function api(method, path, body) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, options);
  return res.json();
}

// ── 统计刷新 ──────────────────────────────

async function loadStats() {
  try {
    const stats = await api('GET', '/api/ops/stats');
    el.statChecks.textContent = stats.totalChecks || 0;
    el.statRepairs.textContent = stats.totalRepairs || 0;
    el.statChats.textContent = stats.totalChats || 0;

    if (stats.lastQuickCheck) {
      el.lastCheckTime.textContent = `上次巡检: ${new Date(stats.lastQuickCheck).toLocaleString('zh-CN')}`;
    }

    const ticketResult = await api('GET', '/api/ops/tickets?status=open');
    el.statOpenTickets.textContent = ticketResult.total || 0;
  } catch {
    // 静默失败
  }
}

// ── 工单加载 ──────────────────────────────

let currentFilter = 'open';

async function loadTickets() {
  try {
    const result = await api('GET', `/api/ops/tickets${currentFilter === 'open' ? '?status=open' : ''}`);
    renderTickets(result.tickets || []);
  } catch {
    el.ticketsList.innerHTML = '<div class="empty-state">加载失败</div>';
  }
}

function renderTickets(tickets) {
  if (tickets.length === 0) {
    el.ticketsList.innerHTML = '<div class="empty-state">暂无工单 · 系统运行正常 ✅</div>';
    return;
  }

  el.ticketsList.innerHTML = tickets.map(t => `
    <div class="ticket-card severity-${t.severity}" data-id="${t.id}">
      <div class="ticket-header">
        <span class="ticket-id">${escapeHtml(t.id)}</span>
        <span class="ticket-severity">${escapeHtml(t.severity)}</span>
      </div>
      <div class="ticket-title">${escapeHtml(t.title)}</div>
      <div class="ticket-direction">${escapeHtml(t.direction)}</div>
      <div class="ticket-meta">
        <span>${escapeHtml(t.relatedService || '')}</span>
        <span>${new Date(t.createdAt).toLocaleString('zh-CN')}</span>
      </div>
      ${t.status === 'open' ? `<button class="btn-resolve" onclick="resolveTicket('${escapeHtml(t.id)}')">标记解决</button>` : ''}
    </div>
  `).join('');
}

async function resolveTicket(ticketId) {
  try {
    await api('PATCH', `/api/ops/tickets/${ticketId}`, { status: 'resolved' });
    loadTickets();
    loadStats();
  } catch {
    // ignore
  }
}

// ── 系统信息 ──────────────────────────────

async function loadSystemInfo() {
  try {
    const info = await api('GET', '/api/ops/system-info');
    renderSystemInfo(info);
  } catch {
    el.sysinfoContent.innerHTML = '<div class="empty-state">无法加载系统信息</div>';
  }
}

function renderSystemInfo(info) {
  let html = '';

  if (info.resources) {
    const r = info.resources;
    const memColor = r.memory.used_pct > 90 ? 'danger' : r.memory.used_pct > 70 ? 'warning' : 'ok';
    const diskColor = r.disk.used_pct > 90 ? 'danger' : r.disk.used_pct > 70 ? 'warning' : 'ok';

    html += `
      <div class="sysinfo-row">
        <span class="sysinfo-label">内存</span>
        <div class="sysinfo-bar"><div class="sysinfo-bar-fill bar-${memColor}" style="width:${r.memory.used_pct}%"></div></div>
        <span class="sysinfo-value">${r.memory.used_pct}% · ${r.memory.free_mb}MB空闲</span>
      </div>
      <div class="sysinfo-row">
        <span class="sysinfo-label">磁盘</span>
        <div class="sysinfo-bar"><div class="sysinfo-bar-fill bar-${diskColor}" style="width:${r.disk.used_pct}%"></div></div>
        <span class="sysinfo-value">${r.disk.used_pct}% · ${r.disk.available_gb}GB可用</span>
      </div>
      <div class="sysinfo-row">
        <span class="sysinfo-label">负载</span>
        <span class="sysinfo-value">${r.load?.[0]?.toFixed(2) || '-'} / ${r.load?.[1]?.toFixed(2) || '-'} / ${r.load?.[2]?.toFixed(2) || '-'} · ${r.cpus}核</span>
      </div>
    `;
  }

  if (info.pm2 && info.pm2.length > 0) {
    html += '<div class="sysinfo-pm2">';
    for (const p of info.pm2) {
      const statusClass = p.status === 'online' ? 'online' : p.status === 'errored' ? 'errored' : 'stopped';
      html += `
        <div class="pm2-item pm2-${statusClass}">
          <span class="pm2-name">${escapeHtml(p.name)}</span>
          <span class="pm2-status">${escapeHtml(p.status)}</span>
          <span class="pm2-mem">${p.memory_mb}MB</span>
        </div>
      `;
    }
    html += '</div>';
  }

  el.sysinfoContent.innerHTML = html || '<div class="empty-state">无数据</div>';
}

// ── 对话功能 v2 ──────────────────────────

async function sendMessage() {
  const message = el.chatInput.value.trim();
  if (!message) return;

  appendChatMsg('user', message);
  el.chatInput.value = '';
  el.btnSend.disabled = true;

  // 打字指示器
  const thinkingId = appendChatMsg('thinking', '');

  try {
    const body = { message };
    if (currentSessionId) {
      body.sessionId = currentSessionId;
    }

    const result = await api('POST', '/api/ops/chat', body);

    // 保存 sessionId
    if (result.sessionId) {
      currentSessionId = result.sessionId;
      el.sessionInfo.textContent = '🧠 对话中';
      el.sessionInfo.title = `会话: ${currentSessionId}`;
    }

    removeChatMsg(thinkingId);

    // 显示工具调用信息
    if (result.toolsUsed?.length > 0) {
      appendChatMsg('tool-info', `🔧 自动执行了: ${result.toolsUsed.join(', ')}`);
    }

    appendChatMsg('agent', result.answer || '无法回答');

    if (result.patternHints?.length > 0) {
      const hints = result.patternHints.map(h => `· ${h.diagnosis}`).join('\n');
      appendChatMsg('hint', `💡 快速提示:\n${hints}`);
    }

    loadStats();
  } catch (err) {
    removeChatMsg(thinkingId);
    appendChatMsg('error', `❌ 请求失败: ${err.message}`);
  } finally {
    el.btnSend.disabled = false;
    el.chatInput.focus();
  }
}

let msgCounter = 0;

function appendChatMsg(type, text) {
  const id = `msg-${++msgCounter}`;
  const div = document.createElement('div');
  div.className = `chat-msg ${type}`;
  div.id = id;

  if (type === 'thinking') {
    div.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div><p class="thinking-text">正在检查并思考...</p>';
  } else {
    div.innerHTML = formatMessage(text);
  }

  el.chatMessages.appendChild(div);
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
  return id;
}

function removeChatMsg(id) {
  const msg = document.getElementById(id);
  if (msg) msg.remove();
}

function formatMessage(text) {
  let html = escapeHtml(text);
  // **bold**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // code blocks
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.replace(/```\w*\n?/g, '').replace(/```/g, '');
    return `<pre><code>${code}</code></pre>`;
  });
  // inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // headings
  html = html.replace(/^### (.*?)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.*?)$/gm, '<h2>$1</h2>');
  // numbered list
  html = html.replace(/^(\d+)\.\s/gm, '<br>$1. ');
  // bullet list
  html = html.replace(/^[-·•]\s/gm, '<br>· ');
  // line breaks
  html = html.replace(/\n/g, '<br>');
  return `<p>${html}</p>`;
}

// ── 巡检按钮 ──────────────────────────────

async function runCheck(type) {
  const btn = type === 'deep' ? el.btnDeepCheck : el.btnQuickCheck;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ 巡检中...';

  try {
    const result = await api('GET', `/api/ops/check/${type}`);
    if (result.skipped) {
      addEventLog('⏳ 巡检跳过', result.reason, 'info');
    } else {
      addEventLog(
        result.healthy ? '✅ 巡检通过' : '⚠️ 发现问题',
        result.summary || '',
        result.healthy ? 'success' : 'warning'
      );
    }
    loadStats();
    loadTickets();
  } catch (err) {
    addEventLog('❌ 巡检失败', err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ── 工具函数 ──────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 事件绑定 ──────────────────────────────

el.btnSend.addEventListener('click', sendMessage);
el.chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
el.btnClearChat.addEventListener('click', () => {
  el.chatMessages.innerHTML = '';
  appendChatMsg('system', '💬 对话已清空。有什么可以帮你？（我还记得之前的上下文）');
});
el.btnNewSession.addEventListener('click', () => {
  currentSessionId = null;
  el.chatMessages.innerHTML = '';
  el.sessionInfo.textContent = '🧠 多轮对话';
  appendChatMsg('system', '🔄 已开始新对话。之前的上下文已清除。');
});
el.btnQuickCheck.addEventListener('click', () => runCheck('quick'));
el.btnDeepCheck.addEventListener('click', () => runCheck('deep'));
el.btnRefreshSysInfo.addEventListener('click', loadSystemInfo);

document.querySelectorAll('.btn-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    loadTickets();
  });
});

// ── 初始化 ──────────────────────────────

connectSSE();
loadStats();
loadTickets();
loadSystemInfo();
setInterval(loadStats, REFRESH_INTERVAL);
setInterval(loadSystemInfo, SYSINFO_INTERVAL);
