/**
 * app.js - 光湖首页导航中心
 * M23 环节1 · 公告轮播 + 卡片交互 + 状态动态化
 */

// 公告轮播数据（Mock数据，未来对接M22真实API）
const announcements = [
    {
        id: 1,
        title: "光湖实验室v1.0开发中",
        content: "全团队并行推进，多模块同步建设",
        date: "2026-03-13",
        type: "update"
    },
    {
        id: 2,
        title: "模块进度总览",
        content: "4个模块在线 · 2个建设中",
        date: "2026-03-13",
        type: "status"
    },
    {
        id: 3,
        title: "欢迎新开发者",
        content: "零点原核频道持续壮大",
        date: "2026-03-13",
        type: "welcome"
    }
];

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
    currentAnnouncementIndex: 0,
    carouselInterval: null,

    init() {
        this.renderCards();
        this.renderCarousel();
        this.startCarousel();
        this.bindEvents();
        this.updateStatusBar();
        console.log('✅ 首页初始化完成 · 15连胜版');
    },

    // 渲染卡片
    renderCards() {
        const grid = document.getElementById('moduleGrid');
        if (!grid) return;

        const cardsHTML = moduleCards.map(card => `
            <div class="card" data-module-id="${card.id}" data-module-path="${card.path}">
                <div class="card-header">
                    <div class="card-icon">${card.icon}</div>
                    <span class="card-name">${card.name}</span>
                    <span class="card-status ${card.status}">${card.status === 'online' ? '在线' : '建设中'}</span>
                </div>
                <span class="card-link">进入模块 →</span>
            </div>
        `).join('');

        grid.innerHTML = cardsHTML;
    },

    // 渲染轮播
    renderCarousel() {
        const carousel = document.getElementById('announcementCarousel');
        if (!carousel) return;

        const announcement = announcements[this.currentAnnouncementIndex];
        carousel.innerHTML = `
            <div class="carousel-item">
                <div class="carousel-title">📢 ${announcement.title}</div>
                <div class="carousel-content">${announcement.content}</div>
                <div class="carousel-date">${announcement.date}</div>
            </div>
        `;
    },

    // 启动轮播（自动4秒切换）
    startCarousel() {
        if (this.carouselInterval) clearInterval(this.carouselInterval);
        this.carouselInterval = setInterval(() => {
            this.nextAnnouncement();
        }, 4000);
        console.log('🔄 轮播已启动，4秒自动切换');
    },

    // 下一条公告
    nextAnnouncement() {
        this.currentAnnouncementIndex = (this.currentAnnouncementIndex + 1) % announcements.length;
        this.renderCarousel();
    },

    // 上一条公告
    prevAnnouncement() {
        this.currentAnnouncementIndex = (this.currentAnnouncementIndex - 1 + announcements.length) % announcements.length;
        this.renderCarousel();
    },

    // 模块跳转
    navigateTo(moduleId) {
        const module = moduleCards.find(m => m.id === moduleId);
        if (module) {
            console.log(`🧭 跳转到模块: ${module.name} | 路径: ${module.path}`);
        } else {
            console.log(`⚠️ 未找到模块: ${moduleId}`);
        }
    },

    // 绑定事件
    bindEvents() {
        // 卡片点击事件
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', (e) => {
                const moduleId = card.dataset.moduleId;
                const modulePath = card.dataset.modulePath;
                console.log(`🖱️ 点击卡片: ${moduleId} | 路径: ${modulePath}`);
                this.navigateTo(moduleId);
                // 未来这里会实现实际跳转：window.location.href = modulePath;
            });
        });

        // 轮播箭头点击
        document.getElementById('carouselPrev')?.addEventListener('click', () => {
            console.log('◀️ 点击左箭头');
            this.prevAnnouncement();
        });

        document.getElementById('carouselNext')?.addEventListener('click', () => {
            console.log('▶️ 点击右箭头');
            this.nextAnnouncement();
        });

        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                console.log('⌨️ 键盘左箭头');
                this.prevAnnouncement();
            } else if (e.key === 'ArrowRight') {
                console.log('⌨️ 键盘右箭头');
                this.nextAnnouncement();
            }
        });
    },

    // 更新状态栏
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