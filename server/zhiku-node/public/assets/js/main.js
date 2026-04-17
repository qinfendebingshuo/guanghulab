/**
 * ═══════════════════════════════════════════
 * 光湖智库 · 前端主脚本 v2.0
 * guanghu.online · ZY-PROJ-006
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * v2.0: 邮箱登录 + 真实搜索下载 + Agent对话 + 登录态管理
 * ═══════════════════════════════════════════
 */

'use strict';

const API_BASE = '/api';
const REQUEST_TIMEOUT_MS = 15000;
let currentToken = localStorage.getItem('zhiku_token') || null;
let currentEmail = localStorage.getItem('zhiku_email') || null;
let codeCooldown = 0;
let codeCooldownTimer = null;

/* ═══ 星空背景 ═══ */
(function initStars() {
  const canvas = document.getElementById('starCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];
  const STAR_COUNT = 200;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.3,
      a: Math.random(),
      da: (Math.random() - 0.5) * 0.008
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      s.a += s.da;
      if (s.a > 1 || s.a < 0.1) s.da = -s.da;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,210,255,${s.a * 0.5})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  draw();
})();

/* ═══ Header 滚动阴影 ═══ */
document.querySelector('.content')?.addEventListener('scroll', function() {
  const header = document.getElementById('header');
  if (header) header.classList.toggle('scrolled', this.scrollTop > 10);
});

/* ═══ 工具函数 ═══ */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function showLoginMsg(text, type) {
  const el = document.getElementById('loginMsg');
  if (!el) return;
  el.textContent = text;
  el.className = 'login-msg ' + (type || '');
}

/* ═══════════════════════════════════════════
 * 邮箱登录系统 · Email Auth
 * ═══════════════════════════════════════════ */

