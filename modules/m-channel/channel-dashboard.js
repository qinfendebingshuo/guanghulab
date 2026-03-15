
/**
 * channel-dashboard.js
 * 频道数据面板逻辑·图表渲染
 */

const ChannelDashboard = (function() {
    // 配色方案
    const COLORS = ['#4fc3f7', '#ffb74d', '#ff8a80', '#aed581', '#ba68c8', '#4dd0e1', '#ffd54f'];

    // 柱状图渲染
    function renderBarChart() {
        const container = document.getElementById('visitBarChart');
        if (!container) return;
        const data = ChannelAnalytics.getAllData();
        const modules = data.modules;
        const keys = Object.keys(modules);
        if (keys.length === 0) {
            container.innerHTML = '<p style="color:#666;text-align:center;width:100%;">暂无数据，多点几个模块再来看</p>';
            return;
        }
        const maxVisits = Math.max.apply(null, keys.map(function(k) { return modules[k].visits; })) || 1;
        let html = '';
        keys.forEach(function(id, i) {
            const mod = modules[id];
            const height = Math.max(4, (mod.visits / maxVisits) * 180);
            const color = COLORS[i % COLORS.length];
            html += '<div class="bar-item">' +
                '<span class="bar-value">' + mod.visits + '</span>' +
                '<div class="bar-fill" style="height:' + height + 'px;background:' + color + ';"></div>' +
                '<span class="bar-label">' + id.replace('m-', '') + '</span>' +
                '</div>';
        });
        container.innerHTML = html;
    }

    // 饼图渲染
    function renderPieChart() {
        const canvas = document.getElementById('pieCanvas');
        const legendEl = document.getElementById('pieLegend');
        if (!canvas || !legendEl) return;
        const ctx = canvas.getContext('2d');
        const data = ChannelAnalytics.getAllData();
        const modules = data.modules;
        const keys = Object.keys(modules);
        const total = keys.reduce(function(sum, k) {
            return sum + (modules[k].totalDuration || 0);
        }, 0);

        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (total === 0 || keys.length === 0) {
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(80, 80, 70, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#666';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('暂无数据', 80, 84);
            legendEl.innerHTML = '';
            return;
        }

        let startAngle = -Math.PI / 2;
        let legendHtml = '';
        keys.forEach(function(id, i) {
            const mod = modules[id];
            const pct = mod.totalDuration / total;
            const sweep = pct * Math.PI * 2;
            const color = COLORS[i % COLORS.length];

            ctx.beginPath();
            ctx.moveTo(80, 80);
            ctx.arc(80, 80, 70, startAngle, startAngle + sweep);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            startAngle += sweep;

            const minutes = Math.round(mod.totalDuration / 60);
            const pctStr = Math.round(pct * 100);
            legendHtml += '<li><span class="dot" style="background:' + color + ';"></span>' +
                id.replace('m-', '') + ' ' + pctStr + '% (' + minutes + '分钟)</li>';
        });
        legendEl.innerHTML = legendHtml;
    }

    // 折线图渲染
    function renderLineChart() {
        const canvas = document.getElementById('lineCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const trend = ChannelAnalytics.getWeeklyTrend();
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        const maxVal = Math.max.apply(null, trend.map(function(t) { return t.visits; })) || 1;
        const padLeft = 40;
        const padBottom = 30;
        const padTop = 10;
        const chartW = w - padLeft - 20;
        const chartH = h - padBottom - padTop;
        const stepX = chartW / (trend.length - 1 || 1);

        // 网格线
        ctx.strokeStyle = '#2a2a4a';
        ctx.lineWidth = 1;
        for (let g = 0; g <= 4; g++) {
            let gy = padTop + (chartH / 4) * g;
            ctx.beginPath();
            ctx.moveTo(padLeft, gy);
            ctx.lineTo(w - 20, gy);
            ctx.stroke();
        }

        // 折线
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        trend.forEach(function(t, i) {
            let x = padLeft + stepX * i;
            let y = padTop + chartH - (t.visits / maxVal) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // 数据点
        trend.forEach(function(t, i) {
            let x = padLeft + stepX * i;
            let y = padTop + chartH - (t.visits / maxVal) * chartH;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#4fc3f7';
            ctx.fill();
        });

        // 标签
        ctx.fillStyle = '#aaa';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        trend.forEach(function(t, i) {
            let x = padLeft + stepX * i;
            let y = padTop + chartH + 15;
            ctx.fillText(t.date.slice(5), x, y);
        });
    }

    // 性能表格渲染
    function renderPerfTable() {
        const tbody = document.getElementById('perfTableBody');
        if (!tbody) return;
        const data = ChannelAnalytics.getAllData();
        const modules = data.modules;
        const keys = Object.keys(modules);
        if (keys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#666;">暂无数据</td></tr>';
            return;
        }

        let html = '';
        keys.forEach(function(id) {
            const mod = modules[id];
            const avgLoad = mod.loadTimes.length ?
                Math.round(mod.loadTimes.reduce((a, b) => a + b, 0) / mod.loadTimes.length) : 0;
            const minutes = Math.round(mod.totalDuration / 60);
            const statusClass = avgLoad > 300 ? 'slow' : '';
            const statusText = avgLoad > 300 ? '⚠️ 慢' : '✅ 正常';

            html += '<tr>' +
                '<td>' + id.replace('m-', '') + '</td>' +
                '<td>' + mod.visits + '</td>' +
                '<td>' + minutes + '分钟</td>' +
                '<td class="' + statusClass + '">' + avgLoad + 'ms</td>' +
                '<td class="' + statusClass + '">' + statusText + '</td>' +
                '</tr>';
        });
        tbody.innerHTML = html;
    }

    // 公开方法
    return {
        render: function() {
            renderBarChart();
            renderPieChart();
            renderLineChart();
            renderPerfTable();
        },
        clearData: function() {
            if (confirm('确定清除所有统计数据吗？')) {
                ChannelAnalytics.clearAll();
                this.render();
                console.log('🗑️ 数据已清除，图表已重置');
            }
        }
    };
})();
