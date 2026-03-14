/**
 * app.js - 光湖首页导航中心
 * M23 环节2 · 接入M22真实公告数据 + 状态API
 */

// === M22真实公告数据接入 ===
let announcements = [];
let dataSource = 'loading';

async function loadAnnouncementsFromM22() {
    const carousel = document.getElementById('announcementCarousel');
    if (carousel) {
        carousel.innerHTML = '<div style="padding: 20px; text-align: center; color: #3b82f6;">正在连接M22公告数据...</div>';
    }
    
    const result = await window.ModulesAPI.getAnnouncements();
    announcements = result.data;
    dataSource = result.source;
    
    if (dataSource === 'M22-live') {
        console.log('📢 首页公告：来自M22真实数据（' + announcements.length + '条）');
    } else {
        console.log('📢 首页公告：使用降级数据（M22不可用）');
    }
    
    if (window.HomepageApp) {
        window.HomepageApp.currentAnnouncementIndex = 0;
        window.HomepageApp.renderCarousel();
    }
}

// === 模块卡片数据 ===
const moduleCards = [
    { id: "M09", name: "消息通知中心", icon: "🔔", status: "online", path: "../notification-center/" },
    { id: "M22", name: "主域公告栏", icon: "📢", status: "online", path: "../announcement/" },
    { id: "M06", name: "工单管理", icon: "🎫", status: "online", path: "../ticket-system/" },
    { id: "M16", name: "码字工作台", icon: "✍️", status: "building", path: "../writing-workspace/" },
    { id: "M11", name: "风格组件库", icon: "🎨", status: "online", path: "../ui-components/" },
    { id: "M05", name: "用户中心", icon: "👤", status: "building", path: "../user-center/" }
];

// === 工具函数 ===
function getTypeLabel(type) {
    const labels = { update: '📢 更新', status: '📊 状态', welcome: '👋 欢迎', alert: '🚨 告警' };
    return labels[type] || '📌 公告';
}

// === 模块状态更新 ===
async function updateModuleStatusFromAPI() {
    const statusResult = await window.ModulesAPI.getAllModuleStatus();
    if (statusResult.source === 'fallback') return;
    
    document.querySelectorAll('.card').forEach(card => {
        const moduleId = card.dataset.moduleId;
        if (moduleId && statusResult.data[moduleId]) {
            const status = statusResult.data[moduleId].status;
            const statusSpan = card.querySelector('.card-status');
            if (statusSpan) {
                statusSpan.className = 'card-status ' + status;
                statusSpan.textContent = status === 'online' ? '在线' : status === 'building' ? '建设中' : '离线';
            }
        }
    });
    console.log('[M23] ✅ 模块状态已从注册表更新');
}

// === 首页应用对象 ===
window.HomepageApp = {
    currentAnnouncementIndex: 0,
    carouselInterval: null,

    async init() {
        this.renderCards();
        await loadAnnouncementsFromM22();
        await updateModuleStatusFromAPI();
        this.startCarousel();
        this.bindEvents();
        console.log('✅ 首页初始化完成 · 数据源：' + dataSource);
    },

    renderCards() {
        const grid = document.getElementById('moduleGrid');
        if (!grid) return;

        grid.innerHTML = moduleCards.map(card => `
            <div class="card" data-module-id="${card.id}" data-module-path="${card.path}">
                <div class="card-header">
                    <div class="card-icon">${card.icon}</div>
                    <span class="card-name">${card.name}</span>
                    <span class="card-status ${card.status}">${card.status === 'online' ? '在线' : '建设中'}</span>
                </div>
                <span class="card-link">进入模块 →</span>
            </div>
        `).join('');
    },

    // 轮播渲染（带高优先级橙色边框）
    renderCarousel() {
        const carousel = document.getElementById('announcementCarousel');
        if (!carousel || announcements.length === 0) {
            console.log('❌ 没有公告或找不到轮播容器');
            return;
        }
        
        const item = announcements[this.currentAnnouncementIndex];
        const priorityStyle = item.priority === 'high' ? 'border-left: 3px solid #ff9800; padding-left: 15px;' : '';
        
        carousel.innerHTML = `
            <div style="padding: 20px; text-align: center; ${priorityStyle}">
                <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; background: rgba(59,130,246,0.2); color: #3b82f6; margin-bottom: 10px; font-size: 14px;">
                    ${getTypeLabel(item.type)}
                </span>
                <h3 style="font-size: 24px; margin-bottom: 10px; color: white;">${item.title}</h3>
                <p style="color: #a0a8b8; margin-bottom: 10px; line-height: 1.6;">${item.content}</p>
                <small style="color: #666; display: block; margin-bottom: 10px;">${item.date}</small>
                <div style="font-size: 12px; color: ${dataSource === 'M22-live' ? '#3b82f6' : '#888'};">
                    ${dataSource === 'M22-live' ? '🔗 M22 实时数据' : '📋 本地数据'}
                </div>
            </div>
        `;
        
        console.log('✅ 轮播已渲染，当前索引：', this.currentAnnouncementIndex);
    },

    startCarousel() {
        if (this.carouselInterval) clearInterval(this.carouselInterval);
        this.carouselInterval = setInterval(() => this.nextAnnouncement(), 4000);
        console.log('🔄 轮播已启动，4秒自动切换');
    },

    nextAnnouncement() {
        if (announcements.length === 0) return;
        this.currentAnnouncementIndex = (this.currentAnnouncementIndex + 1) % announcements.length;
        this.renderCarousel();
    },

    prevAnnouncement() {
        if (announcements.length === 0) return;
        this.currentAnnouncementIndex = (this.currentAnnouncementIndex - 1 + announcements.length) % announcements.length;
        this.renderCarousel();
    },

    bindEvents() {
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', () => {
                const moduleId = card.dataset.moduleId;
                const modulePath = card.dataset.modulePath;
                console.log(`🖱️ 点击卡片: ${moduleId} | 路径: ${modulePath}`);
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                console.log('⌨️ 键盘左箭头');
                this.prevAnnouncement();
            }
            if (e.key === 'ArrowRight') {
                console.log('⌨️ 键盘右箭头');
                this.nextAnnouncement();
            }
        });
    }
};

// 启动
document.addEventListener('DOMContentLoaded', () => window.HomepageApp.init());

// 确保函数全局可用（配合 HTML onclick）
window.prevAnnouncement = function() {
    window.HomepageApp.prevAnnouncement();
};

window.nextAnnouncement = function() {
    window.HomepageApp.nextAnnouncement();
};