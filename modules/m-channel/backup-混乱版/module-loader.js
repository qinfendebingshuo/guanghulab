/**
 * module-loader.js
 * 模块加载器 - 负责动态加载模块HTML/JS，并管理生命周期
 * 集成事件总线和生命周期钩子
 */

const ModuleLoader = (function() {
  // 已加载的模块缓存
  const loadedModules = {};

  // 加载模块
  async function loadModule(moduleId, container, params = {}) {
    if (loadedModules[moduleId]) {
      console.log(`[loader] 模块 ${moduleId} 已加载，直接显示`);
      showModule(moduleId, container, params);
      return;
    }

    try {
      console.log(`[loader] 正在加载模块: ${moduleId}`);

      // 获取模块URL（这里使用mock-modules下的html文件）
      const url = `mock-modules/mock-${moduleId}.html`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const html = await response.text();

      // 解析HTML，提取body内容作为模块内容
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      let moduleContent = doc.body.innerHTML;

      // 提取script标签并执行
      const scripts = doc.querySelectorAll('script');
      scripts.forEach(script => {
        const newScript = document.createElement('script');
        if (script.src) {
          newScript.src = script.src;
        } else {
          newScript.textContent = script.textContent;
        }
        document.body.appendChild(newScript);
        // 注意：动态添加的脚本会立即执行
      });

      // 存储模块内容
      loadedModules[moduleId] = {
        content: moduleContent,
        scripts: scripts.length
      };

      // 显示模块
      showModule(moduleId, container, params);

      // 触发生命周期 onLoad
      ModuleLifecycle.triggerLoad(moduleId, params);

      // 标记已访问（状态管理）
      if (window.ChannelState) {
        ChannelState.markModuleVisited(moduleId);
      }

      console.log(`[loader] 模块 ${moduleId} 加载完成`);
    } catch (error) {
      console.error(`[loader] 加载模块 ${moduleId} 失败:`, error);
      container.innerHTML = `<div class="error">加载失败：${error.message}</div>`;
    }
  }

  // 显示已加载的模块
  function showModule(moduleId, container, params) {
    const mod = loadedModules[moduleId];
    if (!mod) return;

    container.innerHTML = mod.content;

    // 如果有参数，可以通过自定义事件传递
    if (params) {
      const event = new CustomEvent('module:params', { detail: params });
      container.dispatchEvent(event);
    }

    // 通知模块已显示（通过生命周期？）
    // 可以用triggerMessage
    ModuleLifecycle.triggerMessage(moduleId, 'show', params);
  }

  // 卸载模块
  function unloadModule(moduleId) {
    if (loadedModules[moduleId]) {
      // 触发生命周期 onUnload
      ModuleLifecycle.triggerUnload(moduleId);

      // 清理缓存（可选）
      delete loadedModules[moduleId];
      console.log(`[loader] 模块 ${moduleId} 已卸载`);
    }
  }

  // 预加载模块
  function preloadModule(moduleId) {
    // 简单fetch但不显示
    fetch(`mock-modules/mock-${moduleId}.html`).catch(() => {});
  }

  return {
    loadModule,
    unloadModule,
    preloadModule
  };
})();

window.ModuleLoader = ModuleLoader;