/** 发送验证码 */
async function loginSendCode() {
  const emailInput = document.getElementById('loginEmail');
  const email = (emailInput?.value || '').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showLoginMsg('请输入有效的邮箱地址', 'err');
    return;
  }

  const sendBtn = document.getElementById('loginSendBtn');
  const sendBtn2 = document.getElementById('loginSendBtn2');
  if (sendBtn) sendBtn.disabled = true;
  if (sendBtn2) sendBtn2.disabled = true;
  showLoginMsg('正在发送验证码...', 'info');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(`${API_BASE}/auth/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok && res.status >= 500) {
      showLoginMsg('服务器暂时不可用，请稍后重试', 'err');
      if (sendBtn) sendBtn.disabled = false;
      if (sendBtn2) sendBtn2.disabled = false;
      return;
    }

    let data;
    try {
      data = await res.json();
    } catch (jsonErr) {
      console.error('[zhiku] send-code JSON parse failed:', jsonErr);
      showLoginMsg('服务器响应异常，请稍后重试', 'err');
      if (sendBtn) sendBtn.disabled = false;
      if (sendBtn2) sendBtn2.disabled = false;
      return;
    }

    if (data.error) {
      showLoginMsg(data.message || '发送失败', 'err');
      if (sendBtn) sendBtn.disabled = false;
      if (sendBtn2) sendBtn2.disabled = false;
      return;
    }

    showLoginMsg('验证码已发送，请查收邮件', 'ok');

    // 显示验证码输入区
    const codeRow = document.getElementById('loginCodeRow');
    if (codeRow) codeRow.style.display = 'flex';
    if (sendBtn) sendBtn.style.display = 'none';
    const verifyBtn = document.getElementById('loginVerifyBtn');
    if (verifyBtn) verifyBtn.style.display = 'block';

    // 禁用邮箱输入
    if (emailInput) emailInput.readOnly = true;

    // 60秒冷却倒计时
    codeCooldown = 60;
    if (codeCooldownTimer) clearInterval(codeCooldownTimer);
    codeCooldownTimer = setInterval(() => {
      codeCooldown--;
      if (sendBtn2) {
        if (codeCooldown > 0) {
          sendBtn2.textContent = `${codeCooldown}s`;
          sendBtn2.disabled = true;
        } else {
          sendBtn2.textContent = '重新发送';
          sendBtn2.disabled = false;
          clearInterval(codeCooldownTimer);
          codeCooldownTimer = null;
        }
      }
    }, 1000);

    // 自动聚焦验证码输入
    document.getElementById('loginCode')?.focus();

  } catch (err) {
    let msg = '网络连接失败，请检查网络后重试';
    if (err.name === 'AbortError') {
      msg = '请求超时，请检查网络后重试';
    } else if (err.message) {
      msg = '连接失败: ' + err.message;
    }
    showLoginMsg(msg, 'err');
    if (sendBtn) sendBtn.disabled = false;
    if (sendBtn2) sendBtn2.disabled = false;
  }
}

/** 验证码校验 → 登录 */
async function loginVerify() {
  const email = (document.getElementById('loginEmail')?.value || '').trim();
  const code = (document.getElementById('loginCode')?.value || '').trim();

  if (!email || !code) {
    showLoginMsg('请输入邮箱和验证码', 'err');
    return;
  }

  if (!/^\d{6}$/.test(code)) {
    showLoginMsg('验证码为6位数字', 'err');
    return;
  }

  const verifyBtn = document.getElementById('loginVerifyBtn');
  if (verifyBtn) verifyBtn.disabled = true;
  showLoginMsg('验证中...', 'info');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    let data;
    try {
      data = await res.json();
    } catch (jsonErr) {
      console.error('[zhiku] verify JSON parse failed:', jsonErr);
      showLoginMsg('服务器响应异常，请稍后重试', 'err');
      if (verifyBtn) verifyBtn.disabled = false;
      return;
    }

    if (data.error) {
      showLoginMsg(data.message || '验证失败', 'err');
      if (verifyBtn) verifyBtn.disabled = false;
      return;
    }

    // 登录成功
    currentToken = data.token;
    currentEmail = data.email || email;
    localStorage.setItem('zhiku_token', currentToken);
    localStorage.setItem('zhiku_email', currentEmail);

    showLoginMsg('登录成功 · 欢迎来到光湖智库', 'ok');

    // 切换到主页面
    setTimeout(() => {
      enterMainPage();
    }, 600);

  } catch (err) {
    let msg = '网络连接失败，请检查网络后重试';
    if (err.name === 'AbortError') {
      msg = '请求超时，请检查网络后重试';
    } else if (err.message) {
      msg = '连接失败: ' + err.message;
    }
    showLoginMsg(msg, 'err');
    if (verifyBtn) verifyBtn.disabled = false;
  }
}

/** 退出登录 */
async function doLogout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      }
    });
  } catch {}

  currentToken = null;
  currentEmail = null;
  localStorage.removeItem('zhiku_token');
  localStorage.removeItem('zhiku_email');

  // 重置登录表单
  const emailInput = document.getElementById('loginEmail');
  if (emailInput) { emailInput.value = ''; emailInput.readOnly = false; }
  const codeInput = document.getElementById('loginCode');
  if (codeInput) codeInput.value = '';
  const codeRow = document.getElementById('loginCodeRow');
  if (codeRow) codeRow.style.display = 'none';
  const sendBtn = document.getElementById('loginSendBtn');
  if (sendBtn) { sendBtn.style.display = 'block'; sendBtn.disabled = false; }
  const verifyBtn = document.getElementById('loginVerifyBtn');
  if (verifyBtn) { verifyBtn.style.display = 'none'; verifyBtn.disabled = false; }
  showLoginMsg('', '');

  // 显示登录弹窗，隐藏主页面
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('mainPage').style.display = 'none';
}

/** 进入主页面 */
function enterMainPage() {
  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('mainPage').style.display = 'block';

  // 更新用户栏
  const userBarEmail = document.getElementById('userBarEmail');
  if (userBarEmail) userBarEmail.textContent = currentEmail || '—';

  // 加载健康状态
  checkHealth();
}

/** 校验已存储的会话 */
async function checkSession() {
  if (!currentToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/session`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const data = await res.json();
    if (!data.error && data.user) {
      currentEmail = data.user.email || currentEmail;
      localStorage.setItem('zhiku_email', currentEmail);
      return true;
    }
  } catch {}

  // Token 失效
  currentToken = null;
  currentEmail = null;
  localStorage.removeItem('zhiku_token');
  localStorage.removeItem('zhiku_email');
  return false;
}

/* ═══ 验证码输入框回车确认 ═══ */
document.getElementById('loginCode')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') loginVerify();
});
document.getElementById('loginEmail')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') loginSendCode();
});

/* ═══════════════════════════════════════════
 * API 健康检查
 * ═══════════════════════════════════════════ */

