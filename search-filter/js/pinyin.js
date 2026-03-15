// ============================================
// pinyin.js - 拼音搜索引擎
// 支持全拼、首字母、中英文混合搜索
// ============================================

const Pinyin = {
    // 常用汉字拼音映射表（简化版，覆盖常用字）
    map: {
        '苹': 'ping',
        '果': 'guo',
        '糖': 'tang',
        '星': 'xing',
        '云': 'yun',
        '甜': 'tian',
        '蜜': 'mi',
        '笔': 'bi',
        '记': 'ji',
        '本': 'ben',
        '空': 'kong',
        '投': 'tou',
        '影': 'ying',
        '灯': 'deng',
        '奶': 'nai',
        '瓶': 'ping',
        '守': 'shou',
        '护': 'hu',
        '挂': 'gua',
        '件': 'jian',
        '搜': 'sou',
        '索': 'suo',
        '历': 'li',
        '史': 'shi',
        '纪': 'ji',
        '念': 'nian',
        '贴': 'tie',
        '纸': 'zhi',
        '实': 'shi',
        '时': 'shi',
        '高': 'gao',
        '亮': 'liang',
        '荧': 'ying',
        '光': 'guang',
        '筛': 'shai',
        '选': 'xuan',
        '预': 'yu',
        '设': 'she',
        '快': 'kuai',
        '捷': 'jie',
        '按': 'an',
        '钮': 'niu',
        '钥': 'yue',
        '匙': 'chi',
        '扣': 'kou',
        '觉': 'jue',
        '醒': 'xing',
        '徽': 'hui',
        '章': 'zhang',
        '光': 'guang',
        '湖': 'hu',
        '纪': 'ji',
        '元': 'yuan',
        '霜': 'shuang',
        '砚': 'yan',
        '执': 'zhi',
        '行': 'xing',
        '手': 'shou',
        '册': 'ce',
        '书': 'shu',
        '籍': 'ji',
        '技': 'ji',
        '术': 'shu',
        '文': 'wen',
        '具': 'ju',
        '限': 'xian',
        '量': 'liang',
        '家': 'jia',
        '居': 'ju',
        '氛': 'fen',
        '围': 'wei',
        '周': 'zhou',
        '边': 'bian',
        '可': 'ke',
        '爱': 'ai',
        '收': 'shou',
        '藏': 'cang',
        '实': 'shi',
        '用': 'yong'
    },
    
    // 将中文文本转换为拼音（空格分隔）
    toPinyin: function(text) {
        if (!text) return '';
        
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            // 如果是英文字母或数字，保留原样
            if (/[a-zA-Z0-9]/.test(char)) {
                result += char.toLowerCase();
            } else {
                // 如果是中文，尝试转换拼音
                const pinyin = this.map[char];
                if (pinyin) {
                    result += pinyin;
                } else {
                    // 未收录的中文，保留原字符（小写）
                    result += char.toLowerCase();
                }
            }
        }
        return result;
    },
    
    // 获取首字母缩写
    getInitials: function(text) {
        if (!text) return '';
        
        let initials = '';
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (/[a-zA-Z]/.test(char)) {
                initials += char.toLowerCase();
            } else {
                const pinyin = this.map[char];
                if (pinyin) {
                    initials += pinyin[0];
                }
            }
        }
        return initials;
    },
    
    // 检查文本是否匹配拼音搜索
    match: function(text, keyword) {
        if (!text || !keyword) return false;
        
        const lowerText = text.toLowerCase();
        const lowerKeyword = keyword.toLowerCase().trim();
        
        // 直接包含关键词
        if (lowerText.includes(lowerKeyword)) {
            return true;
        }
        
        // 转换为拼音
        const pinyin = this.toPinyin(text);
        if (pinyin.includes(lowerKeyword)) {
            return true;
        }
        
        // 检查首字母
        const initials = this.getInitials(text);
        if (initials.includes(lowerKeyword)) {
            return true;
        }
        
        // 分词匹配（空格分隔的关键词）
        const keywords = lowerKeyword.split(/\s+/);
        if (keywords.length > 1) {
            // 检查每个词是否匹配拼音或原文
            return keywords.every(k => 
                lowerText.includes(k) || 
                pinyin.includes(k) || 
                initials.includes(k)
            );
        }
        
        return false;
    },
    
    // 拼音搜索：返回匹配项及匹配类型
    search: function(items, keyword, options = {}) {
        const {
            key = 'title',
            maxResults = 20
        } = options;
        
        if (!keyword || !items || items.length === 0) {
            return [];
        }
        
        const lowerKeyword = keyword.toLowerCase().trim();
        if (lowerKeyword === '') return [];
        
        const results = [];
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const text = typeof item === 'string' ? item : (item[key] || '');
            
            // 直接匹配原文
            if (text.toLowerCase().includes(lowerKeyword)) {
                results.push({
                    item: item,
                    matchType: 'direct',
                    score: 1.0
                });
                continue;
            }
            
            // 拼音匹配
            const pinyin = this.toPinyin(text);
            if (pinyin.includes(lowerKeyword)) {
                results.push({
                    item: item,
                    matchType: 'pinyin',
                    score: 0.95
                });
                continue;
            }
            
            // 首字母匹配
            const initials = this.getInitials(text);
            if (initials.includes(lowerKeyword)) {
                results.push({
                    item: item,
                    matchType: 'initials',
                    score: 0.9
                });
                continue;
            }
        }
        
        // 按匹配度排序
        results.sort((a, b) => b.score - a.score);
        
        return results.slice(0, maxResults);
    }
};

// 导出
window.HoloLake = window.HoloLake || {};
window.HoloLake.Pinyin = Pinyin;
