// === HoloLake · 多人格体协作调度 · 前端交互 ===

// 实时时钟
function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const el = document.getElementById('currentTime');
    if (el) el.textContent = time;
}
updateClock();
setInterval(updateClock, 1000);

// 刷新按钮动画
document.getElementById('btnRefresh')?.addEventListener('click', function() {
    this.style.opacity = '0.5';
    this.style.pointerEvents = 'none';
    setTimeout(() => {
        this.style.opacity = '1';
        this.style.pointerEvents = 'auto';
    }, 800);
    this.textContent = '刷新中...';
    setTimeout(() => this.textContent = '刷新', 800);
});

// 人格体状态闪烁 (仅在线)
function pulseOnline() {
    document.querySelectorAll('.persona-card.online .persona-status-dot').forEach(dot => {
        dot.style.opacity = dot.style.opacity === '0.5' ? '1' : '0.5';
    });
}
setInterval(pulseOnline, 2000);

// 进度条模拟 (仅 active 任务)
function simulateProgress() {
    document.querySelectorAll('.task-item.active .progress-bar').forEach(bar => {
        const current = parseFloat(bar.style.width) || 0;
        if (current < 95) {
            bar.style.width = (current + Math.random() * 2) + '%';
        }
    });
}
setInterval(simulateProgress, 3000);

// 选项卡切换 (简单模拟)
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        // 这里可以后续对接真实数据
    });
});

console.log('HoloLake · 多人格体协作调度系统 · 已加载');