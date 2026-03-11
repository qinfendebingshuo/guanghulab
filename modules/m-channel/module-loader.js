// 模块加载器（带缓存、超时、错误处理）
const moduleCache = new Map();  // 缓存已加载的模块HTML

// 加载模块
async function loadModule(moduleId, containerId = 'module-display-area') {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 显示加载动画
    container.innerHTML = '<div class="loader" style="margin: 1rem auto;"></div>';

    // 检查缓存
    if (moduleCache.has(moduleId)) {
        console.log(`[cache hit] 模块 ${moduleId} 从缓存加载`);
        container.innerHTML = moduleCache.get(moduleId);
        return;
    }

    // 获取模块路径
    const modulePath = window.moduleRegistry?.[moduleId];
    if (!modulePath) {
        container.innerHTML = `<div class="error-message">❌ 模块 ID "${moduleId}" 未在注册表中找到</div>`;
        return;
    }

    // 设置超时（5秒）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(modulePath, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        // 存入缓存
        moduleCache.set(moduleId, html);
        console.log(`[cache miss] 模块 ${moduleId} 已加载并缓存`);

        container.innerHTML = html;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            container.innerHTML = `<div class="error-message">⏰ 加载超时（>5秒），请检查网络或文件是否存在</div>`;
        } else {
            container.innerHTML = `<div class="error-message">❌ 加载失败：${error.message}</div>`;
        }
    }
}

// 卸载模块（清空容器）
function unloadModule(containerId = 'module-display-area') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
        console.log(`[unload] 模块已卸载 (${containerId})`);
    }
}

// 导出
window.loadModule = loadModule;
window.unloadModule = unloadModule;
