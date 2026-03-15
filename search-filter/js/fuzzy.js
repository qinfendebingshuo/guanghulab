// ============================================
// fuzzy.js - 模糊匹配引擎 (Levenshtein距离)
// 让搜索能理解错别字、近似词
// ============================================

const Fuzzy = {
    // 计算两个字符串的编辑距离
    levenshtein: function(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        
        const matrix = [];
        
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i - 1][j] + 1,
                        matrix[i][j - 1] + 1
                    );
                }
            }
        }
        
        return matrix[b.length][a.length];
    },
    
    // 计算相似度
    similarity: function(str1, str2) {
        if (!str1 || !str2) return 0;
        
        const s1 = String(str1).toLowerCase();
        const s2 = String(str2).toLowerCase();
        
        if (s1 === s2) return 1;
        
        const distance = this.levenshtein(s1, s2);
        const maxLength = Math.max(s1.length, s2.length);
        
        if (maxLength === 0) return 1;
        
        // 相似度 = 1 - (距离 / 最大长度)
        return 1 - (distance / maxLength);
    },
    
    // 模糊搜索
    search: function(items, keyword, options = {}) {
        const {
            threshold = 0.5,           // 调低到0.5，更容易匹配
            key = 'title',
            includeScore = true,
            maxResults = 20
        } = options;
        
        if (!keyword || !items || items.length === 0) {
            return [];
        }
        
        const lowerKeyword = String(keyword).toLowerCase().trim();
        const results = [];
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const text = typeof item === 'string' ? item : (item[key] || '');
            const lowerText = String(text).toLowerCase();
            
            // 1. 精确包含
            if (lowerText.includes(lowerKeyword)) {
                results.push({
                    item: item,
                    score: 1.0,
                    matchType: 'exact'
                });
                continue;
            }
            
            // 2. 单词拆分匹配
            const words = lowerText.split(/[\s\-·]+/);
            let bestWordScore = 0;
            for (const word of words) {
                if (word.length > 1) {
                    const sim = this.similarity(word, lowerKeyword);
                    if (sim > bestWordScore) {
                        bestWordScore = sim;
                    }
                }
            }
            
            if (bestWordScore >= threshold) {
                results.push({
                    item: item,
                    score: bestWordScore,
                    matchType: 'fuzzy-word'
                });
                continue;
            }
            
            // 3. 整体模糊匹配
            const sim = this.similarity(lowerText, lowerKeyword);
            
            if (sim >= threshold) {
                results.push({
                    item: item,
                    score: sim,
                    matchType: 'fuzzy'
                });
            }
        }
        
        results.sort((a, b) => b.score - a.score);
        
        const limited = results.slice(0, maxResults);
        
        if (includeScore) {
            return limited;
        } else {
            return limited.map(r => r.item);
        }
    }
};

// 导出
window.HoloLake = window.HoloLake || {};
window.HoloLake.Fuzzy = Fuzzy;
