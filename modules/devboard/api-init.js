// =====================================
// HoloLake DevBoard · API Init v1.0
// 负责：异步加载 + 加载动画 + 自动刷新
// 必须在 api.js 和 main.js 之后加载
// =====================================

(function(){
    // -------------- 加载动画 --------------
    function showLoader(show) {
        var el = document.getElementById('devboard-loader');
        if (!el && show) {
            el = document.createElement('div');
            el.id = 'devboard-loader';
            el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(10,14,23,0.92);display:flex;align-items:center;justify-content:center;z-index:10000';
            el.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:16px;"><div style="width:40px;height:40px;border:3px solid rgba(96,165,250,0.3);border-top-color:#60a5fa;border-radius:50%;animation:dbspin 0.8s linear infinite;"></div><div style="font-size:14px;color:#60a5fa;">数据加载中...</div></div>';
            var style = document.createElement('style');
            style.textContent = '@keyframes dbspin{to{transform:rotate(360deg)}}';
            document.head.appendChild(style);
            document.body.appendChild(el);
        }
        if (el) el.style.display = show ? 'flex' : 'none';
    }

    // -------------- 数据加载+渲染 --------------
    async function loadAndRender() {
        try {
            var developers = await apiGetDevelopers();
            var stats = await apiGetStats();
            var leaderboard = await apiGetLeaderboard();

            // 使用 components.js 里实际存在的函数
            if (typeof renderDeveloperCards === 'function') {
                renderDeveloperCards(developers);
            }
            
            if (typeof renderRanking === 'function') {
                renderRanking(leaderboard);
            }
            
            // stats 暂时用控制台输出，等找到实际渲染函数再改
            console.log('[DevBoard] 统计数据:', stats);

            console.log('[DevBoard] 数据加载完成，共 ' + developers.length + ' 位开发者');
        } catch (err) {
            console.error('[DevBoard] 数据加载异常: ', err);
        }
    }

    // -------------- 初始化入口 --------------
    async function init() {
        showLoader(true);

        // 检测API状态
        var online = await apiHealthCheck();
        showApiStatus(online);
        console.log('[DevBoard] API状态: ' + (online ? '在线(实时)' : '离线(降级)'));

        // 加载+渲染
        await loadAndRender();
        showLoader(false);

        // 自动刷新（仅API在线时）
        if (online && API.REFRESH_MS > 0) {
            console.log('[DevBoard] 自动刷新已启动，间隔 ' + (API.REFRESH_MS/1000) + ' 秒');
            setInterval(async function() {
                try {
                    await loadAndRender();
                } catch (e) {
                    console.warn('[DevBoard] 自动刷新失败: ', e.message);
                }
            }, API.REFRESH_MS);
        }
    }

    // 等待DOM和所有脚本加载完成后启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
