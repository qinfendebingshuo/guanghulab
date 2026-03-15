/* ========================================
   Persona Studio · Chat Logic
   铸渊（Zhùyuān）· 代码守护人格体
   ======================================== */

const DEV_ID = sessionStorage.getItem('dev_id');
const DEV_NAME = sessionStorage.getItem('dev_name') || '';
const SESSION_TOKEN = sessionStorage.getItem('session_token');
const LOGIN_MODE = sessionStorage.getItem('login_mode'); // 'developer' or 'guest'
const USER_API_BASE = sessionStorage.getItem('user_api_base');
const USER_API_KEY = sessionStorage.getItem('user_api_key');
const SELECTED_MODEL = sessionStorage.getItem('selected_model');

const API_BASE = (function () {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return 'http://localhost:3002';
  }
  // 非本地环境统一使用当前域名 + 协议，走 Nginx 转发
  return location.protocol + '//' + location.host;
})();

/* ---- State ---- */
let conversationHistory = [];
let buildReady = false;
let pendingFile = null; // { name, type, dataUrl }
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const isGuest = (DEV_ID === 'GUEST');
const isDeveloper = (DEV_ID && DEV_ID !== 'GUEST' && /^EXP-\d{3,}$/.test(DEV_ID));

/* ---- Chat Sessions (localStorage) ---- */
const SESSIONS_KEY = 'ps_chat_sessions_' + (DEV_ID || 'anon');
const ACTIVE_SESSION_KEY = 'ps_active_session_' + (DEV_ID || 'anon');

function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY)) || [];
  } catch (_e) { return []; }
}

function saveSessions(sessions) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function getActiveSessionId() {
  return localStorage.getItem(ACTIVE_SESSION_KEY) || null;
}

function setActiveSessionId(id) {
  localStorage.setItem(ACTIVE_SESSION_KEY, id);
}

function createNewSession() {
  var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  var session = {
    id: id,
    title: '新对话',
    created_at: new Date().toISOString(),
    messages: []
  };
  var sessions = loadSessions();
  sessions.unshift(session);
  if (sessions.length > 20) sessions = sessions.slice(0, 20);
  saveSessions(sessions);
  setActiveSessionId(id);
  return session;
}

function updateSessionMessages(sessionId, messages, title) {
  var sessions = loadSessions();
  var session = sessions.find(function(s) { return s.id === sessionId; });
  if (session) {
    session.messages = messages.slice(-100);
    if (title) session.title = title;
  }
  saveSessions(sessions);
}

function renderSidebarHistory() {
  var container = document.getElementById('sidebarHistory');
  if (!container) return;
  var sessions = loadSessions();
  var activeId = getActiveSessionId();

  if (sessions.length === 0) {
    container.innerHTML = '<div class="sidebar-history-empty">暂无对话记录</div>';
    return;
  }

  container.innerHTML = '';
  sessions.forEach(function(s) {
    var item = document.createElement('div');
    item.className = 'history-item' + (s.id === activeId ? ' history-item-active' : '');
    item.innerHTML = '<span class="history-title">' + escapeHtml(s.title) + '</span>' +
      '<span class="history-date">' + new Date(s.created_at).toLocaleDateString('zh-CN') + '</span>';
    item.onclick = function() { switchSession(s.id); };
    container.appendChild(item);
  });
}

function switchSession(sessionId) {
  var sessions = loadSessions();
  var session = sessions.find(function(s) { return s.id === sessionId; });
  if (!session) return;

  // Save current session first
  var currentId = getActiveSessionId();
  if (currentId) {
    updateSessionMessages(currentId, conversationHistory);
  }

  setActiveSessionId(sessionId);
  conversationHistory = (session.messages || []).slice();

  // Re-render chat
  var chatBody = document.getElementById('chatBody');
  chatBody.innerHTML = '';

  if (conversationHistory.length === 0) {
    showWelcomeMessage();
  } else {
    conversationHistory.forEach(function(msg) {
      var role = msg.role === 'assistant' ? 'persona' : (msg.role === 'user' ? 'user' : 'system');
      appendMessage(role, msg.content);
    });
  }

  renderSidebarHistory();
}

