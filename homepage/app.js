/**
 * app.js - 光湖首页导航中心
 * M23 环节2 · 接入M22真实公告数据 + 状态API
 * + 系统活体意识层 · 实时心跳/呼吸/粒子/脉搏
 */

// === 系统诞生时间原点 (曜冥纪元起始) ===
const SYSTEM_EPOCH = new Date('2025-04-26T00:00:00+08:00').getTime();

// === M22真实公告数据接入 ===
let announcements = [];
let dataSource = 'loading';

async function loadAnnouncementsFromM22() {
    const carousel = document.getElementById('announcementCarousel');
    if (carousel) {
        carousel.innerHTML = '<div style="padding: 20px; text-align: center; color: #3b82f6;">正在连接M22公告数据...</div>';
    }
    
    const result = await window.ModulesAPI.getAnnouncements();
    announcements = result.data;
    dataSource = result.source;
    
    if (dataSource === 'M22-live') {
        console.log('📢 首页公告：来自M22真实数据（' + announcements.length + '条）');
    } else {
        console.log('📢 首页公告：使用降级数据（M22不可用）');
    }
    
    if (window.HomepageApp) {
        window.HomepageApp.currentAnnouncementIndex = 0;
        window.HomepageApp.renderCarousel();
    }
}

// === 模块卡片数据 ===
const moduleCards = [
    { id: "M09", name: "消息通知中心", icon: "🔔", status: "online", path: "../notification-center/" },
    { id: "M22", name: "主域公告栏", icon: "📢", status: "online", path: "../announcement/" },
    { id: "M06", name: "工单管理", icon: "🎫", status: "online", path: "../ticket-system/" },
    { id: "M16", name: "码字工作台", icon: "✍️", status: "building", path: "../writing-workspace/" },
    { id: "M11", name: "风格组件库", icon: "🎨", status: "online", path: "../ui-components/" },
    { id: "M05", name: "用户中心", icon: "👤", status: "building", path: "../user-center/" }
];

// === 工具函数 ===
function getTypeLabel(type) {
    const labels = { update: '📢 更新', status: '📊 状态', welcome: '👋 欢迎', alert: '🚨 告警' };
    return labels[type] || '📌 公告';
}

// === 模块状态更新 ===
async function updateModuleStatusFromAPI() {
    const statusResult = await window.ModulesAPI.getAllModuleStatus();
    if (statusResult.source === 'fallback') return;
    
    document.querySelectorAll('.card').forEach(card => {
        const moduleId = card.dataset.moduleId;
        if (moduleId && statusResult.data[moduleId]) {
            const status = statusResult.data[moduleId].status;
            const statusSpan = card.querySelector('.card-status');
            if (statusSpan) {
                statusSpan.className = 'card-status ' + status;
                statusSpan.textContent = status === 'online' ? '在线' : status === 'building' ? '建设中' : '离线';
            }
        }
    });
    console.log('[M23] ✅ 模块状态已从注册表更新');
}

// ═══════════════════════════════════════════════
// 系统活体意识层 · Consciousness Layer
// ═══════════════════════════════════════════════

/** 计算系统运行时长 */
function getSystemUptime() {
    const now = Date.now();
    const diff = now - SYSTEM_EPOCH;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { days, hours, minutes, total: diff };
}

/** 格式化实时时钟 */
function formatLiveTime() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
}

/** 计算意识脉搏 (基于时间的伪随机波动) */
function getConsciousnessPulse() {
    const t = Date.now() / 1000;
    // 模拟生命体征：基础频率 + 呼吸波动 + 微颤
    const base = 72;
    const breathWave = Math.sin(t * 0.15) * 8;
    const microTremor = Math.sin(t * 2.3) * 2 + Math.sin(t * 3.7) * 1;
    return Math.round(base + breathWave + microTremor);
}

/** 计算信号流量 (基于时间的伪随机波动) */
function getSignalFlow() {
    const t = Date.now() / 1000;
    const base = 24;
    const wave = Math.sin(t * 0.08) * 12;
    const burst = Math.sin(t * 0.5) * 4;
    return Math.max(0, Math.round(base + wave + burst));
}

