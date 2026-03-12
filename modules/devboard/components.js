// components.js - 组件渲染函数

// 模拟数据
const mockDevelopers = [
    { id: 'DEV-001', name: '小明', pca: { EXE: 85, TEC: 72, SYS: 68, COL: 90, INI: 78 }, wins: 5, el: 'EL-6', module: 'M-DEVBOARD' },
    { id: 'DEV-002', name: '小红', pca: { EXE: 78, TEC: 88, SYS: 82, COL: 75, INI: 92 }, wins: 8, el: 'EL-7', module: 'M-FRONTEND' },
    { id: 'DEV-003', name: '小刚', pca: { EXE: 92, TEC: 65, SYS: 70, COL: 68, INI: 85 }, wins: 3, el: 'EL-5', module: 'M-BACKEND' },
    { id: 'DEV-004', name: '之之', pca: { EXE: 75, TEC: 58, SYS: 82, COL: 82, INI: 85 }, wins: 13, el: 'EL-6', module: 'M-DEVBOARD' }
];

// 获取所有开发者
function getDevelopers() {
    return mockDevelopers;
}

// 根据ID获取开发者
function getDeveloperById(id) {
    return mockDevelopers.find(d => d.id === id) || mockDevelopers[0];
}

// 渲染开发者卡片
function renderDeveloperCards(developers) {
    return developers.map(dev => `
        <div class="dev-card" data-dev-id="${dev.id}" tabindex="0" role="button" aria-label="查看${dev.name}的详情">
            <div class="dev-header">
                <span class="dev-id">${dev.id}</span>
                <span class="dev-wins">🏆 ${dev.wins}</span>
            </div>
            <div class="dev-name">${dev.name}</div>
            <div class="dev-details">
                <span class="dev-el">${dev.el}</span>
                <span class="dev-module">${dev.module}</span>
            </div>
            <div class="dev-pca">
                ${Object.entries(dev.pca).map(([key, val]) => 
                    `<span class="pca-mini ${key}">${key}:${val}</span>`
                ).join('')}
            </div>
        </div>
    `).join('');
}

// 渲染排行榜
function renderRanking(developers) {
    // 按连胜数排序
    const sorted = [...developers].sort((a, b) => b.wins - a.wins);
    
    return sorted.map((dev, index) => {
        const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
        return `
            <div class="ranking-item ${rankClass}">
                <span class="rank-number">${index + 1}</span>
                <div class="rank-info">
                    <div class="rank-name">${dev.name}</div>
                    <div class="rank-id">${dev.id}</div>
                </div>
                <span class="rank-wins">${dev.wins}连胜</span>
            </div>
        `;
    }).join('');
}

// 刷新看板
function refreshDashboard() {
    const developers = getDevelopers();
    
    // 渲染卡片
    const grid = document.getElementById('developers-grid');
    if (grid) {
        grid.innerHTML = renderDeveloperCards(developers);
    }
    
    // 渲染排行榜
    const ranking = document.getElementById('ranking-list');
    if (ranking) {
        ranking.innerHTML = renderRanking(developers);
    }
    
    // 绘制团队雷达图（平均分）
    const avgPca = {
        EXE: Math.round(developers.reduce((sum, d) => sum + d.pca.EXE, 0) / developers.length),
        TEC: Math.round(developers.reduce((sum, d) => sum + d.pca.TEC, 0) / developers.length),
        SYS: Math.round(developers.reduce((sum, d) => sum + d.pca.SYS, 0) / developers.length),
        COL: Math.round(developers.reduce((sum, d) => sum + d.pca.COL, 0) / developers.length),
        INI: Math.round(developers.reduce((sum, d) => sum + d.pca.INI, 0) / developers.length)
    };
    
    drawRadarChart('team-radar', avgPca);
}

// 搜索筛选
function filterDevelopers(searchTerm, filterStatus) {
    let developers = getDevelopers();
    
    // 搜索过滤
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        developers = developers.filter(dev => 
            dev.name.toLowerCase().includes(term) ||
            dev.id.toLowerCase().includes(term) ||
            dev.module.toLowerCase().includes(term)
        );
    }
    
    // 状态过滤（模拟，实际需要真实数据）
    if (filterStatus !== 'all') {
        // 这里简化处理，实际应该根据模块状态筛选
        developers = developers.filter(dev => {
            if (filterStatus === 'active') return dev.wins < 10;
            if (filterStatus === 'completed') return dev.wins >= 10;
            return true;
        });
    }
    
    return developers;
}

// 导出函数
window.getDevelopers = getDevelopers;
window.getDeveloperById = getDeveloperById;
window.renderDeveloperCards = renderDeveloperCards;
window.renderRanking = renderRanking;
window.refreshDashboard = refreshDashboard;
window.filterDevelopers = filterDevelopers;

// 增强版排行榜渲染（带数字滚动支持）
function renderRankingWithAnimation(developers) {
    const sorted = [...developers].sort((a, b) => b.wins - a.wins);
    
    return sorted.map((dev, index) => {
        const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
        return `
            <div class="ranking-item ${rankClass}" data-dev-id="${dev.id}">
                <span class="rank-number">${index + 1}</span>
                <div class="rank-info">
                    <div class="rank-name">${dev.name}</div>
                    <div class="rank-id">${dev.id}</div>
                </div>
                <span class="rank-wins stat-value">${dev.wins}连胜</span>
            </div>
        `;
    }).join('');
}

// 覆盖原函数
window.renderRanking = renderRankingWithAnimation;
