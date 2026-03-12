// api.js - API配置和模拟数据切换

const CONFIG = {
    // API基础地址（页页的接口）
    BASE_URL: 'https://guanghulab.com/api',
    
    // 是否使用真实API（false = 使用模拟数据）
    USE_REAL_API: false,
    
    // API端点
    endpoints: {
        teamStatus: '/dashboard/team-status',
        developerDetail: '/dashboard/dev/',  // + id
        modules: '/dashboard/modules'
    }
};

// 检查API是否可用
async function checkApiAvailability() {
    if (!CONFIG.USE_REAL_API) return false;
    
    try {
        const response = await fetch(`${CONFIG.BASE_URL}/health`, {
            method: 'HEAD',
            mode: 'cors',
            cache: 'no-cache'
        });
        return response.ok;
    } catch (error) {
        console.log('API不可用，使用模拟数据');
        return false;
    }
}

// 获取团队状态
async function getTeamStatus() {
    if (CONFIG.USE_REAL_API) {
        try {
            const response = await fetch(`${CONFIG.BASE_URL}${CONFIG.endpoints.teamStatus}`);
            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (error) {
            console.warn('API请求失败，使用模拟数据');
        }
    }
    
    // 返回模拟数据
    return {
        developers: window.getDevelopers ? window.getDevelopers() : []
    };
}

// 获取开发者详情
async getDeveloperDetail(devId) {
    if (CONFIG.USE_REAL_API) {
        try {
            const response = await fetch(`${CONFIG.BASE_URL}${CONFIG.endpoints.developerDetail}${devId}`);
            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (error) {
            console.warn('API请求失败，使用模拟数据');
        }
    }
    
    // 返回模拟数据
    return window.getDeveloperById ? window.getDeveloperById(devId) : null;
}

// 导出配置
window.API = {
    CONFIG,
    checkApiAvailability,
    getTeamStatus,
    getDeveloperDetail
};
