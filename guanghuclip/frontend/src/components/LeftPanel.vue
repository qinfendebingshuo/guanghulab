<template>
  <div class="gl-header">
    <span class="gl-header-icon">🤖</span>
    <span class="gl-header-title">人格体交互区</span>
    <span class="gl-header-subtitle">光湖AI · 无记忆模式</span>
  </div>

  <!-- 聊天消息区域 -->
  <div class="gl-chat-area" ref="chatArea">
    <div class="gl-msg gl-msg-bot">
      你好！我是光湖的人格体 ✨<br><br>
      这里是光湖短视频工作台，你可以在右边的面板里输入提示词来生成AI视频。<br><br>
      有什么问题都可以问我，比如：
      <ul style="margin-top: 8px; padding-left: 20px;">
        <li>怎么写好视频提示词？</li>
        <li>即梦Seedance有什么特点？</li>
        <li>我想生成一个什么风格的视频</li>
      </ul>
    </div>

    <div
      v-for="(msg, i) in messages"
      :key="i"
      class="gl-msg"
      :class="msg.role === 'user' ? 'gl-msg-user' : 'gl-msg-bot'"
      v-html="msg.content"
    ></div>
  </div>

  <!-- 输入区域 -->
  <div class="gl-chat-input-wrap">
    <input
      class="gl-chat-input"
      v-model="input"
      placeholder="输入消息..."
      @keydown.enter="sendMessage"
    />
    <button class="gl-btn gl-btn-primary" style="padding: 10px 16px;" @click="sendMessage">
      发送
    </button>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';

const input = ref('');
const messages = ref([]);
const chatArea = ref(null);

// P0: 本地预设回复 (P1接入大模型API)
const quickReplies = {
  '提示词': '写好视频提示词的技巧：\n\n1. <b>描述画面</b>：先说主体（谁/什么），再说环境（在哪里），最后说动作\n2. <b>加入风格</b>：电影质感、动漫风、水彩画、赛博朋克...\n3. <b>镜头语言</b>：特写、航拍、慢动作、推拉摇移\n4. <b>光影氛围</b>：金色夕阳、霓虹灯光、柔和晨光\n\n例如：「一只橘猫在樱花树下打瞌睡，微风吹过花瓣缓缓飘落，电影质感，浅景深，暖色调」',
  '即梦': '即梦 Seedance 1.5 Pro 是字节跳动推出的AI视频生成模型 🎬\n\n特点：\n• 支持 5秒/10秒 视频生成\n• 支持 720p/1080p 分辨率\n• 中文提示词理解能力强\n• 生成速度较快（通常1-3分钟）\n• 画面质量优秀，动态自然\n\n目前是我们MVP的默认模型，后续会开放更多选择！',
  '风格': '光湖支持的视频风格参考：\n\n🎬 <b>写实/电影</b>：真实感画面，适合故事片\n🎨 <b>动漫/二次元</b>：日系动画风格\n🌐 <b>3D/CG</b>：三维渲染质感\n🎭 <b>赛博朋克</b>：霓虹+科技感\n🌿 <b>水彩/油画</b>：艺术绘画质感\n\n在提示词里加上风格关键词就行！',
  'default': '我收到了你的消息 😊 目前我还在MVP阶段，暂时只能回复预设内容。\n\n你可以试试问我：\n• 怎么写提示词\n• 即梦模型介绍\n• 视频风格推荐\n\n或者直接去右边面板试试生成视频吧！'
};

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  messages.value.push({ role: 'user', content: text });
  input.value = '';

  await nextTick();
  scrollToBottom();

  // 模拟延迟
  setTimeout(() => {
    let reply = quickReplies.default;
    for (const [key, val] of Object.entries(quickReplies)) {
      if (key !== 'default' && text.includes(key)) {
        reply = val;
        break;
      }
    }
    messages.value.push({ role: 'bot', content: reply });
    nextTick(() => scrollToBottom());
  }, 500);
}

function scrollToBottom() {
  if (chatArea.value) {
    chatArea.value.scrollTop = chatArea.value.scrollHeight;
  }
}
</script>
