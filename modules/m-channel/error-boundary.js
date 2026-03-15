// 错误边界 - 保险丝
window.ErrorBoundary = {
    // 包裹一个可能出错的渲染函数
    wrap: function(renderFn, fallbackComponent, moduleId) {
        return function(container) {
            try {
                return renderFn(container);
            } catch (error) {
                console.error(`[error-boundary] 模块 ${moduleId} 渲染失败:`, error);
                return this.showFallback(container, moduleId, error);
            }
        };
    },
    
    // 显示降级界面
    showFallback: function(container, moduleId, error) {
        if (!container) return;
        
        container.innerHTML = `
            <div class="error-boundary">
                <div class="error-icon">⚠️</div>
                <div class="error-message">
                    <h4>模块 ${moduleId} 加载失败</h4>
                    <p>${error.message || '未知错误'}</p>
                </div>
                <div class="error-actions">
                    <button onclick="ErrorBoundary.reloadModule('${moduleId}')" class="error-retry">
                        重试
                    </button>
                    <button onclick="ErrorBoundary.hideError(this)" class="error-dismiss">
                        忽略
                    </button>
                </div>
            </div>
        `;
        
        // 记录错误到事件总线
        if (window.EventBus) {
            EventBus.emit('module:error', {
                module: moduleId,
                error: error.message,
                time: Date.now()
            });
        }
    },
    
    // 重新加载模块（通过适配器）
    reloadModule: function(moduleId) {
        console.log(`[error-boundary] 尝试重载模块: ${moduleId}`);
        
        // 触发全局重载事件
        if (window.EventBus) {
            EventBus.emit('module:reload', { module: moduleId });
        }
        
        // 如果存在适配器，调用适配器的重载方法
        if (window.ModuleAdapter && window.ModuleAdapter.reloadModule) {
            const container = document.querySelector(`[data-module="${moduleId}"]`) || 
                             document.getElementById(`module-${moduleId}`);
            if (container) {
                ModuleAdapter.reloadModule(moduleId, container.id);
            }
        } else {
            // 否则直接刷新页面（简易方案）
            location.reload();
        }
    },
    
    // 隐藏错误（仅当用户点击“忽略”时）
    hideError: function(btn) {
        const errorDiv = btn.closest('.error-boundary');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    },
    
    // 添加一些基础样式（会在 channel-style.css 中补充）
    injectStyles: function() {
        const style = document.createElement('style');
        style.textContent = `
            .error-boundary {
                padding: 30px;
                text-align: center;
                background: #fff3f3;
                border: 1px solid #ffcdd2;
                border-radius: 8px;
                margin: 20px 0;
            }
            .error-icon {
                font-size: 48px;
                margin-bottom: 15px;
            }
            .error-message h4 {
                color: #d32f2f;
                margin: 0 0 10px;
            }
            .error-message p {
                color: #666;
                margin: 0 0 20px;
            }
            .error-actions {
                display: flex;
                gap: 10px;
                justify-content: center;
            }
            .error-retry {
                padding: 8px 16px;
                background: #d32f2f;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            .error-dismiss {
                padding: 8px 16px;
                background: #9e9e9e;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
    }
};

// 自动注入样式
setTimeout(() => {
    if (window.ErrorBoundary) {
        ErrorBoundary.injectStyles();
    }
}, 100);

console.log('[error-boundary] 已加载');
