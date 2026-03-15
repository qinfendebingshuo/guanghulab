/**
 * channel-state.js
 * 频道状态管理器 - 记忆妈妈的浏览足迹
 * 使用localStorage持久化，刷新页面自动恢复
 * 功能：保存/恢复当前路由、已访问模块列表、历史栈
 */

const ChannelState = (function() {
  const STORAGE_KEY = 'm-channel-state';
  
  // 默认状态
  const defaultState = {
    currentRoute: '/home',
    visitedModules: [],      // 已访问过的模块ID列表
    historyStack: ['/home'], // 历史记录栈
    historyIndex: 0          // 当前在历史栈中的位置
  };

  let state = { ...defaultState };

  // 加载本地存储的状态
  function load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        state = JSON.parse(saved);
        // 确保必要字段存在
        if (!state.visitedModules) state.visitedModules = [];
        if (!state.historyStack || !Array.isArray(state.historyStack)) {
          state.historyStack = [state.currentRoute || '/home'];
        }
        if (typeof state.historyIndex !== 'number') {
          state.historyIndex = 0;
        }
        console.log('[state] restore', state);
      } else {
        reset();
      }
    } catch (e) {
      console.warn('[state] load failed, use default', e);
      reset();
    }
    return state;
  }

  // 保存当前状态到localStorage
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      console.log('[state] save', state);
    } catch (e) {
      console.warn('[state] save failed', e);
    }
  }

  // 重置为默认状态
  function reset() {
    state = { ...defaultState };
    save();
  }

  // 更新当前路由
  function setCurrentRoute(route) {
    if (state.currentRoute !== route) {
      state.currentRoute = route;
      // 添加到已访问模块（如果是模块路由）
      if (route.startsWith('/module/')) {
        const moduleId = route.replace('/module/', '');
        if (!state.visitedModules.includes(moduleId)) {
          state.visitedModules.push(moduleId);
        }
      }
      save();
    }
  }

  // 添加到历史栈（用于前进后退）
  function pushHistory(route) {
    // 如果当前不在栈顶，先截断后面的记录
    if (state.historyIndex < state.historyStack.length - 1) {
      state.historyStack = state.historyStack.slice(0, state.historyIndex + 1);
    }
    state.historyStack.push(route);
    state.historyIndex = state.historyStack.length - 1;
    setCurrentRoute(route); // 会触发保存
  }

  // 后退
  function goBack() {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      state.currentRoute = state.historyStack[state.historyIndex];
      save();
      return state.currentRoute;
    }
    return null;
  }

  // 前进
  function goForward() {
    if (state.historyIndex < state.historyStack.length - 1) {
      state.historyIndex++;
      state.currentRoute = state.historyStack[state.historyIndex];
      save();
      return state.currentRoute;
    }
    return null;
  }

  // 获取当前状态
  function getState() {
    return { ...state };
  }

  // 标记模块为已访问（外部调用）
  function markModuleVisited(moduleId) {
    if (!state.visitedModules.includes(moduleId)) {
      state.visitedModules.push(moduleId);
      save();
    }
  }

  // 清除状态（用于测试）
  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    reset();
  }

  // 初始化：加载状态
  load();

  return {
    load,
    save,
    reset,
    setCurrentRoute,
    pushHistory,
    goBack,
    goForward,
    getState,
    markModuleVisited,
    clear
  };
})();

// 导出（如果是模块环境）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChannelState;
}
