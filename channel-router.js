// ================== 路由配置 ==================
const routes = {
    'home': 'views/home.html',
    'channel': 'views/channel.html',
    'about': 'views/about.html'
};

// 动画时长
const ANIMATION_DURATION = 300;

// 获取当前 hash 中的路径（去掉 #/）
function getHashPath() {
    const hash = window.location.hash.slice(1) || '/';
    const path = hash.startsWith('/') ? hash.slice(1) : hash;
    return path || 'home';
}

// ================== 状态管理（localStorage） ==================
const STORAGE_KEY = 'm-channel-state';

// 保存状态
function saveState(path) {
    // 获取已访问模块列表
    let visited = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { visitedModules: [] };
    if (!visited.visitedModules.includes(path)) {
        visited.visitedModules.push(path);
    }
    visited.lastRoute = path;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visited));
    console.log(`[state] save ${path}`, visited);
}

// 恢复状态（返回上次访问的路由，如果没有则返回 'home'）
function restoreState() {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.lastRoute) {
        console.log(`[state] restore ${saved.lastRoute}`, saved);
        return saved.lastRoute;
    }
    return 'home';
}

// ================== 加载视图（带动画+状态保存） ==================
async function loadView(path) {
    const routerView = document.getElementById('router-view');
    if (!routerView) return;

    // 1. 开始离开动画
    routerView.classList.add('fade-leave-active', 'fade-leave-to');

    // 2. 稍等片刻让离开动画跑起来，再加载新内容
    setTimeout(async () => {
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

        // 3. 移除离开动画类，添加入场动画类
        routerView.classList.remove('fade-leave-active', 'fade-leave-to');
        routerView.classList.add('fade-enter-active', 'fade-enter-from');

        requestAnimationFrame(() => {
            routerView.classList.remove('fade-enter-from');
        });

        setTimeout(() => {
            routerView.classList.remove('fade-enter-active');
        }, ANIMATION_DURATION);

        // 4. 保存状态到 localStorage（并打印日志）
        saveState(path);

        // 5. 更新导航高亮和状态栏
        updateActiveNav(path);
        updateStatusBar(path);
    }, 50);
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

// ================== 初始化：恢复上次访问的路由 ==================
function initRouter() {
    // 先尝试从 localStorage 恢复上次路由
    const lastRoute = restoreState();
    // 如果当前 hash 为空或为默认，就跳转到上次路由
    if (!window.location.hash || window.location.hash === '#/home') {
        window.location.hash = `#/${lastRoute}`;
    } else {
        // 否则加载当前 hash 对应的路由
        const path = getHashPath();
        loadView(path);
    }
}

// 监听 hash 变化
window.addEventListener('hashchange', () => {
    const path = getHashPath();
    loadView(path);
});

// 首次加载
window.addEventListener('DOMContentLoaded', initRouter);
