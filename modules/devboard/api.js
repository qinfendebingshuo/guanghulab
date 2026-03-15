// ======================
// HoloLake DevBoard · API Client v2.0
// DEV-004 之之 · 环节5 · 真实API对接
// 协议：SYSLOG-v4.0
// ======================

const API = {
    // ====== 配置区 ======
    // 页页的后端API地址（如果地址不对，问知秋确认）
    BASE_URL: 'https://guanghulab.com/api/devboard',
    TIMEOUT: 8000,
    FALLBACK: true,         // API挂了自动切换模拟数据
    REFRESH_MS: 30000,       // 30秒自动刷新
    _cache: {}
};

// ====== 通用请求（带超时+缓存+降级） =====================
async function apiFetch(path) {
    const url = API.BASE_URL + path;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), API.TIMEOUT);
    try {
        const res = await fetch(url, {
            signal: ctrl.signal,
            headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        API._cache[path] = { data: data, time: Date.now() };
        return data;
    } catch (err) {
        clearTimeout(timer);
        console.warn(' 🚨 [DevBoard API] ' + path + ' 失败: ', err.message);
        if (API._cache[path]) {
            console.info(' 💾 [DevBoard API] 使用缓存');
            return API._cache[path].data;
        }
        if (API.FALLBACK) {
            console.info(' 🛡️ [DevBoard API] 降级到模拟数据');
            return getMockData(path);
        }
        throw err;
    }
}

// ========== 公开接口 ==========
async function apiGetDevelopers() {
    return apiFetch('/developers');
}

async function apiGetDeveloperDetail(devId) {
    return apiFetch('/developers/' + devId);
}

async function apiGetStats() {
    return apiFetch('/stats');
}

async function apiGetLeaderboard() {
    return apiFetch('/leaderboard');
}

// ========== 健康检查 ==========
async function apiHealthCheck() {
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(API.BASE_URL + '/health', { signal: ctrl.signal });
        clearTimeout(t);
        return res.ok;
    } catch (e) {
        return false;
    }
}

// ========== 模拟数据（降级保护） ==========
function getMockData(path) {
    var devs = [
        { dev_id:'DEV-001', name:'页页', module:'BC-集成', status:'进行中', streak:5, el:'EL-6', pca:{EXE:75,TEC:60,SYS:70,COL:80,INI:65} },
        { dev_id:'DEV-002', name:'肥猫', module:'M-STATUS', status:'进行中', streak:9, el:'EL-5', pca:{EXE:72,TEC:40,SYS:68,COL:82,INI:70} },
        { dev_id:'DEV-003', name:'燕樊', module:'M-MEMORY', status:'进行中', streak:7, el:'EL-5', pca:{EXE:70,TEC:55,SYS:65,COL:75,INI:68} },
        { dev_id:'DEV-004', name:'之之', module:'M-DEVBOARD', status:'进行中', streak:14, el:'EL-8', pca:{EXE:90,TEC:55,SYS:80,COL:85,INI:88} },
        { dev_id:'DEV-009', name:'花尔', module:'M20', status:'进行中', streak:4, el:'EL-8', pca:{EXE:65,TEC:45,SYS:55,COL:70,INI:60} },
        { dev_id:'DEV-010', name:'桔子', module:'M-CHANNEL', status:'进行中', streak:14, el:'EL-6', pca:{EXE:85,TEC:50,SYS:75,COL:80,INI:82} },
        { dev_id:'DEV-011', name:'匆匆那年',module:'M16', status:'等待中', streak:1, el:'EL-3', pca:{EXE:50,TEC:30,SYS:40,COL:55,INI:45} },
        { dev_id:'DEV-012', name:'Awen', module:'M22', status:'进行中', streak:13, el:'EL-6', pca:{EXE:88,TEC:45,SYS:78,COL:90,INI:80} },
        { dev_id:'DEV-013', name:'小兴', module:'M-AUTH', status:'进行中', streak:1, el:'EL-3', pca:{EXE:55,TEC:25,SYS:35,COL:60,INI:50} }
    ];
    var stats = { total_developers:10, active:8, modules:12, code_lines:32000, longest_streak:14, avg_streak:7.5 };

    if (path === '/developers') return devs;
    if (path.indexOf('/developers/') === 0) {
        var id = path.split('/').pop();
        return devs.find(function(d){ return d.dev_id === id; }) || devs[0];
    }
    if (path === '/stats') return stats;
    if (path === '/leaderboard') return devs.slice().sort(function(a,b){ return b.streak - a.streak; });
    return [];
}

// ========== API状态指示器 ==========
function showApiStatus(online) {
    var el = document.getElementById('api-status');
    if (!el) {
        el = document.createElement('div');
        el.id = 'api-status';
        el.style.cssText = 'position:fixed;bottom:12px;right:12px;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;z-index:9999;transition:all 0.3s;';
        document.body.appendChild(el);
    }
    if (online) {
        el.textContent = '🟢 实时数据';
        el.style.backgroundColor = 'rgba(52,211,153,0.15)';
        el.style.color = '#34d399';
        el.style.border = '1px solid rgba(52,211,153,0.3)';
    } else {
        el.textContent = '🟡 模拟数据';
        el.style.backgroundColor = 'rgba(251,191,36,0.15)';
        el.style.color = '#fbbf24';
        el.style.border = '1px solid rgba(251,191,36,0.3)';
    }
}
