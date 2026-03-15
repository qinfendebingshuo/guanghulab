/**
 * 频道通知系统 - 环节7 (晨星陪伴版)
 * 功能：模块更新提醒、未读小红点、通知面板、高亮点击修复
 * 修改：通过卡片文字内容匹配模块ID（解决moduleId undefined问题）
 */

(function() {
  // ========== 初始化模拟数据 ==========
  const STORAGE_KEY = 'channel_notifications';
  
  // 默认模拟数据（基于已完成模块 M06, M08, M11, 以及当前频道模块）
  const DEFAULT_UPDATES = {
    'M06': {
      hasUpdate: true,
      count: 2,
      updates: [
        { time: '10:30', summary: '修复了拖拽排序的bug' },
        { time: '昨天', summary: '新增统计面板' }
      ]
    },
    'M08': {
      hasUpdate: true,
      count: 1,
      updates: [
        { time: '昨天', summary: '优化了模块加载性能' }
      ]
    },
    'M11': {
      hasUpdate: true,
      count: 3,
      updates: [
        { time: '15:20', summary: '新增键盘快捷键' },
        { time: '昨天', summary: '修复焦点管理' },
        { time: '3月10日', summary: '模块生命周期完善' }
      ]
    },
    'channel': {
      hasUpdate: true,
      count: 1,
      updates: [
        { time: '现在', summary: '通知系统上线啦！' }
      ]
    }
  };

  // 加载或初始化数据
  let notificationData = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (!notificationData) {
    notificationData = DEFAULT_UPDATES;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notificationData));
  }

  // ========== 工具函数：从卡片文字猜测模块ID ==========
  function guessModuleIdFromCard(card) {
    // 尝试找卡片里的标题文字
    const titleElem = card.querySelector('h3, .module-title, .card-title, .module-name');
    if (titleElem) {
      const text = titleElem.textContent.trim();
      // 简单映射：如果文字包含“工单” -> M06
      if (text.includes('工单')) return 'M06';
      if (text.includes('数据统计')) return 'M08';
      if (text.includes('组件库')) return 'M11';
      if (text.includes('调试面板')) return 'M11'; // 暂时用 M11
    }
    
    // 后备：用卡片内所有文字尝试匹配
    const fullText = card.textContent;
    if (fullText.includes('工单')) return 'M06';
    if (fullText.includes('数据统计')) return 'M08';
    if (fullText.includes('组件库')) return 'M11';
    
    return null; // 实在猜不到就返回 null
  }

  function getModuleCards() {
    return document.querySelectorAll('.module-card');
  }

  // ========== 更新标签渲染（带日志） ==========
  function renderUpdateBadges() {
    console.log('🟦 renderUpdateBadges 开始执行');
    const cards = document.querySelectorAll('.module-card');
    console.log('找到卡片数量:', cards.length);
    
    cards.forEach(card => {
      // 先尝试原有方法，失败则用猜测
      let moduleId = card.dataset.moduleId || card.id || card.querySelector('.module-name')?.textContent.trim();
      if (!moduleId) {
        moduleId = guessModuleIdFromCard(card);
      }
      console.log('卡片最终 moduleId:', moduleId);
      
      // 移除旧的标签
      const oldBadge = card.querySelector('.update-badge');
      if (oldBadge) oldBadge.remove();

      const modData = moduleId ? notificationData[moduleId] : null;
      console.log('模块数据:', moduleId, modData);
      
      if (modData && modData.hasUpdate) {
        console.log('✅ 应该添加标签的模块:', moduleId);
        const badge = document.createElement('span');
        badge.className = 'update-badge';
        badge.textContent = '有更新';
        // 内联样式保证可见
        badge.style.backgroundColor = '#2196f3';
        badge.style.color = 'white';
        badge.style.padding = '2px 8px';
        badge.style.borderRadius = '12px';
        badge.style.fontSize = '12px';
        badge.style.display = 'inline-block';
        badge.style.marginTop = '8px';
        // 直接追加到卡片末尾
        card.appendChild(badge);
        console.log('✅ 标签已追加到卡片', moduleId);
      } else {
        console.log('❌ 不需要添加标签的模块:', moduleId);
      }
    });
    console.log('🟦 renderUpdateBadges 执行完毕');
  }

  // ========== 小红点渲染 ==========
  function renderUnreadDots() {
    const cards = getModuleCards();
    cards.forEach(card => {
      let moduleId = card.dataset.moduleId || card.id || card.querySelector('.module-name')?.textContent.trim();
      if (!moduleId) {
        moduleId = guessModuleIdFromCard(card);
      }
      if (!moduleId) return;

      const oldDot = card.querySelector('.unread-dot');
      if (oldDot) oldDot.remove();

      const modData = notificationData[moduleId];
      if (modData && modData.hasUpdate && modData.count > 0) {
        const dot = document.createElement('span');
        dot.className = 'unread-dot';
        dot.textContent = modData.count > 9 ? '9+' : modData.count;
        card.appendChild(dot);
      }
    });
  }

  // ========== 标记模块已读 ==========
  function markModuleAsRead(moduleId) {
    if (notificationData[moduleId]) {
      notificationData[moduleId].hasUpdate = false;
      notificationData[moduleId].count = 0;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notificationData));
      renderUpdateBadges();
      renderUnreadDots();
      updateBellBadge();
      renderNotificationPanel();
    }
  }

  // ========== 铃铛相关 ==========
  let bellContainer, panel, overlay;
  let isPanelOpen = false;

  function createBell() {
    const header = document.querySelector('.channel-header') || document.querySelector('header') || document.body;
    bellContainer = document.createElement('div');
    bellContainer.className = 'bell-container';
    bellContainer.innerHTML = `
      <span class="bell-icon">🔔</span>
      <span class="bell-badge" style="display: none;">0</span>
    `;
    const title = header.querySelector('h1, h2');
    if (title) {
      title.insertAdjacentElement('afterend', bellContainer);
    } else {
      header.appendChild(bellContainer);
    }

    panel = document.createElement('div');
    panel.className = 'notification-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <span>通知中心</span>
        <button class="mark-all-read">全部已读</button>
      </div>
      <ul class="notification-list"></ul>
    `;
    overlay = document.createElement('div');
    overlay.className = 'panel-overlay';
    document.body.appendChild(panel);
    document.body.appendChild(overlay);

    bellContainer.addEventListener('click', togglePanel);
    overlay.addEventListener('click', closePanel);
    panel.querySelector('.mark-all-read').addEventListener('click', markAllRead);
  }

  function updateBellBadge() {
    const totalUnread = Object.values(notificationData).reduce((acc, mod) => acc + (mod.count || 0), 0);
    const badge = bellContainer?.querySelector('.bell-badge');
    if (badge) {
      if (totalUnread > 0) {
        badge.style.display = 'flex';
        badge.textContent = totalUnread > 9 ? '9+' : totalUnread;
      } else {
        badge.style.display = 'none';
      }
    }
  }

  function togglePanel(e) {
    e.stopPropagation();
    isPanelOpen ? closePanel() : openPanel();
  }

  function openPanel() {
    isPanelOpen = true;
    panel.classList.add('open');
    overlay.classList.add('show');
    renderNotificationPanel();
  }

  function closePanel() {
    isPanelOpen = false;
    panel.classList.remove('open');
    overlay.classList.remove('show');
  }

  function renderNotificationPanel() {
    const list = panel.querySelector('.notification-list');
    if (!list) return;

    let items = [];
    for (const [moduleId, modData] of Object.entries(notificationData)) {
      if (modData.updates && modData.updates.length > 0) {
        modData.updates.forEach((update) => {
          items.push({
            moduleId,
            time: update.time,
            summary: update.summary,
            read: !modData.hasUpdate
          });
        });
      }
    }

    if (items.length === 0) {
      list.innerHTML = '<li class="empty-state">暂无新通知</li>';
      return;
    }

    items.sort((a, b) => (a.time > b.time ? -1 : 1));

    list.innerHTML = items.map(item => `
      <li class="notification-item ${item.read ? 'read' : ''}" data-module="${item.moduleId}">
        <div class="notification-time">${item.time}</div>
        <div class="notification-module">${item.moduleId}</div>
        <div class="notification-summary">${item.summary}</div>
      </li>
    `).join('');

    list.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const moduleId = item.dataset.module;
        const card = findCardByModuleId(moduleId);
        if (card) {
          card.click();
        }
        markModuleAsRead(moduleId);
        closePanel();
      });
    });
  }

  function findCardByModuleId(moduleId) {
    const cards = getModuleCards();
    for (let card of cards) {
      let id = card.dataset.moduleId || card.id || card.querySelector('.module-name')?.textContent.trim();
      if (!id) id = guessModuleIdFromCard(card);
      if (id === moduleId) return card;
    }
    return null;
  }

  function markAllRead() {
    for (let moduleId in notificationData) {
      notificationData[moduleId].hasUpdate = false;
      notificationData[moduleId].count = 0;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notificationData));
    renderUpdateBadges();
    renderUnreadDots();
    updateBellBadge();
    renderNotificationPanel();
  }

  function fixHighlightClick() {
    const container = document.querySelector('.modules-grid') || document.body;
    container.addEventListener('click', (e) => {
      const card = e.target.closest('.module-card');
      if (card) {
        // 不做额外处理，只是确保事件冒泡
      }
    }, true);

    const style = document.createElement('style');
    style.textContent = `
      .search-highlight {
        pointer-events: none !important;
      }
      .module-card {
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    if (!document.querySelector('link[href*="channel-notifications.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'channel-notifications.css';
      document.head.appendChild(link);
    }

    renderUpdateBadges();
    renderUnreadDots();

    createBell();
    updateBellBadge();

    fixHighlightClick();

    document.addEventListener('click', (e) => {
      const card = e.target.closest('.module-card');
      if (card) {
        let moduleId = card.dataset.moduleId || card.id || card.querySelector('.module-name')?.textContent.trim();
        if (!moduleId) moduleId = guessModuleIdFromCard(card);
        if (moduleId) {
          setTimeout(() => markModuleAsRead(moduleId), 100);
        }
      }
    });

    window.addEventListener('modulesRendered', () => {
      renderUpdateBadges();
      renderUnreadDots();
    });

    let lastCardCount = 0;
    setInterval(() => {
      const cards = getModuleCards();
      if (cards.length !== lastCardCount) {
        lastCardCount = cards.length;
        renderUpdateBadges();
        renderUnreadDots();
      }
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
