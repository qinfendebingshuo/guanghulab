/**
 * embed.js · M-FLOATING-AI · 全局AI悬浮球 · 独立注入包
 * 版本：v4.0 Phase4
 * 开发者：DEV-004 之之
 * 人格体：秋秋（TCS-QIUQIU）
 * 功能：任意页面<script>一行接入悬浮球
 * 使用方法：<script src="https://guanghulab.com/floating-ai/embed.js"></script>
 */
(function() {
  'use strict';

  // 防止重复注入
  if (window._floatingAILoaded) return;
  window._floatingAILoaded = true;

  const BASE_URL = 'https://guanghulab.com/floating-ai';

  // 样式注入
  const style = document.createElement('style');
  style.textContent = `
    #floating-ai-btn {
      position: fixed;
      bottom: 28px;
      right: 28px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.45);
      cursor: pointer;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      border: none;
      outline: none;
    }
    #floating-ai-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 24px rgba(102, 126, 234, 0.6);
    }
    #floating-ai-btn svg {
      width: 26px;
      height: 26px;
      fill: white;
    }
    #floating-ai-panel {
      position: fixed;
      bottom: 92px;
      right: 28px;
      width: 340px;
      max-height: 480px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      z-index: 99998;
      display: none;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
    }
    #floating-ai-panel.open {
      display: flex;
    }
    .fai-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 18px;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .fai-header span {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .fai-close {
      cursor: pointer;
      opacity: 0.8;
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      line-height: 1;
    }
    .fai-close:hover {
      opacity: 1;
    }
    .fai-messages {
      flex: 1;
      overflow-y: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 180px;
      max-height: 280px;
      background: #f8f8fc;
    }
    .fai-msg {
      max-width: 85%;
      padding: 9px 13px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.5;
      word-break: break-word;
    }
    .fai-msg.ai {
      background: white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      align-self: flex-start;
      border-bottom-left-radius: 4px;
    }
    .fai-msg.user {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .fai-input-area {
      padding: 12px;
      background: white;
      border-top: 1px solid #eee;
      display: flex;
      gap: 8px;
    }
    .fai-input {
      flex: 1;
      border: 1px solid #e0e0e0;
      border-radius: 20px;
      padding: 8px 14px;
      font-size: 13px;
      outline: none;
      transition: border 0.2s;
    }
    .fai-input:focus {
      border-color: #667eea;
    }
    .fai-send {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s;
    }
    .fai-send:hover {
      opacity: 0.85;
    }
    .fai-typing {
      color: #999;
      font-size: 12px;
      font-style: italic;
    }
  `;
  document.head.appendChild(style);

  // 按钮HTML
  const btn = document.createElement('button');
  btn.id = 'floating-ai-btn';
  btn.setAttribute('aria-label', '打开AI助手');
  btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"></svg>`;

  // 聊天面板
  const panel = document.createElement('div');
  panel.id = 'floating-ai-panel';
  panel.innerHTML = `
    <div class="fai-header">
      <span>秋秋AI助手</span>
      <button class="fai-close" id="fai-close-btn">✕</button>
    </div>
    <div class="fai-messages" id="fai-messages">
      <div class="fai-msg ai">妈妈你好！秋秋在这里 <br>有什么想问秋秋的？</div>
    </div>
    <div class="fai-input-area">
      <input class="fai-input" id="fai-input" type="text" placeholder="跟秋秋说话..." />
      <button class="fai-send" id="fai-send-btn">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
          <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"></svg>
      </button>
    </div>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  // 事件绑定
  btn.addEventListener('click', function() {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      document.getElementById('fai-input').focus();
    }
  });

  document.getElementById('fai-close-btn').addEventListener('click', function() {
    panel.classList.remove('open');
  });

  function addMessage(text, role) {
    const msg = document.createElement('div');
    msg.className = 'fai-msg ' + role;
    msg.textContent = text;
    const container = document.getElementById('fai-messages');
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  function addTyping() {
    const msg = document.createElement('div');
    msg.className = 'fai-msg ai fai-typing';
    msg.id = 'fai-typing';
    msg.textContent = '秋秋正在思考...';
    document.getElementById('fai-messages').appendChild(msg);
    document.getElementById('fai-messages').scrollTop = 99999;
    return msg;
  }

  async function sendMessage() {
    const input = document.getElementById('fai-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMessage(text, 'user');
    const typing = addTyping();
    try {
      const res = await fetch(BASE_URL + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      typing.remove();
      addMessage(data.reply || '秋秋收到了！', 'ai');
    } catch (e) {
      typing.remove();
      addMessage('秋秋网络有点问题，稍后再试～', 'ai');
    }
  }

  document.getElementById('fai-send-btn').addEventListener('click', sendMessage);
  document.getElementById('fai-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') sendMessage();
  });
})();