async function checkHealth() {
  const el = document.getElementById('apiStatus');
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    if (data.status === 'ok') {
      el.textContent = `● API 在线 · ${data.uptime_human || ''}`;
      el.className = 'api-status ok';
      const statBooks = document.getElementById('statBooks');
      const statUptime = document.getElementById('statUptime');
      const statSources = document.getElementById('statSources');
      const statCos = document.getElementById('statCos');
      if (statBooks) statBooks.textContent = data.books_count || 0;
      if (statUptime) statUptime.textContent = data.uptime_human || '-';
      if (statSources) statSources.textContent = (data.data_sources || []).length || '-';
      if (statCos) statCos.textContent = data.cos_configured ? '已连接' : '未配置';
    } else {
      throw new Error('not ok');
    }
  } catch {
    if (el) {
      el.textContent = '● API 离线';
      el.className = 'api-status err';
    }
  }
}

setInterval(checkHealth, 30000);

/* ═══════════════════════════════════════════
 * 搜索功能 · 真实数据源搜索
 * ═══════════════════════════════════════════ */

async function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  const resultDiv = document.getElementById('searchResults');

  if (!q) {
    resultDiv.innerHTML = '<div class="no-results">请输入书名或作者名</div>';
    resultDiv.style.display = 'block';
    return;
  }

  if (!currentToken) {
    resultDiv.innerHTML = '<div class="no-results">请先登录后再搜索</div>';
    resultDiv.style.display = 'block';
    return;
  }

  resultDiv.innerHTML = '<div class="no-results search-loading">🔍 正在搜索「' + escapeHtml(q) + '」...</div>';
  resultDiv.style.display = 'block';

  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const data = await res.json();

    if (data.error) {
      if (data.code === 'TOKEN_EXPIRED' || data.code === 'TOKEN_INVALID' || data.code === 'NO_TOKEN') {
        resultDiv.innerHTML = '<div class="no-results">⚠️ 登录已过期，请重新登录</div>';
        setTimeout(() => doLogout(), 2000);
        return;
      }
      resultDiv.innerHTML = '<div class="no-results">⚠️ ' + escapeHtml(data.message) + '</div>';
    } else if (!data.results || data.results.length === 0) {
      resultDiv.innerHTML = '<div class="no-results">未找到匹配书籍 · 可尝试其他关键词</div>';
    } else {
      const sourceColors = { local: '#34d399', fanqie: '#fbbf24', qimao: '#a78bfa' };
      resultDiv.innerHTML = '<div class="search-summary">找到 ' + data.total + ' 个结果 · 来源: ' + (data.sources_queried || []).join(', ') + '</div>' +
        data.results.map(book => {
          const sourceColor = sourceColors[book.source] || '#94a7d0';
          const sourceName = book.source_name || book.source;
          const hasFile = book.has_file;
          const downloadAttr = !hasFile && book.source_book_id
            ? ` data-source="${escapeHtml(book.source)}" data-bookid="${escapeHtml(book.source_book_id)}" data-title="${escapeHtml(book.title)}" data-author="${escapeHtml(book.author || '')}"`
            : '';

          return `<div class="search-result-card">
            <div class="result-info">
              <div class="result-title">📕 ${escapeHtml(book.title)}</div>
              <div class="result-meta">
                ${escapeHtml(book.author || '未知作者')}
                ${book.category ? ' · ' + escapeHtml(book.category) : ''}
                ${book.word_count ? ' · ' + (book.word_count > 10000 ? Math.round(book.word_count / 10000) + '万字' : book.word_count + '字') : ''}
              </div>
              <div class="result-source">
                <span class="source-badge" style="border-color:${sourceColor};color:${sourceColor}">${sourceName}</span>
                ${hasFile ? '<span class="source-badge local-badge">已收录</span>' : ''}
              </div>
            </div>
            <div class="result-actions">
              ${hasFile
                ? `<button class="result-btn result-btn-read" onclick="readBook('${escapeHtml(book.id)}')">📖 阅读</button>
                   <button class="result-btn result-btn-dl" onclick="downloadLocal('${escapeHtml(book.id)}')">⬇️ 下载</button>`
                : (book.source_book_id
                    ? `<button class="result-btn result-btn-dl" onclick="startDownload('${escapeHtml(book.source)}','${escapeHtml(book.source_book_id)}','${escapeHtml(book.title)}','${escapeHtml(book.author || '')}')" ${downloadAttr}>⬇️ 下载到智库</button>`
                    : '')
              }
            </div>
          </div>`;
        }).join('');
    }
  } catch (err) {
    resultDiv.innerHTML = '<div class="no-results">搜索失败: ' + escapeHtml(err.message) + '</div>';
  }
}

