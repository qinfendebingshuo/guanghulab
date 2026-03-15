function renderRanking(developers) {
    const container = document.getElementById('ranking-container');
    if (!container) return;
    const sorted = [...developers].sort((a, b) => b.streak - a.streak);
    const maxStreak = sorted[0].streak;
    
    let html = '<div class="ranking-header"><h3>🏆 连胜排行榜</h3><span>实时更新</span></div><div class="ranking-list">';
    
    sorted.forEach((dev, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx+1}.`;
        const percent = (dev.streak / maxStreak) * 100;
        html += `
            <div class="ranking-item" data-dev-id="${dev.id}">
                <div class="ranking-rank">${medal}</div>
                <div class="ranking-info">
                    <div class="ranking-name">${dev.name}</div>
                    <div class="ranking-streak-bar">
                        <div class="streak-progress" style="width:${percent}%"></div>
                        <span class="streak-count">${dev.streak}连胜</span>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

async function initRanking() {
    const devs = await getDevStatus();
    renderRanking(devs);
}

window.initRanking = initRanking;
