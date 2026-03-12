// radar.js - 雷达图绘制
function drawRadarChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;
    
    const dimensions = ['EXE', 'TEC', 'SYS', 'COL', 'INI'];
    const angleStep = (Math.PI * 2) / dimensions.length;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 绘制背景网格
    ctx.strokeStyle = '#2a3040';
    ctx.lineWidth = 1;
    
    // 绘制5层同心圆
    for (let level = 1; level <= 5; level++) {
        ctx.beginPath();
        for (let i = 0; i <= dimensions.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const x = centerX + radius * (level / 5) * Math.cos(angle);
            const y = centerY + radius * (level / 5) * Math.sin(angle);
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = '#2a3040';
        ctx.stroke();
    }
    
    // 绘制轴线
    for (let i = 0; i < dimensions.length; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = '#3a4050';
        ctx.stroke();
        
        // 标注维度
        const labelX = centerX + (radius + 15) * Math.cos(angle);
        const labelY = centerY + (radius + 15) * Math.sin(angle);
        ctx.fillStyle = '#4a9eff';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(dimensions[i], labelX, labelY);
    }
    
    // 绘制数据
    if (data) {
        ctx.beginPath();
        for (let i = 0; i < dimensions.length; i++) {
            const value = data[dimensions[i]] || 0;
            const angle = i * angleStep - Math.PI / 2;
            const r = radius * (value / 100);
            const x = centerX + r * Math.cos(angle);
            const y = centerY + r * Math.sin(angle);
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(74, 158, 255, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // 绘制数据点
        for (let i = 0; i < dimensions.length; i++) {
            const value = data[dimensions[i]] || 0;
            const angle = i * angleStep - Math.PI / 2;
            const r = radius * (value / 100);
            const x = centerX + r * Math.cos(angle);
            const y = centerY + r * Math.sin(angle);
            
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.strokeStyle = '#4a9eff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}

// 渲染雷达图HTML（供detail.js调用）
function renderRadarChart(pcaData, size = 'normal') {
    const canvasId = 'radar-' + Math.random().toString(36).substr(2, 9);
    const width = size === 'large' ? 400 : 300;
    const height = size === 'large' ? 300 : 250;
    
    setTimeout(() => {
        const canvas = document.getElementById(canvasId);
        if (canvas) drawRadarChart(canvas.id, pcaData);
    }, 100);
    
    return `<canvas id="${canvasId}" width="${width}" height="${height}" style="width:100%; height:auto;"></canvas>`;
}

// 导出函数
window.drawRadarChart = drawRadarChart;
window.renderRadarChart = renderRadarChart;
