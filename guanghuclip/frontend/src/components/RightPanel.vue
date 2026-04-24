<template>
  <div class="gl-header">
    <span class="gl-header-icon">🎥</span>
    <span class="gl-header-title">视频生产区</span>
    <span class="gl-header-subtitle">光湖短视频工作台</span>
    <!-- BYOK 设置入口 -->
    <button class="gl-btn-icon" @click="showApiSettings = !showApiSettings" :title="apiKeyStatus">
      🔑
    </button>
  </div>

  <!-- BYOK API Key 设置面板 -->
  <div class="gl-byok-panel" v-if="showApiSettings">
    <div class="gl-byok-header">
      <span class="gl-byok-title">🔐 自定义 API Key</span>
      <span class="gl-byok-hint">使用自己的即梦额度，不消耗平台余额</span>
    </div>
    <div class="gl-byok-body">
      <div class="gl-byok-input-wrap">
        <input
          class="gl-byok-input"
          :type="showKey ? 'text' : 'password'"
          v-model="customApiKey"
          placeholder="粘贴你的即梦 (火山方舟) API Key..."
          @input="onApiKeyInput"
        />
        <button class="gl-btn-icon gl-byok-eye" @click="showKey = !showKey">
           showKey ? '🙈' : '👁️' 
        </button>
      </div>
      <div class="gl-byok-actions">
        <button
          class="gl-btn gl-btn-small gl-btn-primary"
          @click="saveApiKey"
          :disabled="!customApiKey.trim()"
        >
          💾 保存
        </button>
        <button
          class="gl-btn gl-btn-small gl-btn-secondary"
          @click="clearApiKey"
          v-if="savedApiKey"
        >
          🗑️ 清除
        </button>
        <button
          class="gl-btn gl-btn-small gl-btn-secondary"
          @click="showApiSettings = false"
        >
          收起
        </button>
      </div>
      <div class="gl-byok-status" v-if="savedApiKey">
        <span class="gl-byok-badge active">✅ 已配置自定义 Key</span>
        <span class="gl-byok-badge-hint">生成将使用您自己的额度</span>
      </div>
      <div class="gl-byok-status" v-else>
        <span class="gl-byok-badge">💡 未配置</span>
        <span class="gl-byok-badge-hint">将使用平台默认额度（有限）</span>
      </div>
      <div class="gl-byok-guide">
        <details>
          <summary>如何获取即梦 API Key？</summary>
          <ol>
            <li>访问 <a href="https://console.volcengine.com/ark" target="_blank">火山方舟控制台</a></li>
            <li>注册/登录账号，完成实名认证</li>
            <li>在「API Key 管理」页面创建新的 Key</li>
            <li>复制 Key 粘贴到上方输入框</li>
            <li>在「模型广场」开通 Seedance 1.5 Pro 模型</li>
            <li>充值余额（按量计费，5秒视频约 ¥0.3）</li>
          </ol>
        </details>
      </div>
    </div>
  </div>

  <div class="gl-content">
    <!-- ① 提示词输入 -->
    <div class="gl-section" v-if="stage === 'input' || stage === 'idle'">
      <div class="gl-section-title">📝 视频提示词</div>
      <textarea
        class="gl-textarea"
        v-model="prompt"
        placeholder="描述你想生成的视频画面...
