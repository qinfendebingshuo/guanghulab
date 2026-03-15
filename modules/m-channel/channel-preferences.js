// 频道偏好管理 - 记住用户的装修设置
window.ChannelPreferences = {
    STORAGE_KEY: 'hololake_channel_preferences',
    
    // 默认配置
    defaults: {
        layout: 'grid',          // grid, list, compact
        theme: 'default',        // default, ocean, forest, sunset, lavender
        favorites: [],           // 收藏的模块ID列表
        moduleOrder: [],         // 模块排序顺序（默认按ID）
        stats: {}                // 使用统计
    },
    
    // 当前配置
    config: null,
    
    // 初始化（加载配置）
    init: function() {
        console.log('[preferences] 初始化');
        this.load();
        return this.config;
    },
    
    // 加载配置
    load: function() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                this.config = JSON.parse(saved);
                console.log('[preferences] 加载配置:', this.config);
            } catch (e) {
                console.error('[preferences] 解析失败，使用默认配置', e);
                this.config = { ...this.defaults };
            }
        } else {
            console.log('[preferences] 无保存配置，使用默认');
            this.config = { ...this.defaults };
        }
        return this.config;
    },
    
    // 保存配置
    save: function() {
        if (!this.config) return;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
        console.log('[preferences] 保存配置:', this.config);
    },
    
    // 获取指定键的值
    get: function(key) {
        if (!this.config) this.load();
        return this.config[key];
    },
    
    // 设置指定键的值（自动保存）
    set: function(key, value) {
        if (!this.config) this.load();
        this.config[key] = value;
        this.save();
        
        // 触发事件总线通知
        if (window.EventBus) {
            EventBus.emit('preferences:changed', { key, value });
        }
    },
    
    // 更新整个配置（合并）
    update: function(newConfig) {
        if (!this.config) this.load();
        this.config = { ...this.config, ...newConfig };
        this.save();
        if (window.EventBus) {
            EventBus.emit('preferences:changed', { full: this.config });
        }
    },
    
    // 恢复默认设置
    reset: function() {
        this.config = { ...this.defaults };
        this.save();
        if (window.EventBus) {
            EventBus.emit('preferences:reset', this.config);
        }
        console.log('[preferences] 恢复默认');
    },
    
    // 记录模块使用（用于统计）
    recordUsage: function(moduleId) {
        if (!this.config) this.load();
        if (!this.config.stats) this.config.stats = {};
        if (!this.config.stats[moduleId]) {
            this.config.stats[moduleId] = {
                count: 0,
                lastUsed: null,
                totalTime: 0
            };
        }
        this.config.stats[moduleId].count++;
        this.config.stats[moduleId].lastUsed = Date.now();
        this.save();
        
        // 开始计时（将在模块卸载时记录时长）
        this.startTiming(moduleId);
    },
    
    // 计时相关
    timing: {},
    startTiming: function(moduleId) {
        this.timing[moduleId] = Date.now();
    },
    stopTiming: function(moduleId) {
        if (this.timing[moduleId]) {
            const duration = (Date.now() - this.timing[moduleId]) / 1000; // 秒
            if (this.config.stats[moduleId]) {
                this.config.stats[moduleId].totalTime += duration;
                this.save();
            }
            delete this.timing[moduleId];
        }
    },
    
    // 获取统计报告
    getStats: function() {
        if (!this.config) this.load();
        return this.config.stats || {};
    },
    
    // 获取收藏列表
    getFavorites: function() {
        return this.get('favorites') || [];
    },
    
    // 切换收藏状态
    toggleFavorite: function(moduleId) {
        let favorites = this.get('favorites') || [];
        if (favorites.includes(moduleId)) {
            favorites = favorites.filter(id => id !== moduleId);
        } else {
            favorites.push(moduleId);
        }
        this.set('favorites', favorites);
        return favorites.includes(moduleId);
    },
    
    // 获取布局
    getLayout: function() {
        return this.get('layout') || 'grid';
    },
    
    // 设置布局
    setLayout: function(layout) {
        this.set('layout', layout);
    },
    
    // 获取主题
    getTheme: function() {
        return this.get('theme') || 'default';
    },
    
    // 设置主题
    setTheme: function(theme) {
        this.set('theme', theme);
    },
    
    // 获取模块排序
    getModuleOrder: function() {
        return this.get('moduleOrder') || [];
    },
    
    // 设置模块排序
    setModuleOrder: function(order) {
        this.set('moduleOrder', order);
    },
    
    // 重新排序（拖拽后调用）
    reorderModules: function(fromIndex, toIndex) {
        const order = this.getModuleOrder();
        if (order.length === 0) {
            // 如果还没有自定义顺序，则基于当前模块列表生成
            const modules = window.ModuleRegistry ? ModuleRegistry.list() : [];
            // 排除非显示模块（如调试面板）
            const displayModules = modules.filter(m => ['m06','m08','m11','home','debug'].includes(m));
            this.setModuleOrder(displayModules);
        }
        // 重新加载最新顺序
        const currentOrder = this.getModuleOrder();
        if (fromIndex < 0 || fromIndex >= currentOrder.length || toIndex < 0 || toIndex >= currentOrder.length) return;
        const [moved] = currentOrder.splice(fromIndex, 1);
        currentOrder.splice(toIndex, 0, moved);
        this.setModuleOrder(currentOrder);
    }
};

console.log('[preferences] 已加载');
