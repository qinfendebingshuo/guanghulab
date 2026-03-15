// ================== 路由配置 ==================
const routes = {
    'home': 'views/home.html',
    'channel': 'views/channel.html',
    'about': 'views/about.html'
};

// 获取当前 hash 中的路径（去掉 #/）
function getHashPath() {
    const hash = window.location.hash.slice(1) || '/';
    const path = hash.startsWith('/') ? hash.slice(1) : hash;
    return path || 'home';
}

// ================== 加载视图 ==================
async function loadView(path) {
    const routerView = document.getElementById('router-view');
    if (!routerView) return;

    // 显示加载动画
    routerView.innerHTML = '<div class="loader" style="margin: 2rem auto;"></div>';

    try {
        const viewFile = routes[path];
        if (!viewFile) {
            await load404(routerView);
            return;
        }

        const response = await fetch(viewFile);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const html = await response.text();
        routerView.innerHTML = html;
    } catch (error) {
        console.error('加载视图失败:', error);
        routerView.innerHTML = `
            <div class="error-message">
                ❌ 加载失败：${error.message}<br>
                <small>请检查文件是否存在，或刷新重试</small>
            </div>
        `;
    }

    // 更新导航高亮和状态栏
    updateActiveNav(path);
    updateStatusBar(path);
}

// 加载 404 页面
async function load404(container) {
    try {
        const resp = await fetch('views/404.html');
        if (resp.ok) {
            container.innerHTML = await resp.text();
        } else {
            container.innerHTML = '<div class="error-message">⚠️ 404 - 页面未找到</div>';
        }
    } catch {
        container.innerHTML = '<div class="error-message">⚠️ 404 - 页面未找到</div>';
    }
}

// 更新导航高亮
function updateActiveNav(path) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        const linkPath = link.getAttribute('href').slice(2);
        if (linkPath === path) {
            link.classList.add('active');
        }
    });
}

// 更新状态栏
function updateStatusBar(path) {
    const statusEl = document.getElementById('current-route');
    if (statusEl) {
        statusEl.textContent = `当前路由：/${path}`;
    }
}

// 监听 hash 变化
window.addEventListener('hashchange', () => {
    const path = getHashPath();
    loadView(path);
});

// 首次加载
window.addEventListener('DOMContentLoaded', () => {
    if (!window.location.hash) {
        window.location.hash = '#/home';
    } else {
        const path = getHashPath();
        loadView(path);
    }
});
