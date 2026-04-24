<template>
  <div class="gl-layout" :class="{ 'gl-tool-panel-open': showToolPanel }">
    <div class="gl-panel gl-panel-left">
      <LeftPanel @tool-calls="onToolCalls" />
    </div>
    <div class="gl-panel gl-panel-right">
      <RightPanel />
    </div>
    <!-- 工具调用可视化面板 -->
    <div class="gl-panel gl-panel-tools" v-if="showToolPanel">
      <ToolPanel :toolCalls="allToolCalls" @close="showToolPanel = false" />
    </div>
    <!-- 工具面板切换按钮 -->
    <button class="gl-tool-toggle" @click="showToolPanel = !showToolPanel" :title="showToolPanel ? '关闭工具面板' : '查看工具调用'">
      <span class="gl-tool-toggle-icon">🔧</span>
      <span class="gl-tool-toggle-badge" v-if="allToolCalls.length > 0"> allToolCalls.length </span>
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import LeftPanel from './components/LeftPanel.vue';
import RightPanel from './components/RightPanel.vue';
import ToolPanel from './components/ToolPanel.vue';

const showToolPanel = ref(false);
const allToolCalls = ref([]);

function onToolCalls(calls) {
  allToolCalls.value = [...allToolCalls.value, ...calls];
  if (calls.length > 0) {
    showToolPanel.value = true; // 有工具调用时自动打开面板
  }
}
</script>

<style>
/* 工具面板切换按钮 */
.gl-tool-toggle {
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--gl-surface, #1a1a2e);
  border: 1px solid var(--gl-border, #2a2a4a);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  transition: all 0.2s;
}
.gl-tool-toggle:hover {
  background: var(--gl-surface-hover, #2a2a4a);
  transform: scale(1.1);
}
.gl-tool-toggle-icon { font-size: 20px; }
.gl-tool-toggle-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--gl-primary, #6c5ce7);
  color: white;
  font-size: 11px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

/* 三栏布局 */
.gl-layout.gl-tool-panel-open {
  grid-template-columns: 1fr 1fr 320px;
}
.gl-panel-tools {
  border-left: 1px solid var(--gl-border, #2a2a4a);
  overflow-y: auto;
}
</style>
