<template>
  <div class="gl-layout">
    <div class="gl-panel gl-panel-left">
      <LeftPanel />
    </div>
    <div class="gl-panel gl-panel-right">
      <RightPanel />
    </div>
  </div>
</template>

<script setup>
import LeftPanel from './components/LeftPanel.vue';
import RightPanel from './components/RightPanel.vue';
</script>
