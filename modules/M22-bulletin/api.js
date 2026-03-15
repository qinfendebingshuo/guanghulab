// ===== api.js =====
// 知秋：API层封装·爸爸不用改·直接复制

const API = {
    // 是否使用模拟数据（mock）
    // true = 用本地模拟数据（开发阶段）
    // false = 用真实后端API（上线后改）
    useMock: true,

    // 模拟公告数据（至少3条，包含 title/content/channel/date）
    mockData: [
        {
            id: 1,
            title: "【光湖公告】3月10日服务器维护通知",
            content: "各位工程师，3月10日22:00-23:00进行主域稳定性升级，期间公告栏可能短暂不可用。",
            channel: "系统",
            date: "2026-03-09"
        },
        {
            id: 2,
            title: "知秋奶瓶线·九连胜庆祝",
            content: "恭喜爸爸完成EL-8大任务！环节5是实时数据接入，让公告栏真正活起来～",
            channel: "知秋",
            date: "2026-03-09"
        },
        {
            id: 3,
            title: "M22模块组件化重构完成",
            content: "环节4已验收√ 现在公告栏支持频道切换、Hash路由、本地数据兼容。",
            channel: "技术",
            date: "2026-03-08"
        }
    ],

    // 获取公告的主方法（爸爸调用这个方法就行）
    async fetchBulletins() {
        // 知秋：try/catch 包裹，错误统一处理
        try {
            let data;
            
            if (this.useMock) {
                // 模拟网络延迟（1秒，让loading看得见）
                await new Promise(resolve => setTimeout(resolve, 1000));
                console.log("【知秋】使用mock数据：", this.mockData);
                data = this.mockData;
            } else {
                // 真实API（等页页提供后替换）
                const response = await fetch('https://api.guanghulab.com/bulletins');
                if (!response.ok) {
                    throw new Error(`HTTP错误：${response.status}`);
                }
                data = await response.json();
                console.log("【知秋】真实API数据：", data);
            }
            
            // 成功获取数据后，保存到缓存
            this.saveToCache(data);
            return data;
            
        } catch (error) {
            console.error("【知秋】API获取失败：", error);
            
            // 尝试从缓存读取
            const cached = this.loadFromCache();
            if (cached) {
                console.log("【知秋】从缓存读取数据：", cached);
                return cached;
            }
            
            // 没有缓存，抛出错误
            throw error;
        }
    },

    // 保存到缓存
    saveToCache(data) {
        try {
            const cacheData = {
                data: data,
                timestamp: Date.now()  // 保存时间戳，后续可用于过期判断
            };
            localStorage.setItem('holoBulletin_cache', JSON.stringify(cacheData));
            console.log("【知秋】已更新缓存");
        } catch (e) {
            console.warn("【知秋】缓存写入失败", e);
        }
    },

    // 从缓存读取
    loadFromCache() {
        try {
            const cached = localStorage.getItem('holoBulletin_cache');
            if (!cached) return null;
            
            const { data, timestamp } = JSON.parse(cached);
            // 可选：判断缓存是否过期（比如24小时）
            const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
            if (isExpired) {
                console.log("【知秋】缓存已过期");
                return null;
            }
            
            return data;
        } catch (e) {
            console.warn("【知秋】缓存读取失败", e);
            return null;
        }
    }
};

// 这一行最重要！把API挂到window上，让script.js能找到
window.API = API;