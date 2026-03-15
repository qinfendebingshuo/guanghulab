let refreshInterval;
let countdownInterval;
let seconds = 30;

function updateLastUpdateTime() {
    const el = document.getElementById('last-update-time');
    if (el) {
        const now = new Date();
        el.textContent = `最后更新: ${now.toLocaleTimeString('zh-CN', { hour12: false })}`;
    }
}

function updateCountdown() {
    const el = document.getElementById('refresh-indicator');
    if (el) el.textContent = `⏳ ${seconds}s`;
}

function startCountdown() {
    seconds = 30;
    updateCountdown();
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        seconds--;
        if (seconds <= 0) seconds = 30;
        updateCountdown();
    }, 1000);
}

async function refreshAllData() {
    const devs = await getDevStatus();
    const stats = await getAllStats();
    if (typeof renderStats === 'function') renderStats(stats);
    if (typeof renderDevCards === 'function') renderDevCards(devs);
    if (typeof renderRanking === 'function') renderRanking(devs);
    updateLastUpdateTime();
}

async function initApp() {
    await initBoard();
    await initRanking();
    initRadar();
    await refreshAllData();
    startCountdown();
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(refreshAllData, 30000);
}

document.addEventListener('DOMContentLoaded', initApp);

window.addEventListener('beforeunload', () => {
    if (refreshInterval) clearInterval(refreshInterval);
    if (countdownInterval) clearInterval(countdownInterval);
});
