// M11 系统组件库适配器
window.M11Adapter = {
    moduleId: 'm11',
    moduleName: '组件库',
    
    init: function(containerId) {
        console.log('[M11Adapter] 初始化');
        if (window.ModuleAdapter) {
            return ModuleAdapter.loadModule(this.moduleId, containerId);
        } else {
            console.error('[M11Adapter] ModuleAdapter 未加载');
            return null;
        }
    },
    
    sendMessage: function(type, payload) {
        return ModuleAdapter.sendMessage(this.moduleId, { type, payload });
    },
    
    // 监听组件库事件
    onThemeChange: function(callback) {
        EventBus.on('module:m11:message', function(data) {
            if (data.type === 'theme:change') {
                callback(data.payload);
            }
        });
    },
    
    onComponentSelect: function(callback) {
        EventBus.on('module:m11:message', function(data) {
            if (data.type === 'component:select') {
                callback(data.payload);
            }
        });
    },
    
    destroy: function() {
        ModuleAdapter.unloadModule(this.moduleId);
    }
};

if (window.ModuleRegistry) {
    ModuleRegistry.register('m11', window.M11Adapter);
    console.log('[M11Adapter] 已注册到模块注册表');
}

console.log('[M11Adapter] 已加载');
