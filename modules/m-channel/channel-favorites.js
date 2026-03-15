// 频道收藏与拖拽排序管理
window.ChannelFavorites = {
    // 当前正在拖拽的元素
    draggingElement: null,
    
    // 初始化
    init: function() {
        console.log('[favorites] 初始化');
        this.bindEvents();
        this.renderFavorites();
    },
    
    // 绑定事件
    bindEvents: function() {
        // 使用事件委托监听星星点击
        document.addEventListener('click', (e) => {
            const star = e.target.closest('.favorite-star');
            if (star) {
                e.preventDefault();
                const card = star.closest('.module-card');
                if (card) {
                    const moduleId = card.dataset.module;
                    if (moduleId) {
                        this.toggleFavorite(moduleId, star);
                    }
                }
            }
        });
        
        // 监听偏好变化，重新渲染收藏状态
        if (window.EventBus) {
            EventBus.on('preferences:changed', (data) => {
                if (data.key === 'favorites' || data.full) {
                    this.updateAllStars();
                }
            });
        }
    },
    
    // 切换收藏状态
    toggleFavorite: function(moduleId, starElement) {
        if (!window.ChannelPreferences) return;
        
        const isNowFavorite = ChannelPreferences.toggleFavorite(moduleId);
        
        // 更新星星样式
        if (starElement) {
            if (isNowFavorite) {
                starElement.classList.add('active');
                starElement.textContent = '★';
            } else {
                starElement.classList.remove('active');
                starElement.textContent = '☆';
            }
        }
        
        // 触发布局更新（收藏置顶）
        this.updateFavoritesOrder();
        
        // 发送事件
        if (window.EventBus) {
            EventBus.emit('favorite:toggled', { 
                module: moduleId, 
                favorite: isNowFavorite 
            });
        }
    },
    
    // 更新所有星星的显示状态
    updateAllStars: function() {
        const favorites = window.ChannelPreferences ? ChannelPreferences.getFavorites() : [];
        document.querySelectorAll('.favorite-star').forEach(star => {
            const card = star.closest('.module-card');
            if (card) {
                const moduleId = card.dataset.module;
                if (moduleId) {
                    if (favorites.includes(moduleId)) {
                        star.classList.add('active');
                        star.textContent = '★';
                    } else {
                        star.classList.remove('active');
                        star.textContent = '☆';
                    }
                }
            }
        });
    },
    
    // 根据收藏状态重新排序（收藏置顶）
    updateFavoritesOrder: function() {
        const container = document.querySelector('.channel-content');
        if (!container) return;
        
        const cards = Array.from(container.querySelectorAll('.module-card'));
        const favorites = window.ChannelPreferences ? ChannelPreferences.getFavorites() : [];
        
        // 按收藏状态和原有顺序排序
        cards.sort((a, b) => {
            const aId = a.dataset.module;
            const bId = b.dataset.module;
            const aFav = favorites.includes(aId);
            const bFav = favorites.includes(bId);
            
            if (aFav && !bFav) return -1;
            if (!aFav && bFav) return 1;
            
            // 如果都是收藏或都不是收藏，保持原有顺序
            const aOrder = cards.indexOf(a);
            const bOrder = cards.indexOf(b);
            return aOrder - bOrder;
        });
        
        // 重新插入到容器中
        cards.forEach(card => container.appendChild(card));
        
        // 保存排序到偏好设置
        const moduleOrder = cards.map(card => card.dataset.module);
        if (window.ChannelPreferences) {
            ChannelPreferences.setModuleOrder(moduleOrder);
        }
    },
    
    // 渲染收藏状态（初始化时调用）
    renderFavorites: function() {
        this.updateAllStars();
    },
    
    // ===== 拖拽排序相关 =====
    
    // 初始化拖拽
    initDragAndDrop: function() {
        console.log('[favorites] 初始化拖拽排序');
        
        const container = document.querySelector('.channel-content');
        if (!container) return;
        
        // 为每个卡片添加拖拽手柄
        container.querySelectorAll('.module-card').forEach(card => {
            // 检查是否已有拖拽手柄
            if (!card.querySelector('.drag-handle')) {
                const header = card.querySelector('.module-card-header');
                if (header) {
                    const handle = document.createElement('span');
                    handle.className = 'drag-handle';
                    handle.innerHTML = '⋮⋮';
                    handle.setAttribute('draggable', 'false');
                    header.insertBefore(handle, header.firstChild);
                }
            }
            
            // 设置 draggable
            card.setAttribute('draggable', 'true');
            
            // 移除旧监听器，添加新监听器
            card.removeEventListener('dragstart', this.handleDragStart);
            card.removeEventListener('dragend', this.handleDragEnd);
            card.removeEventListener('dragover', this.handleDragOver);
            card.removeEventListener('dragenter', this.handleDragEnter);
            card.removeEventListener('dragleave', this.handleDragLeave);
            card.removeEventListener('drop', this.handleDrop);
            
            card.addEventListener('dragstart', this.handleDragStart.bind(this));
            card.addEventListener('dragend', this.handleDragEnd.bind(this));
            card.addEventListener('dragover', this.handleDragOver);
            card.addEventListener('dragenter', this.handleDragEnter);
            card.addEventListener('dragleave', this.handleDragLeave);
            card.addEventListener('drop', this.handleDrop.bind(this));
        });
    },
    
    // 拖拽开始
    handleDragStart: function(e) {
        this.draggingElement = e.target.closest('.module-card');
        if (!this.draggingElement) return;
        
        e.dataTransfer.setData('text/plain', this.draggingElement.dataset.module);
        e.dataTransfer.effectAllowed = 'move';
        
        // 添加拖拽中的样式
        setTimeout(() => {
            this.draggingElement.classList.add('dragging');
        }, 0);
    },
    
    // 拖拽结束
    handleDragEnd: function(e) {
        const card = e.target.closest('.module-card');
        if (card) {
            card.classList.remove('dragging');
        }
        
        // 移除所有高亮
        document.querySelectorAll('.module-card.drop-target').forEach(el => {
            el.classList.remove('drop-target');
        });
        
        this.draggingElement = null;
    },
    
    // 拖拽经过（必须阻止默认事件才能成为放置目标）
    handleDragOver: function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    },
    
    // 拖拽进入
    handleDragEnter: function(e) {
        const card = e.target.closest('.module-card');
        if (card && card !== this.draggingElement) {
            card.classList.add('drop-target');
        }
    },
    
    // 拖拽离开
    handleDragLeave: function(e) {
        const card = e.target.closest('.module-card');
        if (card) {
            card.classList.remove('drop-target');
        }
    },
    
    // 放置
    handleDrop: function(e) {
        e.preventDefault();
        
        const targetCard = e.target.closest('.module-card');
        if (!targetCard || !this.draggingElement || targetCard === this.draggingElement) {
            return;
        }
        
        // 移除高亮
        targetCard.classList.remove('drop-target');
        
        // 获取所有卡片
        const container = document.querySelector('.channel-content');
        const cards = Array.from(container.querySelectorAll('.module-card'));
        
        const fromIndex = cards.indexOf(this.draggingElement);
        const toIndex = cards.indexOf(targetCard);
        
        if (fromIndex === -1 || toIndex === -1) return;
        
        // 重新排序
        if (window.ChannelPreferences) {
            ChannelPreferences.reorderModules(fromIndex, toIndex);
        }
        
        // 移动 DOM 元素
        if (fromIndex < toIndex) {
            targetCard.insertAdjacentElement('afterend', this.draggingElement);
        } else {
            targetCard.insertAdjacentElement('beforebegin', this.draggingElement);
        }
        
        // 触发事件
        if (window.EventBus) {
            EventBus.emit('favorites:reordered', {
                from: fromIndex,
                to: toIndex,
                module: this.draggingElement.dataset.module
            });
        }
    },
    
    // 刷新拖拽功能（在布局变化后调用）
    refreshDragAndDrop: function() {
        this.initDragAndDrop();
    }
};

console.log('[favorites] 已加载');