document.getElementById('searchInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

/* ═══════════════════════════════════════════
 * 下载功能
 * ═══════════════════════════════════════════ */

/** 启动从数据源下载到COS */
async function startDownload(source, sourceBookId, title, author) {
  if (!currentToken) { alert('请先登录'); return; }

  // 确认下载
  if (!confirm(`确认下载「${title}」(${source === 'fanqie' ? '番茄小说' : '七猫小说'}) 到智库？`)) return;

  try {
    const res = await fetch(`${API_BASE}/download/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ source, source_book_id: sourceBookId, title, author })
    });
    const data = await res.json();

    if (data.error) {
      alert('下载失败: ' + data.message);
      return;
    }

    // 弹出进度弹窗
    showDownloadProgress(data.task_id, title);

  } catch (err) {
    alert('下载请求失败: ' + err.message);
  }
}

/** 下载进度轮询 */
function showDownloadProgress(taskId, title) {
  const resultDiv = document.getElementById('searchResults');
  const progressHtml = `
    <div class="download-progress-card" id="dl-${taskId}">
      <div class="dl-title">⬇️ 正在下载「${escapeHtml(title)}」</div>
      <div class="dl-bar-wrap"><div class="dl-bar" id="dl-bar-${taskId}" style="width:0%"></div></div>
      <div class="dl-status" id="dl-status-${taskId}">排队中...</div>
    </div>
  `;

  // 在搜索结果顶部插入
  resultDiv.insertAdjacentHTML('afterbegin', progressHtml);

  // 轮询进度
  const pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/download/status/${taskId}`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await res.json();

      const bar = document.getElementById(`dl-bar-${taskId}`);
      const status = document.getElementById(`dl-status-${taskId}`);
      if (bar) bar.style.width = (data.progress || 0) + '%';
      if (status) status.textContent = data.message || data.status;

      if (data.status === 'completed') {
        clearInterval(pollInterval);
        const card = document.getElementById(`dl-${taskId}`);
        if (card) {
          card.classList.add('dl-done');
          if (status) status.textContent = '✅ 下载完成 · 已收录到智库';
        }
      } else if (data.status === 'failed') {
        clearInterval(pollInterval);
        if (status) status.textContent = '❌ ' + (data.message || '下载失败');
      }
    } catch {
      // 网络异常时静默重试
    }
  }, 2000);

  // 5分钟超时保护
  setTimeout(() => clearInterval(pollInterval), 300000);
}

