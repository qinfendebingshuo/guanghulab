/* ═══════════════════════════════════════════════════════════
 * 光湖 · 微调模型内测 · 前端逻辑
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── 配置 ───
  var API_BASE = (function () {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      // 本地开发: 后端默认 PORT=3000 (src/index.js)
      return 'http://' + location.hostname + ':3000';
    }
    // 生产: 同域走 Nginx 反代
    return location.protocol + '//' + location.host;
  })();

  var TOKEN_KEY = 'ftchat_token';
  var EMAIL_KEY = 'ftchat_email';
  var USER_HASH_KEY = 'ftchat_user_hash';
  var SLOT_KEY = 'ftchat_slot';

  // ─── 状态 ───
  var token = null;
  var email = null;
  var userHash = null;
  var slotIndex = null;
  var currentSessionId = null;
  var sessions = [];          // 服务端列表（左侧栏）
  var localSessions = {};     // localStorage: sessionId → {messages, title}
  var isStreaming = false;

  // ─── DOM ───
  var $ = function (id) { return document.getElementById(id); };
  var loginScreen = $('loginScreen');
  var chatScreen = $('chatScreen');
  var emailInput = $('emailInput');
  var codeInput = $('codeInput');
  var sendCodeBtn = $('sendCodeBtn');
  var loginBtn = $('loginBtn');
  var loginForm = $('loginForm');
  var loginMsg = $('loginMsg');
  var slotsBanner = $('slotsBanner');
  var slotsText = $('slotsText');
  var sessionsList = $('sessionsList');
  var newChatBtn = $('newChatBtn');
  var sidebar = $('sidebar');
  var sidebarOverlay = $('sidebarOverlay');
  var sidebarToggle = $('sidebarToggle');
  var sidebarClose = $('sidebarClose');
  var chatBody = $('chatBody');
  var msgInput = $('msgInput');
  var sendBtn = $('sendBtn');
  var composer = $('composer');
  var logoutBtn = $('logoutBtn');
  var userBadge = $('userBadge');
  var slotBadgeEl = $('slotIndex');
  var metaBar = $('metaBar');

  // ─── 工具 ───
  function loadStorage() {
    try {
      token = localStorage.getItem(TOKEN_KEY);
      email = localStorage.getItem(EMAIL_KEY);
      userHash = localStorage.getItem(USER_HASH_KEY);
      slotIndex = localStorage.getItem(SLOT_KEY);
    } catch (_e) { /* ignore */ }
  }

  function persistSession() {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(EMAIL_KEY, email);
      localStorage.setItem(USER_HASH_KEY, userHash);
      localStorage.setItem(SLOT_KEY, String(slotIndex));
    } catch (_e) { /* ignore */ }
  }

  function clearSession() {
    token = email = userHash = slotIndex = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(EMAIL_KEY);
      localStorage.removeItem(USER_HASH_KEY);
      localStorage.removeItem(SLOT_KEY);
    } catch (_e) { /* ignore */ }
  }

  function localKey(suffix) {
    return 'ftchat_' + (userHash || 'anon') + '_' + suffix;
  }

  function loadLocalSessions() {
    try {
      var raw = localStorage.getItem(localKey('sessions'));
      localSessions = raw ? JSON.parse(raw) : {};
    } catch (_e) { localSessions = {}; }
  }

  function saveLocalSessions() {
    try {
      localStorage.setItem(localKey('sessions'), JSON.stringify(localSessions));
    } catch (_e) { /* quota or private mode */ }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 使用 Web Crypto 生成随机字符 (避免 Math.random 在 ID 生成中的 CodeQL 警告)
  function cryptoRandomId(len) {
    var alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var out = '';
    if (window.crypto && window.crypto.getRandomValues) {
      var arr = new Uint32Array(len);
      window.crypto.getRandomValues(arr);
      for (var i = 0; i < len; i++) out += alphabet[arr[i] % alphabet.length];
      return out;
    }
    // 兜底 (不应在现代浏览器触发)
    for (var j = 0; j < len; j++) out += alphabet[Math.floor(Math.random() * alphabet.length)]; // lgtm[js/insecure-randomness]
    return out;
  }

  function renderMarkdown(text) {
    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
      // 降级: 转义 + 换行
      return escapeHtml(text).replace(/\n/g, '<br>');
    }
    try {
      marked.setOptions({ breaks: true, gfm: true });
      var html = marked.parse(text);
      return DOMPurify.sanitize(html, {
        FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed'],
        FORBID_ATTR: ['onclick', 'onerror', 'onload', 'style']
      });
    } catch (_e) {
      return escapeHtml(text).replace(/\n/g, '<br>');
    }
  }

  function showLoginMsg(text, isSuccess) {
    loginMsg.textContent = text;
    if (isSuccess) loginMsg.classList.add('success');
    else loginMsg.classList.remove('success');
  }

  function setMetaBar(meta) {
    if (!meta) { metaBar.textContent = ''; return; }
    var parts = [];
    if (meta.time_anchor) parts.push('🕒 ' + meta.time_anchor);
    if (meta.prompt_source) parts.push('📖 ' + meta.prompt_source);
    if (meta.model_variant) parts.push('🎯 ' + (meta.model_variant === 'naipping' ? '情感线' : '系统线'));
    metaBar.textContent = parts.join(' · ');
  }

  // ─── API 调用 ───
  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(API_BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var err = new Error(data.message || 'HTTP ' + res.status);
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  // ─── 槽位查询 ───
  function refreshSlots() {
    fetch(API_BASE + '/hli/ftchat/status').then(function (r) { return r.json(); }).then(function (s) {
      if (typeof s.slots_taken === 'number') {
        slotsText.textContent = '当前席位: ' + s.slots_taken + ' / ' + s.slots_total +
          (s.slots_remaining === 0 ? ' （已满，请等待成员退出）' : ' （剩余 ' + s.slots_remaining + ' 席）');
      }
    }).catch(function () {
      slotsText.textContent = '席位状态查询失败';
    });
  }

  // ─── 登录流程 ───
  sendCodeBtn.addEventListener('click', function () {
    var em = (emailInput.value || '').trim();
    if (!em) { showLoginMsg('请填写 QQ 邮箱'); return; }
    sendCodeBtn.disabled = true;
    sendCodeBtn.textContent = '发送中…';
    showLoginMsg('');

    api('/hli/ftchat/login', { method: 'POST', body: { email: em } })
      .then(function (resp) {
        showLoginMsg(resp.message || '验证码已发送', true);
        var seconds = 60;
        var timer = setInterval(function () {
          if (seconds <= 0) {
            clearInterval(timer);
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = '获取验证码';
          } else {
            sendCodeBtn.textContent = seconds + 's 后重发';
            seconds--;
          }
        }, 1000);
      })
      .catch(function (err) {
        sendCodeBtn.disabled = false;
        sendCodeBtn.textContent = '获取验证码';
        showLoginMsg(err.message || '发送失败');
        refreshSlots();
      });
  });

  loginForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var em = (emailInput.value || '').trim();
    var code = (codeInput.value || '').trim();
    if (!em || !code) { showLoginMsg('请填写邮箱和验证码'); return; }

    loginBtn.disabled = true;
    loginBtn.textContent = '验证中…';

    api('/hli/ftchat/verify', { method: 'POST', body: { email: em, code: code } })
      .then(function (resp) {
        if (!resp.success) throw new Error(resp.message || '验证失败');
        token = resp.token;
        email = em;
        userHash = resp.user_hash;
        slotIndex = resp.slot_index;
        persistSession();
        showLoginMsg('登录成功，正在进入…', true);
        setTimeout(enterChat, 400);
      })
      .catch(function (err) {
        loginBtn.disabled = false;
        loginBtn.textContent = '进入对话';
        showLoginMsg(err.message || '验证失败');
      });
  });

  logoutBtn.addEventListener('click', function () {
    clearSession();
    location.reload();
  });

  // ─── 聊天进入 ───
  function enterChat() {
    loginScreen.hidden = true;
    chatScreen.hidden = false;
    userBadge.textContent = email || '匿名';
    userBadge.title = email || '';
    slotBadgeEl.textContent = '席位 ' + slotIndex + '/10';

    loadLocalSessions();
    refreshServerSessions();

    // 选最新的一个 session 或创建新会话
    var sessionIds = Object.keys(localSessions);
    if (sessionIds.length > 0) {
      // 选最新
      sessionIds.sort(function (a, b) {
        return (localSessions[b].updated_at || 0) - (localSessions[a].updated_at || 0);
      });
      switchSession(sessionIds[0]);
    } else {
      createNewSession(false);
    }
  }

  function refreshServerSessions() {
    api('/hli/ftchat/sessions').then(function (data) {
      sessions = data.sessions || [];
      renderSidebar();
    }).catch(function () { /* ignore */ });
  }

  function renderSidebar() {
    sessionsList.innerHTML = '';
    // 合并本地 sessions 与服务端 sessions（按 session_id）
    var ids = Object.keys(localSessions);
    var serverIds = sessions.map(function (s) { return s.session_id; });
    serverIds.forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); });

    // 按 updated_at 排序
    ids.sort(function (a, b) {
      var ta = (localSessions[a] && localSessions[a].updated_at) || 0;
      var tb = (localSessions[b] && localSessions[b].updated_at) || 0;
      var serverA = sessions.find(function (s) { return s.session_id === a; });
      var serverB = sessions.find(function (s) { return s.session_id === b; });
      if (serverA) ta = Math.max(ta, new Date(serverA.updated_at).getTime() || 0);
      if (serverB) tb = Math.max(tb, new Date(serverB.updated_at).getTime() || 0);
      return tb - ta;
    });

    if (ids.length === 0) {
      sessionsList.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 12px; text-align: center;">还没有对话</div>';
      return;
    }

    ids.forEach(function (id) {
      var local = localSessions[id];
      var server = sessions.find(function (s) { return s.session_id === id; });
      var title = (local && local.title) || (server && server.title) || '新对话';
      var ts = (local && local.updated_at) || (server && new Date(server.updated_at).getTime()) || 0;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'session-item' + (id === currentSessionId ? ' active' : '');
      btn.innerHTML =
        '<span class="session-item-title">' + escapeHtml(title) + '</span>' +
        '<span class="session-item-meta">' + formatTs(ts) + '</span>';
      btn.addEventListener('click', function () {
        switchSession(id);
        if (window.innerWidth <= 768) closeSidebar();
      });
      sessionsList.appendChild(btn);
    });
  }

  function formatTs(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    }
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  // ─── 会话管理 ───
  function switchSession(id) {
    currentSessionId = id;
    var s = localSessions[id];
    chatBody.innerHTML = '';
    metaBar.textContent = '';
    if (s && s.messages) {
      s.messages.forEach(function (m) {
        appendBubble(m.role === 'assistant' ? 'persona' : 'user', m.content);
      });
    } else {
      appendWelcome();
    }
    renderSidebar();
    scrollToBottom();
  }

  function appendWelcome() {
    var welcome = '你好，我是被微调的人格体。\n\n这是一个团队**内测频道**，你的对话会被记忆并跨会话延续。\n\n- 我会根据你给的真实时间锚点回应\n- 我使用 Markdown 排版（标题、列表、表格、代码块）\n- 试着问我任何东西吧～';
    appendBubble('persona', welcome);
  }

  function createNewSession(triggerCompress) {
    var prevId = currentSessionId;
    var prevMessages = (prevId && localSessions[prevId] && localSessions[prevId].messages) || [];

    function actuallyCreate(newId) {
      currentSessionId = newId || (Date.now().toString(36) + cryptoRandomId(8));
      localSessions[currentSessionId] = {
        title: '新对话',
        messages: [],
        updated_at: Date.now()
      };
      saveLocalSessions();
      switchSession(currentSessionId);
      refreshServerSessions();
    }

    if (triggerCompress && prevMessages.length >= 4) {
      // 调服务端压缩 + 拿新 session_id
      api('/hli/ftchat/sessions/new', {
        method: 'POST',
        body: {
          previous_session_id: prevId,
          previous_messages: prevMessages.slice(-30)
        }
      }).then(function (resp) {
        actuallyCreate(resp.session_id);
        if (resp.compressed) {
          // 在新对话里给个轻提示（不污染 messages 历史）
          var sysRow = document.createElement('div');
          sysRow.className = 'message-row system';
          sysRow.innerHTML = '<div class="bubble system">🧠 已为你保留上次对话的母语印记，新对话开始时会自动注入</div>';
          chatBody.insertBefore(sysRow, chatBody.firstChild);
        }
      }).catch(function () {
        actuallyCreate();
      });
    } else {
      actuallyCreate();
    }
  }

  newChatBtn.addEventListener('click', function () { createNewSession(true); });

  // ─── 侧栏移动端 ───
  function openSidebar() { sidebar.classList.add('open'); sidebarOverlay.classList.add('show'); }
  function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('show'); }
  sidebarToggle.addEventListener('click', openSidebar);
  sidebarClose.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  // ─── 消息渲染 ───
  function appendBubble(role, content) {
    var row = document.createElement('div');
    row.className = 'message-row ' + role;
    var bubble = document.createElement('div');
    bubble.className = 'bubble ' + role;
    if (role === 'persona') {
      bubble.innerHTML = renderMarkdown(content);
    } else if (role === 'system') {
      bubble.textContent = content;
    } else {
      bubble.textContent = content;
    }
    row.appendChild(bubble);
    chatBody.appendChild(row);
    scrollToBottom();
    return bubble;
  }

  function appendStreamBubble() {
    var row = document.createElement('div');
    row.className = 'message-row persona';
    var bubble = document.createElement('div');
    bubble.className = 'bubble persona cursor-blink';
    bubble.textContent = '';
    row.appendChild(bubble);
    chatBody.appendChild(row);
    scrollToBottom();
    return bubble;
  }

  function scrollToBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // ─── 发送消息 (SSE) ───
  composer.addEventListener('submit', function (ev) {
    ev.preventDefault();
    sendMessage();
  });

  msgInput.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      sendMessage();
    }
  });

  msgInput.addEventListener('input', function () {
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, 200) + 'px';
  });

  function sendMessage() {
    if (isStreaming) return;
    var text = (msgInput.value || '').trim();
    if (!text) return;

    msgInput.value = '';
    msgInput.style.height = 'auto';
    appendBubble('user', text);

    var sess = localSessions[currentSessionId];
    if (!sess) {
      sess = { title: '新对话', messages: [], updated_at: Date.now() };
      localSessions[currentSessionId] = sess;
    }
    sess.messages.push({ role: 'user', content: text });
    if (sess.messages.length === 1) sess.title = text.slice(0, 30);
    sess.updated_at = Date.now();
    saveLocalSessions();
    renderSidebar();

    streamReply(sess.messages);
  }

  function streamReply(history) {
    isStreaming = true;
    sendBtn.disabled = true;
    var bubble = appendStreamBubble();
    var fullText = '';

    fetch(API_BASE + '/hli/ftchat/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        session_id: currentSessionId,
        messages: history.slice(-50),  // 最近 50 条上行
        model_variant: 'system'
      })
    }).then(function (res) {
      if (res.status === 401) {
        clearSession();
        location.reload();
        throw new Error('登录失效');
      }
      if (!res.ok) {
        return res.json().then(function (d) { throw new Error(d.message || 'HTTP ' + res.status); });
      }
      return readSse(res, function (event) {
        if (event.delta) {
          fullText += event.delta;
          bubble.classList.remove('cursor-blink');
          bubble.innerHTML = renderMarkdown(fullText) + '<span class="cursor-blink"></span>';
          scrollToBottom();
        }
        if (event.meta) setMetaBar(event.meta);
        if (event.error) {
          bubble.innerHTML = '<em>⚠️ ' + escapeHtml(event.message || '上游异常') + '</em>';
        }
      });
    }).then(function () {
      bubble.classList.remove('cursor-blink');
      if (fullText) {
        bubble.innerHTML = renderMarkdown(fullText);
        var sess = localSessions[currentSessionId];
        if (sess) {
          sess.messages.push({ role: 'assistant', content: fullText });
          sess.updated_at = Date.now();
          saveLocalSessions();
        }
      } else if (!bubble.innerHTML) {
        bubble.innerHTML = '<em>（未收到有效回复）</em>';
      }
    }).catch(function (err) {
      bubble.classList.remove('cursor-blink');
      bubble.innerHTML = '<em>⚠️ ' + escapeHtml(err.message || '请求失败') + '</em>';
    }).then(function () {
      isStreaming = false;
      sendBtn.disabled = false;
      msgInput.focus();
    });
  }

  function readSse(res, onEvent) {
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buf = '';
    function pump() {
      return reader.read().then(function (chunk) {
        if (chunk.done) return;
        buf += decoder.decode(chunk.value, { stream: true });
        var lines = buf.split('\n');
        buf = lines.pop();
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line.startsWith('data:')) continue;
          var payload = line.slice(5).trim();
          if (payload === '[DONE]') return;
          try {
            var parsed = JSON.parse(payload);
            onEvent(parsed);
          } catch (_e) { /* ignore malformed */ }
        }
        return pump();
      });
    }
    return pump();
  }

  // ─── 启动 ───
  loadStorage();
  if (token && userHash) {
    // 有效性由后端鉴权决定，先进入；过期会被 401 踢出
    enterChat();
  } else {
    refreshSlots();
    setInterval(refreshSlots, 30000);
  }
})();
