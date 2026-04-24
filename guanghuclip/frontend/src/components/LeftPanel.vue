<template>
  <div class="gl-header">
    <span class="gl-header-icon">🤖</span>
    <span class="gl-header-title">人格体交互区</span>
    <!-- 模型选择器 -->
    <select class="gl-model-select" v-model="selectedModel" :title="modelTitle">
      <option v-for="m in availableModels" :key="m.id" :value="m.id" :disabled="!m.available">
         m.icon   m.name   m.available ? '' : '(未配置)' 
      </option>
    </select>
  </div>

  <!-- 聊天消息区域 -->
  <div class="gl-chat-area" ref="chatArea">
    <div class="gl-msg gl-msg-bot">
      你好！我是光湖的人格体 ✨<br><br>
      这里是光湖短视频工作台，你可以在右边的面板里输入提示词来生成AI视频。<br><br>
      有什么问题都可以问我，比如：
      <ul style="margin-top: 8px; padding-left: 20px;">
        <li>怎么写好视频提示词？</li>
        <li>帮我在Notion里查一下项目进度</li>
        <li>我想生成一个什么风格的视频</li>
      </ul>
    </div>

    <div
      v-for="(msg, i) in messages"
      :key="i"
      class="gl-msg"
      :class="msg.role === 'user' ? 'gl-msg-user' : 'gl-msg-bot'"
    >
      <div v-html="msg.content"></div>
      <div class="gl-msg-meta" v-if="msg.role === 'bot' && msg.modelName">
         msg.modelName 
        <span v-if="msg.toolsUsed && msg.toolsUsed.length > 0">
          · 🔧  msg.toolsUsed.map(t => t.name.replace('notion_', '')).join(', ') 
        </span>
      </div>
    </div>

    <!-- 输入中动画 -->
    <div class="gl-msg gl-msg-bot gl-typing" v-if="isTyping">
      <span class="gl-typing-dot"></span>
      <span class="gl-typing-dot"></span>
      <span class="gl-typing-dot"></span>
    </div>
  </div>

  <!-- 输入区域 -->
  <div class="gl-chat-input-wrap">
    <input
      class="gl-chat-input"
      v-model="input"
      placeholder="输入消息..."
      @keydown.enter="sendMessage"
      :disabled="isTyping"
    />
    <button
      class="gl-btn gl-btn-primary"
      style="padding: 10px 16px;"
      @click="sendMessage"
      :disabled="isTyping || !input.trim()"
    >
       isTyping ? '…' : '发送' 
    </button>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue';

const input = ref('');
const messages = ref([]);
const chatArea = ref(null);
const isTyping = ref(false);
const selectedModel = ref('');
const availableModels = ref([]);

// ── 初始化：加载可用模型列表 ────────────────────
onMounted(async () => {
  try {
    const resp = await fetch('/api/chat/models');
    const data = await resp.json();
    availableModels.value = data.models || [];
    if (data.defaultModel) {
      selectedModel.value = data.defaultModel;
    } else if (availableModels.value.length > 0) {
      const first = availableModels.value.find(m => m.available);
      if (first) selectedModel.value = first.id;
    }
  } catch (err) {
    console.warn('加载模型列表失败:', err);
    // fallback
    availableModels.value = [
      { id: 'qianwen', name: '通义千问', icon: '🧠', available: true },
      { id: 'deepseek', name: 'DeepSeek', icon: '🔮', available: true },
      { id: 'kimi', name: 'Kimi', icon: '🌙', available: true },
      { id: 'zhipu', name: '智谱清言', icon: '💎', available: true },
    ];
    selectedModel.value = 'qianwen';
  }
});

const modelTitle = ref('选择AI模型');

// ── 发送消息 ──────────────────────────────────────
async function sendMessage() {
  const text = input.value.trim();
  if (!text || isTyping.value) return;

  messages.value.push({ role: 'user', content: escapeHtml(text) });
  input.value = '';
  isTyping.value = true;

  await nextTick();
  scrollToBottom();

  try {
    // 构建历史消息（发给后端的是纯文本，不含 HTML）
    const history = messages.value
      .filter(m => m.role === 'user' || m.role === 'bot')
      .slice(-20)
      .map(m => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: stripHtml(m.content),
      }));
    // 去掉最后一条（就是当前这条，会通过 message 参数发）
    history.pop();

    const resp = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history,
        modelId: selectedModel.value,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || '人格体暂时无法回复');
    }

    messages.value.push({
      role: 'bot',
      content: formatReply(data.reply),
      modelName: data.modelName,
      toolsUsed: data.toolsUsed,
    });
  } catch (err) {
    messages.value.push({
      role: 'bot',
      content: `<span style="color: var(--gl-error)">❌ ${escapeHtml(err.message)}</span>`,
    });
  } finally {
    isTyping.value = false;
    await nextTick();
    scrollToBottom();
  }
}

// ── 工具函数 ──────────────────────────────────────
function scrollToBottom() {
  if (chatArea.value) {
    chatArea.value.scrollTop = chatArea.value.scrollHeight;
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function formatReply(text) {
  // 简单的 markdown 转 HTML
  return text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}
</script>

<style scoped>
.gl-model-select {
  margin-left: auto;
  padding: 4px 8px;
  background: var(--gl-bg-input);
  border: 1px solid var(--gl-border);
  border-radius: 6px;
  color: var(--gl-text-secondary);
  font-size: 12px;
  outline: none;
  cursor: pointer;
  max-width: 140px;
}

.gl-model-select:focus {
  border-color: var(--gl-accent-dim);
}

.gl-msg-meta {
  font-size: 10px;
  color: var(--gl-text-muted);
  margin-top: 4px;
  opacity: 0.7;
}

/* ── 打字动画 ── */
.gl-typing {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  min-height: auto;
}

.gl-typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--gl-accent);
  opacity: 0.4;
  animation: glTypingBounce 1.2s ease-in-out infinite;
}

.gl-typing-dot:nth-child(2) { animation-delay: 0.2s; }
.gl-typing-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes glTypingBounce {
  0%, 60%, 100% { opacity: 0.4; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-4px); }
}
</style>
