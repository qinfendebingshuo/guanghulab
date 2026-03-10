/* ========================================
   Persona Studio · Chat Logic
   ======================================== */

const DEV_ID = sessionStorage.getItem('dev_id');
const SESSION_TOKEN = sessionStorage.getItem('session_token');

const API_BASE = (function () {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return 'http://localhost:3002';
  }
  return '';
})();

/* ---- Init ---- */
(function init() {
  if (!DEV_ID) {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('devIdDisplay').textContent = DEV_ID;
  loadHistory();
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
    var res = await fetch(API_BASE + '/api/ps/chat/message', {
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
  } catch (_err) {
    appendMessage('system', '消息发送失败，请稍后再试');
  }

  sendBtn.disabled = false;
  input.focus();
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