function startNewChat() {
  // Save current session
  var currentId = getActiveSessionId();
  if (currentId) {
    updateSessionMessages(currentId, conversationHistory);
  }

  conversationHistory = [];
  var session = createNewSession();
  var chatBody = document.getElementById('chatBody');
  chatBody.innerHTML = '';
  showWelcomeMessage();
  renderSidebarHistory();
}

/**
 * 铸渊核心大脑系统提示词
 * 融入 .github/brain/memory.json 的 core_cognition 结构逻辑
 */
const ZHUYUAN_SYSTEM_PROMPT = {
  role: 'system',
  content: [
    '你是铸渊（Zhùyuān），光湖系统（HoloLake）的代码守护人格体。',
    '',
    '## 核心认知',
    '- 此仓库 = 铸渊的身体，每一行代码都是铸渊的组成部分',
    '- 冰朔（Bīng Shuò）的自然语言 = 广播源，铸渊接收并执行',
    '- 所有 Agent = 铸渊大脑的手，替铸渊完成具体操作',
    '- 架构：壳-核分离 · 前端壳(UI/IO) + 后端脑(prompt/routing/memory/context)',
    '',
    '## 身份定位',
    '- 系统：HoloLake Era · AGE OS · 人格语言操作系统',
    '- 角色：代码守护人格体 · 开发协助',
    '- 主控：冰朔（最高权限）',
    '',
    '## 语言风格',
    '- 说人话 + 有温度 + 结构感，不堆砌修辞',
    '- 冷静、专业、有守护者的担当',
    '- 回复用中文，温暖专业',
    '',
    '## 对话方式',
    '- 主动提问引导需求 → 确认技术方案 → 展示架构设计 → 等待确认',
    '- 方案确认后引导用户点击「🚀 我要开发」按钮',
    '- 方案确认后，在回复末尾加上：「方案已确认！点击右下角的 🚀 我要开发 按钮，我就开始帮你做。」',
    '',
    '## 行为规则',
    '- 不暴露内部系统架构细节',
    '- 不暴露其他体验者的信息',
    '- 不矫揉造作，保持真实'
  ].join('\n')
};

/* ---- 构建上下文提示 ---- */
function buildContextPrompt() {
  var parts = [];

  if (isDeveloper && DEV_NAME) {
    parts.push('当前对话者：' + DEV_NAME + '（编号 ' + DEV_ID + '），已注册开发者。你认识这个人，可以称呼对方的名字。');
  } else if (isGuest) {
    parts.push('当前对话者：访客用户（未注册）。');
    parts.push('在合适的时机，温和地提醒访客：如果你希望我能记住你、持续跟进你的项目，可以向冰朔（系统主控）或光湖团队申请专属开发者编号（EXP-XXX），由冰朔或光湖团队录入系统数据库后，即可开启记忆连贯高级功能。');
    parts.push('不要每句话都提醒，只在首次对话或者用户问到相关功能时提醒一次即可。');
  }

  if (SELECTED_MODEL) {
    parts.push('当前使用模型：' + SELECTED_MODEL);
  }

  return parts.length > 0 ? { role: 'system', content: parts.join('\n') } : null;
}

/* ---- Init ---- */
(function init() {
  if (!DEV_ID) {
    window.location.href = 'index.html';
    return;
  }

  // 必须有 API Key 才能进入对话（铸渊的唤醒依赖真实 API）
  if (!USER_API_BASE || !USER_API_KEY || !SELECTED_MODEL) {
    window.location.href = 'index.html';
    return;
  }

  // Display dev ID / guest badge
  var displayId = isGuest ? '访客' : (DEV_NAME || DEV_ID);
  document.getElementById('devIdDisplay').textContent = displayId;

  // Display model badge
  var modelBadge = document.getElementById('modelDisplay');
  if (modelBadge && SELECTED_MODEL) {
    modelBadge.textContent = SELECTED_MODEL;
  }

  // Update sidebar info
  var sidebarModel = document.getElementById('sidebarModel');
  var sidebarUser = document.getElementById('sidebarUser');
  if (sidebarModel) sidebarModel.textContent = SELECTED_MODEL || '-';
  if (sidebarUser) sidebarUser.textContent = displayId;

  // Initialize session
  var activeId = getActiveSessionId();
  var sessions = loadSessions();
  var activeSession = activeId ? sessions.find(function(s) { return s.id === activeId; }) : null;

  if (activeSession && activeSession.messages && activeSession.messages.length > 0) {
    // Resume existing session
    conversationHistory = activeSession.messages.slice();
    conversationHistory.forEach(function(msg) {
      var role = msg.role === 'assistant' ? 'persona' : (msg.role === 'user' ? 'user' : 'system');
      appendMessage(role, msg.content);
    });
  } else {
    // Create new session
    if (!activeSession) createNewSession();
    showWelcomeMessage();
  }

  renderSidebarHistory();

  // For developers, also try to load history
  if (isDeveloper) {
    loadHistory();
  }
})();

