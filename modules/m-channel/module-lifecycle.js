// 模块生命周期管理
window.ModuleLifecycle = {
    activeModules: new Set(),
    
    // 模块加载时
    onLoad: function(moduleName) {
        this.activeModules.add(moduleName);
        console.log(`[生命周期] 模块加载: ${moduleName}`);
        EventBus.emit('module:loaded', { module: moduleName, time: Date.now() });
    },
    
    // 模块卸载时
    onUnload: function(moduleName) {
        this.activeModules.delete(moduleName);
        console.log(`[生命周期] 模块卸载: ${moduleName}`);
        EventBus.emit('module:unloaded', { module: moduleName, time: Date.now() });
    },
    
    // 获取当前活跃模块
    getActiveModules: function() {
        return Array.from(this.activeModules);
    }
};
