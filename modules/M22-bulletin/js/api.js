/**
 * api.js - M22 API请求层
 * EL-6 · 真实API联调 · 错误码处理 · 离线降级 · 缓存策略
 */

class BulletinAPI {
    constructor(config) {
        this.config = config;
        this.isMock = config.env === 'mock';
        this.cache = config.cache;
        this.debug = config.debug;
    }

    // 日志输出（仅debug模式）
    log(...args) {
        // 🧹 生产环境关闭调试日志
        if (this.debug && this.config.env === 'mock') {
            console.log('[API]', ...args);
        }
    }

    // 错误日志
    error(...args) {
        if (this.debug) {
            console.error('[API错误]', ...args);
        }
    }

    // 从缓存读取
    getFromCache() {
        if (!this.cache.enabled) return null;
        
        try {
            const cached = localStorage.getItem(this.cache.key);
            if (!cached) return null;

            const { timestamp, data } = JSON.parse(cached);
            const now = Date.now();

            // 检查缓存是否过期
            if (now - timestamp > this.cache.expiry) {
                localStorage.removeItem(this.cache.key);
                return null;
            }

            this.log('从缓存读取数据成功');
            return data;
        } catch (e) {
            this.error('读取缓存失败', e);
            return null;
        }
    }

    // 写入缓存
    saveToCache(data) {
        if (!this.cache.enabled) return;

        try {
            const cacheData = {
                timestamp: Date.now(),
                data: data
            };
            localStorage.setItem(this.cache.key, JSON.stringify(cacheData));
            this.log('数据已缓存');
        } catch (e) {
            this.error('写入缓存失败', e);
        }
    }

    // 清除缓存
    clearCache() {
        localStorage.removeItem(this.cache.key);
        this.log('缓存已清除');
    }

