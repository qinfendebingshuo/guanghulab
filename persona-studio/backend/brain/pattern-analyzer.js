/**
 * persona-studio · 模式识别引擎
 *
 * 触发：每完成一个项目 + 每日凌晨聚合
 * 功能：从已完成项目中识别高频模式，建立模式库
 */
const fs = require('fs');
const path = require('path');

const BRAIN_DIR = path.join(__dirname, '..', '..', 'brain');
const PATTERN_PATH = path.join(BRAIN_DIR, 'pattern-library.json');
const MEMORY_DIR = path.join(BRAIN_DIR, 'memory');

/**
 * 加载模式库
 */
function loadPatternLibrary() {
  try {
    return JSON.parse(fs.readFileSync(PATTERN_PATH, 'utf-8'));
  } catch {
    return {
      schema_version: '1.0',
      description: '系统模式库 · 自动识别',
      last_updated: null,
      total_patterns: 0,
      patterns: []
    };
  }
}

/**
 * 保存模式库
 */
function savePatternLibrary(lib) {
  lib.last_updated = new Date().toISOString();
  lib.total_patterns = lib.patterns.length;
  fs.writeFileSync(PATTERN_PATH, JSON.stringify(lib, null, 2), 'utf-8');
}

/**
 * 从项目中检测模式类型
 */
function detectPatternType(conversation, projectFiles) {
  const allText = (conversation || [])
    .map(function (m) { return m.content || ''; })
    .join('\n')
    .toLowerCase();

  const patterns = [];

  const patternDefs = [
    { name: '个人博客', keywords: ['博客', 'blog', '文章', '发布', '个人主页'] },
    { name: '登录注册', keywords: ['登录', '注册', 'login', 'register', '用户认证', '用户系统'] },
    { name: '管理后台', keywords: ['管理', '后台', 'dashboard', '管理面板', 'admin'] },
    { name: '电商页面', keywords: ['商城', '购物', '商品', '购买', '电商', 'shop'] },
    { name: '展示页面', keywords: ['展示', '介绍', '落地页', 'landing', '产品页'] },
    { name: '数据表格', keywords: ['表格', '数据', '列表', '筛选', 'table', '搜索'] },
    { name: '表单系统', keywords: ['表单', '提交', '验证', 'form', '输入'] },
    { name: '聊天应用', keywords: ['聊天', 'chat', '即时通讯', '消息', '对话'] },
    { name: '小工具', keywords: ['工具', '计算器', '转换器', '生成器', 'tool', 'utility'] },
    { name: 'API服务', keywords: ['api', '接口', '后端服务', 'restful', 'server'] }
  ];

  patternDefs.forEach(function (def) {
    const matchCount = def.keywords.filter(function (kw) {
      return allText.includes(kw);
    }).length;

    if (matchCount >= 2) {
      patterns.push(def.name);
    }
  });

  return patterns.length > 0 ? patterns : ['通用项目'];
}

/**
 * 检测技术栈
 */
function detectTechStack(conversation, projectFiles) {
  const allText = (conversation || [])
    .map(function (m) { return m.content || ''; })
    .join('\n')
    .toLowerCase();

  const stack = [];
  const techMap = {
    'HTML/CSS/JS': ['html', 'css', 'javascript'],
    'React': ['react', 'jsx', 'tsx'],
    'Vue': ['vue', 'vuex'],
    'Node.js': ['node', 'express', 'koa'],
    'Python': ['python', 'flask', 'django'],
    'TypeScript': ['typescript', 'ts'],
    'Tailwind': ['tailwind'],
    'Bootstrap': ['bootstrap']
  };

  for (const [tech, keywords] of Object.entries(techMap)) {
    if (keywords.some(function (kw) { return allText.includes(kw); })) {
      stack.push(tech);
    }
  }

  // 从文件扩展名推断
  if (projectFiles && projectFiles.length > 0) {
    const exts = projectFiles.map(function (f) {
      return path.extname(f).toLowerCase();
    });

    if (exts.includes('.html')) stack.push('HTML/CSS/JS');
    if (exts.includes('.jsx') || exts.includes('.tsx')) stack.push('React');
    if (exts.includes('.vue')) stack.push('Vue');
    if (exts.includes('.py')) stack.push('Python');
  }

  return [...new Set(stack)];
}

/**
 * 核心方法：分析项目并更新模式库
 * @param {string} devId - 开发者编号
 * @param {Array} conversation - 对话历史
 * @param {Array} projectFiles - 项目文件列表
 * @param {number} buildTimeMs - 构建耗时（毫秒）
 * @param {boolean} success - 是否成功
 */
function analyzeAndUpdatePatterns(devId, conversation, projectFiles, buildTimeMs, success) {
  const lib = loadPatternLibrary();
  const patternNames = detectPatternType(conversation, projectFiles);
  const techStack = detectTechStack(conversation, projectFiles);

  patternNames.forEach(function (patternName) {
    // 查找已有模式
    const existing = lib.patterns.find(function (p) { return p.name === patternName; });

    if (existing) {
      // 更新已有模式
      existing.frequency = (existing.frequency || 0) + 1;
      existing.common_tech_stack = mergeArrays(existing.common_tech_stack, techStack);
      if (buildTimeMs) {
        existing.avg_build_time = existing.avg_build_time
          ? Math.round((existing.avg_build_time + buildTimeMs) / 2)
          : buildTimeMs;
      }
      if (success !== undefined) {
        const totalAttempts = existing.frequency;
        const prevSuccesses = Math.round((existing.success_rate || 100) / 100 * (totalAttempts - 1));
        existing.success_rate = Math.round((prevSuccesses + (success ? 1 : 0)) / totalAttempts * 100);
      }
      existing.last_seen = new Date().toISOString();
    } else {
      // 添加新模式
      lib.patterns.push({
        name: patternName,
        frequency: 1,
        common_features: [],
        common_tech_stack: techStack,
        avg_build_time: buildTimeMs || null,
        success_rate: success !== false ? 100 : 0,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString()
      });
    }
  });

  savePatternLibrary(lib);
  return patternNames;
}

/**
 * 查询模式库（供 persona-engine 调用）
 * @param {string} query - 搜索关键词
 * @returns {Array} 匹配的模式
 */
function queryPatterns(query) {
  const lib = loadPatternLibrary();
  if (!query || lib.patterns.length === 0) return [];

  const lower = query.toLowerCase();

  return lib.patterns
    .filter(function (p) {
      return p.name.toLowerCase().includes(lower) ||
        (p.common_tech_stack || []).some(function (t) { return t.toLowerCase().includes(lower); });
    })
    .sort(function (a, b) { return (b.frequency || 0) - (a.frequency || 0); });
}

/**
 * 工具：合并去重数组
 */
function mergeArrays(arr1, arr2) {
  return [...new Set((arr1 || []).concat(arr2 || []))];
}

module.exports = {
  analyzeAndUpdatePatterns,
  queryPatterns,
  loadPatternLibrary,
  detectPatternType,
  detectTechStack
};
