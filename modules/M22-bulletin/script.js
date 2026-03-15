// ===== script.js =====
// 知秋：主逻辑·动态渲染+错误处理+i18n+无障碍+骨架屏

(function() {
    // 状态变量
    let allBulletins = [];          // 所有公告（从API拿）
    let currentChannel = '全部';     // 当前频道（默认全部）
    let loading = false;            // 是否正在加载
    let error = null;               // 错误信息

    // DOM元素
    const container = document.querySelector('.bulletin-container');
    const channelTabs = document.querySelectorAll('.channel-tab');
    const skeletonContainer = document.getElementById('skeleton-container');

    // ========== 骨架屏控制 ==========
    function showSkeleton() {
        if (skeletonContainer) {
            skeletonContainer.style.display = 'block';
        }
    }

    function hideSkeleton() {
        if (skeletonContainer) {
            skeletonContainer.style.opacity = '0';
            skeletonContainer.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                skeletonContainer.style.display = 'none';
            }, 300);
        }
    }

    // 初始化
    async function init() {
        console.log("【知秋】M22公告栏·环节7启动");
        
        // 监听语言切换事件
        window.addEventListener('languagechange', () => {
            render();
        });

        await loadBulletins();
        render();
        setupEventListeners();
        setupLangSwitcher();
        setupKeyboardNavigation();
    }

    // 语言切换器
    function setupLangSwitcher() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                window.i18n.switchLang(lang);
                document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        const currentLang = window.i18n.currentLang;
        document.querySelectorAll('.lang-btn').forEach(btn => {
            if (btn.dataset.lang === currentLang) {
                btn.classList.add('active');
            }
        });
    }

    // 键盘导航
    function setupKeyboardNavigation() {
        const tabs = document.querySelectorAll('.channel-tab');
        
        tabs.forEach(tab => {
            tab.addEventListener('keydown', (e) => {
                const currentIndex = Array.from(tabs).findIndex(t => t === e.target);
                
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const nextIndex = (currentIndex + 1) % tabs.length;
                    tabs[nextIndex].focus();
                    tabs[nextIndex].click();
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                    tabs[prevIndex].focus();
                    tabs[prevIndex].click();
                } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.target.click();
                }
            });
        });
    }

    // 加载公告
    async function loadBulletins() {
        showSkeleton();              // 显示骨架屏
        loading = true;
        error = null;

        try {
            const data = await API.fetchBulletins();
            allBulletins = data;
            hideSkeleton();           // 数据到手，隐藏骨架屏
            loading = false;
            render();                  // 渲染真实内容
        } catch (err) {
            console.error("加载失败：", err);
            hideSkeleton();           // 出错也要隐藏骨架屏
            loading = false;
            error = "error";
            render();                  // 显示错误状态
        }
    }

    // 渲染公告列表
    function render() {
        if (!container) return;

        // 错误状态
        if (error) {
            const isOffline = !navigator.onLine;
            const offlineHint = isOffline ? window.i18n.t('offline') : '';
            
            container.innerHTML = `
                <div class="error-state" role="alert">
                    <p>😢 ${offlineHint}${window.i18n.t('error')}</p>
                    <button class="retry-btn" id="retryBtn">${window.i18n.t('retry')}</button>
                </div>
            `;
            const retryBtn = document.getElementById('retryBtn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    loadBulletins();
                });
            }
            return;
        }

        // 空数据状态
        if (allBulletins.length === 0) {
            container.innerHTML = `
                <div class="empty-state" role="status">
                    <p>${window.i18n.t('empty')}</p>
                </div>
            `;
            return;
        }

        // 正常渲染：根据频道筛选
        const filtered = currentChannel === '全部'
            ? allBulletins
            : allBulletins.filter(item => item.channel === currentChannel);

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state" role="status">
                    <p>${window.i18n.t('emptyChannel')}</p>
                </div>
            `;
            return;
        }

        // 渲染公告卡片
        let html = '';
        filtered.forEach((item, index) => {
            if (typeof createCard === 'function') {
                html += createCard(item);
            } else {
                html += `
                    <div class="bulletin-card" role="listitem" tabindex="0" aria-label="${item.title}">
                        <h3>${item.title}</h3>
                        <p>${item.content}</p>
                        <div class="meta">
                            <span class="channel">${item.channel}</span>
                            <span class="date">${item.date}</span>
                        </div>
                    </div>
                `;
            }
        });
        container.innerHTML = html;
    }

    // 频道切换事件
    function setupEventListeners() {
        channelTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                channelTabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                currentChannel = e.target.dataset.channel || '全部';
                render();
            });
        });
    }

    // 启动一切
    init();
})();
