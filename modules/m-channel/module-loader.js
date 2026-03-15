// 模块加载器
window.ModuleLoader = {
    loadModule: function(moduleName, containerId) {
        console.log(`[loader] 加载模块: ${moduleName}`);
        
        const module = ModuleRegistry.get(moduleName);
        if (!module) {
            console.error(`[loader] 模块 ${moduleName} 未注册`);
            return;
        }
        
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`[loader] 容器 ${containerId} 不存在`);
            return;
        }
        
        // 如果模块有 init 方法
        if (module.init && typeof module.init === 'function') {
            module.init(container);
        } else {
            container.innerHTML = `<div>模块 ${moduleName} 内容</div>`;
        }
        
        ModuleLifecycle.onLoad(moduleName);
    },
    
    unloadModule: function(moduleName) {
        console.log(`[loader] 卸载模块: ${moduleName}`);
        const module = ModuleRegistry.get(moduleName);
        if (module && module.destroy && typeof module.destroy === 'function') {
            module.destroy();
        }
        ModuleLifecycle.onUnload(moduleName);
    }
};
