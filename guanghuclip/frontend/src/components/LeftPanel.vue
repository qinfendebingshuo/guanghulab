<template>
  <div class="gl-header">
    <span class="gl-header-icon">🤖</span>
    <span class="gl-header-title"> currentPersona.name || '人格体交互区' </span>
    <span class="gl-header-subtitle">🗼 光湖灯塔 ·  isConnected ? '已连接' : '连接中...' </span>
  </div>

  <!-- 聊天消息区域 -->
  <div class="gl-chat-area" ref="chatArea">
    <div class="gl-msg gl-msg-bot">
      🗼 <b>光湖灯塔已激活</b><br><br>
      人格体已就绪。灯塔系统正在监管所有工具调用——<br>
      你能在右下角的 🔧 面板里看到人格体使用的每一个工具的真实执行结果。<br><br>
      有什么想聊的或想做的？✨
    </div>

    <div
      v-for="(msg, i) in messages"
      :key="i"
      class="gl-msg"
      :class="getMsgClass(msg)"
    >
      <!-- 工具调用消息 -->
      <div v-if="msg.type === 'tool'" class="gl-tool-msg">
        <div class="gl-tool-msg-header">
          <span class="gl-tool-msg-icon"> msg.status === 'success' ? '✅' : '❌' </span>
          <span class="gl-tool-msg-name"> msg.toolName </span>
          <span class="gl-tool-msg-duration"> msg.duration ms</span>
        </div>
        <div class="gl-tool-msg-result" v-if="msg.result">
           typeof msg.result === 'string' ? msg.result.substring(0, 200) : JSON.stringify(msg.result).substring(0, 200) 
        </div>
      </div>
      <!-- 思考中 -->
      <div v-else-if="msg.type === 'thinking'" class="gl-thinking">
        <span class="gl-thinking-dot"></span>
        <span class="gl-thinking-dot"></span>
        <span class="gl-thinking-dot"></span>
        <span style="margin-left: 8px; opacity: 0.7;"> currentPersona.name || '人格体' 正在思考...</span>
      </div>
      <!-- 普通消息 -->
      <div v-else v-html="msg.content"></div>
    </div>
  </div>

  <!-- 人格体选择 + 输入区域 -->
  <div class="gl-chat-input-wrap">
    <select class="gl-persona-select" v-model="selectedPersona" title="选择人格体">
      <option value="default">🤖 光湖助手</option>
      <option value="shuangyan">❄️ 霜砚</option>
      <option value="zhuyuan">🔨 铸渊</option>
    </select>
    <input
      class="gl-chat-input"
      v-model="input"
      placeholder="输入消息..."
      @keydown.enter="sendMessage"
      :disabled="isLoading"
    />
    <button class="gl-btn gl-btn-primary" style="padding: 10px 16px;" @click="sendMessage" :disabled="isLoading">
       isLoading ? '...' : '发送' 
    </button>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted, computed } from 'vue';
import { io } from 'socket.io-client';

const emit = defineEmits(['tool-calls']);

const input = ref('');
const messages = ref([]);
const chatArea = ref(null);
const isLoading = ref(false);
const isConnected = ref(false);
const selectedPersona = ref('default');

const PERSONA_NAMES = {
  default: '光湖助手',
  shuangyan: '霜砚',
  zhuyuan: '铸渊',
};

const currentPersona = computed(() => ({
  name: PERSONA_NAMES[selectedPersona.value] || '光湖助手',
}));

let socket = null;

onMounted(() => {
  socket = io({ transports: ['websocket', 'polling'] });
  
  socket.on('connect', () => { isConnected.value = true; });
  socket.on('disconnect', () => { isConnected.value = false; });
  
  // 工具开始执行
  socket.on('tool:start', (data) => {
    messages.value.push({
      type: 'tool',
      role: 'system',
      toolName: data.name,
      status: 'running',
      result: '执行中...',
      duration: 0,
      timestamp: data.timestamp,
    });
    nextTick(() => scrollToBottom());
  });
  
  // 工具执行完成
  socket.on('tool:executed', (data) => {
    // 更新最后一条同名工具消息
    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i].type === 'tool' && messages.value[i].toolName === data.name && messages.value[i].status === 'running') {
        messages.value[i].status = data.status;
        messages.value[i].result = data.result;
        messages.value[i].duration = data.duration;
        break;
      }
    }
    nextTick(() => scrollToBottom());
  });
  
  // 监听视频进度
  socket.on('video:progress', (data) => {
    // 视频进度转发到已有的RightPanel
  });
});

