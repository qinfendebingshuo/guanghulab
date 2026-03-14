/**
 * modules-api.js - M23 光湖首页 · 跨模块数据桥
 * 版本：v1.0
 * 开发者：DEV-012 Awen
 * 功能：从M22读取公告数据 + 模块状态API + 错误降级
 */

(function() {
    'use strict';

    // ===== Mock数据（降级兜底·当API不可用时使用） =====
    const FALLBACK_ANNOUNCEMENTS = [
        {
            "id": 1,
            "title": "光湖实验室v1.0全面开发中",
            "content": "12位开发者并行推进，多模块同步建设。光湖系统正在从蓝图变为现实。",
            "date": "2026-03-14",
            "type": "update",
            "priority": "high"
        },
        {
            "id": 2,
            "title": "M22主域公告栏已上线",
            "content": "公告栏支持多语言、无障碍访问、骨架屏加载、实时数据接入。由DEV-012 Awen独立完成。",
            "date": "2026-03-13",
            "type": "update",
            "priority": "normal"
        },
        {
            "id": 3,
            "title": "模块进度总览",
            "content": "多个模块已上线，更多模块建设中。",
            "date": "2026-03-14",
            "type": "status",
            "priority": "normal"
        },
        {
            "id": 4,
            "title": "欢迎新开发者",
            "content": "光湖实验室持续壮大，欢迎每一位共建者。",
            "date": "2026-03-14",
            "type": "welcome",
            "priority": "normal"
        }
    ];

    const FALLBACK_STATUS = {
        status: "building",
        name: "未知模块",
        lastUpdate: new Date().toISOString().split('T')[0]
    };

    // ===== 公告数据API =====
    async function getAnnouncements() {
        try {
            // 优先从M22共享数据文件读取
           const response = await fetch('/bulletin-board/shared-announcements.json');
            if (!response.ok) throw new Error('M22 data not available: ' + response.status);
            const data = await response.json();
            console.log('[ModulesAPI] M22公告数据加载成功，共' + data.length + '条');
            return { source: 'M22-live', data: data };
        } catch (err) {
            console.warn('[ModulesAPI] M22数据不可用，使用降级数据:', err.message);
            return { source: 'fallback', data: FALLBACK_ANNOUNCEMENTS };
        }
    }

    // ===== 模块状态API =====
    async function getModuleStatus(moduleId) {
        try {
            const response = await fetch('./module-status.json');
            if (!response.ok) throw new Error('Status data not available');
            const allStatus = await response.json();
            if (allStatus[moduleId]) {
                return { source: 'local-registry', ...allStatus[moduleId] };
            }
            return { source: 'fallback', ...FALLBACK_STATUS };
        } catch (err) {
            console.warn('[ModulesAPI] 状态数据不可用:', err.message);
            return { source: 'fallback', ...FALLBACK_STATUS };
        }
    }

    // ===== 批量获取所有模块状态 =====
    async function getAllModuleStatus() {
        try {
            const response = await fetch('./module-status.json');
            if (!response.ok) throw new Error('Status data not available');
            const data = await response.json();
            console.log('[ModulesAPI] 模块状态加载成功, 共' + Object.keys(data).length + '个模块');
            return { source: 'local-registry', data: data };
        } catch (err) {
            console.warn('[ModulesAPI] 状态数据不可用, 使用降级');
            return { source: 'fallback', data: {} };
        }
    }

    // ===== API可用性检测 =====
    async function isAPIAvailable() {
        try {
            const response = await fetch('../bulletin-board/shared-announcements.json', { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }

    // ===== 导出到全局 =====
    window.ModulesAPI = {
        getAnnouncements: getAnnouncements,
        getModuleStatus: getModuleStatus,
        getAllModuleStatus: getAllModuleStatus,
        isAPIAvailable: isAPIAvailable
    };

    console.log('[ModulesAPI] 跨模块数据桥已初始化');
})();