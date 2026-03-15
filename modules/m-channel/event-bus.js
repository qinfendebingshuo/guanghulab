// 事件总线（群聊频道）
window.EventBus = {
    listeners: {},
    
    // 订阅（加入群聊）
    on: function(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        console.log(`[事件总线] 订阅事件: ${event}`);
    },
    
    // 取消订阅（退群）
    off: function(event, callback) {
        if (!this.listeners[event]) return;
        if (!callback) {
            delete this.listeners[event];
        } else {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
        console.log(`[事件总线] 取消订阅: ${event}`);
    },
    
    // 发送消息（@所有人）
    emit: function(event, data) {
        console.log(`[事件总线] 发送事件: ${event}`, data);
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error(`[事件总线] 执行回调出错: ${e}`);
            }
        });
    }
};
