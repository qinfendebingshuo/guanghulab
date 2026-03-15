// event-bus.js
// 事件总线（发布/订阅模式）

const EventBus = {
    events: {},

    // 订阅事件
    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);
        console.log(`[bus] 订阅事件: ${eventName}`);
        return this; // 支持链式调用
    },

    // 发布事件
    emit(eventName, data) {
        console.log(`[bus] 发布事件: ${eventName}`, data);
        if (this.events[eventName]) {
            this.events[eventName].forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console.error(`[bus] 事件 ${eventName} 回调执行错误:`, err);
                }
            });
        }
        return this;
    },

    // 取消订阅
    off(eventName, callback) {
        if (!this.events[eventName]) return this;
        if (!callback) {
            // 如果没有提供回调，取消该事件的所有订阅
            delete this.events[eventName];
            console.log(`[bus] 取消所有订阅: ${eventName}`);
        } else {
            // 移除特定的回调
            this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
            console.log(`[bus] 取消一个订阅: ${eventName}`);
        }
        return this;
    },

    // 清空所有事件
    clear() {
        this.events = {};
        console.log('[bus] 清空所有事件');
    }
};

// 导出到全局，方便其他模块使用
window.EventBus = EventBus;