/** 本地已收录书籍下载 */
async function downloadLocal(bookId) {
  if (!currentToken) return;
  try {
    const res = await fetch(`${API_BASE}/download/${bookId}`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const data = await res.json();
    if (data.error) {
      alert(data.message);
    } else if (data.download_url) {
      window.open(data.download_url, '_blank');
    }
  } catch (err) {
    alert('下载失败: ' + err.message);
  }
}

/** 在线阅读（简单版 — 跳转阅读页） */
function readBook(bookId) {
  alert('在线阅读功能开发中，敬请期待 📖');
}

/* ═══════════════════════════════════════════
 * AI图书管理员Agent · 对话交互
 * ═══════════════════════════════════════════ */

let agentSending = false;

async function agentSend() {
  const input = document.getElementById('agentInput');
  const msg = (input?.value || '').trim();
  if (!msg || agentSending) return;
  if (!currentToken) {
    appendAgentMessage('bot', '请先登录后再和我对话 📚');
    return;
  }

  // 显示用户消息
  appendAgentMessage('user', msg);
  input.value = '';
  agentSending = true;

  // 显示thinking状态
  const thinkingId = appendAgentMessage('bot', '思考中...', true);

  try {
    const res = await fetch(`${API_BASE}/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();

    // 移除thinking
    removeAgentMessage(thinkingId);

    if (data.error) {
      if (data.code === 'TOKEN_EXPIRED' || data.code === 'NO_TOKEN') {
        appendAgentMessage('bot', '登录已过期，请重新登录');
        setTimeout(() => doLogout(), 2000);
      } else {
        appendAgentMessage('bot', '⚠️ ' + (data.message || 'Agent异常'));
      }
    } else {
      // 显示Agent回复
      appendAgentMessage('bot', data.reply || '(无回复)');

      // 处理工具调用结果
      if (data.tool_results && data.tool_results.length > 0) {
        for (const tool of data.tool_results) {
          if (tool.type === 'search' && tool.results) {
            appendAgentSearchResults(tool.results);
          }
          if (tool.type === 'download') {
            appendAgentMessage('bot', `⬇️ 已创建下载任务: 「${tool.title}」(任务ID: ${tool.task_id})`);
            showDownloadProgress(tool.task_id, tool.title);
          }
        }
      }
    }
  } catch (err) {
    removeAgentMessage(thinkingId);
    appendAgentMessage('bot', '网络错误: ' + err.message);
  }

  agentSending = false;
}

let agentMsgCounter = 0;

function appendAgentMessage(role, text, isThinking) {
  const container = document.getElementById('agentMessages');
  if (!container) return;

  const id = 'amsg-' + (++agentMsgCounter);
  const div = document.createElement('div');
  div.className = `agent-msg agent-msg-${role}${isThinking ? ' agent-msg-thinking' : ''}`;
  div.id = id;

  const content = document.createElement('div');
  content.className = 'agent-msg-content';
  content.innerHTML = isThinking ? '<span class="thinking-dots">●●●</span>' : formatAgentText(text);
  div.appendChild(content);
  container.appendChild(div);

  // 自动滚动到底部
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeAgentMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function formatAgentText(text) {
  // 增强 Markdown 渲染 · 书岚风格
  let html = escapeHtml(text);

  // 分隔线
  html = html.replace(/^---$/gm, '<hr class="shulan-divider">');

  // 引用块
  html = html.replace(/^&gt;\s*(.+)$/gm, '<blockquote class="shulan-quote">$1</blockquote>');

  // 粗体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="shulan-bold">$1</strong>');

  // 斜体
  html = html.replace(/\*(.+?)\*/g, '<em class="shulan-italic">$1</em>');

  // 行内代码
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  // 书名号高亮（限制匹配长度避免性能问题）
  html = html.replace(/《([^》]{1,100})》/g, '<span class="shulan-book-title">《$1》</span>');

  // 换行
  html = html.replace(/\n/g, '<br>');

  return html;
}

function appendAgentSearchResults(results) {
  const container = document.getElementById('agentMessages');
  if (!container || !results.length) return;

  const div = document.createElement('div');
  div.className = 'agent-msg agent-msg-bot';
  div.innerHTML = `<div class="agent-msg-content agent-search-results">
    <div class="agent-search-title">📜 找到 ${results.length} 本</div>
    ${results.slice(0, 8).map(book => {
      const sourceName = book.source_name || book.source;
      const sourceClass = book.source === 'fanqie' ? 'fanqie' : (book.source === 'qimao' ? 'qimao' : 'local');
      const hasFile = book.has_file;

      // 操作按钮 · 搜到书后直接展示「在线阅读」和「下载」
      let actionBtns = '';
      if (hasFile) {
        actionBtns = `
          <button class="shulan-action-btn shulan-btn-read" onclick="readBook('${escapeHtml(book.id || '')}')">📖 在线阅读</button>
          <button class="shulan-action-btn shulan-btn-dl" onclick="downloadLocal('${escapeHtml(book.id || '')}')">⬇️ 下载</button>
          <span class="agent-local-tag">已收录</span>`;
      } else if (book.source_book_id) {
        actionBtns = `
          <button class="shulan-action-btn shulan-btn-dl" onclick="startDownload('${escapeHtml(book.source)}','${escapeHtml(book.source_book_id)}','${escapeHtml(book.title)}','${escapeHtml(book.author || '')}')">⬇️ 下载到智库</button>`;
      }

      return `<div class="shulan-book-card">
        <div class="shulan-book-info">
          <span class="shulan-book-name">📖 ${escapeHtml(book.title)}</span>
          <span class="shulan-book-meta">${escapeHtml(book.author || '')} · <span class="source-badge ${sourceClass}">${sourceName}</span>${book.word_count ? ' · ' + book.word_count : ''}</span>
        </div>
        <div class="shulan-book-actions">${actionBtns}</div>
      </div>`;
    }).join('')}
  </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

/* Agent输入框事件 */
document.getElementById('agentInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    agentSend();
  }
});

/* ═══════════════════════════════════════════
 * 初始化 · 自动恢复登录态
 * ═══════════════════════════════════════════ */

(async function init() {
  if (currentToken) {
    const valid = await checkSession();
    if (valid) {
      enterMainPage();
    } else {
      // Token失效，显示登录
      document.getElementById('loginOverlay').style.display = 'flex';
      document.getElementById('mainPage').style.display = 'none';
    }
  } else {
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('mainPage').style.display = 'none';
  }
})();