例如：一只橘猫在樱花树下打瞌睡，微风吹过，花瓣缓缓飘落，电影质感，浅景深"
        maxlength="3000"
        @input="onPromptInput"
      ></textarea>
      <div class="gl-char-count" :class="charCountClass">
        已输入  charCount  / 1000 字
      </div>
    </div>

    <!-- ② 模型选择 -->
    <div class="gl-section" v-if="stage === 'input' || stage === 'idle'">
      <div class="gl-section-title">🎯 选择模型</div>
      <div class="gl-model-grid">
        <div
          class="gl-model-card active"
          @click="selectedModel = 'jimeng'"
        >
          <div class="gl-model-name">即梦 Seedance</div>
          <div class="gl-model-tag" style="color: var(--gl-success);">✅ 可用</div>
        </div>
        <div class="gl-model-card disabled" title="即将开放">
          <div class="gl-model-name">可灵 Kling</div>
          <div class="gl-model-tag">🔒 即将开放</div>
        </div>
        <div class="gl-model-card disabled" title="即将开放">
          <div class="gl-model-name">Vidu</div>
          <div class="gl-model-tag">🔒 即将开放</div>
        </div>
        <div class="gl-model-card disabled" title="即将开放">
          <div class="gl-model-name">万象 WAN</div>
          <div class="gl-model-tag">🔒 即将开放</div>
        </div>
        <div class="gl-model-card disabled" title="即将开放">
          <div class="gl-model-name">Google Veo</div>
          <div class="gl-model-tag">🔒 即将开放</div>
        </div>
      </div>
    </div>

    <!-- ③ 视频参数 -->
    <div class="gl-section" v-if="stage === 'input' || stage === 'idle'">
      <div class="gl-section-title">⚙️ 参数设置</div>
      <div class="gl-param-row">
        <span class="gl-param-label">时长</span>
        <div class="gl-param-options">
          <span
            class="gl-param-chip"
            :class="{ active: duration === '5' }"
            @click="duration = '5'"
          >5 秒</span>
          <span
            class="gl-param-chip"
            :class="{ active: duration === '10' }"
            @click="duration = '10'"
          >10 秒</span>
        </div>
      </div>
      <div class="gl-param-row">
        <span class="gl-param-label">分辨率</span>
        <div class="gl-param-options">
          <span
            class="gl-param-chip"
            :class="{ active: resolution === '720p' }"
            @click="resolution = '720p'"
          >720p</span>
          <span
            class="gl-param-chip"
            :class="{ active: resolution === '1080p' }"
            @click="resolution = '1080p'"
          >1080p</span>
        </div>
      </div>

      <!-- BYOK 状态提示 -->
      <div class="gl-byok-inline" v-if="savedApiKey">
        🔑 使用自定义 Key · <a href="#" @click.prevent="showApiSettings = true">管理</a>
      </div>
    </div>

    <!-- ④ 生成按钮 -->
    <div class="gl-section" v-if="stage === 'input' || stage === 'idle'">
      <button
        class="gl-btn gl-btn-primary"
        style="width: 100%;"
        :disabled="!canGenerate"
        @click="generate"
      >
        ▶️ 开始生成
      </button>
    </div>

    <!-- ⑤ 生成进度 -->
    <div class="gl-progress-wrap" v-if="stage === 'generating'">
      <div class="gl-progress-ring">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle class="track" cx="60" cy="60" r="52" />
          <circle
            class="fill"
            cx="60" cy="60" r="52"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="dashOffset"
          />
        </svg>
        <div class="gl-progress-pct"> progress %</div>
      </div>
      <div class="gl-progress-msg"> progressMsg </div>
    </div>

    <!-- ⑥ 视频预览 -->
    <div class="gl-video-wrap" v-if="stage === 'completed'">
      <video
        class="gl-video-player"
        :src="videoUrl"
        controls
        autoplay
        loop
      ></video>
      <div class="gl-video-actions">
        <button class="gl-btn gl-btn-success" @click="downloadVideo">
          ⬇️ 下载视频
        </button>
        <button class="gl-btn gl-btn-secondary" @click="reset">
          ✖️ 重新生成
        </button>
      </div>
    </div>

    <!-- ⑦ 生成失败 -->
    <div class="gl-progress-wrap" v-if="stage === 'failed'">
      <div style="font-size: 48px; margin-bottom: 16px;">😞</div>
      <div class="gl-progress-msg" style="color: var(--gl-error);"> errorMsg </div>
      <button class="gl-btn gl-btn-secondary" style="margin-top: 16px;" @click="reset">
        重新尝试
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { io } from 'socket.io-client';

// ── BYOK 状态 ─────────────────────────────────────
const STORAGE_KEY = 'guanghuclip_custom_api_key';
const showApiSettings = ref(false);
const showKey = ref(false);
const customApiKey = ref('');
const savedApiKey = ref('');

// 初始化：从 localStorage 读取已保存的 Key
const loadSavedKey = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      savedApiKey.value = saved;
      customApiKey.value = saved;
    }
  } catch (e) {
    console.warn('无法读取 localStorage:', e);
  }
};

