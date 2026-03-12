// 频道标签过滤
document.querySelectorAll('.channel-tag').forEach(tag => {
  tag.addEventListener('click', () => {
    const channel = tag.dataset.channel;
    document.querySelectorAll('.announcement').forEach(ann => {
      ann.style.display = channel === 'all' || ann.dataset.channel === channel ? 'block' : 'none';
    });
  });
});

// 置顶悬浮动画
document.querySelectorAll('.pin-icon').forEach(pin => {
  pin.addEventListener('click', () => {
    const announcement = pin.closest('.announcement');
    announcement.classList.toggle('pinned');
  });
});

// ✨ 动态数据加载（M24 核心！）
fetch('data.json')
  .then(response => response.json())
  .then(data => {
    const announcements = document.querySelector('.announcements-container');
    announcements.innerHTML = '';
    
    data.forEach(item => {
      const announcement = document.createElement('div');
      announcement.className = nnouncement ;
      announcement.dataset.channel = item.channel;
      announcement.innerHTML = 
        <div class="announcement-content">
          <h3></h3>
          <p></p>
        </div>
        <i class="pin-icon"></i>
      ;
      announcements.appendChild(announcement);
    });
    
    // 重新绑定事件
    document.querySelectorAll('.pin-icon').forEach(pin => {
      pin.addEventListener('click', () => {
        const announcement = pin.closest('.announcement');
        announcement.classList.toggle('pinned');
        pin.textContent = announcement.classList.contains('pinned') ? '⭐' : '✨';
      });
    });
  });
