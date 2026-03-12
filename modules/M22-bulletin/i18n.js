// ===== i18n.js =====
// 知秋：国际化框架·语言包+切换函数

const i18n = {
    // 当前语言
    currentLang: 'zh-CN',

    // 语言包
    messages: {
        'zh-CN': {
            title: '公告栏',
            subscribe: '订阅',
            all: '全部',
            system: '系统公告',
            dev: '开发动态',
            team: '团队消息',
            loading: '知秋正在飞向服务器……',
            error: '网络开小差了，稍后重试～',
            empty: '✨ 暂无公告，稍后再来看看～',
            emptyChannel: '📭 这个频道暂时没有公告',
            retry: '重试',
            pinned: '条置顶',
            footer: 'HoloLake光湖系统',
            offline: '📴 离线模式 · '
        },
        'en-US': {
            title: 'Bulletin Board',
            subscribe: 'Subscribe',
            all: 'All',
            system: 'System',
            dev: 'Dev',
            team: 'Team',
            loading: 'ZhiQiu is flying to the server...',
            error: 'Network error, please retry～',
            empty: '✨ No announcements yet.',
            emptyChannel: '📭 No announcements in this channel.',
            retry: 'Retry',
            pinned: 'pinned',
            footer: 'HoloLake System',
            offline: '📴 Offline Mode · '
        }
    },

    // 初始化
    init: function() {
        const savedLang = localStorage.getItem('holo_lang');
        if (savedLang && this.messages[savedLang]) {
            this.currentLang = savedLang;
        }
        this.updatePageLanguage();
    },

    // 切换语言
    switchLang: function(lang) {
        if (this.messages[lang]) {
            this.currentLang = lang;
            localStorage.setItem('holo_lang', lang);
            this.updatePageLanguage();
            window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
        }
    },

    // 获取文本
    t: function(key) {
        // 确保当前语言存在，如果不存在就回退到中文
        const lang = this.currentLang;
        if (this.messages[lang] && this.messages[lang][key] !== undefined) {
            return this.messages[lang][key];
        }
        // 如果当前语言没有这个key，尝试从中文包找
        if (this.messages['zh-CN'][key] !== undefined) {
            return this.messages['zh-CN'][key];
        }
        // 都没有就返回key本身
        return key;
    },

    // 更新页面
    updatePageLanguage: function() {
        // 更新所有 data-i18n 元素
        document.querySelectorAll('[data-i18n]').forEach(function(el) {
            const key = el.getAttribute('data-i18n');
            el.textContent = i18n.t(key);
        });

        // 更新 HTML lang
        document.documentElement.lang = this.currentLang;

        // 更新按钮 value
        document.querySelectorAll('[data-i18n-value]').forEach(function(el) {
            const key = el.getAttribute('data-i18n-value');
            el.value = i18n.t(key);
        });

        // 更新 placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = i18n.t(key);
        });

        console.log('【知秋】语言已切换为: ' + this.currentLang);
    }
};

// 自动初始化
i18n.init();

// 挂载到 window
window.i18n = i18n;