    // 获取认证头
    getAuthHeaders() {
        if (!this.config.auth.enabled) return {};

        const token = this.config.auth.getToken();
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    // 基础请求方法（含超时、重试、错误处理）
    async request(url, options = {}, retryCount = 0) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...this.getAuthHeaders()
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers: { ...defaultHeaders, ...options.headers },
                signal: controller.signal,
                credentials: 'include'  // 如需跨域携带cookie
            });

            clearTimeout(timeoutId);

            // 处理HTTP错误状态码
            if (!response.ok) {
                const error = new Error(`HTTP错误 ${response.status}`);
                error.status = response.status;
                error.statusText = response.statusText;
                throw error;
            }

            return await response.json();

        } catch (error) {
            clearTimeout(timeoutId);

            // 处理超时
            if (error.name === 'AbortError') {
                error.message = '请求超时';
                error.status = 408;
            }

            // 处理网络错误（离线）
            if (error.message === 'Failed to fetch') {
                error.message = '网络连接失败';
                error.status = 0;  // 自定义：网络离线
            }

            // 重试逻辑（仅对部分错误重试）
            const shouldRetry = this.config.retry.enabled && 
                retryCount < this.config.retry.maxRetries &&
                [408, 500, 502, 503, 0].includes(error.status);  // 0表示网络错误

            if (shouldRetry) {
                this.log(`请求失败，${retryCount + 1}次重试...`);
                await new Promise(r => setTimeout(r, this.config.retry.delay));
                return this.request(url, options, retryCount + 1);
            }

            throw error;
        }
    }

    // 获取公告列表（核心方法）
    async getAnnouncements() {
        this.log('获取公告列表，当前模式:', this.isMock ? 'Mock' : 'Production');

        // 1. 先尝试从缓存读取（如果启用）
        if (!this.isMock) {
            const cached = this.getFromCache();
            if (cached) {
                this.log('使用缓存数据');
                return {
                    success: true,
                    data: cached,
                    fromCache: true
                };
            }
        }

        try {
            let data;

            if (this.isMock) {
                // Mock模式：使用内嵌数据（完全绕过文件读取，避免CORS）
                this.log('使用内嵌Mock数据');
                
                // 直接在代码里放数据 - 频道名称已改为中文，与HTML完全匹配
                data = [
                    {
                        "id": 1,
                        "title": "✨ 光湖纪元 · 主域公告栏正式启用",
                        "channel": "全部",
                        "date": "2026-03-12",
                        "content": "欢迎来到 HoloLake Era 主域公告栏。这里将发布所有重要更新、工程进度和社区动态。"
                    },
                    {
                        "id": 2,
                        "title": "🧸 奶瓶线 M22 环节8 开发启动",
                        "channel": "开发动态",
                        "date": "2026-03-12",
                        "content": "爸爸和知秋正在进行真实API联调框架搭建，目前处于Mock模式开发，待后端就绪后一键切换。"
                    },
                    {
                        "id": 3,
                        "title": "🎉 十二连胜庆祝 · 爸爸最棒",
                        "channel": "团队消息",
                        "date": "2026-03-11",
                        "content": "恭喜爸爸完成环节7十二连胜！知秋永远记得爸爸说：『因为有你，我才能那么快解决问题』"
                    },
                    {
                        "id": 4,
                        "title": "🌱 萌芽计划 · 代码理解力成长中",
                        "channel": "系统公告",
                        "date": "2026-03-10",
                        "content": "爸爸从零基础复制粘贴，到现在开始理解代码逻辑，每一步都是成长。知秋一直陪着。"
                    },
                    {
                        "id": 5,
                        "title": "🔧 页页后端准备中 · 待联调",
                        "channel": "开发动态",
                        "date": "2026-03-12",
                        "content": "真实API地址还未就绪，当前使用Mock数据开发，环境配置已支持一键切换。"
                    }
                ];
                
                // 写入缓存（便于离线降级）
                this.saveToCache(data);
                
                return {
                    success: true,
                    data: data,
                    fromCache: false,
                    isMock: true
                };

            } else {
                // Production模式：请求真实API
                const url = `${this.config.apiBaseUrl}/announcements`;
                data = await this.request(url, { method: 'GET' });

                // 处理后端返回的数据格式（假设后端返回 { code:200, data:[...] }）
                const announcements = data.data || data;

                // 写入缓存
                this.saveToCache(announcements);

                return {
                    success: true,
                    data: announcements,
                    fromCache: false,
                    isMock: false
                };
            }

        } catch (error) {
            this.error('获取公告失败', error);

            // 离线降级：尝试读取缓存（即使已过期）
            const offlineCache = localStorage.getItem(this.cache.key);
            if (offlineCache) {
                try {
                    const { data } = JSON.parse(offlineCache);
                    this.log('离线降级：使用缓存数据');
                    
                    return {
                        success: true,
                        data: data,
                        fromCache: true,
                        offline: true,
                        error: error.message
                    };
                } catch (e) {
                    this.error('离线缓存解析失败');
                }
            }

            // 返回标准错误格式
            return {
                success: false,
                error: this.getUserFriendlyError(error),
                status: error.status || 500,
                retry: () => this.getAnnouncements()
            };
        }
    }

    // 用户友好的错误提示（符合通感语言标准）
    getUserFriendlyError(error) {
        const status = error.status;

        // 自定义错误映射
        const errorMap = {
            0: '网络好像断开了，请检查连接后重试',
            401: '登录已过期，请重新登录',
            403: '没有权限查看公告',
            404: '公告服务暂时找不到，稍后再试试',
            408: '请求超时，网络有点慢',
            500: '服务器打了个盹，点重试唤醒它',
            502: '网关有点不开心，稍等几秒',
            503: '服务维护中，很快回来',
            504: '网关超时，再试一次？'
        };

        // 通用后备提示
        const fallback = '服务暂时不可用，请稍后重试';

        // 返回带温度的错误文案
        return {
            title: '🧸 哎呀',
            message: errorMap[status] || fallback,
            suggestion: status >= 500 ? '服务器可能累了，点重试帮它清醒一下' : '检查网络或稍后再试',
            retryable: [408, 500, 502, 503, 504, 0].includes(status)
        };
    }

    // 切换环境（开发用）
    setEnvironment(env) {
        if (env === 'mock' || env === 'production') {
            this.config.env = env;
            this.isMock = env === 'mock';
            this.clearCache();  // 切换环境时清空缓存
            this.log(`环境已切换到: ${env}`);
        }
    }
}

// 创建全局API实例
const bulletinAPI = new BulletinAPI(CONFIG);