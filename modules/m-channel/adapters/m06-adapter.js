// M06 工单管理模块适配器
window.M06Adapter = {
    moduleId: 'm06',
    moduleName: '工单管理',
    
    // 初始化模块（由 ModuleAdapter 调用）
    init: function(containerId) {
        console.log('[M06Adapter] 初始化');
        
        // 通过核心适配器加载
        if (window.ModuleAdapter) {
            return ModuleAdapter.loadModule(this.moduleId, containerId);
        } else {
            console.error('[M06Adapter] ModuleAdapter 未加载');
            return null;
        }
    },
    
    // 发送消息到工单模块
    sendMessage: function(type, payload) {
        return ModuleAdapter.sendMessage(this.moduleId, { type, payload });
    },
    
    // 监听工单模块事件
    onTicketCreate: function(callback) {
        EventBus.on('module:m06:message', function(data) {
            if (data.type === 'ticket:create') {
                callback(data.payload);
            }
        });
    },
    
    onTicketUpdate: function(callback) {
        EventBus.on('module:m06:message', function(data) {
            if (data.type === 'ticket:update') {
                callback(data.payload);
            }
        });
    },
    
    onTicketDelete: function(callback) {
        EventBus.on('module:m06:message', function(data) {
            if (data.type === 'ticket:delete') {
                callback(data.payload);
            }
        });
    },
    
    // 销毁模块
    destroy: function() {
        ModuleAdapter.unloadModule(this.moduleId);
    }
};

// 注册到模块注册表
if (window.ModuleRegistry) {
    ModuleRegistry.register('m06', window.M06Adapter);
    console.log('[M06Adapter] 已注册到模块注册表');
}

console.log('[M06Adapter] 已加载');
