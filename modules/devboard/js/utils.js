function formatDate(isoString) {
    if (!isoString) return '--:--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getStreakEmoji(count) {
    if (count >= 20) return '🔥🔥🔥';
    if (count >= 15) return '🔥🔥';
    if (count >= 10) return '🔥';
    if (count >= 5) return '⚡';
    if (count >= 3) return '👍';
    return '👣';
}

function getPCAColor(score) {
    if (score >= 90) return { color: '#FFD700', level: 'S', text: '传奇' };
    if (score >= 80) return { color: '#00B4D8', level: 'A', text: '精英' };
    if (score >= 70) return { color: '#10B981', level: 'B', text: '专家' };
    if (score >= 60) return { color: '#F59E0B', level: 'C', text: '熟手' };
    return { color: '#EF4444', level: 'D', text: '新手' };
}

function getStatusBadge(status) {
    const map = {
        'done': '✅ 已完成',
        'doing': '⚡ 进行中',
        'pending': '⏳ 待分配',
        'blocked': '⚠️ 阻塞'
    };
    return map[status] || '⏳ 待分配';
}

function formatNumber(num) {
    return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';
}
