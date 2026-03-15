function drawRadar(canvasId, pcaData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.35;
    
    ctx.clearRect(0, 0, w, h);
    
    const dims = [
        { label: '执行力', val: pcaData.exe || 0 },
        { label: '技术纵深', val: pcaData.tec || 0 },
        { label: '系统理解', val: pcaData.sys || 0 },
        { label: '协作力', val: pcaData.col || 0 },
        { label: '主动性', val: pcaData.ini || 0 }
    ];
    
    for (let lv = 1; lv <= 5; lv++) {
        const r = (maxR * lv) / 5;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = '#2d3748';
        ctx.stroke();
    }
    
    for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + maxR * Math.cos(angle), cy + maxR * Math.sin(angle));
        ctx.strokeStyle = '#4a5568';
        ctx.stroke();
    }
    
    ctx.fillStyle = '#cbd5e0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
        const x = cx + (maxR + 25) * Math.cos(angle);
        const y = cy + (maxR + 25) * Math.sin(angle);
        ctx.fillText(dims[i].label, x, y);
    }
    
    const points = [];
    for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
        const r = (dims[i].val / 100) * maxR;
        points.push({
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle)
        });
    }
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < 5; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 180, 216, 0.3)';
    ctx.fill();
    ctx.strokeStyle = '#00b4d8';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#00b4d8';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pcaData.total || '0', cx, cy - 10);
    
    ctx.font = 'bold 14px sans-serif';
    const colorInfo = getPCAColor(pcaData.total || 0);
    ctx.fillStyle = colorInfo.color;
    ctx.fillText(pcaData.level || 'C', cx, cy + 15);
}

async function loadRadarForDev(devId) {
    const pcaData = await getPCA(devId);
    if (pcaData) drawRadar('pca-canvas', pcaData);
}

function initRadar() {
    document.querySelectorAll('.dev-card').forEach(card => {
        card.addEventListener('click', () => {
            loadRadarForDev(card.dataset.devId);
        });
    });
    loadRadarForDev('DEV-004');
}

window.initRadar = initRadar;
window.loadRadarForDev = loadRadarForDev;
