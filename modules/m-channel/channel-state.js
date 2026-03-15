// 状态管理（localStorage）
window.ChannelState = {
    STORAGE_KEY: 'hololake_channel_state',
    
    // 保存状态
    saveState: function(state) {
        const data = {
            ...state,
            timestamp: Date.now(),
            visited: state.visited || []
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        console.log('[state] 保存状态:', data);
    },
    
    // 恢复状态
    restoreState: function() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (!saved) return null;
        try {
            const state = JSON.parse(saved);
            console.log('[state] 恢复状态:', state);
            return state;
        } catch (e) {
            console.error('[state] 解析失败:', e);
            return null;
        }
    },
    
    // 标记已访问
    markVisited: function(channel) {
        const state = this.restoreState() || { visited: [] };
        if (!state.visited.includes(channel)) {
            state.visited.push(channel);
            this.saveState(state);
        }
    },
    
    // 清除状态
    clearState: function() {
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('[state] 已清除');
    }
};