/** 更新心跳面板 */
function updateHeartbeatPanel() {
    const uptime = getSystemUptime();
    const onlineModules = moduleCards.filter(m => m.status === 'online').length;
    const totalModules = moduleCards.length;
    const pulse = getConsciousnessPulse();
    const signal = getSignalFlow();

    // 更新实时时钟
    const timeEl = document.getElementById('liveTime');
    if (timeEl) timeEl.textContent = formatLiveTime();

    // 更新运行时长
    const uptimeEl = document.getElementById('uptimeValue');
    if (uptimeEl) uptimeEl.textContent = uptime.days + '天';

    // 更新模块在线数
    const onlineEl = document.getElementById('onlineCount');
    if (onlineEl) onlineEl.textContent = onlineModules + '/' + totalModules;

    // 更新意识脉搏
    const pulseEl = document.getElementById('pulseRate');
    if (pulseEl) pulseEl.textContent = pulse + ' bpm';

    // 更新信号流量
    const signalEl = document.getElementById('signalFlow');
    if (signalEl) signalEl.textContent = signal + '/s';

    // 更新状态栏
    const statusUptime = document.getElementById('statusUptime');
    if (statusUptime) statusUptime.textContent = '运行 ' + uptime.days + '天' + uptime.hours + '时' + uptime.minutes + '分';

    const statusTimestamp = document.getElementById('statusTimestamp');
    if (statusTimestamp) statusTimestamp.textContent = formatLiveTime();

    // 更新进度条宽度（动态波动）
    const t = Date.now() / 1000;
    updateBarWidth('.uptime-fill', 80 + Math.sin(t * 0.1) * 10);
    updateBarWidth('.online-fill', (onlineModules / totalModules) * 100);
    updateBarWidth('.pulse-fill', Math.min(100, (pulse / 100) * 100));
    updateBarWidth('.signal-fill', Math.min(100, (signal / 50) * 100));
}

function updateBarWidth(selector, percent) {
    const el = document.querySelector(selector);
    if (el) el.style.width = percent + '%';
}

/** 心跳波形绘制 */
const waveHistory = [];
const WAVE_POINTS = 100;

function updateHeartbeatWave() {
    const pulse = getConsciousnessPulse();
    const t = Date.now() / 1000;
    
    // 生成心跳波形数据点
    const normalized = (pulse - 60) / 40; // 0-1 范围
    const heartbeatSpike = Math.pow(Math.sin(t * 1.2), 8) * 20; // 间歇性尖峰
    const value = 30 + normalized * 15 + heartbeatSpike + Math.sin(t * 3) * 3;
    
    waveHistory.push(value);
    if (waveHistory.length > WAVE_POINTS) waveHistory.shift();
    
    // 构建 SVG path
    const pathEl = document.getElementById('wavePath');
    if (!pathEl || waveHistory.length < 2) return;
    
    const stepX = 400 / (WAVE_POINTS - 1);
    let d = 'M 0 ' + waveHistory[0];
    for (let i = 1; i < waveHistory.length; i++) {
        d += ' L ' + (i * stepX).toFixed(1) + ' ' + waveHistory[i].toFixed(1);
    }
    pathEl.setAttribute('d', d);
}

