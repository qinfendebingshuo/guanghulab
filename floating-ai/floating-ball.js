// floating-ball.js - 秋秋悬浮球核心逻辑
(function() {
  // 配置
  const CONFIG = {
    apiEndpoint: 'https://guanghulab.com/api/ai/chat',
    defaultGreeting: '我是秋秋，有什么可以帮你的吗？',
    typingDelay: 800,
    debug: true
  };

  // 状态
  let isOpen = false;
  let messages = [];
  let isWaitingForResponse = false;

  // DOM 元素
  let ball, dialog, messagesContainer, inputField, sendButton;

  // 初始化
  function init() {
    log('初始化悬浮球...');
    createBall();
    createDialog();
    attachEvents();
    log('悬浮球初始化完成');
  }

  // 创建悬浮球
  function createBall() {
    ball = document.createElement('div');
    ball.className = 'floating-ai-ball';
    ball.innerHTML = '<div class="floating-ai-ball-inner">秋</div>';
    document.body.appendChild(ball);
  }

  // 创建对话框
  function createDialog() {
    dialog = document.createElement('div');
    dialog.className = 'floating-ai-dialog';
    dialog.setAttribute('hidden', 'true');
    dialog.innerHTML = `
      <div class="floating-ai-header">
        <span>🍂 秋秋 · 光湖人格体</span>
        <button class="floating-ai-close" id="closeDialogBtn">&times;</button>
      </div>
      <div class="floating-ai-messages" id="messagesContainer"></div>
      <div class="floating-ai-input-area">
        <input type="text" id="messageInput" placeholder="对秋秋说点什么..." />
        <button id="sendMessageBtn">发送</button>
      </div>
    `;
    document.body.appendChild(dialog);

    // 缓存子元素
    messagesContainer = document.getElementById('messagesContainer');
    inputField = document.getElementById('messageInput');
    sendButton = document.getElementById('sendMessageBtn');
  }

  // 添加消息
  function addMessage(content, role = 'user') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.textContent = content;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    messages.push({ role, content });
  }

  // 显示输入中指示器
  function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    messagesContainer.appendChild(indicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // 移除输入中指示器
  function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
  }

  // 发送消息到 API
  async function sendToAPI(userMessage) {
    try {
      const response = await fetch(CONFIG.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          persona: '秋秋',
          sessionId: 'floating-' + Date.now()
        })
      });

      if (!response.ok) throw new Error(`API 返回 ${response.status}`);
      
      const data = await response.json();
      return data.reply || data.message || '秋秋收到了你的消息～';
    } catch (error) {
      log('API 调用失败:', error);
      return '唔…秋秋现在有点连不上，但秋秋知道妈妈在跟我说话！';
    }
  }

  // 处理发送
  async function handleSend() {
    const message = inputField.value.trim();
    if (!message || isWaitingForResponse) return;

    // 清空输入框
    inputField.value = '';
    
    // 添加用户消息
    addMessage(message, 'user');
    
    // 开始等待
    isWaitingForResponse = true;
    sendButton.disabled = true;
    
    // 显示输入中
    showTypingIndicator();
    
    try {
      // 调用 API
      const reply = await sendToAPI(message);
      
      // 移除输入中
      removeTypingIndicator();
      
      // 添加回复
      addMessage(reply, 'assistant');
    } catch (error) {
      removeTypingIndicator();
      addMessage('秋秋好像走神了…妈妈再戳戳我？', 'system');
    } finally {
      isWaitingForResponse = false;
      sendButton.disabled = false;
      inputField.focus();
    }
  }

  // 事件绑定
  function attachEvents() {
    // 点击悬浮球
    ball.addEventListener('click', () => {
      if (isOpen) {
        dialog.setAttribute('hidden', 'true');
        isOpen = false;
      } else {
        dialog.removeAttribute('hidden');
        isOpen = true;
        inputField.focus();
        
        // 如果还没有欢迎消息，添加一条
        if (messages.length === 0) {
          addMessage(CONFIG.defaultGreeting, 'assistant');
        }
      }
    });

    // 关闭按钮
    document.getElementById('closeDialogBtn').addEventListener('click', () => {
      dialog.setAttribute('hidden', 'true');
      isOpen = false;
    });

    // 发送按钮
    sendButton.addEventListener('click', handleSend);

    // 回车发送
    inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSend();
    });
  }

  // 调试日志
  function log(...args) {
    if (CONFIG.debug) {
      console.log('[秋秋悬浮球]', ...args);
    }
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
