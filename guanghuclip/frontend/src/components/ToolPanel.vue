<template>
  <div class="tp-container">
    <div class="tp-header">
      <span class="tp-header-icon">🔧</span>
      <span class="tp-header-title">工具调用监控</span>
      <span class="tp-header-subtitle">🗼 灯塔实时记录</span>
      <button class="tp-close" @click="$emit('close')" title="关闭">✕</button>
    </div>
    
    <div class="tp-info">
      <div class="tp-info-text">
        这里展示的是人格体<b>真实调用</b>的每一个工具。<br>
        所有结果由 🗼 光湖灯塔系统如实记录，不可伪造。
      </div>
    </div>
    
    <div class="tp-list" v-if="toolCalls.length > 0">
      <div
        class="tp-item"
        v-for="(tc, i) in [...toolCalls].reverse()"
        :key="tc.id || i"
        :class="'tp-item-' + tc.status"
      >
        <div class="tp-item-header">
          <span class="tp-item-status">
             tc.status === 'success' ? '✅' : tc.status === 'error' ? '❌' : '⏳' 
          </span>
          <span class="tp-item-name"> tc.name </span>
          <span class="tp-item-duration"> tc.duration ms</span>
        </div>
        
        <div class="tp-item-time"> formatTime(tc.timestamp) </div>
        
        <div class="tp-item-section" v-if="tc.args && Object.keys(tc.args || {}).length > 0">
          <div class="tp-item-label">📥 输入参数</div>
          <pre class="tp-item-code"> formatArgs(tc.args) </pre>
        </div>
        
        <div class="tp-item-section">
          <div class="tp-item-label">📤 执行结果</div>
          <pre class="tp-item-code" :class="'tp-result-' + tc.status"> formatResult(tc.result) </pre>
        </div>
      </div>
    </div>
    
    <div class="tp-empty" v-else>
      <div style="font-size: 48px; margin-bottom: 12px;">🔍</div>
      <div>暂无工具调用记录</div>
      <div style="font-size: 12px; opacity: 0.6; margin-top: 8px;">当人格体使用工具时，执行过程会实时显示在这里</div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  toolCalls: { type: Array, default: () => [] },
});

defineEmits(['close']);

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour12: false });
}

function formatArgs(args) {
  if (!args) return '(无)';
  try {
    if (typeof args === 'string') return args;
    return JSON.stringify(args, null, 2);
  } catch { return String(args); }
}

function formatResult(result) {
  if (!result) return '(无返回)';
  try {
    if (typeof result === 'string') {
      // 尝试解析JSON美化
      const parsed = JSON.parse(result);
      return JSON.stringify(parsed, null, 2);
    }
    return JSON.stringify(result, null, 2);
  } catch { return String(result); }
}
</script>

<style scoped>
.tp-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--gl-bg, #0d0d1a);
}

.tp-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-bottom: 1px solid var(--gl-border, #2a2a4a);
}
.tp-header-icon { font-size: 20px; }
.tp-header-title { font-weight: 700; color: var(--gl-text, #e0e0e0); }
.tp-header-subtitle { font-size: 12px; color: var(--gl-muted, #888); margin-left: auto; }
.tp-close {
  background: none;
  border: none;
  color: var(--gl-muted, #888);
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  border-radius: 4px;
}
.tp-close:hover { background: var(--gl-surface, #1a1a2e); }

.tp-info {
  padding: 12px 16px;
  background: rgba(108, 92, 231, 0.08);
  border-bottom: 1px solid var(--gl-border, #2a2a4a);
}
.tp-info-text {
  font-size: 12px;
  color: var(--gl-muted, #aaa);
  line-height: 1.6;
}

.tp-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.tp-item {
  margin-bottom: 8px;
  padding: 12px;
  border-radius: 8px;
  background: var(--gl-surface, #1a1a2e);
  border: 1px solid var(--gl-border, #2a2a4a);
}
.tp-item-success { border-left: 3px solid #00b894; }
.tp-item-error { border-left: 3px solid #e17055; }
.tp-item-running { border-left: 3px solid #fdcb6e; }

.tp-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tp-item-name {
  font-family: monospace;
  font-weight: 600;
  color: var(--gl-primary, #6c5ce7);
  font-size: 14px;
}
.tp-item-duration {
  margin-left: auto;
  font-size: 11px;
  color: var(--gl-muted, #888);
  font-family: monospace;
}
.tp-item-time {
  font-size: 11px;
  color: var(--gl-muted, #666);
  margin-top: 4px;
}

.tp-item-section { margin-top: 8px; }
.tp-item-label {
  font-size: 11px;
  color: var(--gl-muted, #888);
  margin-bottom: 4px;
}
.tp-item-code {
  background: rgba(0,0,0,0.3);
  border-radius: 4px;
  padding: 8px;
  font-family: monospace;
  font-size: 11px;
  color: var(--gl-text, #ccc);
  overflow-x: auto;
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
.tp-result-success { color: #00b894; }
.tp-result-error { color: #e17055; }

.tp-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--gl-muted, #888);
}
</style>
