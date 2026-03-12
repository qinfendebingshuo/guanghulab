// ============================================
// storage.js - 糖星云的数据存储模块
// 管理搜索历史 + 筛选预设的 localStorage 读写
// ============================================

const Storage = {
    // 存储键名常量
    KEYS: {
        SEARCH_HISTORY: 'searchHistory',
        FILTER_PRESETS: 'filterPresets'
    },

    // ---------- 搜索历史 ----------
    // 获取所有历史记录
    getHistory: function() {
        const history = localStorage.getItem(this.KEYS.SEARCH_HISTORY);
        return history ? JSON.parse(history) : [];
    },

    // 保存历史记录（最多20条，按时间倒序）
    saveHistory: function(historyArray) {
        // 确保不超过20条
        const limited = historyArray.slice(0, 20);
        localStorage.setItem(this.KEYS.SEARCH_HISTORY, JSON.stringify(limited));
    },

    // 添加一条新搜索记录
    addHistoryItem: function(keyword) {
        if (!keyword || keyword.trim() === '') return;
        
        let history = this.getHistory();
        const trimmedKeyword = keyword.trim();
        
        // 移除已存在的相同关键词（避免重复）
        history = history.filter(item => item !== trimmedKeyword);
        
        // 插入到最前面
        history.unshift(trimmedKeyword);
        
        // 保存
        this.saveHistory(history);
        return history;
    },

    // 删除单条历史
    deleteHistoryItem: function(keyword) {
        let history = this.getHistory();
        history = history.filter(item => item !== keyword);
        this.saveHistory(history);
        return history;
    },

    // 清空全部历史
    clearAllHistory: function() {
        localStorage.removeItem(this.KEYS.SEARCH_HISTORY);
        return [];
    },

    // ---------- 筛选预设 ----------
    // 获取所有预设
    getPresets: function() {
        const presets = localStorage.getItem(this.KEYS.FILTER_PRESETS);
        return presets ? JSON.parse(presets) : [];
    },

    // 保存预设数组
    savePresets: function(presetsArray) {
        localStorage.setItem(this.KEYS.FILTER_PRESETS, JSON.stringify(presetsArray));
    },

    // 添加新预设
    addPreset: function(name, filterState) {
        if (!name || name.trim() === '') return;
        
        const presets = this.getPresets();
        const newPreset = {
            id: Date.now().toString(),
            name: name.trim(),
            filters: { ...filterState }
        };
        
        presets.push(newPreset);
        this.savePresets(presets);
        return presets;
    },

    // 删除预设
    deletePreset: function(presetId) {
        let presets = this.getPresets();
        presets = presets.filter(p => p.id !== presetId);
        this.savePresets(presets);
        return presets;
    },

    // 根据id获取预设
    getPresetById: function(presetId) {
        const presets = this.getPresets();
        return presets.find(p => p.id === presetId) || null;
    }
};

// 确保 Storage 对象全局可用
window.HoloLake = window.HoloLake || {};
window.HoloLake.Storage = Storage;

// 加一行测试输出，看看有没有加载成功
console.log('✅ storage.js 已加载', Storage);
