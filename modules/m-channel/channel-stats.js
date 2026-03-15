// 频道使用统计管理
window.ChannelStats = {
    // 初始化
    init: function() {
        console.log('[stats] 初始化');
        this.bindEvents();
    },
    
    // 绑定事件
    bindEvents: function() {
        if (!window.EventBus) return;
        
        // 监听模块加载，开始计时
        EventBus.on('module:loaded', (data) => {
            if (data && data.module) {
                this.recordView(data.module);
            }
        });
        
        // 监听模块卸载，结束计时
        EventBus.on('module:unloaded', (data) => {
            if (data && data.module) {
                if (window.ChannelPreferences) {
                    ChannelPreferences.stopTiming(data.module);
                }
            }
        });
        
        // 监听页面关闭，停止所有计时
        window.addEventListener('beforeunload', () => {
            if (window.ChannelPreferences && window.ChannelPreferences.timing) {
                Object.keys(ChannelPreferences.timing).forEach(moduleId => {
                    ChannelPreferences.stopTiming(moduleId);
                });
            }
        });
    },
    
    // 记录模块访问
    recordView: function(moduleId) {
        if (!window.ChannelPreferences) return;
        
        // 记录使用次数和开始计时
        ChannelPreferences.recordUsage(moduleId);
        
        // 发送事件
        if (window.EventBus) {
            EventBus.emit('stats:recorded', { 
                module: moduleId, 
                time: Date.now() 
            });
        }
    },
    
    // 获取统计报告
    getStatsReport: function() {
        if (!window.ChannelPreferences) return {};
        
        const stats = ChannelPreferences.getStats();
        const modules = window.ModuleRegistry ? ModuleRegistry.list() : [];
        
        // 格式化统计数据
        const report = {
            totalViews: 0,
            mostUsed: null,
            lastUsed: null,
            moduleDetails: {}
        };
        
        let maxCount = 0;
        let lastTime = 0;
        
        modules.forEach(moduleId => {
            const moduleStats = stats[moduleId] || { count: 0, lastUsed: null, totalTime: 0 };
            report.moduleDetails[moduleId] = {
                count: moduleStats.count,
                lastUsed: moduleStats.lastUsed ? new Date(moduleStats.lastUsed).toLocaleString() : '从未使用',
                totalTime: moduleStats.totalTime ? this.formatTime(moduleStats.totalTime) : '0秒'
            };
            
            report.totalViews += moduleStats.count;
            
            if (moduleStats.count > maxCount) {
                maxCount = moduleStats.count;
                report.mostUsed = moduleId;
            }
            
            if (moduleStats.lastUsed && moduleStats.lastUsed > lastTime) {
                lastTime = moduleStats.lastUsed;
                report.lastUsed = moduleId;
            }
        });
        
        return report;
    },
    
    // 格式化时间（秒 -> 可读格式）
    formatTime: function(seconds) {
        if (seconds < 60) return `${Math.round(seconds)}秒`;
        if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const secs = Math.round(seconds % 60);
            return `${minutes}分${secs}秒`;
        }
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}小时${minutes}分`;
    },
    
    // 渲染统计面板
    renderStatsPanel: function(container) {
        if (!container) return;
        
        const report = this.getStatsReport();
        const modules = window.ModuleRegistry ? ModuleRegistry.list() : [];
        
        let html = `
            <div class="stats-panel">
                <h3>📊 使用统计</h3>
                <div class="stats-summary">
                    <div class="stat-item">
                        <span class="stat-label">总访问次数：</span>
                        <span class="stat-value">${report.totalViews}</span>
                    </div>
                    ${report.mostUsed ? `
                    <div class="stat-item">
                        <span class="stat-label">最常用模块：</span>
                        <span class="stat-value">${this.getModuleName(report.mostUsed)} (${report.moduleDetails[report.mostUsed]?.count || 0}次)</span>
                    </div>
                    ` : ''}
                    ${report.lastUsed ? `
                    <div class="stat-item">
                        <span class="stat-label">最近使用：</span>
                        <span class="stat-value">${this.getModuleName(report.lastUsed)}</span>
                    </div>
                    ` : ''}
                </div>
                
                <h4>模块详情</h4>
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>模块</th>
                            <th>访问次数</th>
                            <th>累计使用时长</th>
                            <th>最后使用</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        modules.forEach(moduleId => {
            const detail = report.moduleDetails[moduleId] || { count: 0, totalTime: '0秒', lastUsed: '从未使用' };
            html += `
                <tr>
                    <td>${this.getModuleName(moduleId)}</td>
                    <td>${detail.count}</td>
                    <td>${detail.totalTime}</td>
                    <td>${detail.lastUsed}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
                <div class="stats-actions">
                    <button id="reset-stats-btn" class="stats-reset-btn">重置统计数据</button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // 绑定重置按钮
        const resetBtn = document.getElementById('reset-stats-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('确定要重置所有统计数据吗？')) {
                    this.resetStats();
                }
            });
        }
    },
    
    // 获取模块显示名称
    getModuleName: function(moduleId) {
        const names = {
            'm06': '工单管理',
            'm08': '数据统计',
            'm11': '组件库',
            'home': '首页',
            'debug': '调试面板'
        };
        return names[moduleId] || moduleId;
    },
    
    // 重置统计
    resetStats: function() {
        if (!window.ChannelPreferences) return;
        
        const config = ChannelPreferences.config;
        if (config) {
            config.stats = {};
            ChannelPreferences.save();
            
            if (window.EventBus) {
                EventBus.emit('stats:reset');
            }
            
            alert('统计数据已重置');
            
            // 重新渲染统计面板
            const container = document.querySelector('.stats-panel-container');
            if (container) {
                this.renderStatsPanel(container);
            }
        }
    },
    
    // 注入样式
    injectStyles: function() {
        const style = document.createElement('style');
        style.textContent = `
            .stats-panel {
                padding: 20px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .stats-summary {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin: 20px 0;
                padding: 16px;
                background: #f8fafc;
                border-radius: 8px;
            }
            .stat-item {
                font-size: 14px;
            }
            .stat-label {
                color: #64748b;
            }
            .stat-value {
                font-weight: 600;
                color: #0f172a;
                margin-left: 8px;
            }
            .stats-table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }
            .stats-table th,
            .stats-table td {
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid #e2e8f0;
            }
            .stats-table th {
                background: #f1f5f9;
                font-weight: 600;
                color: #334155;
            }
            .stats-table tr:hover {
                background: #f8fafc;
            }
            .stats-actions {
                text-align: right;
                margin-top: 20px;
            }
            .stats-reset-btn {
                padding: 8px 16px;
                background: #ef4444;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
            }
            .stats-reset-btn:hover {
                background: #dc2626;
            }
        `;
        document.head.appendChild(style);
    }
};

// 自动注入样式
setTimeout(() => {
    if (window.ChannelStats) {
        ChannelStats.injectStyles();
    }
}, 100);

console.log('[stats] 已加载');
