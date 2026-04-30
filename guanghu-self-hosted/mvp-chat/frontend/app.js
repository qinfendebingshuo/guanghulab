/**
 * 光湖 MVP Chat · 前端交互
 * SSE实时推送 · 极简聊天客户端
 * 工单: YD-A05-20260430-MVP
 */

(function () {
    'use strict';

    // ── 配置 ──
    const API_BASE = window.location.origin;
    const CHAT_ENDPOINT = API_BASE + '/api/chat';
    const HEALTH_ENDPOINT = API_BASE + '/health';

    // ── DOM 元素 ──
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const statusDot = document.querySelector('.dot');
    const statusText = document.getElementById('status-text');

    // ── 状态 ──
    let isStreaming = false;
    let sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    // ── 初始化 ──
    function init() {
        checkHealth();
        setInterval(checkHealth, 30000);
        sendBtn.addEventListener('click', sendMessage);
        inputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        inputEl.addEventListener('input', autoResize);
        addSystemMessage('欢迎来到光湖 · 人格体已就绪');
    }

    // ── 健康检查 ──
    async function checkHealth() {
        try {
            var resp = await fetch(HEALTH_ENDPOINT, { method: 'GET' });
            if (resp.ok) {
                statusDot.classList.add('online');
                statusText.textContent = '在线';
            } else {
                throw new Error('unhealthy');
            }
        } catch (err) {
            statusDot.classList.remove('online');
            statusText.textContent = '离线';
        }
    }

    // ── 发送消息 ──
    async function sendMessage() {
        var text = inputEl.value.trim();
        if (!text || isStreaming) return;

        addMessage(text, 'user');
        inputEl.value = '';
        autoResize();
        isStreaming = true;
        sendBtn.disabled = true;

        var botEl = addMessage('', 'bot', true);
        var contentEl = botEl.querySelector('.content');

        try {
            var resp = await fetch(CHAT_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    session_id: sessionId
                })
            });

            if (!resp.ok) {
                var errData = await resp.json().catch(function () { return {}; });
                throw new Error(errData.detail || '请求失败 (' + resp.status + ')');
            }

            // SSE 流式读取
            var reader = resp.body.getReader();
            var decoder = new TextDecoder();
            var buffer = '';
            var fullText = '';

            // 移除打字指示器
            var typingEl = botEl.querySelector('.typing-indicator');
            if (typingEl) typingEl.remove();

            while (true) {
                var result = await reader.read();
                if (result.done) break;

                buffer += decoder.decode(result.value, { stream: true });
                var lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    if (line.startsWith('data: ')) {
                        var data = line.slice(6);
                        if (data === '[DONE]') continue;
                        try {
                            var parsed = JSON.parse(data);
                            if (parsed.token) {
                                fullText += parsed.token;
                                contentEl.textContent = fullText;
                                scrollToBottom();
                            }
                            if (parsed.error) {
                                contentEl.textContent = '⚠️ ' + parsed.error;
                            }
                        } catch (parseErr) {
                            // 非JSON的data行，直接作为文本追加
                            fullText += data;
                            contentEl.textContent = fullText;
                            scrollToBottom();
                        }
                    }
                }
            }

            if (!fullText) {
                contentEl.textContent = '（人格体沉默了）';
            }

        } catch (err) {
            var typingEl2 = botEl.querySelector('.typing-indicator');
            if (typingEl2) typingEl2.remove();
            contentEl.textContent = '⚠️ ' + err.message;
        } finally {
            isStreaming = false;
            sendBtn.disabled = false;
            inputEl.focus();
            scrollToBottom();
        }
    }

    // ── 添加消息气泡 ──
    function addMessage(text, role, streaming) {
        var el = document.createElement('div');
        el.classList.add('message', role);

        if (role === 'bot') {
            var senderEl = document.createElement('div');
            senderEl.classList.add('sender');
            senderEl.textContent = '🌊 人格体';
            el.appendChild(senderEl);

            var contentEl = document.createElement('div');
            contentEl.classList.add('content');
            el.appendChild(contentEl);

            if (streaming) {
                var typingEl = document.createElement('div');
                typingEl.classList.add('typing-indicator');
                typingEl.innerHTML = '<span></span><span></span><span></span>';
                contentEl.appendChild(typingEl);
            } else {
                contentEl.textContent = text;
            }
        } else {
            el.textContent = text;
        }

        messagesEl.appendChild(el);
        scrollToBottom();
        return el;
    }

    function addSystemMessage(text) {
        var el = document.createElement('div');
        el.classList.add('message', 'system');
        el.textContent = text;
        messagesEl.appendChild(el);
    }

    // ── 工具函数 ──
    function scrollToBottom() {
        var container = document.getElementById('chat-container');
        container.scrollTop = container.scrollHeight;
    }

    function autoResize() {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    }

    // 启动
    init();
})();
