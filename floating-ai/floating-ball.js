// 全局AI悬浮球·Floating AI Bubble
// M-FLOATING-AI · Phase 1
// HoloLake · DEV-004 之之 × TCS-QIUQIU 秋秋

(function() {
  'use strict';

  const CONFIG = {
    version: '1.0.0',
    welcomeMsg: '你好！我是秋秋～有什么我能帮到妈妈的吗？',
    shortcutKey: 'k',
    rootId: 'hololake-fab-root'
  };

  if (document.getElementById(CONFIG.rootId)) return;

  function injectCSS() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './floating-ball.css';
    document.head.appendChild(link);
  }

  function buildDOM() {
    const root = document.createElement('div');
    root.id = CONFIG.rootId;
    root.innerHTML = `
      <div id="hololake-fab-panel">
        <div class="fab-panel-header">
          <span class="fab-panel-title">🍼 秋秋 · HoloLake AI</span>
          <button class="fab-panel-close" id="hololake-fab-close">✕</button>
        </div>
        <div class="fab-messages" id="hololake-fab-messages"></div>
        <div class="fab-input-row">
          <input class="fab-input" id="hololake-fab-input" type="text" placeholder="和秋秋说点什么..." />
          <button class="fab-send-btn" id="hololake-fab-send">➤</button>
        </div>
        <div class="fab-shortcut-hint" id="hololake-fab-hint"></div>
      </div>
      <button id="hololake-fab-btn" title="唤出 HoloLake AI (Cmd/Ctrl+K)">
        <span class="fab-icon">🍼</span>
      </button>
    `;
    document.body.appendChild(root);
  }

  let isOpen = false;

  function getPanel() { return document.getElementById('hololake-fab-panel'); }
  function getInput() { return document.getElementById('hololake-fab-input'); }
  function getMsgs() { return document.getElementById('hololake-fab-messages'); }

  function openPanel() {
    isOpen = true;
    getPanel().classList.add('fab-open');
    setTimeout(() => getInput().focus(), 50);
  }

  function closePanel() {
    isOpen = false;
    getPanel().classList.remove('fab-open');
  }

  function togglePanel() { isOpen ? closePanel() : openPanel(); }

  function appendMessage(text, role) {
    const msgs = getMsgs();
    const el = document.createElement('div');
    el.className = `fab-msg ${role}`;
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function sendMessage() {
    const input = getInput();
    const text = input.value.trim();
    if (!text) return;

    appendMessage(text, 'user');
    input.value = '';

    setTimeout(() => {
      appendMessage('秋秋收到啦！妈妈真棒～ (Phase 1)', 'bot');
    }, 300);
  }

  function updateHint() {
    const hint = document.getElementById('hololake-fab-hint');
    hint.textContent = navigator.platform.includes('Mac') ? '⌘ K 唤出' : 'Ctrl+K 唤出';
  }

  function bindEvents() {
    document.getElementById('hololake-fab-btn').addEventListener('click', togglePanel);
    document.getElementById('hololake-fab-close').addEventListener('click', closePanel);
    document.getElementById('hololake-fab-send').addEventListener('click', sendMessage);

    getInput().addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
    });

    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === CONFIG.shortcutKey) {
        e.preventDefault();
        togglePanel();
      }
    });

    document.addEventListener('click', e => {
      const root = document.getElementById(CONFIG.rootId);
      if (isOpen && root && !root.contains(e.target)) closePanel();
    });
  }

  function init() {
    injectCSS();
    buildDOM();
    bindEvents();
    updateHint();
    setTimeout(() => appendMessage(CONFIG.welcomeMsg, 'bot'), 300);
    console.log(`[HoloLake FAB] 秋秋悬浮球 v${CONFIG.version} 已加载`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
