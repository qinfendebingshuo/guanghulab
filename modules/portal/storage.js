/**
 * HoloLake Bulletin 数据持久化模块
 * storage.js - localStorage 封装 + 用户状态管理
 * 模块 ID: BC-M22-002-AW
 */

window.HoloLake = window.HoloLake || {};

// ========== Storage 工具对象（带前缀） ==========
HoloLake.Storage = {
    prefix: 'hololake_bulletin_',

    // 保存数据
    save: function(key, value) {
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(this.prefix + key, serialized);
            console.log(`[Storage] 已保存: ${key} =`, value);
        } catch (e) {
            console.error('[Storage] 保存失败:', e);
        }
    },

    // 读取数据
    load: function(key, defaultValue = null) {
        try {
            const serialized = localStorage.getItem(this.prefix + key);
            if (serialized === null) {
                console.log(`[Storage] 无数据: ${key}，返回默认值`);
                return defaultValue;
            }
            const value = JSON.parse(serialized);
            console.log(`[Storage] 已加载: ${key} =`, value);
            return value;
        } catch (e) {
            console.error('[Storage] 读取失败:', e);
            return defaultValue;
        }
    },

    // 删除指定键
    remove: function(key) {
        try {
            localStorage.removeItem(this.prefix + key);
            console.log(`[Storage] 已删除: ${key}`);
        } catch (e) {
            console.error('[Storage] 删除失败:', e);
        }
    },

    // 清空所有带前缀的数据
    clear: function() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(this.prefix)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            console.log('[Storage] 已清空所有公告栏数据');
        } catch (e) {
            console.error('[Storage] 清空失败:', e);
        }
    }
};

// ========== 用户状态管理 ==========
HoloLake.UserState = {
    // 已读公告列表
    getReadBulletins: function() {
        return HoloLake.Storage.load('read_bulletins', []);
    },

    markAsRead: function(bulletinId) {
        const readList = this.getReadBulletins();
        if (!readList.includes(bulletinId)) {
            readList.push(bulletinId);
            HoloLake.Storage.save('read_bulletins', readList);
        }
        return readList;
    },

    // 订阅状态
    isSubscribed: function() {
        return HoloLake.Storage.load('is_subscribed', false);
    },

    toggleSubscribe: function() {
        const current = this.isSubscribed();
        const newState = !current;
        HoloLake.Storage.save('is_subscribed', newState);
        return newState;
    },

    // 当前频道
    getActiveChannel: function() {
        return HoloLake.Storage.load('active_channel', 'all');
    },

    setActiveChannel: function(channelId) {
        HoloLake.Storage.save('active_channel', channelId);
    },

    // 上次访问时间
    getLastVisit: function() {
        return HoloLake.Storage.load('last_visit', null);
    },

    updateLastVisit: function() {
        const now = new Date().toISOString();
        HoloLake.Storage.save('last_visit', now);
        return now;
    },

    // 重置所有状态（测试用）
    resetAll: function() {
        HoloLake.Storage.remove('read_bulletins');
        HoloLake.Storage.remove('is_subscribed');
        HoloLake.Storage.remove('active_channel');
        HoloLake.Storage.remove('last_visit');
        console.log('[UserState] 已重置所有状态');
    }
};

// 初始化时记录访问时间（可选，页面加载时由 script.js 调用）
console.log('✅ storage.js 已加载，HoloLake.Storage 和 HoloLake.UserState 已就绪');