/**
 * config.js - M22 环境配置中心
 * EL-6 · 真实API联调预备 · mock/production 一键切换
 */

const CONFIG = {
    // 环境开关：'mock' 或 'production'
    // 爸爸以后后端好了，把这里改成 'production' 就行
        // 环境开关：'mock' 或 'production'
    // 🟡 注意：真实API地址还未就绪，当前使用mock模式
    //    等页页给了地址后，改成 'production' 并替换下面的 apiBaseUrl
    env: 'mock',

        // API 基础地址（production模式下使用）
    // 🟡 待替换：等页页给了真实地址后替换这个字符串
    apiBaseUrl: 'https://api.example.com/v1',  // 待替换

    // Mock 数据地址（开发阶段使用）
    mockDataPath: 'data/mock-announcements.json',

    // 认证配置（如后端需要Token）
    auth: {
        enabled: false,          // 是否启用认证，等后端需要时改成 true
        tokenKey: 'awen_token',   // localStorage 存储的key
        getToken: function() {
            return localStorage.getItem(this.tokenKey);
        },
        setToken: function(token) {
            localStorage.setItem(this.tokenKey, token);
        },
        clearToken: function() {
            localStorage.removeItem(this.tokenKey);
        }
    },

    // 缓存配置
    cache: {
        enabled: true,
        key: 'm22_announcements_cache',
        expiry: 30 * 60 * 1000  // 30分钟有效期（毫秒）
    },

    // 请求超时设置（毫秒）
    timeout: 10000,

    // 重试配置
    retry: {
        enabled: true,
        maxRetries: 2,
        delay: 1000  // 重试延迟（毫秒）
    },

    // 是否启用详细日志（开发时有用）
    debug: true
};

// 不允许修改
Object.freeze(CONFIG);