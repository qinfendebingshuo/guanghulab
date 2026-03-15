function renderStats(stats) {
    const container = document.getElementById('stats-container');
    if (!container) return;
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">活跃开发者</div>
                <div class="stat-number">${stats.activeDevs}</div>
                <div class="stat-sub">总人数 ${stats.totalDevs}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">总代码量</div>
                <div class="stat-number">${formatNumber(stats.totalCodeLines)}</div>
                <div class="stat-sub">行代码</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">模块进度</div>
                <div class="stat-number">${stats.modulesCompleted}/${stats.totalModules}</div>
                <div class="stat-sub">✅ ${stats.modulesCompleted} / ⚡ ${stats.modulesInProgress} / ⏳ ${stats.modulesPending}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">最高连胜</div>
                <div class="stat-number">${stats.topStreak.count}</div>
                <div class="stat-sub">${stats.topStreak.name} ${getStreakEmoji(stats.topStreak.count)}</div>
            </div>
        </div>
    `;
}

function renderDevCards(developers) {
    const container = document.getElementById('devgrid-container');
    if (!container) return;
    const sorted = [...developers].sort((a, b) => b.streak - a.streak);
    let html = '<div class="dev-grid">';
    sorted.forEach(dev => {
        const pcaColor = getPCAColor(dev.totalScore);
        html += `
            <div class="dev-card" data-dev-id="${dev.id}">
                <div class="dev-card-header">
                    <div class="dev-avatar">${dev.name[0]}</div>
                    <div class="dev-info">
                        <div class="dev-name">${dev.name}</div>
                        <div class="dev-id">${dev.id}</div>
                    </div>
                </div>
                <div class="dev-module">📁 ${dev.module}</div>
                <div class="dev-stats">
                    <div class="dev-streak">${dev.streak}<span>连胜</span></div>
                    <div class="dev-badges">
                        <span class="badge badge-el">EL-${dev.el}</span>
                        <span class="badge" style="background:${pcaColor.color}20; color:${pcaColor.color}">${pcaColor.level} · ${dev.totalScore}</span>
                    </div>
                </div>
                <div class="dev-footer">
                    <span>${getStatusBadge(dev.status)}</span>
                    <span>🕒 ${formatDate(dev.lastActive)}</span>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

async function initBoard() {
    const devs = await getDevStatus();
    const stats = await getAllStats();
    renderStats(stats);
    renderDevCards(devs);
}

window.initBoard = initBoard;
