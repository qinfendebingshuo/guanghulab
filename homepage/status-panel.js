/**
 * status-panel.js
 * M23 光湖首页 · 模块状态总览面板 + 骨架屏 + 自动刷新
 * 版本：v1.0
 * 开发者：DEV-012 Awen
 */

(function() {
    'use strict';

    var REFRESH_INTERVAL = 30000; // 30秒自动刷新
    var refreshTimer = null;

    // === 状态颜色映射 ===
    var STATUS_CONFIG = {
        online: { label: '● 已上线', color: '#81c784', bg: 'rgba(129,199,132,0.15)' },
        building: { label: '◐ 建设中', color: '#ffb74d', bg: 'rgba(255,183,77,0.15)' },
        offline: { label: '○ 离线', color: '#e57373', bg: 'rgba(229,115,115,0.15)' }
    };

    // === 渲染状态卡片 ===
    function renderStatusCards(modules) {
        var grid = document.getElementById('statusGrid');
        var summary = document.getElementById('statusSummary');
        if (!grid) return;

        var html = '';
        var onlineCount = 0;
        var buildingCount = 0;
        var keys = Object.keys(modules);

        keys.forEach(function(id) {
            var m = modules[id];
            var cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.offline;
            if (m.status === 'online') onlineCount++;
            else buildingCount++;

            html += '<div class="status-card" style="border-left: 3px solid ' + cfg.color + '; background: ' + cfg.bg + '">';
            html += '  <div class="status-card-header">';
            html += '    <span class="module-id">' + id + '</span>';
            html += '    <span class="status-dot" style="color: ' + cfg.color + '">' + cfg.label + '</span>';
            html += '  </div>';
            html += '  <div class="module-name">' + m.name + '</div>';
            html += '  <div class="last-update">更新: ' + m.lastUpdate + '</div>';
            html += '</div>';
        });

        grid.innerHTML = html;

        // 状态摘要
        if (summary) {
            summary.innerHTML = 
                '<span class="summary-online">● ' + onlineCount + ' 个已上线</span>' +
                '<span class="summary-building">◐ ' + buildingCount + ' 个建设中</span>' +
                '<span class="summary-total">共 ' + keys.length + ' 个模块</span>' +
                '<span class="summary-refresh">每30秒自动刷新</span>';
        }

        console.log('[StatusPanel] 状态面板已渲染，' + onlineCount + '个在线／' + keys.length + '个总计');
    }

    // === 加载并渲染 ===
    async function loadStatusPanel() {
        try {
            var result = await window.ModulesAPI.getAllModuleStatus();
            if (result.source !== 'fallback' && Object.keys(result.data).length > 0) {
                renderStatusCards(result.data);
            } else {
                document.getElementById('statusGrid').innerHTML = '<div class="status-empty">△ 模块状态数据暂不可用</div>';
            }
        } catch (err) {
            console.warn('[StatusPanel] 加载失败: ', err);
        }
    }

    // === 自动刷新 ===
    function startAutoRefresh() {
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(function() {
            loadStatusPanel();
            console.log('[StatusPanel] 自动刷新');
        }, REFRESH_INTERVAL);
    }

    // === 初始化 ===
    window.StatusPanel = {
        init: async function() {
            await loadStatusPanel();
            startAutoRefresh();
            console.log('[StatusPanel] 📊 状态总览面板已启动');
        }
    };
})();