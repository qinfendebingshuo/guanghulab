// module-lifecycle.js
// 模块生命周期管理

const ModuleLifecycle = {
    // 当前激活的模块
    currentModule: null,

    // 加载模块
    async load(moduleName, containerId) {
        console.log(`[lifecycle] 开始加载模块: ${moduleName}`);

        // 如果有当前模块，先卸载
        if (this.currentModule) {
            await this.unload(this.currentModule.name);
        }

        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`[lifecycle] 容器不存在: ${containerId}`);
            return;
        }

        try {
            // 假设模块的 HTML 放在 mock-modules/ 下
            const resp = await fetch(`mock-modules/${moduleName}.html`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const html = await resp.text();
            container.innerHTML = html;

            // 记录当前模块
            this.currentModule = {
                name: moduleName,
                containerId: containerId,
                loadedAt: new Date()
            };

            // 触发模块的 onLoad 钩子（如果定义了）
            if (window[`onModuleLoad_${moduleName}`]) {
                window[`onModuleLoad_${moduleName}`]();
            }

            console.log(`[lifecycle] 模块加载完成: ${moduleName}`);
            return this.currentModule;
        } catch (err) {
            console.error(`[lifecycle] 加载模块失败 ${moduleName}:`, err);
            container.innerHTML = `<div class="error">加载模块 ${moduleName} 失败</div>`;
        }
    },

    // 卸载当前模块
    async unload(moduleName) {
        if (!this.currentModule || this.currentModule.name !== moduleName) {
            console.log(`[lifecycle] 模块 ${moduleName} 未激活，无需卸载`);
            return;
        }

        console.log(`[lifecycle] 开始卸载模块: ${moduleName}`);

        // 触发模块的 onUnload 钩子（如果定义了）
        if (window[`onModuleUnload_${moduleName}`]) {
            window[`onModuleUnload_${moduleName}`]();
        }

        // 取消该模块订阅的所有事件（约定：模块的事件名前缀为模块名）
        // 这里简单演示，实际可能需要更精细的管理
        Object.keys(EventBus.events).forEach(eventName => {
            if (eventName.startsWith(moduleName)) {
                EventBus.off(eventName);
            }
        });

        // 清空容器
        const container = document.getElementById(this.currentModule.containerId);
        if (container) {
            container.innerHTML = '';
        }

        this.currentModule = null;
        console.log(`[lifecycle] 模块卸载完成: ${moduleName}`);
    },

    // 发送消息给指定模块（通过事件总线）
    sendMessage(targetModule, eventName, data) {
        const fullEventName = `${targetModule}:${eventName}`;
        EventBus.emit(fullEventName, data);
        console.log(`[lifecycle] 发送消息给 ${targetModule}: ${eventName}`, data);
    }
};

window.ModuleLifecycle = ModuleLifecycle;
