/* ========================================
   Persona Studio · Chat Logic
   ======================================== */

const DEV_ID = sessionStorage.getItem('dev_id');
const SESSION_TOKEN = sessionStorage.getItem('session_token');
const LOGIN_MODE = sessionStorage.getItem('login_mode'); // 'apikey' or null
const USER_API_BASE = sessionStorage.getItem('user_api_base');
const USER_API_KEY = sessionStorage.getItem('user_api_key');
const SELECTED_MODEL = sessionStorage.getItem('selected_model');

const API_BASE = (function () {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return 'http://localhost:3721';
  }
  return 'https://guanghulab.com';
})();

/* ---- Init ---- */
(function init() {
  if (!DEV_ID) {
    window.location.href = 'index.html';
    return;
  }

  // API Key 模式额外校验
  if (LOGIN_MODE === 'apikey' && (!USER_API_BASE || !USER_API_KEY || !SELECTED_MODEL)) {
    window.location.href = 'index.html';
    return;
  }

  var displayId = DEV_ID;
  if (LOGIN_MODE === 'apikey') {
    displayId = SELECTED_MODEL;
  }
  document.getElementById('devIdDisplay').textContent = displayId;

  if (LOGIN_MODE === 'apikey') {
    // API Key 模式：显示欢迎信息，不加载历史
    appendMessage('persona', '你好！当前使用模型：' + SELECTED_MODEL + '。有什么我可以帮你的？');
    conversationHistory.push({ role: 'assistant', content: '你好！当前使用模型：' + SELECTED_MODEL + '。有什么我可以帮你的？' });
  } else {
    loadHistory();
  }
})();

/* ---- State ---- */
let conversationHistory = [];
let buildReady = false;

/* ---- Load History ---- */
async function loadHistory() {
  try {
    const res = await fetch(API_BASE + '/api/ps/chat/history?dev_id=' + encodeURIComponent(DEV_ID), {
      headers: authHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data.conversations && data.conversations.length > 0) {
        conversationHistory = data.conversations;
        data.conversations.forEach(function (msg) {
          appendMessage(msg.role === 'user' ? 'user' : 'persona', msg.content);
        });
      }
    }
  } catch (_err) {
    // History load failed silently — greeting will come from first message
  }

  if (conversationHistory.length === 0) {
    sendGreeting();
  }
}

/* ---- Greeting ---- */
async function sendGreeting() {
  try {
    const res = await fetch(API_BASE + '/api/ps/chat/message', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ dev_id: DEV_ID, message: '__greeting__' })
    });
    const data = await res.json();
    if (data.reply) {
      appendMessage('persona', data.reply);
      conversationHistory.push({ role: 'assistant', content: data.reply });
    }
  } catch (_err) {
    appendMessage('persona', '你好！我是知秋，光湖系统的开发协助人格体。告诉我你想做什么，我们一起聊聊方案，聊好了我来帮你开发。');
  }
}

/* ---- Send Message ---- */
async function sendMessage() {
  var input = document.getElementById('msgInput');
  var text = input.value.trim();
  if (!text) return;

  input.value = '';
  autoResizeTextarea(input);
  appendMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });

  var sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;

  try {
    if (LOGIN_MODE === 'apikey') {
      // API Key 模式：浏览器直连用户 API（无需后端代理）
      await streamApiKeyReply(text);
    } else {
      // 开发编号模式：使用原有后端接口
      const res = await fetch(API_BASE + '/api/ps/chat/message', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          dev_id: DEV_ID,
          message: text,
          history: conversationHistory.slice(-20)
        })
      });

      var data = await res.json();

      if (data.reply) {
        appendMessage('persona', data.reply);
        conversationHistory.push({ role: 'assistant', content: data.reply });
      }

      if (data.build_ready) {
        buildReady = true;
        document.getElementById('buildBtn').style.display = 'inline-flex';
      }
    }
  } catch (_err) {
    appendMessage('system', '消息发送失败，请稍后再试');
  }

  sendBtn.disabled = false;
  input.focus();
}

/* ---- API Key 对话（通过后端代理，避免 CORS 问题） ---- */
async function streamApiKeyReply(text) {
  var apiMessages = conversationHistory.slice(-20).map(function (msg) {
    return { role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content };
  });

  var streamEl = appendStreamMessage();

  try {
    var res = await fetch(API_BASE + '/api/ps/apikey/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_base: USER_API_BASE,
        api_key: USER_API_KEY,
        model: SELECTED_MODEL,
        messages: apiMessages
      })
    });

    if (!res.ok) {
      var errText = '请求失败 (HTTP ' + res.status + ')';
      try {
        var errData = await res.json();
        errText = errData.message || errText;
      } catch (_e) { /* ignore parse error */ }
      streamEl.textContent = '⚠️ ' + errText;
      return;
    }

    var data = await res.json();

    if (data.reply) {
      streamEl.textContent = data.reply;
      conversationHistory.push({ role: 'assistant', content: data.reply });
    } else {
      streamEl.textContent = '（未收到有效回复）';
    }
  } catch (err) {
    streamEl.textContent = '⚠️ ' + (err.message || '请求失败，请检查网络连接');
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
  msgDiv.innerHTML = '<span class="avatar">🧠</span>';
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
  if (role === 'persona') avatar = '<span class="avatar">🧠</span>';
  else if (role === 'user') avatar = '<span class="avatar">👤</span>';
  else avatar = '<span class="avatar">⚙️</span>';

  msgDiv.innerHTML = avatar + '<div class="msg-content">' + escapeHtml(content) + '</div>';
  chatBody.appendChild(msgDiv);
  chatBody.scrollTop = chatBody.scrollHeight;
}

/* ---- Build Flow ---- */
function handleBuild() {
  document.getElementById('emailModal').style.display = 'flex';
  document.getElementById('emailInput').focus();
}

function closeEmailModal() {
  document.getElementById('emailModal').style.display = 'none';
}

async function confirmBuild() {
  var email = document.getElementById('emailInput').value.trim();
  if (!email) return;

  closeEmailModal();
  appendMessage('system', '🚀 开发任务已提交，完成后会发送到 ' + email);

  try {
    await fetch(API_BASE + '/api/ps/build/start', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        dev_id: DEV_ID,
        email: email,
        conversation: conversationHistory
      })
    });
  } catch (_err) {
    appendMessage('system', '任务提交失败，请稍后再试');
  }
}

/* ---- Logout ---- */
function handleLogout() {
  sessionStorage.removeItem('dev_id');
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
