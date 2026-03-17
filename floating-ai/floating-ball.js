// floating-ball.js · Phase 2 · 接入M-ROUTER API
// DEV-004 之之妈妈 · 秋秋奶瓶线
// ✅ 完美版：自动创建小球+绑定事件+等待body加载

(function() {
  // 等待 body 加载完
  if (!document.body) {
    setTimeout(arguments.callee, 50);
    return;
  }

  // 防止重复加载
  if (document.getElementById('floatingBallContainer')) return;

  function init() {
    // 创建悬浮球DOM
    var container = document.createElement('div');
    container.id = 'floatingBallContainer';
    container.innerHTML = `
      <div id="floatingBall" title="秋秋 · HoloLake AI (Cmd/Ctrl+K)">
        <span>🍂</span>
      </div>
      <div id="floatingChatBox">
        <div id="floatingChatHeader">
          <span>秋秋 · HoloLake AI</span>
          <button id="floatingCloseBtn">✕</button>
        </div>
        <div id="floatingChatMessages">
          <div id="floatingMsgList">
            <div class="msg-bubble bot-bubble">你好！我是秋秋～有什么我能帮到妈妈的吗？</div>
          </div>
        </div>
        <div id="floatingChatInputArea">
          <input type="text" id="floatingChatInput" placeholder="和秋秋说点什么...">
          <button id="floatingSendBtn">发送</button>
        </div>
        <div id="floatingShortcutHint">⌘ / Ctrl + K 唤出</div>
      </div>
    `;
    document.body.appendChild(container);

    // 状态
    var isOpen = false;
    var ball = document.getElementById('floatingBall');
    var chatBox = document.getElementById('floatingChatBox');
    var closeBtn = document.getElementById('floatingCloseBtn');
    var sendBtn = document.getElementById('floatingSendBtn');
    var input = document.getElementById('floatingChatInput');
    var msgList = document.getElementById('floatingMsgList');

    // 添加消息
    function addMessage(text, isUser) {
      var msgDiv = document.createElement('div');
      msgDiv.className = 'msg-bubble ' + (isUser ? 'user-bubble' : 'bot-bubble');
      msgDiv.textContent = text;
      msgList.appendChild(msgDiv);
      msgList.scrollTop = msgList.scrollHeight;
    }

    // AI回复
    function sendBotReply(userText) {
      if (!msgList) return;

      var loadingId = 'loading-' + Date.now();
      var loadingDiv = document.createElement('div');
      loadingDiv.className = 'msg-bubble bot-bubble loading-bubble';
      loadingDiv.id = loadingId;
      loadingDiv.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span>';
      msgList.appendChild(loadingDiv);
      msgList.scrollTop = msgList.scrollHeight;

      if (typeof FloatingAIClient !== 'undefined') {
        FloatingAIClient.sendMessage(
          userText,
          function(reply) {
            var loadingEl = document.getElementById(loadingId);
            if (loadingEl) {
              loadingEl.className = 'msg-bubble bot-bubble';
              loadingEl.innerHTML = reply;
            }
            msgList.scrollTop = msgList.scrollHeight;
          },
          function(fallbackMsg, err) {
            var loadingEl = document.getElementById(loadingId);
            if (loadingEl) {
              loadingEl.className = 'msg-bubble bot-bubble';
              loadingEl.innerHTML = fallbackMsg;
            }
            msgList.scrollTop = msgList.scrollHeight;
          }
        );
      } else {
        var loadingEl = document.getElementById(loadingId);
        if (loadingEl) {
          loadingEl.className = 'msg-bubble bot-bubble';
          loadingEl.innerHTML = '秋秋在这里, API加载中, 请刷新一下~';
        }
      }
    }

    // 事件绑定
    ball.addEventListener('click', function(e) {
      e.stopPropagation();
      isOpen = !isOpen;
      chatBox.classList.toggle('open', isOpen);
      if (isOpen) input.focus();
    });

    closeBtn.addEventListener('click', function() {
      isOpen = false;
      chatBox.classList.remove('open');
    });

    sendBtn.addEventListener('click', function() {
      var text = input.value.trim();
      if (!text) return;
      addMessage(text, true);
      input.value = '';
      sendBotReply(text);
    });

    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') sendBtn.click();
    });

    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        isOpen = !isOpen;
        chatBox.classList.toggle('open', isOpen);
        if (isOpen) input.focus();
      }
    });

    document.addEventListener('click', function(e) {
      if (isOpen && !chatBox.contains(e.target) && e.target !== ball) {
        isOpen = false;
        chatBox.classList.remove('open');
      }
    });

    console.log('[M-FLOATING-AI] Phase 2 悬浮球已加载 (完美版)');
  }

  // 如果页面已经加载完，直接执行；否则等 DOM 加载完
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
