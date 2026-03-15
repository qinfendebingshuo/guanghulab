// 应用入口
console.log('[app] 启动中...');

// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', function() {
    console.log('[app] DOM 已加载');
    
    const contentEl = document.getElementById('channel-content');
    if (!contentEl) {
        console.error('[app] 找不到 #channel-content');
        return;
    }
    
    // 初始化路由器
    if (window.ChannelRouter) {
        ChannelRouter.init(contentEl);
    }
    
    // 绑定导航按钮
    document.querySelectorAll('.channel-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const channel = this.dataset.channel;
            if (channel && window.ChannelRouter) {
                ChannelRouter.navigateTo(channel);
                
                // 标记已访问
                this.classList.add('visited');
                ChannelState.markVisited(channel);
            }
        });
    });
    
    console.log('[app] 初始化完成');
});

// 拦截所有事件总线消息，用于调试面板
const originalEmit = EventBus.emit;
EventBus.emit = function(event, data) {
    // 保存到调试日志
    if (!window.debugMessages) window.debugMessages = [];
    window.debugMessages.push({
        event,
        data,
        time: new Date().toLocaleTimeString()
    });
    
    // 调用原始方法
    originalEmit.call(this, event, data);
};
console.log('[app] 事件总线拦截器已安装');
