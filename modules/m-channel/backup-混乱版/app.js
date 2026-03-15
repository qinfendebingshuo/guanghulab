// app.js - 光湖频道动态渲染引擎入口
console.log('[app] 启动中...');

// 等待 DOM 完全加载
document.addEventListener('DOMContentLoaded', function() {
    console.log('[app] DOM 已加载，初始化组件...');

    // 获取内容容器
    const contentEl = document.getElementById('channel-content');
    if (!contentEl) {
        console.error('[app] 找不到 #channel-content 元素');
        return;
    }

    // 恢复状态（如果 ChannelState 存在）
    if (window.ChannelState) {
        const savedState = ChannelState.restoreState();
        console.log('[app] 恢复的状态:', savedState);
    } else {
        console.warn('[app] ChannelState 未加载');
    }

    // 初始化路由器
    if (window.ChannelRouter) {
        ChannelRouter.init(contentEl);
    } else {
        console.error('[app] ChannelRouter 未加载');
        return;
    }

    // 绑定导航按钮点击事件
    document.querySelectorAll('.channel-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const channel = this.dataset.channel;
            if (channel) {
                ChannelRouter.navigateTo(channel);
            }
        });
    });

    console.log('[app] 初始化完成');
});
