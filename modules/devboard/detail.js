// detail.js - 开发者详情页渲染器

let currentDevId = null;

// 显示详情页
function showDetailPage(devId) {
    currentDevId = devId;
    
    const overview = document.getElementById('overview-container');
    const detail = document.getElementById('detail-container');
    
    if (!overview || !detail) {
        console.error('找不到容器元素');
        return;
    }
    
    // 淡出总览页
    overview.classList.add('fade-out');
    
    setTimeout(() => {
        overview.style.display = 'none';
        overview.classList.remove('fade-out');
        
        // 渲染详情页数据
        renderDetailPage(devId);
        
        detail.style.display = 'block';
        detail.classList.add('fade-in');
        
        // 滚动到顶部
        window.scrollTo(0, 0);
    }, 300);
}

// 返回总览页
function hideDetailPage() {
    const overview = document.getElementById('overview-container');
    const detail = document.getElementById('detail-container');
    
    detail.classList.add('fade-out');
    
    setTimeout(() => {
        detail.style.display = 'none';
        detail.classList.remove('fade-out');
        
        overview.style.display = 'block';
        overview.classList.add('fade-in');
        
        // 刷新总览页数据
        refreshDashboard();
    }, 300);
}

// 渲染详情页
function renderDetailPage(devId) {
    const dev = getDeveloperById(devId);
    if (!dev) return;
    
    const container = document.getElementById('detail-container');
    
    // 生成五维进度条
    const progressBars = renderPCAProgressBars(dev.pca);
    
    // 获取模块历史
    const modules = getModuleHistory(devId);
    const moduleList = renderModuleHistory(modules);
    
    // 获取连胜趋势数据
    const trendData = getWinTrendData(devId);
    
    container.innerHTML = `
        <div class="detail-header">
            <button class="back-button" onclick="hideDetailPage()" aria-label="返回总览">
                ← 返回总览
            </button>
        </div>
        <div class="detail-content">
            <!-- 开发者大头卡片 -->
            <div class="detail-section developer-card-large">
                <div class="dev-card" data-dev-id="${dev.id}">
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
            </div>
            
            <!-- PCA雷达图 -->
            <div class="detail-section">
                <h2>📊 完整PCA雷达图</h2>
                <div class="radar-large-container">
                    ${renderRadarChart(dev.pca, 'large')}
                </div>
                <div class="pca-scores">
                    ${Object.entries(dev.pca).map(([dim, score]) => 
                        `<span class="score-tag ${dim}">${dim}: ${score}</span>`
                    ).join('')}
                </div>
            </div>
            
            <!-- 五维进度条 -->
            <div class="detail-section">
                <h2>📈 五维进度条</h2>
                <div class="progress-bars-container">
                    ${progressBars}
                </div>
            </div>
            
            <!-- 模块历史 -->
            <div class="detail-section">
                <h2>📋 模块历史</h2>
                <div class="module-history-container">
                    ${moduleList}
                </div>
            </div>
            
            <!-- 连胜趋势 -->
            <div class="detail-section">
                <h2>🏆 连胜趋势</h2>
                <div class="trend-chart-container">
                    <canvas id="trend-canvas" width="400" height="200" 
                            style="width:100%; height:200px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                    </canvas>
                </div>
            </div>
        </div>
    `;
    
    // 绘制趋势图
    setTimeout(() => drawTrendChart('trend-canvas', trendData), 100);
}

// 渲染PCA五维进度条
function renderPCAProgressBars(pca) {
    const dimensions = [
        { key: 'EXE', label: '执行力', color: '#4CAF50' },
        { key: 'TEC', label: '技术深度', color: '#2196F3' },
        { key: 'SYS', label: '系统思维', color: '#9C27B0' },
        { key: 'COL', label: '协作力', color: '#FF9800' },
        { key: 'INI', label: '主动性', color: '#f44336' }
    ];
    
    return dimensions.map(dim => {
        const score = pca[dim.key] || 0;
        
        return `
            <div class="progress-item">
                <div class="progress-label">
                    <span class="dim-name">${dim.label}</span>
                    <span class="dim-score">${score}</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" 
                         style="width: ${score}%; background-color: ${dim.color};">
                    </div>
                </div>
                <div class="progress-dim-code">${dim.key}</div>
            </div>
        `;
    }).join('');
}

// 渲染模块历史列表
function renderModuleHistory(modules) {
    if (!modules || modules.length === 0) {
        return '<p class="no-data">暂无模块历史</p>';
    }
    
    return `
        <ul class="module-history-list">
            ${modules.map(m => `
                <li class="module-item status-${m.status}">
                    <span class="module-code">${m.code}</span>
                    <span class="module-name">${m.name}</span>
                    <span class="module-status">${m.status}</span>
                    <span class="module-date">${m.completedDate || m.startDate || '-'}</span>
                </li>
            `).join('')}
        </ul>
    `;
}

