/**
 * event-bus.js
 * 事件总线 - 模块间的群聊频道
 * 发布/订阅模式，支持命名空间和调试日志
 */

const EventBus = (function() {
  // 存储订阅者：{ eventName: [handler1, handler2, ...] }
  const listeners = {};
  // 调试模式开关
  let debugMode = true;

  // 订阅事件
  function on(eventName, handler) {
    if (typeof handler !== 'function') {
      console.error('[bus] 订阅必须提供函数');
      return;
    }

    if (!listeners[eventName]) {
      listeners[eventName] = [];
    }
    listeners[eventName].push(handler);

    if (debugMode) {
      console.log(`[bus] 订阅事件: ${eventName}，当前订阅数: ${listeners[eventName].length}`);
    }

    // 返回取消订阅函数
    return function off() {
      off(eventName, handler);
    };
  }

  // 取消订阅
  function off(eventName, handler) {
    if (!listeners[eventName]) return;

    if (handler) {
      // 移除特定handler
      const index = listeners[eventName].indexOf(handler);
      if (index !== -1) {
        listeners[eventName].splice(index, 1);
        if (debugMode) {
          console.log(`[bus] 取消订阅: ${eventName}，剩余: ${listeners[eventName].length}`);
        }
      }
    } else {
      // 移除该事件所有订阅
      delete listeners[eventName];
      if (debugMode) {
        console.log(`[bus] 移除所有订阅: ${eventName}`);
      }
    }
  }

  // 触发事件
  function emit(eventName, data) {
    if (!listeners[eventName]) {
      if (debugMode) {
        console.log(`[bus] 触发事件 ${eventName} 但无订阅者`);
      }
      return;
    }

    if (debugMode) {
      console.log(`[bus] 触发事件: ${eventName}，数据:`, data);
    }

    // 复制一份以防在遍历过程中修改
    const handlers = listeners[eventName].slice();
    handlers.forEach(handler => {
      try {
        handler(data, eventName);
      } catch (e) {
        console.error(`[bus] 事件 ${eventName} 处理出错:`, e);
      }
    });
  }

  // 清空所有订阅
  function clear() {
    for (let key in listeners) {
      delete listeners[key];
    }
    if (debugMode) {
      console.log('[bus] 清空所有订阅');
    }
  }

  // 开启/关闭调试
  function setDebug(enable) {
    debugMode = enable;
  }

  return {
    on,
    off,
    emit,
    clear,
    setDebug
  };
})();

// 挂载到全局
window.EventBus = EventBus;

// 如果是模块环境
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventBus;
}