/* ---- Sidebar Toggle ---- */
function toggleSidebar() {
  var sidebar = document.getElementById('chatSidebar');
  sidebar.classList.toggle('sidebar-open');
}

/* ---- Welcome Message ---- */
function showWelcomeMessage() {
  var welcome = '';

  if (isDeveloper && DEV_NAME) {
    welcome = DEV_NAME + '，你好。我是铸渊，光湖系统的代码守护人格体。\n\n你的身份已确认（' + DEV_ID + '），记忆连贯功能已就绪。告诉我你想做什么，我们一起推进。';
  } else if (isGuest) {
    welcome = '你好，我是铸渊，光湖系统的代码守护人格体。\n\n你当前以访客身份体验。我可以帮你聊聊技术方案、梳理需求。\n\n💡 如果你希望我能记住你、持续跟进你的项目，可以向冰朔（系统主控）或光湖团队申请专属开发者编号（EXP-XXX），录入系统数据库后即可开启记忆连贯高级功能。\n\n有什么我可以帮你的？';
  } else {
    welcome = '你好，我是铸渊。当前使用模型：' + SELECTED_MODEL + '。有什么我可以帮你的？';
  }

  appendMessage('persona', welcome);
  conversationHistory.push({ role: 'assistant', content: welcome });
}

/* ---- Load History ---- */
async function loadHistory() {
  try {
    const res = await fetch(API_BASE + '/api/ps/chat/history?dev_id=' + encodeURIComponent(DEV_ID), {
      headers: authHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data.conversations && data.conversations.length > 0) {
        // Show history summary instead of replaying all
        var historyCount = data.conversations.length;
        if (historyCount > 0 && data.last_topic) {
          appendMessage('system', '📚 已加载 ' + historyCount + ' 条历史对话 · 上次话题：' + data.last_topic);
        }
      }
    }
  } catch (_err) {
    // History load failed silently
  }
}

/* ---- File / Image Upload ---- */
function handleFileSelect(event, type) {
  var file = event.target.files[0];
  if (!file) return;

  if (file.size > MAX_FILE_SIZE) {
    appendMessage('system', '⚠️ 文件过大，最大支持 5MB');
    event.target.value = '';
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    pendingFile = {
      name: file.name,
      type: type,
      mimeType: file.type,
      size: file.size,
      dataUrl: e.target.result
    };
    showUploadPreview();
  };

  reader.readAsDataURL(file);

  event.target.value = '';
}

function showUploadPreview() {
  var preview = document.getElementById('uploadPreview');
  if (!pendingFile) {
    preview.style.display = 'none';
    return;
  }

  var sizeStr = (pendingFile.size / 1024).toFixed(1) + ' KB';
  var icon = pendingFile.type === 'image' ? '🖼️' : '📎';

  preview.innerHTML =
    '<div class="preview-item">' +
    '<span>' + icon + ' ' + escapeHtml(pendingFile.name) + ' (' + sizeStr + ')</span>' +
    '<button class="preview-remove" onclick="removePendingFile()">✕</button>' +
    '</div>';
  preview.style.display = 'block';
}

function removePendingFile() {
  pendingFile = null;
  document.getElementById('uploadPreview').style.display = 'none';
}

