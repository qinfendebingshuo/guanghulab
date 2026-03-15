// main.js - 主逻辑（增强版）

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始渲染
    refreshDashboard();
    
    // 搜索功能（带防抖和动画）
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let searchTimer;
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimer);
            
            // 添加输入时的微动效
            this.style.transform = 'scale(1.02)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
            
            searchTimer = setTimeout(() => {
                applyFilters();
            }, 300);
        });
    }
    
    // 筛选按钮
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // 按钮点击动画
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
            
            // 更新按钮状态
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // 应用筛选
            applyFilters();
        });
    });
    
    // 卡片点击事件（使用事件委托）
    document.addEventListener('click', function(e) {
        const card = e.target.closest('.dev-card');
        if (card) {
            const devId = card.dataset.devId;
            if (devId && window.showDetailPage) {
                // 添加点击动画
                card.style.transform = 'scale(0.98)';
                card.style.opacity = '0.8';
                
                setTimeout(() => {
                    card.style.transform = '';
                    card.style.opacity = '';
                    window.showDetailPage(devId);
                }, 150);
            }
        }
    });
    
    // 键盘导航
    document.addEventListener('keydown', function(e) {
        // 获取所有可聚焦的卡片
        const cards = Array.from(document.querySelectorAll('.dev-card'));
        const currentIndex = cards.indexOf(document.activeElement);
        
        // Tab键（默认行为已支持，我们只加样式）
        if (e.key === 'Tab') {
            setTimeout(() => {
                const focused = document.activeElement;
                if (focused.classList.contains('dev-card')) {
                    focused.style.outline = '3px solid #ffd700';
                    focused.style.transform = 'scale(1.02)';
                }
            }, 50);
        }
        
        // 箭头键导航
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || 
            e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            
            if (cards.length === 0) return;
            
            const cols = Math.floor(document.querySelector('.developers-grid').offsetWidth / 300);
            let nextIndex;
            
            if (e.key === 'ArrowRight') {
                nextIndex = currentIndex + 1;
            } else if (e.key === 'ArrowLeft') {
                nextIndex = currentIndex - 1;
            } else if (e.key === 'ArrowDown') {
                nextIndex = currentIndex + cols;
            } else if (e.key === 'ArrowUp') {
                nextIndex = currentIndex - cols;
            }
            
            if (nextIndex >= 0 && nextIndex < cards.length) {
                cards[nextIndex].focus();
            }
        }
        
        // Enter/Space 打开详情
        if (e.key === 'Enter' || e.key === ' ') {
            const target = e.target.closest('.dev-card');
            if (target) {
                e.preventDefault();
                const devId = target.dataset.devId;
                if (devId && window.showDetailPage) {
                    window.showDetailPage(devId);
                }
            }
        }
        
        // ESC返回总览
        if (e.key === 'Escape') {
            const detail = document.getElementById('detail-container');
            if (detail && detail.style.display !== 'none' && window.hideDetailPage) {
                window.hideDetailPage();
            }
        }
    });
    
    // 失去焦点时移除高亮
    document.addEventListener('blur', function(e) {
        if (e.target.classList.contains('dev-card')) {
            e.target.style.outline = '';
            e.target.style.transform = '';
        }
    }, true);
});

// 应用搜索和筛选
function applyFilters() {
    const searchTerm = document.getElementById('search-input')?.value || '';
    const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    
    // 获取筛选后的开发者
    const filtered = filterDevelopers(searchTerm, activeFilter);
    
    // 重新渲染卡片
    const grid = document.getElementById('developers-grid');
    if (grid) {
        // 添加淡出动画
        grid.style.opacity = '0.5';
        
        setTimeout(() => {
            if (filtered.length === 0) {
                // 显示无结果提示
                grid.innerHTML = '<div class="no-results">🔍 没有找到匹配的开发者</div>';
            } else {
                grid.innerHTML = renderDeveloperCards(filtered);
                
                // 添加展开/收起动画
                Array.from(grid.children).forEach((card, index) => {
                    card.style.animation = `cardPopIn 0.3s ease ${index * 0.05}s forwards`;
                    card.style.opacity = '0';
                    setTimeout(() => {
                        card.style.opacity = '1';
                    }, 50 + index * 20);
                });
            }
            
            grid.style.opacity = '1';
        }, 200);
    }
    
    // 更新排行榜（排行榜不筛选，但高亮匹配项）
    const ranking = document.getElementById('ranking-list');
    if (ranking) {
        const allDevs = getDevelopers();
        ranking.innerHTML = renderRanking(allDevs);
        
        // 高亮筛选出的开发者
        if (filtered.length < allDevs.length && filtered.length > 0) {
            const filteredIds = filtered.map(d => d.id);
            document.querySelectorAll('.ranking-item').forEach(item => {
                const nameEl = item.querySelector('.rank-name');
                if (nameEl) {
                    const dev = allDevs.find(d => d.name === nameEl.textContent);
                    if (dev && filteredIds.includes(dev.id)) {
                        item.classList.add('match-highlight');
                        
                        // 添加数字滚动动画
                        const winsEl = item.querySelector('.rank-wins');
                        if (winsEl) {
                            const oldValue = parseInt(winsEl.textContent) || 0;
                            animateNumber(winsEl, oldValue, dev.wins, 500);
                        }
                    } else {
                        item.classList.remove('match-highlight');
                    }
                }
            });
        } else {
            document.querySelectorAll('.ranking-item').forEach(item => {
                item.classList.remove('match-highlight');
            });
        }
    }
}

// 数字滚动动画
function animateNumber(element, start, end, duration = 1000) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 缓动函数
        const easeOutQuart = 1 - Math.pow(1 - progress, 3);
        current = start + (range * easeOutQuart);
        
        element.textContent = Math.round(current) + (element.textContent.includes('连胜') ? '连胜' : '');
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = end + (element.textContent.includes('连胜') ? '连胜' : '');
        }
    }
    
    requestAnimationFrame(update);
}

// 导出函数
window.applyFilters = applyFilters;
window.animateNumber = animateNumber;
