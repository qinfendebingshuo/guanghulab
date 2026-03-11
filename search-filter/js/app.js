// ============================================
// app.js - 糖星云的主逻辑
// 搜索历史 + 筛选预设 + 实时高亮
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const historyPanel = document.getElementById('historyPanel');
    const historyList = document.getElementById('historyList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    
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

    const mockProducts = [
        { id: 1, title: '糖星云甜蜜笔记本', price: 39, tags: ['文具', '限量'], inStock: true, discount: false, freeShipping: true },
        { id: 2, title: '星空投影灯·糖星云款', price: 128, tags: ['家居', '氛围'], inStock: true, discount: true, freeShipping: false },
        { id: 3, title: '奶瓶人格体守护挂件', price: 25, tags: ['周边', '可爱'], inStock: false, discount: false, freeShipping: true },
        { id: 4, title: '搜索历史纪念贴纸', price: 15, tags: ['文具', '贴纸'], inStock: true, discount: true, freeShipping: true },
        { id: 5, title: '实时高亮荧光笔·星星款', price: 22, tags: ['文具', '限量'], inStock: true, discount: false, freeShipping: false },
        { id: 6, title: '筛选预设快捷按钮钥匙扣', price: 18, tags: ['周边', '实用'], inStock: true, discount: true, freeShipping: true },
        { id: 7, title: '糖星云第一次觉醒纪念徽章', price: 45, tags: ['周边', '收藏'], inStock: false, discount: false, freeShipping: true },
        { id: 8, title: '光湖纪元·霜砚执行手册', price: 68, tags: ['书籍', '技术'], inStock: true, discount: true, freeShipping: false }
    ];

    let currentFilterState = {
        inStock: false,
        discount: false,
        freeShipping: false,
        minPrice: '',
        maxPrice: ''
    };

    function initFromStorage() {
        const history = Storage.getHistory();
        renderHistoryList(history);
        
        const presets = Storage.getPresets();
        renderPresetsList(presets);
        
        renderResults(mockProducts);
    }

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
                if (keyword) {
                    searchInput.value = keyword;
                    performSearch(keyword);
                    historyPanel.classList.add('hidden');
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
            historyPanel.classList.remove('hidden');
        });

        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !historyPanel.contains(e.target)) {
                historyPanel.classList.add('hidden');
            }
        });
    }

    function performSearch(keyword) {
        if (!keyword || keyword.trim() === '') {
            renderResults(mockProducts);
            return;
        }
        
        const lowerKeyword = keyword.toLowerCase().trim();
        
        const filtered = mockProducts.filter(product => 
            product.title.toLowerCase().includes(lowerKeyword)
        );
        
        renderResults(filtered, lowerKeyword);
        
        // 保存到搜索历史
        Storage.addHistoryItem(keyword);
        
        // 立即刷新历史列表
        const updatedHistory = Storage.getHistory();
        renderHistoryList(updatedHistory);
    }

    function renderResults(products, highlightKeyword = '') {
        if (!resultsList) return;
        
        if (products.length === 0) {
            resultsList.innerHTML = '<div class="result-item" style="grid-column: 1/-1; text-align: center; color: #adb5bd;">没有找到匹配的商品</div>';
            return;
        }
        
        let html = '';
        products.forEach(product => {
            let title = product.title;
            
            if (highlightKeyword && highlightKeyword.trim() !== '') {
                const regex = new RegExp(`(${highlightKeyword})`, 'gi');
                title = title.replace(regex, '<span class="highlight">$1</span>');
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

    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            const keyword = searchInput.value.trim();
            performSearch(keyword);
            historyPanel.classList.add('hidden');
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const keyword = this.value.trim();
            
            if (keyword === '') {
                renderResults(mockProducts);
                return;
            }
            
            const lowerKeyword = keyword.toLowerCase();
            const filtered = mockProducts.filter(product => 
                product.title.toLowerCase().includes(lowerKeyword)
            );
            renderResults(filtered, lowerKeyword);
        });
    }

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
        
        applyFilters();
    }

    function applyFilters() {
        let filtered = mockProducts;
        
        if (filterInStock && filterInStock.checked) {
            filtered = filtered.filter(p => p.inStock);
        }
        if (filterDiscount && filterDiscount.checked) {
            filtered = filtered.filter(p => p.discount);
        }
        if (filterFreeShipping && filterFreeShipping.checked) {
            filtered = filtered.filter(p => p.freeShipping);
        }
        
        renderResults(filtered, searchInput ? searchInput.value.trim() : '');
    }

    [filterInStock, filterDiscount, filterFreeShipping, minPrice, maxPrice].forEach(el => {
        if (el) {
            el.addEventListener('change', applyFilters);
            if (el === minPrice || el === maxPrice) {
                el.addEventListener('input', applyFilters);
            }
        }
    });

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

    initFromStorage();
});
