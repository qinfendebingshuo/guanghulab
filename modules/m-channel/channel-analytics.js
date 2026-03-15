/**
 * channel-analytics.js
 * 频道数据采集核心·环节8 + 环节9设置联动
 * 记录模块访问次数、停留时间、页面加载速度
 */

const ChannelAnalytics = (function() {
    const STORAGE_KEY = 'channel-analytics-data';

    // 数据结构初始化
    function getDefaultData() {
        return {
            modules: {},          // {moduleId: {visits: 0, totalDuration: 0, loadTimes: [], dailyVisits: {} }}
            globalDaily: {},       // {'YYYY-MM-DD': totalVisits}
            lastUpdated: null
        };
    }

    // localStorage 读写
    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch(e) {
            console.log('⚠️ 读取分析数据失败，重新初始化');
        }
        return getDefaultData();
    }

    function saveData(data) {
        data.lastUpdated = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    // 日期工具
    function today() {
        return new Date().toISOString().split('T')[0];
    }

    // 确保模块数据结构存在
    function ensureModule(data, moduleId) {
        if (!data.modules[moduleId]) {
            data.modules[moduleId] = {
                visits: 0,
                totalDuration: 0,
                loadTimes: [],
                dailyVisits: {}
            };
        }
        return data.modules[moduleId];
    }

    // 当前会话状态
    let currentModule = null;
    let enterTime = null;
    let loadStartTime = null;

    // 公开方法
    return {
        // 记录模块访问（环节9：检查数据采集开关）
        recordVisit: function(moduleId) {
            // 数据采集开关检查（环节9新增）
            if (typeof ChannelSettings !== 'undefined' && !ChannelSettings.get('analyticsEnabled')) {
                console.log('📊 数据采集已关闭（设置中心）');
                return;
            }
            if (!moduleId) return;
            const data = loadData();
            const mod = ensureModule(data, moduleId);

            // 访问计数 +1
            mod.visits++;

            // 每日访问计数
            const d = today();
            mod.dailyVisits[d] = (mod.dailyVisits[d] || 0) + 1;

            // 全局每日访问
            data.globalDaily[d] = (data.globalDaily[d] || 0) + 1;

            saveData(data);
            console.log('📊 已记录：模块 ' + moduleId + ' 被访问，累计 ' + mod.visits + ' 次');

            // 记录进入时间
            this.startSession(moduleId);
        },

        // 开始计时
        startSession: function(moduleId) {
            // 先结束上一个模块的计时
            if (currentModule && enterTime) {
                this.endSession();
            }
            currentModule = moduleId;
            enterTime = performance.now();
            loadStartTime = performance.now();
        },

        // 结束计时（切换模块或离开时调用）
        endSession: function() {
            if (!currentModule || !enterTime) return;
            // 数据采集开关检查（环节9新增）
            if (typeof ChannelSettings !== 'undefined' && !ChannelSettings.get('analyticsEnabled')) {
                // 如果关闭采集，清空当前会话但不记录
                currentModule = null;
                enterTime = null;
                return;
            }
            const duration = Math.round((performance.now() - enterTime) / 1000); // 秒
            const data = loadData();
            const mod = ensureModule(data, currentModule);
            mod.totalDuration += duration;
            saveData(data);
            console.log('⏱️ 停留时间：模块 ' + currentModule + ' 停留约 ' + duration + ' 秒');
            currentModule = null;
            enterTime = null;
        },

        // 记录加载性能
        recordLoadTime: function(moduleId, loadTimeMs) {
            if (!moduleId) return;
            // 数据采集开关检查（环节9新增）
            if (typeof ChannelSettings !== 'undefined' && !ChannelSettings.get('analyticsEnabled')) {
                return;
            }
            const data = loadData();
            const mod = ensureModule(data, moduleId);
            mod.loadTimes.push(loadTimeMs);
            // 只保留最近50次
            if (mod.loadTimes.length > 50) {
                mod.loadTimes = mod.loadTimes.slice(-50);
            }
            saveData(data);
            console.log('⚡ 加载耗时：模块 ' + moduleId + ' 加载 ' + Math.round(loadTimeMs) + ' 毫秒');
        },

        // 标记加载开始
        markLoadStart: function() {
            loadStartTime = performance.now();
        },

        // 标记加载完成并记录
        markLoadEnd: function(moduleId) {
            if (loadStartTime && moduleId) {
                const loadTime = performance.now() - loadStartTime;
                this.recordLoadTime(moduleId, loadTime);
                loadStartTime = null;
            }
        },

        // 获取所有数据（面板用）
        getAllData: function() {
            return loadData();
        },

        // 获取最近7天趋势
        getWeeklyTrend: function() {
            const data = loadData();
            const trend = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                trend.push({
                    date: dateStr,
                    visits: data.globalDaily[dateStr] || 0
                });
            }
            return trend;
        },

        // 清除所有数据（调试用）
        clearAll: function() {
            localStorage.removeItem(STORAGE_KEY);
            console.log('🗑️ 所有分析数据已清除');
        }
    };
})();
