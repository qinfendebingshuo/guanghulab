/**
 * bulletin.js - M22公告栏主逻辑
 * 修复URL编码问题 · 频道筛选正常
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 显示骨架屏
    showSkeleton();

    // 初始化频道
    initializeChannels();

    // 加载公告数据
    await loadAnnouncements();

    // 监听路由变化
    window.addEventListener('hashchange', handleRouteChange);
});

// 当前频道
let currentChannel = '全部';

// 所有公告数据
let allAnnouncements = [];

// 初始化频道
function initializeChannels() {
    const channelTabs = document.querySelectorAll('.channel-tab');
    
    // 从URL Hash恢复当前频道（需要解码）
    const rawHash = window.location.hash.slice(1) || '全部';
    currentChannel = decodeURIComponent(rawHash);

    // 设置激活状态并绑定事件
    channelTabs.forEach(tab => {
        const channel = tab.dataset.channel;
        
        if (channel === currentChannel) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }

        // 绑定点击事件
        tab.onclick = function(e) {
            e.preventDefault();
            const clickChannel = this.dataset.channel;
            console.log('点击频道:', clickChannel);
            // 直接设置中文hash，浏览器会自动编码
            window.location.hash = clickChannel;
        };
    });
}

// 显示骨架屏
function showSkeleton() {
    const skeletonContainer = document.getElementById('skeleton-container');
    if (skeletonContainer) {
        skeletonContainer.style.display = 'block';
    }
    
    const bulletinContainer = document.querySelector('.bulletin-container');
    if (bulletinContainer) {
        bulletinContainer.innerHTML = '';
    }
}

// 隐藏骨架屏
function hideSkeleton() {
    const skeletonContainer = document.getElementById('skeleton-container');
    if (skeletonContainer) {
        skeletonContainer.style.display = 'none';
    }
}

// 渲染公告（带筛选功能）
function renderAnnouncements(announcements) {
    // 隐藏骨架屏
    hideSkeleton();
    
    const container = document.querySelector('.bulletin-container');
    if (!container) return;

    console.log('当前频道:', currentChannel, '总公告数:', announcements.length);

    // 根据当前频道筛选
    let filtered = [];
    if (currentChannel === '全部') {
        filtered = announcements;
    } else {
        filtered = announcements.filter(a => a.channel === currentChannel);
    }

    console.log('筛选后条数:', filtered.length);

    // 如果没有公告，显示空状态
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <div class="empty-title">这里还没有公告</div>
                <div class="empty-desc">当前频道「${currentChannel}」没有公告</div>
            </div>
        `;
        return;
    }

    // 生成公告HTML
    let html = '';
    for (let i = 0; i < filtered.length; i++) {
        const a = filtered[i];
        html += `
            <article class="bulletin-item">
                <h2 class="bulletin-title">${a.title}</h2>
                <div class="bulletin-meta">
                    <span class="bulletin-channel">#${a.channel}</span>
                    <time class="bulletin-date">${a.date}</time>
                </div>
                <div class="bulletin-content">${a.content}</div>
            </article>
        `;
    }

    container.innerHTML = html;

    // 更新底部计数
    const totalSpan = document.getElementById('totalCount');
    if (totalSpan) {
        totalSpan.textContent = announcements.length;
    }
}

// 路由变化处理
function handleRouteChange() {
    // 获取hash并解码（比如 %E5%9B%A2%E9%98%9F%E6%B6%88%E6%81%AF -> 团队消息）
    const rawHash = window.location.hash.slice(1) || '全部';
    const newChannel = decodeURIComponent(rawHash);
    
    console.log('路由变化 - 原始hash:', rawHash, '解码后:', newChannel, '当前频道:', currentChannel);
    
    if (newChannel !== currentChannel) {
        currentChannel = newChannel;
        
        // 更新频道激活状态
        document.querySelectorAll('.channel-tab').forEach(tab => {
            const channel = tab.dataset.channel;
            if (channel === newChannel) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // 重新渲染
        if (allAnnouncements && allAnnouncements.length > 0) {
            console.log('重新渲染，当前频道:', currentChannel);
            renderAnnouncements(allAnnouncements);
        }
    }
}

// 加载公告
async function loadAnnouncements() {
    try {
        const result = await bulletinAPI.getAnnouncements();

        if (result.success) {
            allAnnouncements = result.data;
            renderAnnouncements(result.data);
            console.log(`[公告加载] 成功 | 条数: ${result.data.length}`);

        } else {
            showError(result.error);
        }

    } catch (error) {
        console.error('加载公告失败:', error);
        showError({
            title: '🧸 出错了',
            message: '加载公告时遇到问题',
            retryable: true
        });
    }
}

// 显示错误
function showError(errorInfo) {
    hideSkeleton();
    
    const container = document.querySelector('.bulletin-container');
    if (!container) return;

    const retryButton = errorInfo.retryable ? 
        `<button class="retry-btn" onclick="window.loadAnnouncements()">重试</button>` : '';

    container.innerHTML = `
        <div class="error-state">
            <div class="error-icon">🧸</div>
            <div class="error-title">${errorInfo.title || '哎呀'}</div>
            <div class="error-message">${errorInfo.message || '服务暂时不可用'}</div>
            ${retryButton}
        </div>
    `;
}

// 暴露给全局
window.loadAnnouncements = loadAnnouncements;