// channel-enhancements.js - 频道搜索、面包屑、快捷键增强功能（修复版）
(function() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        addStyles();
        createSearchBox();
        createBreadcrumb();
        createShortcutHint();
        initShortcuts();
        initSearch();
        window.addEventListener('hashchange', updateBreadcrumb);
        updateBreadcrumb();
    }

    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .channel-search-container {
                padding: 16px 20px;
                background: #f8f9fa;
                border-bottom: 1px solid #e9ecef;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .channel-search-input {
                flex: 1;
                padding: 10px 16px;
                border: 1px solid #ced4da;
                border-radius: 24px;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s;
            }
            .channel-search-input:focus {
                border-color: #4d6bfe;
                box-shadow: 0 0 0 3px rgba(77,107,254,0.1);
            }
            .channel-search-clear {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #6c757d;
                padding: 0 8px;
                display: none;
            }
            .channel-search-clear:hover {
                color: #212529;
            }
            .channel-search-input:not(:placeholder-shown) + .channel-search-clear {
                display: inline-block;
            }
            .highlight {
                background-color: #ffeb3b;
                padding: 2px 0;
                border-radius: 2px;
            }
            .no-results {
                text-align: center;
                padding: 40px;
                color: #6c757d;
                font-style: italic;
            }
            .channel-breadcrumb {
                padding: 12px 20px;
                background: white;
                border-bottom: 1px solid #e9ecef;
                font-size: 14px;
            }
            .channel-breadcrumb a {
                color: #4d6bfe;
                text-decoration: none;
            }
            .channel-breadcrumb a:hover {
                text-decoration: underline;
            }
            .channel-breadcrumb span {
                color: #6c757d;
            }
            .channel-breadcrumb .current {
                color: #212529;
                font-weight: 500;
            }
            .shortcut-hint {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(0,0,0,0.7);
                color: white;
                padding: 8px 16px;
                border-radius: 30px;
                font-size: 12px;
                backdrop-filter: blur(4px);
                z-index: 1000;
            }
            .shortcut-hint kbd {
                background: rgba(255,255,255,0.2);
                padding: 2px 6px;
                border-radius: 4px;
                margin: 0 2px;
            }
            .module-card.selected {
                outline: 2px solid #4d6bfe;
                outline-offset: 2px;
                transform: scale(1.02);
                transition: all 0.2s;
            }
        `;
        document.head.appendChild(style);
    }

    function createSearchBox() {
        const container = document.querySelector('.module-grid') || document.querySelector('#module-list') || document.querySelector('.channel-content');
        if (!container) return;

        const searchContainer = document.createElement('div');
        searchContainer.className = 'channel-search-container';
        searchContainer.innerHTML = `
            <input type="text" class="channel-search-input" placeholder="搜索模块...">
            <button class="channel-search-clear">&times;</button>
        `;
        container.parentNode.insertBefore(searchContainer, container);

        const searchInput = searchContainer.querySelector('.channel-search-input');
        const clearBtn = searchContainer.querySelector('.channel-search-clear');

        searchInput.addEventListener('input', function() {
            filterModules(this.value);
        });

        clearBtn.addEventListener('click', function() {
            searchInput.value = '';
            filterModules('');
            searchInput.focus();
        });

        window.__channelSearchInput = searchInput;
    }

    function filterModules(keyword) {
        const cards = document.querySelectorAll('.module-card');
        const container = document.querySelector('.module-grid') || document.querySelector('#module-list');
        let hasResults = false;

        // 先移除所有高亮
        removeAllHighlights();

        cards.forEach(card => {
            const text = card.innerText || card.textContent;
            if (keyword === '') {
                card.style.display = '';
                hasResults = true;
            } else {
                const lowerText = text.toLowerCase();
                const lowerKeyword = keyword.toLowerCase();
                if (lowerText.includes(lowerKeyword)) {
                    card.style.display = '';
                    highlightText(card, keyword);
                    hasResults = true;
                } else {
                    card.style.display = 'none';
                }
            }
        });

        let noResultsEl = document.querySelector('.no-results');
        if (!hasResults && keyword !== '') {
            if (!noResultsEl) {
                noResultsEl = document.createElement('div');
                noResultsEl.className = 'no-results';
                noResultsEl.textContent = '没有找到匹配的模块';
                container.parentNode.insertBefore(noResultsEl, container.nextSibling);
            }
        } else {
            if (noResultsEl) noResultsEl.remove();
        }
    }

    // 移除所有高亮span，恢复原文本
    function removeAllHighlights() {
        document.querySelectorAll('.highlight').forEach(span => {
            const parent = span.parentNode;
            parent.replaceChild(document.createTextNode(span.textContent), span);
            parent.normalize(); // 合并相邻文本节点
        });
    }

    // 高亮匹配文本（不破坏事件监听）
    function highlightText(card, keyword) {
        const regex = new RegExp(`(${keyword})`, 'gi');
        const walk = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, {
            acceptNode: function(node) {
                // 跳过已经高亮过的span内部
                if (node.parentNode.classList && node.parentNode.classList.contains('highlight')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }, false);

        const textNodes = [];
        while (walk.nextNode()) textNodes.push(walk.currentNode);

        textNodes.forEach(node => {
            const text = node.nodeValue;
            if (regex.test(text)) {
                const span = document.createElement('span');
                span.className = 'highlight';
                span.innerHTML = text.replace(regex, '<span class="highlight">$1</span>');
                node.parentNode.replaceChild(span, node);
            }
        });
    }

    function createBreadcrumb() {
        const searchContainer = document.querySelector('.channel-search-container');
        const breadcrumb = document.createElement('div');
        breadcrumb.className = 'channel-breadcrumb';
        breadcrumb.id = 'channelBreadcrumb';
        if (searchContainer) {
            searchContainer.parentNode.insertBefore(breadcrumb, searchContainer.nextSibling);
        } else {
            const container = document.querySelector('.module-grid') || document.querySelector('#module-list');
            if (container) {
                container.parentNode.insertBefore(breadcrumb, container);
            }
        }
    }

    function updateBreadcrumb() {
        const breadcrumb = document.getElementById('channelBreadcrumb');
        if (!breadcrumb) return;
        const hash = window.location.hash.slice(1) || '';
        let moduleName = '频道';
        if (hash.startsWith('module-')) {
            const moduleId = hash.replace('module-', '');
            const moduleNames = {
                'M06': '工单管理',
                'M08': '数据看板',
                'M11': '用户反馈'
            };
            moduleName = moduleNames[moduleId] || moduleId;
        }
        breadcrumb.innerHTML = `
            <a href="#/">首页</a> &gt;
            <a href="#/channel">频道</a> &gt;
            <span class="current">${moduleName}</span>
        `;
    }

    function createShortcutHint() {
        const hint = document.createElement('div');
        hint.className = 'shortcut-hint';
        hint.innerHTML = `
            <kbd>⌘K</kbd> 搜索 ·
            <kbd>↑</kbd><kbd>↓</kbd> 选择 ·
            <kbd>Enter</kbd> 打开 ·
            <kbd>Esc</kbd> 关闭
        `;
        document.body.appendChild(hint);
    }

    function initShortcuts() {
        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = window.__channelSearchInput;
                if (searchInput) searchInput.focus();
            }
            if (e.key === 'Escape') {
                const searchInput = window.__channelSearchInput;
                if (searchInput && document.activeElement === searchInput) {
                    searchInput.value = '';
                    filterModules('');
                    searchInput.blur();
                } else if (searchInput && searchInput.value) {
                    searchInput.value = '';
                    filterModules('');
                }
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                const cards = Array.from(document.querySelectorAll('.module-card:not([style*="display: none"])'));
                if (cards.length === 0) return;
                e.preventDefault();
                let selectedIndex = cards.findIndex(card => card.classList.contains('selected'));
                if (selectedIndex === -1) {
                    selectedIndex = e.key === 'ArrowDown' ? 0 : cards.length - 1;
                } else {
                    cards[selectedIndex].classList.remove('selected');
                    if (e.key === 'ArrowDown') {
                        selectedIndex = (selectedIndex + 1) % cards.length;
                    } else {
                        selectedIndex = (selectedIndex - 1 + cards.length) % cards.length;
                    }
                }
                cards[selectedIndex].classList.add('selected');
                cards[selectedIndex].scrollIntoView({ block: 'nearest' });
            }
            if (e.key === 'Enter') {
                const selected = document.querySelector('.module-card.selected');
                if (selected) {
                    // 触发点击事件，模拟鼠标点击
                    selected.click();
                }
            }
        });
    }

    function initSearch() {
        // 不需要预先保存innerHTML了
    }
})();
