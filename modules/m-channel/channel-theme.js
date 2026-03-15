// 频道主题管理 - 换主题色
window.ChannelTheme = {
    // 预设主题
    themes: {
        default: {
            name: '默认蓝',
            colors: {
                primary: '#3b82f6',
                primaryDark: '#2563eb',
                secondary: '#10b981',
                background: '#ffffff',
                surface: '#f9fafb',
                text: '#1f2937',
                textLight: '#6b7280',
                border: '#e5e7eb'
            }
        },
        ocean: {
            name: '海洋',
            colors: {
                primary: '#0891b2',
                primaryDark: '#0e7490',
                secondary: '#2dd4bf',
                background: '#ecfeff',
                surface: '#ffffff',
                text: '#164e63',
                textLight: '#155e75',
                border: '#a5f3fc'
            }
        },
        forest: {
            name: '森林',
            colors: {
                primary: '#059669',
                primaryDark: '#047857',
                secondary: '#fbbf24',
                background: '#f0fdf4',
                surface: '#ffffff',
                text: '#064e3b',
                textLight: '#065f46',
                border: '#a7f3d0'
            }
        },
        sunset: {
            name: '日落',
            colors: {
                primary: '#d97706',
                primaryDark: '#b45309',
                secondary: '#f43f5e',
                background: '#fff7ed',
                surface: '#ffffff',
                text: '#7c2d12',
                textLight: '#9a3412',
                border: '#fed7aa'
            }
        },
        lavender: {
            name: '薰衣草',
            colors: {
                primary: '#8b5cf6',
                primaryDark: '#7c3aed',
                secondary: '#ec4899',
                background: '#f5f3ff',
                surface: '#ffffff',
                text: '#4c1d95',
                textLight: '#5b21b6',
                border: '#ddd6fe'
            }
        }
    },
    
    // 当前主题ID
    currentTheme: 'default',
    
    // 初始化主题
    init: function() {
        console.log('[theme] 初始化');
        
        // 从偏好设置加载主题
        if (window.ChannelPreferences) {
            const savedTheme = ChannelPreferences.getTheme();
            if (savedTheme && this.themes[savedTheme]) {
                this.currentTheme = savedTheme;
            }
        }
        
        // 应用主题
        this.applyTheme(this.currentTheme);
        
        // 监听主题变化事件
        if (window.EventBus) {
            EventBus.on('preferences:changed', (data) => {
                if (data.key === 'theme') {
                    this.applyTheme(data.value);
                }
            });
        }
    },
    
    // 应用主题
    applyTheme: function(themeId) {
        if (!this.themes[themeId]) {
            console.error(`[theme] 未知主题: ${themeId}`);
            return;
        }
        
        this.currentTheme = themeId;
        const colors = this.themes[themeId].colors;
        
        // 设置 CSS 自定义属性
        const root = document.documentElement;
        for (const [key, value] of Object.entries(colors)) {
            root.style.setProperty(`--theme-${key}`, value);
        }
        
        console.log(`[theme] 应用主题: ${themeId}`);
        
        // 触发事件
        if (window.EventBus) {
            EventBus.emit('theme:changed', { theme: themeId, colors });
        }
    },
    
    // 切换主题
    setTheme: function(themeId) {
        if (!this.themes[themeId]) return;
        
        this.applyTheme(themeId);
        
        // 保存到偏好设置
        if (window.ChannelPreferences) {
            ChannelPreferences.setTheme(themeId);
        }
    },
    
    // 获取所有主题列表
    getThemes: function() {
        return Object.entries(this.themes).map(([id, theme]) => ({
            id,
            name: theme.name
        }));
    },
    
    // 获取当前主题名称
    getCurrentThemeName: function() {
        return this.themes[this.currentTheme]?.name || '默认蓝';
    }
};

// 自动初始化
setTimeout(() => {
    if (window.ChannelTheme) {
        ChannelTheme.init();
    }
}, 200);

console.log('[theme] 已加载');
