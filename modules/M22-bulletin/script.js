// ========== 确保 HoloLake 命名空间存在 ==========
window.HoloLake = window.HoloLake || {};

// ========== 页面加载完成后执行 ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 script.js 初始化');
    
    // 恢复所有状态
    restoreState();
    
    // 绑定事件
    bindEvents();
    
    // 更新布局信息
    updateLayoutInfo();
    
    // 监听窗口大小变化
    window.addEventListener('resize', function() {
        updateLayoutInfo();
    });
});

// ========== 恢复状态 ==========
function restoreState() {
    console.log('🔍 restoreState 开始...');
    
    try {
        // 1. 恢复订阅状态
        const isSubscribed = HoloLake.UserState.isSubscribed();
        const subscribeBtn = document.querySelector('.subscribe-btn');
        if (subscribeBtn) {
            if (isSubscribed) {
                subscribeBtn.classList.add('active');
                subscribeBtn.textContent = '已订阅';
            } else {
                subscribeBtn.classList.remove('active');
                subscribeBtn.textContent = '订阅';
            }
        }
        
        // 2. 恢复已读公告
        const readList = HoloLake.UserState.getReadBulletins();
        const bulletinCards = document.querySelectorAll('.bulletin-card');
        bulletinCards.forEach((card, index) => {
            const bulletinId = `bulletin-${index}`;
            if (readList.includes(bulletinId)) {
                card.classList.add('read');
            }
        });
        
        // 3. 恢复选中频道
        const activeChannel = HoloLake.UserState.getActiveChannel();
        const channels = document.querySelectorAll('.channel');
        channels.forEach(channel => {
            const channelText = channel.textContent.trim();
            if (channelText === activeChannel || (activeChannel === '全部' && channelText === '全部')) {
                channel.classList.add('active');
            } else {
                channel.classList.remove('active');
            }
        });
        
        // 4. 更新最后访问时间
        HoloLake.UserState.updateLastVisit();
        
        console.log('✅ 恢复已完成');
    } catch (e) {
        console.error('❌ 恢复失败:', e);
    }
}

// ========== 绑定事件 ==========
function bindEvents() {
    console.log('🔗 绑定事件...');
    
    // 订阅按钮
    const subscribeBtn = document.querySelector('.subscribe-btn');
    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', function() {
            const newState = HoloLake.UserState.toggleSubscribe();
            if (newState) {
                this.classList.add('active');
                this.textContent = '已订阅';
            } else {
                this.classList.remove('active');
                this.textContent = '订阅';
            }
            console.log('📌 订阅状态:', newState ? '已订阅' : '未订阅');
        });
    }
    
    // 频道点击
    const channels = document.querySelectorAll('.channel');
    channels.forEach(channel => {
        channel.addEventListener('click', function() {
            // 更新UI
            channels.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            
            // 保存状态
            const channelName = this.textContent.trim();
            HoloLake.UserState.setActiveChannel(channelName);
            
            // 筛选公告（可选功能，这里先做简单筛选）
            filterBulletinsByChannel(channelName);
            
            console.log('📺 切换到频道:', channelName);
        });
    });
    
    // 公告点击（标记已读）
    const bulletinCards = document.querySelectorAll('.bulletin-card');
    bulletinCards.forEach((card, index) => {
        card.addEventListener('click', function() {
            const bulletinId = `bulletin-${index}`;
            
            // 标记已读
            if (!this.classList.contains('read')) {
                this.classList.add('read');
                HoloLake.UserState.markAsRead(bulletinId);
                console.log('📖 已读公告:', bulletinId);
            }
        });
    });
}

// ========== 按频道筛选 ==========
function filterBulletinsByChannel(channelName) {
    const cards = document.querySelectorAll('.bulletin-card');
    
    if (channelName === '全部') {
        cards.forEach(card => {
            card.style.display = 'flex';
        });
        return;
    }
    
    cards.forEach(card => {
        const tag = card.querySelector('.bulletin-tag');
        if (tag && tag.textContent.trim() === channelName) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// ========== 更新布局信息 ==========
function updateLayoutInfo() {
    const width = window.innerWidth;
    let mode = '桌面';
    
    if (width <= 480) {
        mode = '手机';
    } else if (width <= 768) {
        mode = '平板';
    }
    
    console.log(`📱 当前布局: ${mode}模式 (${width}px)`);
}