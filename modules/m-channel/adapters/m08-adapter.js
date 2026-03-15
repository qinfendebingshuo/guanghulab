// M08 数据统计模块适配器
window.M08Adapter = {
    moduleId: 'm08',
    moduleName: '数据统计',
    
    init: function(containerId) {
        console.log('[M08Adapter] 初始化');
        if (window.ModuleAdapter) {
            return ModuleAdapter.loadModule(this.moduleId, containerId);
        } else {
            console.error('[M08Adapter] ModuleAdapter 未加载');
            return null;
        }
    },
    
    sendMessage: function(type, payload) {
        return ModuleAdapter.sendMessage(this.moduleId, { type, payload });
    },
    
    // 监听统计模块事件
    onStatsRefresh: function(callback) {
        EventBus.on('module:m08:message', function(data) {
            if (data.type === 'stats:refresh') {
                callback(data.payload);
            }
        });
    },
    
    onStatsExport: function(callback) {
        EventBus.on('module:m08:message', function(data) {
            if (data.type === 'stats:export') {
                callback(data.payload);
            }
        });
    },
    
    destroy: function() {
        ModuleAdapter.unloadModule(this.moduleId);
    }
};

if (window.ModuleRegistry) {
    ModuleRegistry.register('m08', window.M08Adapter);
    console.log('[M08Adapter] 已注册到模块注册表');
}

console.log('[M08Adapter] 已加载');