const saveApiKey = () => {
  const key = customApiKey.value.trim();
  if (!key) return;
  try {
    localStorage.setItem(STORAGE_KEY, key);
    savedApiKey.value = key;
    showApiSettings.value = false;
  } catch (e) {
    console.warn('无法写入 localStorage:', e);
  }
};

const clearApiKey = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    savedApiKey.value = '';
    customApiKey.value = '';
  } catch (e) {
    console.warn('无法清除 localStorage:', e);
  }
};

const onApiKeyInput = () => {};

const apiKeyStatus = computed(() => {
  return savedApiKey.value ? '已配置自定义 API Key' : '配置自定义 API Key';
});

// ── 状态 ──────────────────────────────────────────
const stage = ref('idle');          // idle → input → generating → completed / failed
const prompt = ref('');
const selectedModel = ref('jimeng');
const duration = ref('5');
const resolution = ref('1080p');
const progress = ref(0);
const progressMsg = ref('');
const videoUrl = ref('');
const errorMsg = ref('');
const taskId = ref('');

// ── 字数统计 ──────────────────────────────────────
const charCount = computed(() => {
  let count = 0;
  for (const ch of prompt.value) {
    count += /[\u4e00-\u9fff]/.test(ch) ? 1 : 0.5;
  }
  return Math.ceil(count);
});

const charCountClass = computed(() => {
  if (charCount.value > 1000) return 'error';
  if (charCount.value > 900) return 'warn';
  return '';
});

const canGenerate = computed(() => {
  return prompt.value.trim().length > 0 && charCount.value <= 1000;
});

const onPromptInput = () => {
  if (stage.value === 'idle') stage.value = 'input';
};

// ── 进度环 ────────────────────────────────────────
const circumference = 2 * Math.PI * 52;
const dashOffset = computed(() => {
  return circumference - (progress.value / 100) * circumference;
});

// ── Socket.IO ─────────────────────────────────────
let socket = null;

onMounted(() => {
  loadSavedKey();

  socket = io({ transports: ['websocket', 'polling'] });

  socket.on('video:progress', (data) => {
    if (data.taskId !== taskId.value) return;

    progress.value = data.progress || 0;
    progressMsg.value = data.message || '';

    if (data.status === 'completed' && data.videoUrl) {
      videoUrl.value = data.videoUrl;
      stage.value = 'completed';
    } else if (data.status === 'failed') {
      errorMsg.value = data.message || '生成失败';
      stage.value = 'failed';
    }
  });
});

onUnmounted(() => {
  if (socket) socket.disconnect();
});

// ── 生成视频 ──────────────────────────────────────
async function generate() {
  try {
    stage.value = 'generating';
    progress.value = 5;
    progressMsg.value = '正在提交任务...';

    const body = {
      prompt: prompt.value.trim(),
      model: selectedModel.value,
      duration: duration.value,
      resolution: resolution.value,
    };

    // BYOK: 如果有自定义 Key 则附带
    if (savedApiKey.value) {
      body.customApiKey = savedApiKey.value;
    }

    const resp = await fetch('/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || '提交失败');
    }

    taskId.value = data.taskId;
    progress.value = 10;
    const keyHint = data.usingCustomKey ? '(您的Key)' : '(平台)';
    progressMsg.value = `任务已提交，等待即梦处理... ${keyHint}`;
  } catch (err) {
    errorMsg.value = err.message;
    stage.value = 'failed';
  }
}

// ── 下载视频 ──────────────────────────────────────
async function downloadVideo() {
  try {
    const resp = await fetch(`/api/video/download/${taskId.value}`);
    const data = await resp.json();

    if (data.downloadUrl) {
      const a = document.createElement('a');
      a.href = data.downloadUrl;
      a.download = `guanghuclip-${Date.now()}.mp4`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (err) {
    console.error('下载失败:', err);
  }
}

// ── 重置 ──────────────────────────────────────────
function reset() {
  stage.value = 'idle';
  progress.value = 0;
  progressMsg.value = '';
  videoUrl.value = '';
  errorMsg.value = '';
  taskId.value = '';
}
</script>
