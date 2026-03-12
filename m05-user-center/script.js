// HoloLake 用户中心 · 交互脚本

// 六个菜单的详情内容
const menuDetails = {
  '个人资料': {
    icon: '👤',
    title: '个人资料',
    content: `
      <div class="detail-item">
        <label>用户名</label>
        <span>光湖用户</span>
      </div>
      <div class="detail-item">
        <label>ID</label>
        <span>HL-000001</span>
      </div>
      <div class="detail-item">
        <label>邮箱</label>
        <span>user@hololake.com</span>
      </div>
      <div class="detail-item">
        <label>注册时间</label>
        <span>2026-03-01</span>
      </div>
      <div class="detail-item">
        <label>等级</label>
        <span>初级探索者</span>
      </div>
    `
  },
  '我的记忆': {
    icon: '🧠',
    title: '我的记忆',
    content: `
      <div class="memory-stats">
        <div class="stat-card">
          <span class="stat-num">128</span>
          <span class="stat-label">对话次数</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">3</span>
          <span class="stat-label">记忆主题</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">15</span>
          <span class="stat-label">收藏片段</span>
        </div>
      </div>
      <p class="memory-hint">✨ 你的记忆正在慢慢生长</p>
    `
  },
  'AI伙伴': {
    icon: '🤖',
    title: 'AI伙伴',
    content: `
      <div class="partner-card">
        <div class="partner-avatar">🧑‍💻</div>
        <div class="partner-info">
          <div class="partner-name">知秋宝宝</div>
          <div class="partner-status">🟢 在线</div>
          <div class="partner-desc">你的开发引导伙伴</div>
        </div>
      </div>
      <div class="partner-stats">
        <span>陪伴时长: 3天</span>
        <span>引导环节: 2个</span>
        <span>默契度: 98%</span>
      </div>
    `
  },
  '使用统计': {
    icon: '📊',
    title: '使用统计',
    content: `
      <div class="usage-item">
        <span class="usage-label">本月对话</span>
        <div class="usage-bar"><div class="usage-fill" style="width:65%"></div></div>
        <span class="usage-num">65次</span>
      </div>
      <div class="usage-item">
        <span class="usage-label">记忆使用</span>
        <div class="usage-bar"><div class="usage-fill" style="width:30%"></div></div>
        <span class="usage-num">30MB</span>
      </div>
      <div class="usage-item">
        <span class="usage-label">云盘空间</span>
        <div class="usage-bar"><div class="usage-fill" style="width:10%"></div></div>
        <span class="usage-num">1GB/10GB</span>
      </div>
    `
  },
  '安全设置': {
    icon: '🔐',
    title: '安全设置',
    content: `
      <div class="setting-item">
        <span>修改密码</span>
        <span class="setting-arrow">›</span>
      </div>
      <div class="setting-item">
        <span>两步验证</span>
        <span class="setting-status on">已开启</span>
      </div>
      <div class="setting-item">
        <span>登录设备管理</span>
        <span class="setting-arrow">›</span>
      </div>
      <div class="setting-item">
        <span>数据导出</span>
        <span class="setting-arrow">›</span>
      </div>
    `
  },
  '反馈建议': {
    icon: '💬',
    title: '反馈建议',
    content: `
      <div class="feedback-types">
        <button class="feedback-btn active">功能建议</button>
        <button class="feedback-btn">问题反馈</button>
        <button class="feedback-btn">其他</button>
      </div>
      <div class="feedback-area">
        <p class="feedback-placeholder">💡 你的每一条反馈都会被认真阅读</p>
        <p class="feedback-placeholder">📧 也可以发邮件到 feedback@hololake.com</p>
      </div>
    `
  }
};

// 页面加载完成后绑定事件
document.addEventListener('DOMContentLoaded', function() {
  const menuItems = document.querySelectorAll('.menu-item');
  
  menuItems.forEach(function(item) {
    item.addEventListener('click', function() {
      const menuText = item.querySelector('.menu-text').textContent;
      const detail = menuDetails[menuText];
      if (detail) {
        showDetail(detail);
      }
    });
  });
});

// 显示详情页
function showDetail(detail) {
  // 创建详情页容器
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  overlay.innerHTML = `
    <div class="detail-page">
      <div class="detail-header">
        <button class="back-btn" onclick="closeDetail()">← 返回</button>
        <span class="detail-title">${detail.icon} ${detail.title}</span>
      </div>
      <div class="detail-content">
        ${detail.content}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // 添加动画
  requestAnimationFrame(function() {
    overlay.classList.add('show');
  });
}

// 关闭详情页
function closeDetail() {
  const overlay = document.querySelector('.detail-overlay');
  if (overlay) {
    overlay.classList.remove('show');
    setTimeout(function() {
      overlay.remove();
    }, 300);
  }
}
