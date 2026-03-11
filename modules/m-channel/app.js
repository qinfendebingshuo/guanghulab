// 应用入口：初始化路由和模块加载器的协作

// 当路由变化时，如果离开频道页，自动卸载模块
window.addEventListener('hashchange', () => {
    const path = window.location.hash.slice(2) || 'home';
    if (path !== 'channel') {
        // 离开频道页时卸载模块（避免残留）
        if (window.unloadModule) window.unloadModule();
    }
});

// 页面加载完成后，如果当前是频道页，绑定卡片事件
document.addEventListener('DOMContentLoaded', () => {
    // 延迟一点等待视图渲染
    setTimeout(initChannelPage, 100);
});

// 每次视图加载完成后也可能触发（路由引擎加载视图后）
// 所以我们用 MutationObserver 监听 router-view 的变化，当内容变成频道页时初始化
const observer = new MutationObserver(() => {
    const routerView = document.getElementById('router-view');
    if (!routerView) return;
    // 检查是否包含 .channel-view
    if (routerView.querySelector('.channel-view')) {
        initChannelPage();
    }
});
observer.observe(document.getElementById('router-view'), { childList: true, subtree: true });

function initChannelPage() {
    const cards = document.querySelectorAll('.module-card');
    cards.forEach(card => {
        card.removeEventListener('click', cardClickHandler); // 防止重复绑定
        card.addEventListener('click', cardClickHandler);
    });
}

function cardClickHandler(e) {
    const card = e.currentTarget;
    const moduleId = card.dataset.module;
    if (moduleId && window.loadModule) {
        // 可选：先卸载再加载（但 loadModule 会覆盖，所以不需要显式 unload）
        window.loadModule(moduleId);
    }
}