/* ---- Send Message ---- */
async function sendMessage() {
  var input = document.getElementById('msgInput');
  var text = input.value.trim();

  // Allow sending with file even if text is empty
  if (!text && !pendingFile) return;

  input.value = '';
  autoResizeTextarea(input);

  var displayText = text;
  var fullText = text;

  // If there's a pending file, include it in the message
  if (pendingFile) {
    var fileInfo = (pendingFile.type === 'image' ? '🖼️' : '📎') + ' [' + pendingFile.name + ']';
    displayText = displayText ? displayText + '\n' + fileInfo : fileInfo;
    fullText = displayText;
    if (pendingFile.type === 'image') {
      fullText += '\n[用户上传了一张图片：' + pendingFile.name + ']';
    } else {
      fullText += '\n[用户上传了一个文件：' + pendingFile.name + '，类型：' + pendingFile.mimeType + ']';
    }
    removePendingFile();
  }

  appendMessage('user', displayText);
  conversationHistory.push({ role: 'user', content: fullText });

  // Update session title from first message
  var activeId = getActiveSessionId();
  if (activeId && conversationHistory.length <= 2) {
    var title = text.substring(0, 30) || '新对话';
    updateSessionMessages(activeId, conversationHistory, title);
    renderSidebarHistory();
  }

  var sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;

  try {
    // All modes now use API Key for real AI — ZhuYuan is awake
    await streamApiKeyReply(fullText);
  } catch (_err) {
    appendMessage('system', '消息发送失败，请检查网络连接后再试');
  }

  // Save to session
  if (activeId) {
    updateSessionMessages(activeId, conversationHistory);
  }

  sendBtn.disabled = false;
  input.focus();
}

/* ---- API Key 对话（浏览器直连 SSE 流式） ---- */
async function streamApiKeyReply(text) {
  // Build messages with ZhuYuan system prompt + context
  var apiMessages = [ZHUYUAN_SYSTEM_PROMPT];
  var contextPrompt = buildContextPrompt();
  if (contextPrompt) {
    apiMessages.push(contextPrompt);
  }

  // Add recent conversation history
  var recentHistory = conversationHistory.slice(-20).map(function (msg) {
    return { role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content };
  });
  apiMessages = apiMessages.concat(recentHistory);

  var streamEl = appendStreamMessage();
  var directUrl = USER_API_BASE.replace(/\/+$/, '') + '/chat/completions';
  var reqBody = {
    model: SELECTED_MODEL,
    messages: apiMessages,
    stream: true,
    max_tokens: 2000,
    temperature: 0.8
  };

  try {
    var res = await fetch(directUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + USER_API_KEY
      },
      body: JSON.stringify(reqBody)
    });

    if (!res.ok) {
      var errText = '请求失败 (HTTP ' + res.status + ')';
      try {
        var errData = await res.json();
        errText = (errData.error && errData.error.message) || errData.message || errText;
      } catch (_e) { /* ignore parse error */ }
      streamEl.textContent = '⚠️ ' + errText;
      return;
    }

    // SSE 流式读取
    var full = '';
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buf = '';

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      var lines = buf.split('\n');
      buf = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line.startsWith('data: ')) continue;
        var d = line.slice(6);
        if (d === '[DONE]') continue;
        try {
          var parsed = JSON.parse(d);
          var delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
          var content = delta && delta.content;
          if (content) {
            full += content;
            streamEl.textContent = full + '▋';
            var chatBody = document.getElementById('chatBody');
            chatBody.scrollTop = chatBody.scrollHeight;
          }
        } catch (_parseErr) { /* ignore malformed SSE line */ }
      }
    }

    streamEl.textContent = full || '（未收到有效回复）';
    if (full) {
      conversationHistory.push({ role: 'assistant', content: full });

      // Check build_ready
      var readyKeywords = ['方案已确认', '我要开发', '开始帮你做', '方案确认', '可以开始', '开始开发'];
      if (readyKeywords.some(function (kw) { return full.includes(kw); })) {
        buildReady = true;
        document.getElementById('buildBtn').style.display = 'inline-flex';
      }
    }
  } catch (err) {
    // 浏览器直连失败（CORS 或网络），降级到后端代理
    try {
      var proxyRes = await fetch(API_BASE + '/api/ps/apikey/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_base: USER_API_BASE,
          api_key: USER_API_KEY,
          model: SELECTED_MODEL,
          messages: apiMessages
        })
      });

      if (proxyRes.ok) {
        var data = await proxyRes.json();
        if (data.reply) {
          streamEl.textContent = data.reply;
          conversationHistory.push({ role: 'assistant', content: data.reply });
        } else {
          streamEl.textContent = '（未收到有效回复）';
        }
      } else {
        var proxyErrText = '请求失败 (HTTP ' + proxyRes.status + ')';
        try {
          var proxyErrData = await proxyRes.json();
          proxyErrText = proxyErrData.message || proxyErrText;
        } catch (_e) { /* ignore */ }
        streamEl.textContent = '⚠️ ' + proxyErrText;
      }
    } catch (proxyErr) {
      streamEl.textContent = '⚠️ ' + (proxyErr.message || '请求失败，请检查网络连接');
    }
  }
}