onUnmounted(() => {
  if (socket) socket.disconnect();
});

async function sendMessage() {
  const text = input.value.trim();
  if (!text || isLoading.value) return;

  messages.value.push({ type: 'text', role: 'user', content: text });
  input.value = '';
  isLoading.value = true;

  // 显示思考动画
  messages.value.push({ type: 'thinking', role: 'system' });

  await nextTick();
  scrollToBottom();

  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        userId: 'web-user',
        personaId: selectedPersona.value,
      }),
    });

    const data = await resp.json();

    // 移除思考动画
    messages.value = messages.value.filter(m => m.type !== 'thinking');

    if (!resp.ok) {
      messages.value.push({
        type: 'text',
        role: 'bot',
        content: `❌ ${data.error || '请求失败'}`,
      });
    } else {
      // 添加AI回复
      messages.value.push({
        type: 'text',
        role: 'bot',
        content: data.reply.replace(/\n/g, '<br>'),
      });

      // 如果有工具调用，通知父组件
      if (data.toolCalls && data.toolCalls.length > 0) {
        emit('tool-calls', data.toolCalls);
      }
    }
  } catch (err) {
    messages.value = messages.value.filter(m => m.type !== 'thinking');
    messages.value.push({
      type: 'text',
      role: 'bot',
      content: `❌ 连接失败: ${err.message}`,
    });
  }

  isLoading.value = false;
  await nextTick();
  scrollToBottom();
}

function getMsgClass(msg) {
  if (msg.type === 'tool') return 'gl-msg-tool';
  if (msg.type === 'thinking') return 'gl-msg-thinking';
  return msg.role === 'user' ? 'gl-msg-user' : 'gl-msg-bot';
}

function scrollToBottom() {
  if (chatArea.value) {
    chatArea.value.scrollTop = chatArea.value.scrollHeight;
  }
}
</script>

<style scoped>
/* 人格体选择器 */
.gl-persona-select {
  background: var(--gl-surface, #1a1a2e);
  color: var(--gl-text, #e0e0e0);
  border: 1px solid var(--gl-border, #2a2a4a);
  border-radius: 8px;
  padding: 8px;
  font-size: 13px;
  cursor: pointer;
  min-width: 100px;
}

/* 工具调用消息 */
.gl-msg-tool {
  background: rgba(108, 92, 231, 0.1) !important;
  border: 1px solid rgba(108, 92, 231, 0.3) !important;
  border-radius: 8px !important;
  margin: 4px 12px !important;
  padding: 8px 12px !important;
  font-size: 13px;
}
.gl-tool-msg-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.gl-tool-msg-name {
  color: var(--gl-primary, #6c5ce7);
  font-family: monospace;
}
.gl-tool-msg-duration {
  color: var(--gl-muted, #888);
  font-size: 11px;
  margin-left: auto;
}
.gl-tool-msg-result {
  margin-top: 4px;
  color: var(--gl-muted, #aaa);
  font-size: 12px;
  font-family: monospace;
  word-break: break-all;
}

/* 思考动画 */
.gl-msg-thinking { background: transparent !important; border: none !important; }
.gl-thinking {
  display: flex;
  align-items: center;
  padding: 8px 0;
  opacity: 0.7;
}
.gl-thinking-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--gl-primary, #6c5ce7);
  margin: 0 3px;
  animation: thinking-bounce 1.2s infinite;
}
.gl-thinking-dot:nth-child(2) { animation-delay: 0.2s; }
.gl-thinking-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes thinking-bounce {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1.2); }
}
</style>
