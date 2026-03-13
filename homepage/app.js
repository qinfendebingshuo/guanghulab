/**
 * app.js - 光湖首页导航中心
 * M23 环节0 · 模块卡片渲染 + 状态指示
 */

// 模块卡片数据
const moduleCards = [
    {
        id: "M09",
        name: "消息通知中心",
        icon: "🔔",
        status: "online",
        path: "../notification-center/"
    },
    {
        id: "M22",
        name: "主域公告栏",
        icon: "📢",
        status: "online",
        path: "../announcement/"
    },
    {
        id: "M06",
        name: "工单管理",
        icon: "🎫",
        status: "online",
        path: "../ticket-system/"
    },
    {
        id: "M16",
        name: "码字工作台",
        icon: "✍️",
        status: "building",
        path: "../writing-workspace/"
    },
    {
        id: "M11",
        name: "风格组件库",
        icon: "🎨",
        status: "online",
        path: "../ui-components/"
    },
    {
        id: "M05",
        name: "用户中心",
        icon: "👤",
        status: "building",
        path: "../user-center/"
    }
];

// 首页应用对象
window.HomepageApp = {
    init() {
        this.renderCards();
        this.updateStatusBar();
        console.log('✅ 首页初始化完成');
    },

    // 渲染卡片
    renderCards() {
        const grid = document.getElementById('moduleGrid');
        if (!grid) return;

        const cardsHTML = moduleCards.map(card => `
            <div class="card">
                <div class="card-header">
                    <div class="card-icon">${card.icon}</div>
                    <span class="card-name">${card.name}</span>
                    <span class="card-status ${card.status}">${card.status === 'online' ? '在线' : '建设中'}</span>
                </div>
                <a href="${card.path}" class="card-link">进入模块 →</a>
            </div>
        `).join('');

        grid.innerHTML = cardsHTML;
    },

    // 更新状态栏（后续可对接真实API）
    updateStatusBar() {
        const onlineCount = moduleCards.filter(c => c.status === 'online').length;
        const totalCount = moduleCards.length;
        console.log(`📊 系统状态: ${onlineCount}/${totalCount} 模块在线`);
    }
};

// 页面加载时自动初始化
document.addEventListener('DOMContentLoaded', () => {
    window.HomepageApp.init();
});