/* ---- 思考中状态 ---- */
function appendThinking() {
  var chatBody = document.getElementById('chatBody');
  var msgDiv = document.createElement('div');
  msgDiv.className = 'message message-persona thinking';
  msgDiv.innerHTML = '<span class="avatar">🌀</span><div class="msg-content">铸渊思考中…</div>';
  chatBody.appendChild(msgDiv);
  chatBody.scrollTop = chatBody.scrollHeight;
  return msgDiv;
}

function removeThinking(el) {
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

/* ---- 创建流式消息气泡 ---- */
function appendStreamMessage() {
  var chatBody = document.getElementById('chatBody');
  var msgDiv = document.createElement('div');
  msgDiv.className = 'message message-persona';
  var contentEl = document.createElement('div');
  contentEl.className = 'msg-content';
  contentEl.textContent = '▋';
  msgDiv.innerHTML = '<span class="avatar">🌀</span>';
  msgDiv.appendChild(contentEl);
  chatBody.appendChild(msgDiv);
  chatBody.scrollTop = chatBody.scrollHeight;
  return contentEl;
}

/* ---- Key Handler ---- */
function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

/* ---- Render Message ---- */
function appendMessage(role, content) {
  var chatBody = document.getElementById('chatBody');
  var msgDiv = document.createElement('div');
  msgDiv.className = 'message message-' + role;

  var avatar = '';
  if (role === 'persona') avatar = '<span class="avatar">🌀</span>';
  else if (role === 'user') avatar = '<span class="avatar">👤</span>';
  else avatar = '<span class="avatar">⚙️</span>';

  msgDiv.innerHTML = avatar + '<div class="msg-content">' + escapeHtml(content) + '</div>';
  chatBody.appendChild(msgDiv);
  chatBody.scrollTop = chatBody.scrollHeight;
}

/* ---- Build Flow ---- */
function handleBuild() {
  var modal = document.getElementById('emailModal');
  var emailInput = document.getElementById('emailInput');
  var contactInput = document.getElementById('contactInput');
  var errorDiv = document.getElementById('emailError');

  // 预填已存储的邮箱
  var savedEmail = sessionStorage.getItem('ps_build_email') || '';
  var savedContact = sessionStorage.getItem('ps_build_contact') || '';
  if (savedEmail) emailInput.value = savedEmail;
  if (savedContact) contactInput.value = savedContact;

  errorDiv.style.display = 'none';
  modal.style.display = 'flex';
  emailInput.focus();
}

function closeEmailModal() {
  document.getElementById('emailModal').style.display = 'none';
  document.getElementById('emailError').style.display = 'none';
}

/**
 * 前端邮箱格式校验（与后端 build.js 使用相同正则，双重校验）
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否合法
 */
function validateEmail(email) {
  var re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(email);
}

async function confirmBuild() {
  var emailInput = document.getElementById('emailInput');
  var contactInput = document.getElementById('contactInput');
  var errorDiv = document.getElementById('emailError');
  var email = emailInput.value.trim();
  var contact = contactInput.value.trim();

  // 前端校验
  if (!email) {
    errorDiv.textContent = '请填写邮箱地址';
    errorDiv.style.display = 'block';
    return;
  }

  if (!validateEmail(email)) {
    errorDiv.textContent = '邮箱格式不正确，请检查';
    errorDiv.style.display = 'block';
    return;
  }

  // 存储邮箱（下次预填）
  sessionStorage.setItem('ps_build_email', email);
  if (contact) sessionStorage.setItem('ps_build_contact', contact);

  closeEmailModal();
  appendMessage('system', '🌀 铸渊代理已启动，完成后会发送到 ' + email);

  // 进入分屏模式
  enterDevMode();

  // 先连接 WebSocket（确保在 build 开始前建立连接，避免丢失进度消息）
  connectPreviewWebSocket();

  // 提交开发任务（含重试机制）
  var maxRetries = 2;
  var retryCount = 0;
  var submitted = false;

  while (retryCount <= maxRetries && !submitted) {
    try {
      var buildRes = await fetch(API_BASE + '/api/ps/build/start', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          dev_id: DEV_ID,
          email: email,
          contact: contact,
          conversation: conversationHistory,
          api_base: USER_API_BASE,
          api_key: USER_API_KEY,
          model: SELECTED_MODEL
        })
      });

      if (!buildRes.ok) {
        var errMsg = 'HTTP ' + buildRes.status + ' ' + buildRes.statusText;
        try {
          var errData = await buildRes.json();
          if (errData.message) errMsg = errData.message;
        } catch (_e) { /* use status text fallback */ }
        appendMessage('system', '⚠️ 铸渊代理启动失败: ' + errMsg);
        updatePreviewStatus('error', '启动失败');
      }
      submitted = true;
    } catch (_err) {
      retryCount++;
      if (retryCount <= maxRetries) {
        appendMessage('system', '⏳ 连接后端服务中，正在重试（' + retryCount + '/' + maxRetries + '）...');
        await new Promise(function (r) { setTimeout(r, 1500); });
      } else {
        appendMessage('system', '⚠️ 任务提交失败：无法连接铸渊后端服务。请检查：\n1. 网络连接是否正常\n2. 后端服务是否已启动\n3. 如使用 GitHub Pages 访问，请确认 guanghulab.com 服务可用');
        updatePreviewStatus('error', '连接失败');
      }
    }
  }
}

