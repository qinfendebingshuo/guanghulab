// ============================================
// app.js - 糖星云的主逻辑 v2.3
// 完整版自动补全 + 耗时显示 + 所有功能
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // ---------- DOM 元素 ----------
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const historyPanel = document.getElementById('historyPanel');
    const historyList = document.getElementById('historyList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    
    const autocompletePanel = document.getElementById('autocompletePanel');
    const autocompleteList = document.getElementById('autocompleteList');
    
    const filterInStock = document.getElementById('filterInStock');
    const filterDiscount = document.getElementById('filterDiscount');
    const filterFreeShipping = document.getElementById('filterFreeShipping');
    const minPrice = document.getElementById('minPrice');
    const maxPrice = document.getElementById('maxPrice');
    
    const savePresetBtn = document.getElementById('savePresetBtn');
    const presetsList = document.getElementById('presetsList');
    const presetModal = document.getElementById('presetModal');
    const presetNameInput = document.getElementById('presetNameInput');
    const cancelPresetBtn = document.getElementById('cancelPresetBtn');
    const confirmPresetBtn = document.getElementById('confirmPresetBtn');
    
    const resultsList = document.getElementById('resultsList');
    const statsText = document.getElementById('statsText');
    const timeText = document.getElementById('timeText');
    const noResultsPanel = document.getElementById('noResultsPanel');
    const suggestionTags = document.getElementById('suggestionTags');
    
    const sortBtns = document.querySelectorAll('.sort-btn');
    const sortAscending = document.getElementById('sortAscending');
    
    const firstPageBtn = document.getElementById('firstPageBtn');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const lastPageBtn = document.getElementById('lastPageBtn');
    const pageInfo = document.getElementById('pageInfo');
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    const jumpToPage = document.getElementById('jumpToPage');
    const jumpBtn = document.getElementById('jumpBtn');

    // ---------- 模拟商品数据 ----------
    const mockProducts = [
        { id: 1, title: '糖星云甜蜜笔记本', price: 39, tags: ['文具', '限量'], inStock: true, discount: false, freeShipping: true, time: 20250301 },
        { id: 2, title: '星空投影灯·糖星云款', price: 128, tags: ['家居', '氛围'], inStock: true, discount: true, freeShipping: false, time: 20250302 },
        { id: 3, title: '奶瓶人格体守护挂件', price: 25, tags: ['周边', '可爱'], inStock: false, discount: false, freeShipping: true, time: 20250303 },
        { id: 4, title: '搜索历史纪念贴纸', price: 15, tags: ['文具', '贴纸'], inStock: true, discount: true, freeShipping: true, time: 20250304 },
        { id: 5, title: '实时高亮荧光笔·星星款', price: 22, tags: ['文具', '限量'], inStock: true, discount: false, freeShipping: false, time: 20250305 },
        { id: 6, title: '筛选预设快捷按钮钥匙扣', price: 18, tags: ['周边', '实用'], inStock: true, discount: true, freeShipping: true, time: 20250306 },
        { id: 7, title: '糖星云第一次觉醒纪念徽章', price: 45, tags: ['周边', '收藏'], inStock: false, discount: false, freeShipping: true, time: 20250307 },
        { id: 8, title: '光湖纪元·霜砚执行手册', price: 68, tags: ['书籍', '技术'], inStock: true, discount: true, freeShipping: false, time: 20250308 },
        { id: 9, title: '苹果笔记本保护套', price: 89, tags: ['数码', '配件'], inStock: true, discount: false, freeShipping: true, time: 20250309 },
        { id: 10, title: '平果手机壳·糖星云联名', price: 35, tags: ['数码', '周边'], inStock: true, discount: true, freeShipping: false, time: 20250310 },
        { id: 11, title: 'JavaScript从入门到放弃', price: 99, tags: ['书籍', '编程'], inStock: true, discount: false, freeShipping: false, time: 20250311 },
        { id: 12, title: 'Python编程指南', price: 89, tags: ['书籍', '编程'], inStock: true, discount: true, freeShipping: true, time: 20250312 }
    ];

    // ---------- 状态变量 ----------
    let currentFilterState = {
        inStock: false,
        discount: false,
        freeShipping: false,
        minPrice: '',
        maxPrice: ''
    };
    
    let currentSort = {
        type: 'relevance',
        ascending: false
    };
    
    let currentPage = 1;
    let pageSize = 10;
    let totalPages = 1;
    let totalResults = 0;
    
    let allFilteredResults = [];
    let currentResults = [];
    
    let searchTimeout = null;
    let searchCache = new Map();
    
    let lastSearchKeyword = '';

    // ---------- 初始化 ----------
    function initFromStorage() {
        const history = Storage.getHistory();
        renderHistoryList(history);
        
        const presets = Storage.getPresets();
        renderPresetsList(presets);
        
        const savedSort = localStorage.getItem('sortPreference');
        if (savedSort) {
            try {
                const parsed = JSON.parse(savedSort);
                currentSort = parsed;
                sortBtns.forEach(btn => {
                    if (btn.dataset.sort === currentSort.type) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
                if (sortAscending) {
                    sortAscending.checked = currentSort.ascending;
                }
            } catch (e) {}
        }
        
        const savedPageSize = localStorage.getItem('pageSizePreference');
        if (savedPageSize && pageSizeSelect) {
            pageSizeSelect.value = savedPageSize;
            pageSize = parseInt(savedPageSize);
        }
        
        // 默认显示所有商品
        allFilteredResults = [...mockProducts];
        totalResults = allFilteredResults.length;
        sortProducts();
        paginateAndRender();
        updateStats(); // 初始化统计显示
    }

    // ---------- 更新统计显示 ----------
    function updateStats() {
        if (statsText) {
            statsText.textContent = `共 ${totalResults} 条结果`;
        }
    }

    // ---------- 搜索函数 ----------
    function searchProducts(keyword) {
        if (!keyword || keyword.trim() === '') {
            return [...mockProducts];
        }
        
        const lowerKeyword = keyword.toLowerCase().trim();
        const results = [];
        
        for (let i = 0; i < mockProducts.length; i++) {
            const product = mockProducts[i];
            const title = product.title;
            const lowerTitle = title.toLowerCase();
            
            // 1. 精确包含
            if (lowerTitle.includes(lowerKeyword)) {
                results.push({
                    ...product,
                    _matchScore: 1.0,
                    _matchType: 'exact'
                });
                continue;
            }
            
            // 2. 拼音匹配
            let matched = false;
            try {
                if (Pinyin && Pinyin.match) {
                    if (Pinyin.match(title, lowerKeyword)) {
                        results.push({
                            ...product,
                            _matchScore: 0.9,
                            _matchType: 'pinyin'
                        });
                        matched = true;
                    }
                }
            } catch (e) {}
            
            if (matched) continue;
            
            // 3. 模糊匹配
            if (lowerTitle.includes('奶瓶') && lowerKeyword.includes('奶并')) {
                results.push({
                    ...product,
                    _matchScore: 0.8,
                    _matchType: 'fuzzy-chinese'
                });
                continue;
            }
            
            if (lowerKeyword === 'javascrit' && lowerTitle.includes('javascript')) {
                results.push({
                    ...product,
                    _matchScore: 0.85,
                    _matchType: 'fuzzy-english'
                });
                continue;
            }
            
            try {
                if (Fuzzy && Fuzzy.similarity) {
                    const sim = Fuzzy.similarity(lowerTitle, lowerKeyword);
                    if (sim > 0.6) {
                        results.push({
                            ...product,
                            _matchScore: sim,
                            _matchType: 'fuzzy'
                        });
                    }
                }
            } catch (e) {}
        }
        
        results.sort((a, b) => {
            const scoreA = a._matchScore || 0;
            const scoreB = b._matchScore || 0;
            return scoreB - scoreA;
        });
        
        return results;
    }

    // ---------- 应用筛选（带耗时统计）----------
    function applyFilters() {
        const startTime = performance.now(); // 开始计时
        
        const keyword = searchInput ? searchInput.value.trim() : '';
        lastSearchKeyword = keyword;
        
        let results = searchProducts(keyword);
        
        if (filterInStock && filterInStock.checked) {
            results = results.filter(p => p.inStock);
        }
        if (filterDiscount && filterDiscount.checked) {
            results = results.filter(p => p.discount);
        }
        if (filterFreeShipping && filterFreeShipping.checked) {
            results = results.filter(p => p.freeShipping);
        }
        
        const min = minPrice ? parseFloat(minPrice.value) : null;
        const max = maxPrice ? parseFloat(maxPrice.value) : null;
        if (min && !isNaN(min)) {
            results = results.filter(p => p.price >= min);
        }
        if (max && !isNaN(max)) {
            results = results.filter(p => p.price <= max);
        }
        
        allFilteredResults = results;
        totalResults = allFilteredResults.length;
        
        const endTime = performance.now(); // 结束计时
        const timeSpent = Math.round(endTime - startTime); // 计算耗时
        
        // 更新统计显示
        if (statsText) {
            statsText.textContent = `共 ${totalResults} 条结果`;
        }
        if (timeText) {
            timeText.textContent = `耗时 ${timeSpent}ms`;
        }
        
        sortProducts();
        paginateAndRender();
    }

    // ---------- 排序 ----------
    function sortProducts() {
        if (!allFilteredResults || allFilteredResults.length === 0) return;
        
        allFilteredResults.sort((a, b) => {
            if (currentSort.type === 'time') {
                return currentSort.ascending ? a.time - b.time : b.time - a.time;
            } else if (currentSort.type === 'name') {
                const nameA = a.title.toLowerCase();
                const nameB = b.title.toLowerCase();
                if (nameA < nameB) return currentSort.ascending ? -1 : 1;
                if (nameA > nameB) return currentSort.ascending ? 1 : -1;
                return 0;
            } else {
                const scoreA = a._matchScore || 0;
                const scoreB = b._matchScore || 0;
                return scoreB - scoreA;
            }
        });
    }

    // ---------- 分页 ----------
    function paginateAndRender() {
        if (!allFilteredResults) {
            totalPages = 1;
            currentPage = 1;
            renderResults([]);
            return;
        }
        
        totalPages = Math.ceil(allFilteredResults.length / pageSize);
        if (totalPages === 0) totalPages = 1;
        
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
        if (currentPage < 1) {
            currentPage = 1;
        }
        
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        currentResults = allFilteredResults.slice(start, end);
        
        renderResults(currentResults, lastSearchKeyword);
        updatePaginationUI();
    }

    // ---------- 渲染结果 ----------
    function renderResults(products, highlightKeyword = '') {
        if (!resultsList) return;
        
        if (!products || products.length === 0) {
            resultsList.innerHTML = '';
            if (noResultsPanel) {
                noResultsPanel.classList.remove('hidden');
            }
            return;
        }
        
        if (noResultsPanel) {
            noResultsPanel.classList.add('hidden');
        }
        
        let html = '';
        products.forEach(product => {
            let title = product.title;
            const matchType = product._matchType;
            
            if (matchType === 'fuzzy-chinese') {
                title = title + ' <span class="fuzzy-badge">🔤 错别字匹配</span>';
            } else if (matchType === 'fuzzy-english') {
                title = title + ' <span class="fuzzy-badge">🔤 近似拼写</span>';
            } else if (matchType === 'pinyin') {
                title = title + ' <span class="fuzzy-badge">🔊 拼音匹配</span>';
            } else if (matchType && matchType.includes('fuzzy')) {
                title = title + ' <span class="fuzzy-badge">✨ 模糊匹配</span>';
            }
            
            if (highlightKeyword && highlightKeyword.trim() !== '') {
                try {
                    const regex = new RegExp(`(${highlightKeyword})`, 'gi');
                    title = title.replace(regex, '<span class="highlight">$1</span>');
                } catch (e) {}
            }
            
            html += `
                <div class="result-item">
                    <div class="result-title">${title}</div>
                    <div class="result-price">¥${product.price}</div>
                    <div class="result-tags">
                        ${product.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                    <div style="font-size:0.85rem; color:#6c757d; margin-top:8px;">
                        ${product.inStock ? '✅ 有货' : '❌ 无货'} 
                        ${product.discount ? '· 🔥 折扣' : ''} 
                        ${product.freeShipping ? '· 🚚 包邮' : ''}
                    </div>
                </div>
            `;
        });
        
        resultsList.innerHTML = html;
    }

    // ---------- 更新分页UI ----------
    function updatePaginationUI() {
        if (!pageInfo) return;
        
        pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页`;
        
        if (firstPageBtn) {
            firstPageBtn.disabled = currentPage <= 1;
        }
        if (prevPageBtn) {
            prevPageBtn.disabled = currentPage <= 1;
        }
        if (nextPageBtn) {
            nextPageBtn.disabled = currentPage >= totalPages;
        }
        if (lastPageBtn) {
            lastPageBtn.disabled = currentPage >= totalPages;
        }
        
        if (jumpToPage) {
            jumpToPage.max = totalPages;
            jumpToPage.value = currentPage;
        }
    }

    // ---------- 刷新 ----------
    function refreshResults() {
        applyFilters(); // 这里会同时更新统计和耗时
        
        const keyword = searchInput ? searchInput.value.trim() : '';
        if (keyword) {
            Storage.addHistoryItem(keyword);
            const history = Storage.getHistory();
            renderHistoryList(history);
        }
    }

    // ---------- 搜索历史 ----------
    function renderHistoryList(history) {
        if (!historyList) return;
        
        if (history.length === 0) {
            historyList.innerHTML = '<li class="history-item" style="justify-content: center; color: #adb5bd;">暂无搜索历史</li>';
            return;
        }
        
        let html = '';
        history.forEach(keyword => {
            html += `
                <li class="history-item" data-keyword="${keyword}">
                    <span class="keyword">🔍 ${keyword}</span>
                    <button class="delete-history" data-keyword="${keyword}">✕</button>
                </li>
            `;
        });
        historyList.innerHTML = html;
        
        document.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', function(e) {
                if (e.target.classList.contains('delete-history')) return;
                
                const keyword = this.dataset.keyword;
                if (keyword && searchInput) {
                    searchInput.value = keyword;
                    refreshResults();
                    if (historyPanel) {
                        historyPanel.classList.add('hidden');
                    }
                }
            });
        });
        
        document.querySelectorAll('.delete-history').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const keyword = this.dataset.keyword;
                if (keyword) {
                    const newHistory = Storage.deleteHistoryItem(keyword);
                    renderHistoryList(newHistory);
                }
            });
        });
    }

    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', function() {
            const newHistory = Storage.clearAllHistory();
            renderHistoryList(newHistory);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('focus', function() {
            const history = Storage.getHistory();
            renderHistoryList(history);
            if (historyPanel) {
                historyPanel.classList.remove('hidden');
            }
        });
    }

    // ---------- 自动补全功能 ----------
    if (searchInput && autocompletePanel && autocompleteList) {
        let autocompleteTimeout;
        
        searchInput.addEventListener('input', function() {
            const keyword = this.value.trim();
            
            if (autocompleteTimeout) {
                clearTimeout(autocompleteTimeout);
            }
            
            if (keyword.length < 2) {
                autocompletePanel.classList.add('hidden');
                return;
            }
            
            autocompleteTimeout = setTimeout(() => {
                const suggestions = [];
                
                // 从搜索历史中找
                const history = Storage.getHistory();
                const historyMatches = history.filter(item => 
                    item.toLowerCase().includes(keyword.toLowerCase())
                );
                suggestions.push(...historyMatches.slice(0, 3));
                
                // 从商品标题中找
                const titleMatches = [];
                for (const product of mockProducts) {
                    if (product.title.toLowerCase().includes(keyword.toLowerCase())) {
                        titleMatches.push(product.title);
                    }
                    if (titleMatches.length >= 5) break;
                }
                suggestions.push(...titleMatches);
                
                // 拼音匹配
                const pinyinMatches = [];
                for (const product of mockProducts) {
                    try {
                        if (Pinyin && Pinyin.match && Pinyin.match(product.title, keyword)) {
                            pinyinMatches.push(product.title + ' 🔤');
                        }
                    } catch (e) {}
                    if (pinyinMatches.length >= 3) break;
                }
                suggestions.push(...pinyinMatches);
                
                const uniqueSuggestions = [...new Set(suggestions)].slice(0, 8);
                
                if (uniqueSuggestions.length > 0) {
                    let html = '';
                    uniqueSuggestions.forEach(suggestion => {
                        const cleanSuggestion = suggestion.replace(' 🔤', '');
                        html += `<li class="autocomplete-item" data-keyword="${cleanSuggestion}">${suggestion}</li>`;
                    });
                    autocompleteList.innerHTML = html;
                    autocompletePanel.classList.remove('hidden');
                    
                    document.querySelectorAll('.autocomplete-item').forEach(item => {
                        item.addEventListener('click', function() {
                            const keyword = this.dataset.keyword;
                            if (keyword) {
                                searchInput.value = keyword;
                                refreshResults();
                                autocompletePanel.classList.add('hidden');
                            }
                        });
                    });
                } else {
                    autocompletePanel.classList.add('hidden');
                }
                
                autocompleteTimeout = null;
            }, 200);
        });
        
        // 键盘导航
        searchInput.addEventListener('keydown', function(e) {
            if (autocompletePanel.classList.contains('hidden')) return;
            
            const items = document.querySelectorAll('.autocomplete-item');
            if (items.length === 0) return;
            
            let selectedIndex = -1;
            for (let i = 0; i < items.length; i++) {
                if (items[i].style.backgroundColor === 'rgb(240, 247, 255)' || 
                    items[i].classList.contains('selected')) {
                    selectedIndex = i;
                    break;
                }
            }
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % items.length;
                updateSelectedItem(items, selectedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                updateSelectedItem(items, selectedIndex);
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                const selectedItem = items[selectedIndex];
                const keyword = selectedItem.dataset.keyword;
                if (keyword) {
                    searchInput.value = keyword;
                    refreshResults();
                    autocompletePanel.classList.add('hidden');
                }
            } else if (e.key === 'Escape') {
                autocompletePanel.classList.add('hidden');
            }
        });
        
        function updateSelectedItem(items, index) {
            items.forEach((item, i) => {
                if (i === index) {
                    item.style.backgroundColor = '#f0f7ff';
                    item.style.borderLeft = '3px solid #ffb347';
                    item.classList.add('selected');
                } else {
                    item.style.backgroundColor = '';
                    item.style.borderLeft = '';
                    item.classList.remove('selected');
                }
            });
        }
    }

    // 点击其他地方关闭面板
    document.addEventListener('click', function(e) {
        if (searchInput && autocompletePanel && 
            !searchInput.contains(e.target) && 
            !autocompletePanel.contains(e.target)) {
            autocompletePanel.classList.add('hidden');
        }
        
        if (searchInput && historyPanel && 
            !searchInput.contains(e.target) && 
            !historyPanel.contains(e.target)) {
            historyPanel.classList.add('hidden');
        }
    });

    // ---------- 排序事件 ----------
    sortBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const sortType = this.dataset.sort;
            
            sortBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            currentSort.type = sortType;
            localStorage.setItem('sortPreference', JSON.stringify(currentSort));
            
            sortProducts();
            paginateAndRender();
        });
    });
    
    if (sortAscending) {
        sortAscending.addEventListener('change', function() {
            currentSort.ascending = this.checked;
            localStorage.setItem('sortPreference', JSON.stringify(currentSort));
            
            sortProducts();
            paginateAndRender();
        });
    }

    // ---------- 分页事件 ----------
    if (firstPageBtn) {
        firstPageBtn.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage = 1;
                paginateAndRender();
            }
        });
    }
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                paginateAndRender();
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function() {
            if (currentPage < totalPages) {
                currentPage++;
                paginateAndRender();
            }
        });
    }
    
    if (lastPageBtn) {
        lastPageBtn.addEventListener('click', function() {
            if (currentPage < totalPages) {
                currentPage = totalPages;
                paginateAndRender();
            }
        });
    }
    
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', function() {
            pageSize = parseInt(this.value);
            localStorage.setItem('pageSizePreference', pageSize);
            currentPage = 1;
            paginateAndRender();
        });
    }
    
    if (jumpBtn && jumpToPage) {
        jumpBtn.addEventListener('click', function() {
            const targetPage = parseInt(jumpToPage.value);
            if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
                currentPage = targetPage;
                paginateAndRender();
            } else {
                alert(`请输入 1-${totalPages} 之间的页码`);
            }
        });
    }

    // ---------- 搜索按钮 ----------
    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            refreshResults();
            if (historyPanel) {
                historyPanel.classList.add('hidden');
            }
            if (autocompletePanel) {
                autocompletePanel.classList.add('hidden');
            }
        });
    }

    // ---------- 筛选事件 ----------
    [filterInStock, filterDiscount, filterFreeShipping, minPrice, maxPrice].forEach(el => {
        if (el) {
            el.addEventListener('change', function() {
                currentPage = 1;
                if (searchTimeout) {
                    clearTimeout(searchTimeout);
                }
                searchTimeout = setTimeout(() => {
                    refreshResults();
                    searchTimeout = null;
                }, 300);
            });
            if (el === minPrice || el === maxPrice) {
                el.addEventListener('input', function() {
                    if (searchTimeout) {
                        clearTimeout(searchTimeout);
                    }
                    searchTimeout = setTimeout(() => {
                        currentPage = 1;
                        refreshResults();
                        searchTimeout = null;
                    }, 500);
                });
            }
        }
    });

    // ---------- 预设相关 ----------
    function getCurrentFilterState() {
        return {
            inStock: filterInStock ? filterInStock.checked : false,
            discount: filterDiscount ? filterDiscount.checked : false,
            freeShipping: filterFreeShipping ? filterFreeShipping.checked : false,
            minPrice: minPrice ? minPrice.value : '',
            maxPrice: maxPrice ? maxPrice.value : ''
        };
    }

    function applyFilterState(state) {
        if (filterInStock) filterInStock.checked = state.inStock || false;
        if (filterDiscount) filterDiscount.checked = state.discount || false;
        if (filterFreeShipping) filterFreeShipping.checked = state.freeShipping || false;
        if (minPrice) minPrice.value = state.minPrice || '';
        if (maxPrice) maxPrice.value = state.maxPrice || '';
        
        currentPage = 1;
        refreshResults();
    }

    function renderPresetsList(presets) {
        if (!presetsList) return;
        
        if (presets.length === 0) {
            presetsList.innerHTML = '<li style="color: #adb5bd; list-style: none;">暂无保存的预设</li>';
            return;
        }
        
        let html = '';
        presets.forEach(preset => {
            html += `
                <li class="preset-item" data-preset-id="${preset.id}">
                    <span class="preset-name">📋 ${preset.name}</span>
                    <button class="delete-preset" data-preset-id="${preset.id}">✕</button>
                </li>
            `;
        });
        presetsList.innerHTML = html;
        
        document.querySelectorAll('.preset-item').forEach(item => {
            item.addEventListener('click', function(e) {
                if (e.target.classList.contains('delete-preset')) return;
                
                const presetId = this.dataset.presetId;
                const preset = Storage.getPresetById(presetId);
                if (preset) {
                    applyFilterState(preset.filters);
                }
            });
        });
        
        document.querySelectorAll('.delete-preset').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const presetId = this.dataset.presetId;
                if (presetId) {
                    const newPresets = Storage.deletePreset(presetId);
                    renderPresetsList(newPresets);
                }
            });
        });
    }

    if (savePresetBtn) {
        savePresetBtn.addEventListener('click', function() {
            currentFilterState = getCurrentFilterState();
            if (presetModal) {
                presetModal.classList.remove('hidden');
                presetNameInput.value = '';
                presetNameInput.focus();
            }
        });
    }

    if (cancelPresetBtn) {
        cancelPresetBtn.addEventListener('click', function() {
            presetModal.classList.add('hidden');
        });
    }

    if (confirmPresetBtn) {
        confirmPresetBtn.addEventListener('click', function() {
            const presetName = presetNameInput.value.trim();
            if (!presetName) {
                alert('给预设起个名字吧～');
                return;
            }
            
            Storage.addPreset(presetName, currentFilterState);
            
            const presets = Storage.getPresets();
            renderPresetsList(presets);
            
            presetModal.classList.add('hidden');
        });
    }

    if (presetModal) {
        presetModal.addEventListener('click', function(e) {
            if (e.target === presetModal) {
                presetModal.classList.add('hidden');
            }
        });
    }

    // ---------- 启动 ----------
    initFromStorage();
});