// 获取模块历史（模拟数据）
function getModuleHistory(devId) {
    const histories = {
        'DEV-001': [
            { code: 'M-DEVBOARD-001', name: '开发者看板·环节0~2', status: '已完成', completedDate: '2026-03-10' },
            { code: 'M-FRONTEND-003', name: '前端基础组件', status: '已完成', completedDate: '2026-03-08' },
            { code: 'M-API-002', name: 'API对接练习', status: '进行中', completedDate: null }
        ],
        'DEV-002': [
            { code: 'M-FRONTEND-001', name: '前端架构设计', status: '已完成', completedDate: '2026-03-09' },
            { code: 'M-UI-005', name: '组件库开发', status: '已完成', completedDate: '2026-03-07' },
            { code: 'M-TEST-003', name: '单元测试编写', status: '待开始', completedDate: null }
        ],
        'DEV-003': [
            { code: 'M-BACKEND-002', name: 'API服务搭建', status: '已完成', completedDate: '2026-03-11' },
            { code: 'M-DB-001', name: '数据库设计', status: '已完成', completedDate: '2026-03-09' },
            { code: 'M-DEPLOY-002', name: '容器化部署', status: '进行中', completedDate: null }
        ],
        'DEV-004': [
            { code: 'M-DEVBOARD-001', name: '开发者看板·环节0~2', status: '已完成', completedDate: '2026-03-11' },
            { code: 'M-CANVAS-005', name: 'Canvas雷达图绘制', status: '已完成', completedDate: '2026-03-09' },
            { code: 'M-COMPONENTS-003', name: '组件化思维训练', status: '已完成', completedDate: '2026-03-07' },
            { code: 'M-DEPLOY-001', name: '静态部署练习', status: '待开始', completedDate: null }
        ]
    };
    return histories[devId] || histories['DEV-001'];
}

// 获取连胜趋势数据
function getWinTrendData(devId) {
    const trends = {
        'DEV-001': [
            { date: '03-06', value: 3 },
            { date: '03-07', value: 3 },
            { date: '03-08', value: 4 },
            { date: '03-09', value: 4 },
            { date: '03-10', value: 5 },
            { date: '03-11', value: 5 },
            { date: '03-12', value: 5 }
        ],
        'DEV-002': [
            { date: '03-06', value: 5 },
            { date: '03-07', value: 6 },
            { date: '03-08', value: 6 },
            { date: '03-09', value: 7 },
            { date: '03-10', value: 7 },
            { date: '03-11', value: 8 },
            { date: '03-12', value: 8 }
        ],
        'DEV-003': [
            { date: '03-06', value: 1 },
            { date: '03-07', value: 1 },
            { date: '03-08', value: 2 },
            { date: '03-09', value: 2 },
            { date: '03-10', value: 3 },
            { date: '03-11', value: 3 },
            { date: '03-12', value: 3 }
        ],
        'DEV-004': [
            { date: '03-06', value: 8 },
            { date: '03-07', value: 9 },
            { date: '03-08', value: 9 },
            { date: '03-09', value: 10 },
            { date: '03-10', value: 11 },
            { date: '03-11', value: 12 },
            { date: '03-12', value: 13 }
        ]
    };
    return trends[devId] || trends['DEV-001'];
}

// 绘制趋势图
function drawTrendChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    
    ctx.clearRect(0, 0, width, height);
    
    if (!data || data.length < 2) {
        ctx.fillStyle = '#888';
        ctx.font = '14px monospace';
        ctx.fillText('暂无连胜数据', padding, height/2);
        return;
    }
    
    // 计算坐标范围
    const values = data.map(d => d.value);
    const maxValue = Math.max(...values) + 1;
    const minValue = Math.max(0, Math.min(...values) - 1);
    const xStep = (width - 2 * padding) / (data.length - 1);
    
    // 绘制网格线
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
        const y = padding + (i * (height - 2 * padding) / 5);
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
    }
    ctx.strokeStyle = '#444';
    ctx.stroke();
    
    // 绘制轴线
    ctx.beginPath();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // 绘制折线
    ctx.beginPath();
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 3;
    
    data.forEach((point, i) => {
        const x = padding + i * xStep;
        const y = padding + (height - 2 * padding) * (1 - (point.value - minValue) / (maxValue - minValue));
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // 绘制数据点
    data.forEach((point, i) => {
        const x = padding + i * xStep;
        const y = padding + (height - 2 * padding) * (1 - (point.value - minValue) / (maxValue - minValue));
        
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 显示数值
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(point.value, x, y - 15);
        
        // 显示日期
        ctx.fillStyle = '#aaa';
        ctx.font = '10px monospace';
        ctx.fillText(point.date, x, height - padding + 20);
    });
}

// 导出函数
window.showDetailPage = showDetailPage;
window.hideDetailPage = hideDetailPage;
window.getModuleHistory = getModuleHistory;
window.getWinTrendData = getWinTrendData;
