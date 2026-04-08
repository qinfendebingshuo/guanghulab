/*
 * search-activity.js
 * M23 光湖首页 · 搜索筛选 + 时间欢迎栏
 * 版本：v1.0
 * 开发者：DEV-012 Awen
 * 环节4：首页完工
 */

(function() {
    'use strict';

    // === 时间欢迎栏 ===
    function getGreeting() {
        var hour = new Date().getHours();
        if (hour < 6) return '🌙 夜深了';
        if (hour < 12) return '🌅 早上好';
        if (hour < 14) return '☀️ 中午好';
        if (hour < 18) return '⛅ 下午好';
        return '🌃 晚上好';
    }

    function updateWelcome() {
        var el = document.getElementById('welcomeBar');
        if (!el) return;
        
        var now = new Date();
        var timeStr = now.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        var dateStr = now.toLocaleDateString('zh-CN', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            weekday: 'long' 
        });
        
        el.innerHTML = '<div class="welcome-greeting">' + getGreeting() + '，欢迎回到光湖</div>' +
                      '<div class="welcome-time">' + dateStr + ' ' + timeStr + '</div>';
    }

    // === 搜索筛选 ===
    function initSearch() {
        var input = document.getElementById('moduleSearch');
        if (!input) return;

        input.addEventListener('input', function() {
            var keyword = this.value.toLowerCase().trim();
            var cards = document.querySelectorAll('#statusGrid .status-card:not(.skeleton)');
            var visibleCount = 0;

            cards.forEach(function(card) {
                var text = card.textContent.toLowerCase();
                if (!keyword || text.indexOf(keyword) !== -1) {
                    card.style.display = '';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });

            var resultEl = document.getElementById('searchResult');
            if (resultEl) {
                resultEl.textContent = keyword ? '🔍 找到 ' + visibleCount + ' 个模块' : '';
            }
            
            console.log('[Search] 筛选: "' + keyword + '" → ' + visibleCount + ' 个结果');
        });
    }

    // === 键盘快捷键 ===
    function initShortcut() {
        document.addEventListener('keydown', function(e) {
            // Ctrl+K 或 Cmd+K 聚焦搜索框
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                var input = document.getElementById('moduleSearch');
                if (input) {
                    input.focus();
                    input.select();
                }
            }
        });
    }

    // === 初始化所有功能 ===
    function init() {
        updateWelcome();
        setInterval(updateWelcome, 1000);
        initSearch();
        initShortcut();
        console.log('✅ 搜索筛选 + 时间欢迎栏 已启动 (环节4)');
    }

    window.SearchActivity = {
        init: init
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 100);
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();