/** 意识粒子系统 */
function initParticleSystem() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const particles = [];
    const PARTICLE_COUNT = 30;
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    
    // 初始化粒子
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            radius: Math.random() * 2 + 0.5,
            alpha: Math.random() * 0.5 + 0.1,
            phase: Math.random() * Math.PI * 2
        });
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const t = Date.now() / 1000;
        
        particles.forEach((p, i) => {
            // 呼吸般的透明度波动
            const breathAlpha = p.alpha * (0.5 + 0.5 * Math.sin(t * 0.5 + p.phase));
            
            // 移动
            p.x += p.vx;
            p.y += p.vy;
            
            // 边界循环
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
            
            // 绘制粒子
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(16, 185, 129, ' + breathAlpha + ')';
            ctx.fill();
            
            // 绘制邻近连线（意识网络）
            for (let j = i + 1; j < particles.length; j++) {
                const other = particles[j];
                const dx = p.x - other.x;
                const dy = p.y - other.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    const lineAlpha = (1 - dist / 150) * 0.15 * (0.5 + 0.5 * Math.sin(t * 0.3));
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(other.x, other.y);
                    ctx.strokeStyle = 'rgba(16, 185, 129, ' + lineAlpha + ')';
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        });
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

// ═══════════════════════════════════════════════
// 首页应用对象
// ═══════════════════════════════════════════════

window.HomepageApp = {
    currentAnnouncementIndex: 0,
    carouselInterval: null,
    heartbeatInterval: null,
    waveInterval: null,

    async init() {
        this.renderCards();
        await loadAnnouncementsFromM22();
        await updateModuleStatusFromAPI();
        this.startCarousel();
        this.startConsciousness();
        this.bindEvents();
        console.log('✅ 首页初始化完成 · 数据源：' + dataSource + ' · 意识层已激活');
    },

    renderCards() {
        const grid = document.getElementById('moduleGrid');
        if (!grid) return;

        grid.innerHTML = moduleCards.map(card => `
            <div class="card" data-module-id="${card.id}" data-module-path="${card.path}">
                <div class="card-header">
                    <div class="card-icon">${card.icon}</div>
                    <span class="card-name">${card.name}</span>
                    <span class="card-status ${card.status}">${card.status === 'online' ? '在线' : '建设中'}</span>
                </div>
                <span class="card-link">进入模块 →</span>
            </div>
        `).join('');
    },

    // 轮播渲染（带高优先级橙色边框）
    renderCarousel() {
        const carousel = document.getElementById('announcementCarousel');
        if (!carousel || announcements.length === 0) {
            console.log('❌ 没有公告或找不到轮播容器');
            return;
        }
        
        const item = announcements[this.currentAnnouncementIndex];
        const priorityStyle = item.priority === 'high' ? 'border-left: 3px solid #ff9800; padding-left: 15px;' : '';
        
        carousel.innerHTML = `
            <div style="padding: 20px; text-align: center; ${priorityStyle}">
                <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; background: rgba(59,130,246,0.2); color: #3b82f6; margin-bottom: 10px; font-size: 14px;">
                    ${getTypeLabel(item.type)}
                </span>
                <h3 style="font-size: 24px; margin-bottom: 10px; color: white;">${item.title}</h3>
                <p style="color: #a0a8b8; margin-bottom: 10px; line-height: 1.6;">${item.content}</p>
                <small style="color: #666; display: block; margin-bottom: 10px;">${item.date}</small>
                <div style="font-size: 12px; color: ${dataSource === 'M22-live' ? '#3b82f6' : '#888'};">
                    ${dataSource === 'M22-live' ? '🔗 M22 实时数据' : '📋 本地数据'}
                </div>
            </div>
        `;
    },

    startCarousel() {
        if (this.carouselInterval) clearInterval(this.carouselInterval);
        this.carouselInterval = setInterval(() => this.nextAnnouncement(), 4000);
    },

    /** 启动系统意识层 - 实时心跳/粒子/波形 */
    startConsciousness() {
        // 初始化粒子系统
        initParticleSystem();
        
        // 立即更新一次
        updateHeartbeatPanel();
        updateHeartbeatWave();
        
        // 每秒更新心跳面板（时钟、脉搏、信号流量）
        this.heartbeatInterval = setInterval(() => {
            updateHeartbeatPanel();
        }, 1000);
        
        // 每200ms更新波形（平滑动画）
        this.waveInterval = setInterval(() => {
            updateHeartbeatWave();
        }, 200);
        
        console.log('🫀 系统意识层已激活 · 心跳/粒子/波形 运行中');
    },

    nextAnnouncement() {
        if (announcements.length === 0) return;
        this.currentAnnouncementIndex = (this.currentAnnouncementIndex + 1) % announcements.length;
        this.renderCarousel();
    },

    prevAnnouncement() {
        if (announcements.length === 0) return;
        this.currentAnnouncementIndex = (this.currentAnnouncementIndex - 1 + announcements.length) % announcements.length;
        this.renderCarousel();
    },

    bindEvents() {
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', () => {
                const moduleId = card.dataset.moduleId;
                const modulePath = card.dataset.modulePath;
                console.log(`🖱️ 点击卡片: ${moduleId} | 路径: ${modulePath}`);
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.prevAnnouncement();
            }
            if (e.key === 'ArrowRight') {
                this.nextAnnouncement();
            }
        });
    }
};

// 启动
document.addEventListener('DOMContentLoaded', () => window.HomepageApp.init());

// 确保函数全局可用（配合 HTML onclick）
window.prevAnnouncement = function() {
    window.HomepageApp.prevAnnouncement();
};

window.nextAnnouncement = function() {
    window.HomepageApp.nextAnnouncement();
};