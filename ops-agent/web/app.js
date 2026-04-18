/**
 * 铸渊运维守卫 · 前端逻辑
 * 编号: ZY-OPS-WEB-001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

// ── API 配置 ──────────────────────────────

const API_BASE = window.location.origin;
const REFRESH_INTERVAL = 30000;

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
  ticketsList: document.getElementById('ticketsList'),
  btnQuickCheck: document.getElementById('btnQuickCheck'),
  btnDeepCheck: document.getElementById('btnDeepCheck'),
  lastCheckTime: document.getElementById('lastCheckTime'),
  eventsList: document.getElementById('eventsList')
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
      // 自动重连
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

  // 保留最近30条
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

    // 开放工单数
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
      ${t.status === 'open' ? `<button class="btn-resolve" onclick="resolveTicket('${t.id}')">标记解决</button>` : ''}
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

// ── 对话功能 ──────────────────────────────

async function sendMessage() {
  const message = el.chatInput.value.trim();
  if (!message) return;

  // 显示用户消息
  appendChatMsg('user', message);
  el.chatInput.value = '';
  el.btnSend.disabled = true;

  // 显示"正在思考"
  const thinkingId = appendChatMsg('system', '🧠 正在思考...');

  try {
    const result = await api('POST', '/api/ops/chat', { message });

    // 替换"正在思考"
    removeChatMsg(thinkingId);
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
  div.innerHTML = formatMessage(text);
  el.chatMessages.appendChild(div);
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
  return id;
}

function removeChatMsg(id) {
  const msg = document.getElementById(id);
  if (msg) msg.remove();
}

function formatMessage(text) {
  // 简单 Markdown: **bold**, 列表, 代码块
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^(\d+)\.\s/gm, '<br>$1. ');
  html = html.replace(/^[-·]\s/gm, '<br>· ');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
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
  appendChatMsg('system', '💬 对话已清空。有什么可以帮你？');
});
el.btnQuickCheck.addEventListener('click', () => runCheck('quick'));
el.btnDeepCheck.addEventListener('click', () => runCheck('deep'));

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
setInterval(loadStats, REFRESH_INTERVAL);