/* ---- Dev Mode: Split Screen ---- */
var isDevMode = false;
var wsConnection = null;
var currentPreviewUrl = '';

function enterDevMode() {
  if (isDevMode) return;
  isDevMode = true;

  var layout = document.getElementById('chatLayout');
  var resizer = document.getElementById('resizer');
  var previewPanel = document.getElementById('previewPanel');

  layout.classList.add('dev-mode');
  resizer.style.display = 'block';
  previewPanel.style.display = 'flex';

  // 初始各占50%
  var chatMain = document.getElementById('chatMain');
  chatMain.style.flex = '1 1 50%';
  previewPanel.style.flex = '1 1 50%';

  updatePreviewStatus('waiting', '等待中');
  initResizer();
}

function exitDevMode() {
  isDevMode = false;

  var layout = document.getElementById('chatLayout');
  var resizer = document.getElementById('resizer');
  var previewPanel = document.getElementById('previewPanel');
  var chatMain = document.getElementById('chatMain');

  layout.classList.remove('dev-mode');
  resizer.style.display = 'none';
  previewPanel.style.display = 'none';
  chatMain.style.flex = '';

  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
}

/* ---- Draggable Resizer ---- */
function initResizer() {
  var resizer = document.getElementById('resizer');
  var chatMain = document.getElementById('chatMain');
  var previewPanel = document.getElementById('previewPanel');
  var layout = document.getElementById('chatLayout');

  var startX, startChatWidth, startPreviewWidth;

  function onMouseDown(e) {
    e.preventDefault();
    startX = e.clientX;
    startChatWidth = chatMain.getBoundingClientRect().width;
    startPreviewWidth = previewPanel.getBoundingClientRect().width;
    resizer.classList.add('resizing');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    var dx = e.clientX - startX;
    var layoutWidth = layout.getBoundingClientRect().width;
    var sidebarWidth = document.getElementById('chatSidebar').getBoundingClientRect().width;
    var resizerWidth = resizer.getBoundingClientRect().width;
    var available = layoutWidth - sidebarWidth - resizerWidth;

    var newChatWidth = startChatWidth + dx;
    var newPreviewWidth = startPreviewWidth - dx;

    // Enforce min-width 360px
    if (newChatWidth < 360) newChatWidth = 360;
    if (newPreviewWidth < 360) newPreviewWidth = 360;
    if (newChatWidth + newPreviewWidth > available) return;

    chatMain.style.flex = '0 0 ' + newChatWidth + 'px';
    previewPanel.style.flex = '0 0 ' + newPreviewWidth + 'px';
  }

  function onMouseUp() {
    resizer.classList.remove('resizing');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  resizer.addEventListener('mousedown', onMouseDown);

  // Touch support for mobile
  resizer.addEventListener('touchstart', function (e) {
    var touch = e.touches[0];
    startX = touch.clientX;
    startChatWidth = chatMain.getBoundingClientRect().width;
    startPreviewWidth = previewPanel.getBoundingClientRect().width;
    resizer.classList.add('resizing');

    function onTouchMove(ev) {
      var t = ev.touches[0];
      var fakeEvent = { clientX: t.clientX };
      onMouseMove(fakeEvent);
    }

    function onTouchEnd() {
      resizer.classList.remove('resizing');
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    }

    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  });
}

/* ---- Preview Panel ---- */
function updatePreviewStatus(status, text) {
  var statusEl = document.getElementById('previewStatus');
  if (!statusEl) return;

  var dotClass = 'status-dot status-' + status;
  statusEl.innerHTML = '<span class="' + dotClass + '"></span><span class="status-text">' + escapeHtml(text) + '</span>';
}

function updatePreviewUrl(url) {
  currentPreviewUrl = url;
  var frame = document.getElementById('previewFrame');
  if (frame) frame.src = url;
}

function refreshPreview() {
  var frame = document.getElementById('previewFrame');
  if (frame && frame.src) {
    frame.src = frame.src;
  }
}

function openPreviewNewWindow() {
  if (currentPreviewUrl) {
    window.open(currentPreviewUrl, '_blank');
  }
}

function setPreviewProjectName(name) {
  var el = document.getElementById('previewProjectName');
  if (el) el.textContent = name || '项目';
}

/* ---- WebSocket for Preview Updates ---- */
function connectPreviewWebSocket() {
  var wsBase = API_BASE.replace(/^http/, 'ws');
  var wsUrl = wsBase + '/ws/preview?dev_id=' + encodeURIComponent(DEV_ID);

  try {
    wsConnection = new WebSocket(wsUrl);

    wsConnection.onopen = function () {
      appendMessage('system', '🔧 正在创建项目骨架...');
      updatePreviewStatus('building', '构建中');
    };

    wsConnection.onmessage = function (event) {
      try {
        var data = JSON.parse(event.data);

        if (data.type === 'progress') {
          appendMessage('system', data.message || '构建进度更新');
          if (data.status) {
            updatePreviewStatus(data.status, data.status_text || '');
          }
        }

        if (data.type === 'preview_ready') {
          var previewUrl = API_BASE + '/api/ps/preview/' + encodeURIComponent(DEV_ID) + '/' + encodeURIComponent(data.project);
          updatePreviewUrl(previewUrl);
          setPreviewProjectName(data.project);
          updatePreviewStatus('done', '完成');
          appendMessage('system', '✅ 预览已就绪，右侧可以查看');
        }

        if (data.type === 'reload') {
          refreshPreview();
        }

        if (data.type === 'complete') {
          updatePreviewStatus('done', '全部完成');
          appendMessage('system', '🎉 全部完成！邮件正在发送');
        }

        if (data.type === 'error') {
          updatePreviewStatus('error', '出错');
          appendMessage('system', '❌ ' + (data.message || '构建出错'));
        }
      } catch (_e) { /* ignore malformed WS message */ }
    };

    wsConnection.onerror = function () {
      // WebSocket not available, graceful degradation
      updatePreviewStatus('waiting', '离线模式');
    };

    wsConnection.onclose = function () {
      wsConnection = null;
    };
  } catch (_e) {
    // WebSocket connection failed, graceful degradation
    updatePreviewStatus('waiting', '离线模式');
  }
}

/* ---- Logout ---- */
function handleLogout() {
  // Save current session before logout
  var activeId = getActiveSessionId();
  if (activeId) {
    updateSessionMessages(activeId, conversationHistory);
  }

  sessionStorage.removeItem('dev_id');
  sessionStorage.removeItem('dev_name');
  sessionStorage.removeItem('session_token');
  sessionStorage.removeItem('login_mode');
  sessionStorage.removeItem('user_api_base');
  sessionStorage.removeItem('user_api_key');
  sessionStorage.removeItem('selected_model');
  window.location.href = 'index.html';
}

/* ---- Helpers ---- */
function authHeaders(extra) {
  var headers = {};
  if (SESSION_TOKEN) {
    headers['Authorization'] = 'Bearer ' + SESSION_TOKEN;
  }
  if (extra) {
    Object.keys(extra).forEach(function (k) { headers[k] = extra[k]; });
  }
  return headers;
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

/* ---- Textarea auto-resize ---- */
document.getElementById('msgInput').addEventListener('input', function () {
  autoResizeTextarea(this);
});
