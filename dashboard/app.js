// HoloLake 数据统计面板 · 交互脚本 v2（含导出 + 环形图）

window.addEventListener('load', function() {
  // 条形图动画
  setTimeout(function() {
    var bars = document.querySelectorAll('.bar-fill');
    bars.forEach(function(bar) {
      var percent = bar.getAttribute('data-percent');
      bar.style.width = percent + '%';
    });
  }, 300);

  // 柱状图动画
  setTimeout(function() {
    var trendBars = document.querySelectorAll('.trend-bar');
    trendBars.forEach(function(bar) {
      var height = bar.getAttribute('data-height');
      var fill = bar.querySelector('.trend-fill');
      fill.style.height = height + '%';
    });
  }, 600);

  // 环形图绘制函数
  function drawDonut(percentages) {
    var segments = document.querySelectorAll('.donut-segment');
    var total = 377; // 2 * Math.PI * 60 ≈ 377
    var cumulative = 0;
    segments.forEach(function(seg, i) {
      var value = percentages[i] || 0;
      var dashArray = (value / 100 * total) + ' ' + total;
      seg.setAttribute('stroke-dasharray', dashArray);
      seg.setAttribute('stroke-dashoffset', 0);
    });
  }

  // 当前选中的时间范围
  var currentRange = 'today';

  // 模拟数据
  var mockData = {
    today: {
      users: '128', chats: '1,024', personas: '6', api: '3,892',
      bars: [72,15,8,3,2],
      trends: [45,62,38,78,55,90,85],
      donut: [72,15,8,3,2],
      apiTotal: '3,892'
    },
    week: {
      users: '128', chats: '6,847', personas: '6', api: '24,103',
      bars: [68,18,9,3,2],
      trends: [320,415,380,450,290,520,480],
      donut: [68,18,9,3,2],
      apiTotal: '24,103'
    },
    month: {
      users: '128', chats: '28,392', personas: '6', api: '98,741',
      bars: [65,20,10,3,2],
      trends: [1200,1450,1100,1680,1320,1890,1750],
      donut: [65,20,10,3,2],
      apiTotal: '98,741'
    }
  };

  // 更新所有图表和数字
  function updateStats(range) {
    currentRange = range;
    var data = mockData[range];

    // 更新统计卡片
    var values = document.querySelectorAll('.stat-value');
    values[0].textContent = data.users;
    values[1].textContent = data.chats;
    values[2].textContent = data.personas;
    values[3].textContent = data.api;

    // 更新条形图
    var bars = document.querySelectorAll('.bar-fill');
    bars.forEach(function(bar, i) {
      bar.style.width = '0%';
      setTimeout(function() {
        bar.style.width = data.bars[i] + '%';
      }, 100);
    });

    // 更新百分比文字
    var barValues = document.querySelectorAll('.bar-value');
    data.bars.forEach(function(v, i) {
      barValues[i].textContent = v + '%';
    });

    // 更新柱状图
    var maxTrend = Math.max.apply(null, data.trends);
    var trendBars = document.querySelectorAll('.trend-bar');
    trendBars.forEach(function(bar, i) {
      var fill = bar.querySelector('.trend-fill');
      fill.style.height = '0%';
      setTimeout(function() {
        fill.style.height = Math.round(data.trends[i] / maxTrend * 90) + '%';
      }, 100);
    });

    // 更新环形图
    drawDonut(data.donut);
    document.querySelector('.donut-center-value').textContent = data.apiTotal;

    // 更新图例百分比
    var legendPercents = document.querySelectorAll('.legend-percent');
    data.donut.forEach(function(v, i) {
      legendPercents[i].textContent = v + '%';
    });
  }

  // 时间选择器切换
  var timeButtons = document.querySelectorAll('.time-btn');
  timeButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      timeButtons.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var range = btn.getAttribute('data-range');
      updateStats(range);
    });
  });

  // 初始化环形图（今日数据）
  drawDonut(mockData.today.donut);

  // 卡片点击高亮
  var cards = document.querySelectorAll('.stat-card');
  cards.forEach(function(card) {
    card.addEventListener('click', function() {
      cards.forEach(function(c) { c.style.borderColor = 'rgba(255,255,255,0.06)'; });
      card.style.borderColor = 'rgba(79, 195, 247, 0.5)';
    });
  });

  // CSV 导出功能
  var exportBtn = document.getElementById('exportBtn');
  var toast = document.getElementById('exportToast');

  exportBtn.addEventListener('click', function() {
    var data = mockData[currentRange];
    var models = ['DeepSeek', '通义千问', 'Kimi', '豆包', 'GPT/Claude'];
    var days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    var csv = '\uFEFF'; // BOM for Chinese support
    csv += 'HoloLake 数据统计报表\n';
    csv += '时间范围,' + currentRange + '\n';
    csv += '导出时间,' + new Date().toLocaleString('zh-CN') + '\n\n';

    csv += '【统计概览】\n';
    csv += '指标,数值,变化\n';
    csv += '总用户,' + data.users + ',↑12%\n';
    csv += '今日对话,' + data.chats + ',↑8%\n';
    csv += '活跃人格体,' + data.personas + ',—\n';
    csv += 'API调用,' + data.api + ',↓3%\n\n';

    csv += '【模型调用分布】\n';
    csv += '模型,占比\n';
    models.forEach(function(m, i) {
      csv += m + ',' + data.donut[i] + '%\n';
    });
    csv += '\n';

    csv += '【每日对话趋势】\n';
    csv += '日期,对话次数\n';
    days.forEach(function(d, i) {
      csv += d + ',' + data.trends[i] + '\n';
    });

    // 创建下载链接
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    var url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'hololake_stats_' + currentRange + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // 显示提示
    toast.classList.add('show');
    setTimeout(function() {
      toast.classList.remove('show');
    }, 2000);
  });

  console.log('HoloLake Analytics v2 · 交互已加载');
});
