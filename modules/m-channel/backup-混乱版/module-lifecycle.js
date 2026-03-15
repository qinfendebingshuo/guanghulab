/**
 * module-lifecycle.js
 * 模块生命周期管理 - 让模块知道自己何时加载/卸载/收到消息
 * 配合事件总线使用
 */

const ModuleLifecycle = (function() {
  // 存储每个模块的钩子函数
  const hooks = {};

  // 注册模块的生命周期钩子
  function register(moduleId, lifecycles) {
    if (!moduleId) return;

    hooks[moduleId] = {
      onLoad: lifecycles.onLoad || null,
      onUnload: lifecycles.onUnload || null,
      onMessage: lifecycles.onMessage || null
    };

    console.log(`[lifecycle] 注册模块: ${moduleId}`, lifecycles);

    // 如果已经加载（比如页面初始化时），自动触发onLoad？
    // 这里留给loader去调用
  }

  // 触发模块加载
  function triggerLoad(moduleId, params) {
    const moduleHooks = hooks[moduleId];
    if (moduleHooks && moduleHooks.onLoad) {
      try {
        moduleHooks.onLoad(params);
        console.log(`[lifecycle] onLoad 模块: ${moduleId}`);
      } catch (e) {
        console.error(`[lifecycle] onLoad 模块 ${moduleId} 出错:`, e);
      }
    }
  }

  // 触发模块卸载
  function triggerUnload(moduleId) {
    const moduleHooks = hooks[moduleId];
    if (moduleHooks && moduleHooks.onUnload) {
      try {
        moduleHooks.onUnload();
        console.log(`[lifecycle] onUnload 模块: ${moduleId}`);
      } catch (e) {
        console.error(`[lifecycle] onUnload 模块 ${moduleId} 出错:`, e);
      }
    }

    // 卸载时自动取消该模块的所有事件订阅
    // 这里简单使用事件总线的off，但需要知道该模块订阅了哪些事件
    // 我们约定模块在订阅时使用带命名空间的事件名，比如 moduleA:click
    // 或者在onUnload里手动取消。为了简化，我们不清除订阅，但可以在onUnload里做。
    // 更完善的做法是记录每个模块的订阅列表，但这里先不实现。
  }

  // 触发模块收到消息（由事件总线转发时调用）
  function triggerMessage(moduleId, message, data) {
    const moduleHooks = hooks[moduleId];
    if (moduleHooks && moduleHooks.onMessage) {
      try {
        moduleHooks.onMessage(message, data);
        console.log(`[lifecycle] onMessage 模块: ${moduleId} 消息: ${message}`);
      } catch (e) {
        console.error(`[lifecycle] onMessage 模块 ${moduleId} 出错:`, e);
      }
    }
  }

  // 获取模块的钩子（用于调试）
  function getHooks(moduleId) {
    return hooks[moduleId] || null;
  }

  return {
    register,
    triggerLoad,
    triggerUnload,
    triggerMessage,
    getHooks
  };
})();

window.ModuleLifecycle = ModuleLifecycle;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModuleLifecycle;
}
