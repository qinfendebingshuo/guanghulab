// 模块适配器核心 - 万能转接头
window.ModuleAdapter = {
    // 已加载的真实模块缓存
    loadedModules: {},
    
    // 适配器配置
    config: {
        m06: {
            name: '工单管理',
            path: '/m06-ticket/index.html',      // 真实路径，但文件可能不全
            width: '100%',
            height: '500px',
            events: ['ticket:create', 'ticket:update', 'ticket:delete']
        },
        m08: {
            name: '数据统计',
            path: '/modules/m08/index.html',      // 暂时未知，先保留错误路径触发边界
            width: '100%',
            height: '500px',
            events: ['stats:refresh', 'stats:export']
        },
        m11: {
            name: '组件库',
            path: '/m11-module/index.html',       // 正确路径！
            width: '100%',
            height: '600px',
            events: ['theme:change', 'component:select']
        }
    },
    
    // 加载真实模块（通过 iframe 沙箱）
    loadModule: function(moduleId, containerId) {
        console.log(`[adapter] 加载真实模块: ${moduleId}`);
        
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`[adapter] 容器 ${containerId} 不存在`);
            return null;
        }
        
        // 清理容器
        container.innerHTML = '';
        
        const config = this.config[moduleId];
        if (!config) {
            console.error(`[adapter] 未知模块: ${moduleId}`);
            container.innerHTML = `<div class="error-boundary">模块配置不存在</div>`;
            return null;
        }
        
        // 创建 iframe 沙箱（玻璃展柜）
        const iframe = document.createElement('iframe');
        iframe.src = config.path;
        iframe.style.width = config.width;
        iframe.style.height = config.height;
        iframe.style.border = 'none';
        iframe.style.borderRadius = '8px';
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
        iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
        
        // 添加加载指示器
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'module-loading';
        loadingDiv.textContent = `加载 ${config.name}...`;
        container.appendChild(loadingDiv);
        
        // iframe 加载完成后移除加载指示器
        iframe.onload = () => {
            loadingDiv.remove();
            console.log(`[adapter] ${moduleId} 加载完成`);
            
            // 建立跨框架通信桥梁
            this.setupMessageBridge(iframe, moduleId);
        };
        
        iframe.onerror = () => {
            loadingDiv.remove();
            container.innerHTML = `<div class="error-boundary">模块加载失败，请重试 <button onclick="ModuleAdapter.reloadModule('${moduleId}', '${containerId}')">重试</button></div>`;
        };
        
        container.appendChild(iframe);
        this.loadedModules[moduleId] = { iframe, containerId };
        
        return iframe;
    },
    
    // 重新加载模块（错误重试）
    reloadModule: function(moduleId, containerId) {
        console.log(`[adapter] 重新加载模块: ${moduleId}`);
        this.loadModule(moduleId, containerId);
    },
    
    // 建立消息桥梁（iframe 和主页通信）
    setupMessageBridge: function(iframe, moduleId) {
        // 监听来自 iframe 的消息
        window.addEventListener('message', function(event) {
            // 安全检查：确保消息来自正确的 iframe
            if (event.source !== iframe.contentWindow) return;
            
            const data = event.data;
            if (!data || !data.type) return;
            
            console.log(`[adapter] 收到来自 ${moduleId} 的消息:`, data);
            
            // 转发为事件总线消息
            if (window.EventBus) {
                EventBus.emit(`module:${moduleId}:message`, {
                    from: moduleId,
                    type: data.type,
                    payload: data.payload
                });
            }
        });
    },
    
    // 向模块发送消息
    sendMessage: function(moduleId, message) {
        const module = this.loadedModules[moduleId];
        if (!module || !module.iframe) {
            console.error(`[adapter] 模块 ${moduleId} 未加载`);
            return false;
        }
        
        module.iframe.contentWindow.postMessage(message, '*');
        return true;
    },
    
    // 卸载模块
    unloadModule: function(moduleId) {
        const module = this.loadedModules[moduleId];
        if (module) {
            const container = document.getElementById(module.containerId);
            if (container) container.innerHTML = '';
            delete this.loadedModules[moduleId];
            console.log(`[adapter] 卸载模块: ${moduleId}`);
        }
    }
};

console.log('[adapter] 模块适配器已加载');
